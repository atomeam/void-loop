// The news page's own API (void-live-deploy/news/, lib/news.js): GET /api/news?sec=<section>&lang=<en|es|fr|de> -> { ok, sec, lang, at, stories, sources }.
// It reads the open RSS / Atom feeds of the section from lib/news.js FEEDS (BBC, Guardian, NPR, Al Jazeera, DW and others), groups the near-identical
// headlines of different sources into one story and keeps the answer on the edge for seven minutes per section and language, so a burst of readers
// (or the gate's several loads) costs the publishers one visit each every seven minutes.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET. The most a caller can do is:
//   - pick a section and a language from two closed lists (SECTIONS, LANGS); anything else is the top stories in English. The caller never names a
//     host, a path, a header or a feed: the addresses are the constants in lib/news.js, so this is not a proxy and cannot be aimed anywhere else;
//   - make Verse's server fetch at most 10 of those fixed feeds, each with a 4.5 second timeout and read at most 600,000 characters, and only on a
//     cache miss: a repeat inside seven minutes is answered from the edge, and a caller gets 20 misses a minute (rateLimited(), its own bucket) on
//     top of the guard's per-connection limit;
//   - read headlines, links and short summaries the publishers already publish. No model, no token, no database, no write; a failed answer is never cached.
// A feed that fails or times out is left out and named in `sources` (ok: false); the page still shows the rest. Only https links are kept.
import { rateLimited } from './answer.js';
import { SECTIONS, LANGS, SOURCES, feedsFor, parseFeed, stories } from '../../lib/news.js';

export const RL_MAX = 20, TTL = 420, TIMEOUT_MS = 4500, MAX_CHARS = 600000;
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });
/** the section and language a request asks for; a name outside the closed lists is the default. Pure. */
export function askIn(url) {
  const p = new URL(url).searchParams, sec = String(p.get('sec') || 'top'), lang = String(p.get('lang') || 'en');
  const { sec: s, lang: l } = feedsFor(Object.hasOwn(SECTIONS, sec) ? sec : 'top', Object.hasOwn(LANGS, lang) ? lang : 'en'); return { sec: s, lang: l };
}
/** the stories of a section: every feed asked at once, each bounded; { ok, stories, sources }. */
export async function lookNews(ask, fetchFn = fetch, now = Date.now()) {
  const { feeds } = feedsFor(ask.sec, ask.lang), seen = new Set(), list = feeds.filter((f) => !seen.has(f[3]) && seen.add(f[3])).slice(0, 10);
  const got = await Promise.all(list.map(async ([src, , , url]) => {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const r = await fetchFn(url, { signal: ctl.signal, headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'user-agent': 'Verse news reader (+https://a-to-mind.com/news/)' } });
      if (!r.ok) throw new Error('status ' + r.status);
      const items = parseFeed((await r.text()).slice(0, MAX_CHARS), now).slice(0, 25).map((i) => ({ ...i, src }));
      if (!items.length) throw new Error('no stories');
      return { src, ok: true, items };
    } catch (_) { return { src, ok: false, items: [] }; } finally { clearTimeout(timer); }
  }));
  const bySrc = new Map(); for (const g of got) { const o = bySrc.get(g.src) || { src: g.src, name: SOURCES[g.src][0], ok: false, count: 0 }; o.ok = o.ok || g.ok; o.count += g.items.length; bySrc.set(g.src, o); }
  const items = got.flatMap((g) => g.items), sources = [...bySrc.values()];
  return { ok: items.length > 0, stories: stories(items, 60, now), sources, at: now };
}
export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const u = new URL(request.url), ask = askIn(request.url);
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(u.origin + '/__void-news/' + ask.lang + '/' + ask.sec);
  if (cache) { try { const hit = await cache.match(key); if (hit) return json({ ...(await hit.json()), cached: true }, 200, { 'cache-control': 'public, max-age=120' }); } catch (_) {} }
  if (await rateLimited(request, env || {}, 'news', RL_MAX)) return json({ ok: false, kind: 'limited', say: 'That is a lot of news in a minute. Give me a moment and ask again.' }, 429);
  const out = await lookNews(ask, fetchFn), body = { ...out, sec: ask.sec, lang: ask.lang };
  if (!out.ok) return json({ ...body, kind: 'away', say: 'None of the news feeds answered just now.' }, 502, { 'cache-control': 'no-store' });
  if (cache) { try { await cache.put(key, new Response(JSON.stringify(body), { headers: { 'cache-control': 'max-age=' + TTL } })); } catch (_) {} }
  return json(body, 200, { 'cache-control': 'public, max-age=120' });
}
