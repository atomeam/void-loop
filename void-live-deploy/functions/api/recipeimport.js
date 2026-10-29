// Importing a recipe (lib/recipeimport.js has the parsing and the shape):
//   GET  /api/recipeimport?url=<a recipe page>   -> { ok, recipe }   the page's own schema.org Recipe data, as the recipes page's shape
//   POST /api/recipeimport { image: data URL }   -> { ok, text }     the text a vision model reads in a photo of a recipe card or page (the page parses it)
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. Both are open, with no account.
//   - GET makes Verse's server read an address the caller gives. Only an https address on a public name (no IP literal, no port, no credentials, no local or single-label name,
//     nothing on Verse itself: lib/icsfeed.js feedUrl; every redirect, at most 3, is checked the same way); Cloudflare's fetch cannot reach private networks. What comes back is
//     only a recipe parsed out of the page's structured data (a name, ingredients, steps, a time, a servings number, one https picture address, the source): a page that has no
//     recipe is a 422 and none of its words leave the server, so this is no way to read an arbitrary page. 2 MB and 8 seconds per read, one read per address per hour (edge
//     cache), 15 addresses a minute from one connection.
//   - POST spends the site's own Workers AI vision model on one picture the caller sends: a PNG, JPEG or WebP under 800 KB (the page sends a 1,000 px JPEG), 6 a minute from one
//     connection and the answer route's shared per-connection limit; the picture is read for this answer and dropped, nothing is stored or logged. It returns the text read, and
//     nothing else; without the model bound it is a 503. BOUNDED, NOT PREVENTED: a stranger can spend a few vision calls a minute, the same exposure as /api/translate's picture mode.
//   - Store anything: no. No D1, no KV; the only copy is the edge cache's parsed recipe for an hour.
// Same-origin writes only (the guard, lib/guard.js). Without the SALT the GET is off (503).
import { bump } from '../../lib/guard.js';
import { dayOf, clientKey } from '../../lib/reactions.js';
import { FEED, feedUrl } from '../../lib/icsfeed.js';
import { parseRecipePage } from '../../lib/recipeimport.js';
import { models } from '../../lib/models.js';
import { imageBytes } from './appraise.js';
import { rateLimited } from './answer.js';

const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const bad = (status, error) => json({ ok: false, error }, status);
export const PER_MINUTE = 15, PHOTOS_PER_MINUTE = 6, MAX_HTML = 1500000;
const READ_PROMPT = 'Transcribe exactly the text of this recipe, in its original language, line by line, keeping the title, the servings, the ingredients heading and list, and the method heading and steps. Output only the text, nothing else. If there is no text, output NONE.';

async function sha(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32); }
/** the body as text, or null past `max` bytes */
async function capped(res, max) {
  const r = res.body && res.body.getReader(); if (!r) return '';
  const parts = []; let n = 0;
  for (;;) { const { done, value } = await r.read(); if (done) break; n += value.byteLength; if (n > max) { try { await r.cancel(); } catch (_) {} return null; } parts.push(value); }
  const all = new Uint8Array(n); let at = 0; for (const p of parts) { all.set(p, at); at += p.byteLength; }
  return new TextDecoder().decode(all);
}
async function reach(url, fetchFn) {
  let at = url;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetchFn(at, { redirect: 'manual', headers: { accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1', 'user-agent': 'Verse recipe import (a-to-mind.com)' }, signal: AbortSignal.timeout(FEED.timeoutMs) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { const next = feedUrl(new URL(res.headers.get('location'), at).toString()); if (!next) return { status: 422, error: 'that page moved somewhere Verse does not read' }; at = next; continue; }
    if (!res.ok) return { status: 502, error: 'that address did not answer with a page (' + res.status + ')' };
    return { res };
  }
  return { status: 422, error: 'too many redirects' };
}
/** what the vision model said, line breaks kept. Pure. */
export const saidOf = (r) => String((r && (r.description || r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && (r.result.description || r.result.response)))) || '').replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim().slice(0, 6000);

export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const here = new URL(request.url), url = feedUrl(here.searchParams.get('url'));
  if (!url) return bad(400, 'give the address of a recipe page, starting with https://');
  if (!env || !env.SALT) return bad(503, 'recipe import is off for now');
  const who = await clientKey(request.headers.get('cf-connecting-ip'), dayOf(), env.SALT);
  if ((await bump(here.origin, 'recipeimport:' + who)) > PER_MINUTE) return json({ ok: false, error: 'slow down' }, 429, { 'retry-after': '60' });
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(here.origin + '/__void-recipeimport/' + (await sha(url)));
  if (cache) { try { const hit = await cache.match(key); if (hit) return json({ ...(await hit.json()), cached: true }, 200, { 'cache-control': 'private, max-age=300' }); } catch (_) {} }
  let html;
  try { const got = await reach(url, fetchFn); if (got.error) return bad(got.status, got.error); html = await capped(got.res, MAX_HTML); if (html == null) return bad(413, 'that page is bigger than 1.5 MB'); }
  catch (_) { return bad(504, 'that address did not answer in time'); }
  const recipe = parseRecipePage(html, url);
  if (!recipe) return bad(422, 'no recipe found on that page: Verse reads the recipe data sites publish for search engines; try pasting the text instead');
  const out = { ok: true, recipe };
  if (cache) { try { await cache.put(key, new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=3600' } })); } catch (_) {} }
  return json(out, 200, { 'cache-control': 'private, max-age=300' });
}

export async function onRequestPost({ request, env }) {
  let body; try { body = await request.json(); } catch (_) { return bad(400, 'send JSON: { image }'); }
  const bytes = imageBytes(body && body.image); if (!bytes) return bad(400, 'a PNG, JPEG or WebP picture, under 800 KB');
  if (!env || !env.AI) return bad(503, 'Verse cannot read pictures from this deploy yet (no vision model bound)');
  if (await rateLimited(request, env, 'recipeimport', PHOTOS_PER_MINUTE)) return json({ ok: false, error: 'slow down' }, 429, { 'retry-after': '60' });
  let said;
  try { said = saidOf(await env.AI.run(models('vision'), { messages: [{ role: 'user', content: [{ type: 'text', text: READ_PROMPT }, { type: 'image_url', image_url: { url: String(body.image).trim() } }] }], max_tokens: 1200, chat_template_kwargs: { enable_thinking: false } })); }
  catch (_) { return bad(502, 'the picture could not be read; try again in a moment'); }
  if (!said || /^NONE\b/i.test(said)) return bad(422, 'no text could be read in the picture');
  return json({ ok: true, text: said });
}
