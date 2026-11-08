// A read-only RSS/Atom passthrough for the journal page (/journal/): GET /api/feed?u=<feed url> -> the feed's
// own bytes with CORS headers, so the page can read a public feed from any visitor's browser where the feed
// itself does not send CORS headers.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET. The most a caller can do is:
//   - read one feed of the closed allow-list below (the journal's own feed; another public feed is added here,
//     never by the caller): the caller never names a host, a path or a header, so this is not a proxy and cannot
//     be aimed anywhere else;
//   - make Verse's server fetch that one fixed address, with a 6 second timeout and at most 600,000 characters read,
//     and only on a cache miss: a repeat inside 10 minutes is answered from the edge, and a caller gets 20 misses
//     a minute (rateLimited(), its own bucket) on top of the guard's per-connection limit;
//   - read what the publisher already publishes. No model, no token, no database, no write; a failed answer is
//     never cached. Only https feeds are served; only XML content types are passed through.
import { rateLimited as rlFromAnswer } from './answer.js';

// injectable for tests: feed.test.mjs swaps this out before calling the route
export let rateLimited = rlFromAnswer;
export function _setRateLimited(fn) { rateLimited = fn; }

export const RL_MAX = 20, TTL = 600, TIMEOUT_MS = 6000, MAX_CHARS = 600000;
// the feeds Verse's pages read cross-origin; one row, added by hand when a page needs one
export const FEEDS = Object.freeze(['https://ajsonline.org/feed']);

export function feedFor(url) { const u = String(url || ''); return FEEDS.includes(u) ? u : null; }

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const feed = feedFor(url.searchParams.get('u'));
  if (!feed) return Response.json({ ok: false, say: 'not an allowed feed' }, { status: 400 });
  if (await rateLimited(request, env, 'feed', RL_MAX)) return Response.json({ ok: false, say: 'too many requests' }, { status: 429, headers: { 'retry-after': '60' } });
  const cache = caches.default;
  const key = new Request('https://a-to-mind.com/__feed-cache/' + encodeURIComponent(feed), { method: 'GET' });
  let r = await cache.match(key);
  if (!r) {
    const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      r = await fetch(feed, { signal: ctl.signal, headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml', 'user-agent': 'Verse journal reader (+https://a-to-mind.com/journal/)' } });
    } catch (_) { clearTimeout(timer); return Response.json({ ok: false, say: 'the feed did not answer' }, { status: 502 }); }
    clearTimeout(timer);
    if (!r.ok) return Response.json({ ok: false, say: 'the feed answered ' + r.status }, { status: 502 });
    const text = await r.text();
    if (text.length > MAX_CHARS) return Response.json({ ok: false, say: 'the feed is too large' }, { status: 502 });
    const cors = new Response(text, { status: 200, headers: { 'content-type': r.headers.get('content-type') || 'application/rss+xml', 'cache-control': `public, max-age=${TTL}`, 'access-control-allow-origin': '*' } });
    await cache.put(key, cors.clone());
    return cors;
  }
  return new Response(await r.text(), { status: 200, headers: { 'content-type': r.headers.get('content-type') || 'application/rss+xml', 'access-control-allow-origin': '*', 'x-verse-cache': 'HIT' } });
}
