// The recipes page's own API (void-live-deploy/recipes/, lib/recipes.js): GET /api/recipes?q=<dish> -> { ok, recipes }, ?i=<ingredient,ingredient>
// -> { ok, list }, ?id=<number> -> { ok, recipes }: TheMealDB's free public catalogue (the v1 test key "1", no sign-up) read once and kept on
// the edge for an hour per question, so a page opens with its recipes at once and a burst of visitors (or the gate's several loads) asks TheMealDB
// once. The page asks TheMealDB itself when this does not answer, and its dozen built-in recipes need no network at all.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET. The most a caller can do is:
//   - (?c=<category> or ?a=<cuisine> -> { ok, list }: browsing, one name from TheMealDB's own closed lists in lib/recipes.js, nothing else)
//   - make Verse's server ask TheMealDB for one dish name or up to three ingredient names of letters, digits, spaces and a few marks, 60
//     characters in all, or one numeric id: the host and path are fixed here, the caller picks no host, path or header;
//   - spend TheMealDB's free allowance: a repeat inside an hour is answered from the edge cache, a miss costs one call per ingredient (at most
//     three) and the caller's own allowance of 20 misses a minute (rateLimited(), its own bucket) on top of the guard's per-connection limit;
//   - read recipes. No model, no token, no database, no write; a failure is never cached.
import { rateLimited } from './answer.js';
import { fromMeal, ingredientsOf, CATEGORIES, AREAS } from '../../lib/recipes.js';

export const RL_MAX = 20, TTL = 3600, HOST = 'https://www.themealdb.com/api/json/v1/1/';
const WORD = /^[\p{L}\p{M}\p{N}\s'’,&-]{1,60}$/u;
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });
/** what a request asks: { kind: 'q' | 'i' | 'id', value }, or null when it is not a plain dish, ingredient list or id. Pure. */
export function askIn(url) {
  const p = new URL(url).searchParams, id = String(p.get('id') || '').trim(), q = String(p.get('q') || '').replace(/\s+/g, ' ').trim(), i = String(p.get('i') || '').replace(/\s+/g, ' ').trim();
  if (id) return /^\d{1,8}$/.test(id) ? { kind: 'id', value: id } : null;
  // browsing a category or a cuisine: only a name from TheMealDB's own closed lists (lib/recipes.js CATEGORIES, AREAS)
  const c = String(p.get('c') || '').trim(), a = String(p.get('a') || '').trim();
  if (c) return CATEGORIES.includes(c) ? { kind: 'c', value: c } : null;
  if (a) return AREAS.includes(a) ? { kind: 'a', value: a } : null;
  if (i) { const list = WORD.test(i) ? ingredientsOf(i).slice(0, 3) : []; return list.length ? { kind: 'i', value: list.join(',') } : null; }
  if (q) return WORD.test(q) ? { kind: 'q', value: q } : null;
  return null;
}
/** TheMealDB's answer to one ask: { ok, recipes } for a dish or an id, { ok, list, all } for ingredients (the meals that use every one of them,
 *  or, when none does, the ones that use most), { ok: false, kind: 'away' } when it does not answer. */
export async function lookRecipes(ask, fetchFn = fetch) {
  const get = async (u) => { const r = await fetchFn(u, { headers: { accept: 'application/json' } }); if (!r.ok) throw new Error('status ' + r.status); return r.json(); };
  try {
    if (ask.kind === 'id') { const j = await get(HOST + 'lookup.php?i=' + ask.value); return { ok: true, recipes: ((j && j.meals) || []).map(fromMeal).filter(Boolean) }; }
    if (ask.kind === 'c' || ask.kind === 'a') { const j = await get(HOST + 'filter.php?' + ask.kind + '=' + encodeURIComponent(ask.value)); return { ok: true, list: ((j && j.meals) || []).slice(0, 30).map((m) => ({ id: String(m.idMeal), name: String(m.strMeal || ''), image: String(m.strMealThumb || '') })), all: true }; }
    if (ask.kind === 'q') { const j = await get(HOST + 'search.php?s=' + encodeURIComponent(ask.value)); return { ok: true, recipes: ((j && j.meals) || []).map(fromMeal).filter(Boolean).slice(0, 12) }; }
    const sets = []; for (const ing of ask.value.split(',')) { const j = await get(HOST + 'filter.php?i=' + encodeURIComponent(ing)); sets.push(((j && j.meals) || []).map((m) => ({ id: String(m.idMeal), name: String(m.strMeal || ''), image: String(m.strMealThumb || '') }))); }
    const count = new Map(); for (const s of sets) for (const m of s) count.set(m.id, (count.get(m.id) || 0) + 1);
    const best = Math.max(0, ...count.values()), list = [...new Map(sets.flat().map((m) => [m.id, m])).values()].filter((m) => count.get(m.id) === best).slice(0, 12);
    return { ok: true, list, all: best === sets.length && best > 0 };
  } catch (_) { return { ok: false, kind: 'away' }; }
}
export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const u = new URL(request.url), ask = askIn(request.url);
  if (!ask) return json({ ok: false, kind: 'missing', say: 'Ask for a dish (?q=pancakes), ingredients (?i=eggs,spinach) or a recipe id (?id=52855): letters and spaces, up to 60.' }, 400);
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(u.origin + '/__void-recipes/' + ask.kind + '/' + encodeURIComponent(ask.value.toLowerCase()));
  if (cache) { try { const hit = await cache.match(key); if (hit) return json({ ...(await hit.json()), cached: true }, 200, { 'cache-control': 'public, max-age=600' }); } catch (_) {} }
  if (await rateLimited(request, env || {}, 'recipes', RL_MAX)) return json({ ok: false, kind: 'limited', say: 'That is a lot of recipes in a minute. Give me a moment and ask again.' }, 429);
  const out = await lookRecipes(ask, fetchFn);
  if (!out.ok) return json({ ...out, say: 'The recipe catalogue did not answer just now.' }, 502, { 'cache-control': 'no-store' });
  if (cache) { try { await cache.put(key, new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=' + TTL } })); } catch (_) {} }
  return json(out, 200, { 'cache-control': 'public, max-age=600' });
}
