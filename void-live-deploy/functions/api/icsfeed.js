// GET /api/icsfeed?url=<an iCal address> -> { ok, name, events }: a calendar someone subscribes to on /calendar/ (lib/icsfeed.js has the rules).
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET that makes Verse's server read an address the caller gives.
//   - Read a page they could not: only an https address on a public name (no IP literal, no port, no credentials, no local or single-label name,
//     nothing on Verse itself; every redirect, at most 3, is checked the same way). Cloudflare's fetch cannot reach private networks. And nothing
//     of what is read comes back but calendar events parsed out of it (title, times, repeat, notes): a page that is not a calendar is a 422 and its
//     words never leave the server, so this is no way to read an arbitrary page.
//   - Make Verse knock on someone's server: one GET per address per 30 minutes (the edge cache answers repeats), 20 addresses a minute from one
//     connection (lib/guard.js bump, keyed by a salted hash of the address, never the address itself), a 2 MB and 8 second ceiling on each read.
//     BOUNDED, NOT PREVENTED: it is a polite reader, at most one request a second per caller.
//   - Store anything: nothing is stored but the edge cache's copy of the parsed events for 30 minutes. No model, no D1, no KV.
// Without the SALT the route is off (503) rather than unguarded.
import { bump } from '../../lib/guard.js';
import { dayOf, clientKey } from '../../lib/reactions.js';
import { FEED, feedUrl, calNameOf, hostName } from '../../lib/icsfeed.js';
import { parseIcs } from '../../lib/calendar.js';

const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: { 'cache-control': 'no-store', ...extra } });
const bad = (status, error) => json({ ok: false, error }, status);

async function sha(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32); }
/** the body as text, or null past the byte ceiling */
async function capped(res) {
  const r = res.body && res.body.getReader(); if (!r) return '';
  const parts = []; let n = 0;
  for (;;) { const { done, value } = await r.read(); if (done) break; n += value.byteLength; if (n > FEED.bytes) { try { await r.cancel(); } catch (_) {} return null; } parts.push(value); }
  const all = new Uint8Array(n); let at = 0; for (const p of parts) { all.set(p, at); at += p.byteLength; }
  return new TextDecoder().decode(all);
}
/** the feed read with each redirect checked: { res } or { error, status } */
async function reach(url, fetchFn) {
  let at = url;
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetchFn(at, { redirect: 'manual', headers: { accept: 'text/calendar, text/plain;q=0.5, */*;q=0.1', 'user-agent': 'Verse calendar subscription (a-to-mind.com)' }, signal: AbortSignal.timeout(FEED.timeoutMs) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { const next = feedUrl(new URL(res.headers.get('location'), at).toString()); if (!next) return { status: 422, error: 'that calendar moved somewhere Verse does not read' }; at = next; continue; }
    if (!res.ok) return { status: 502, error: 'that address did not answer with a calendar (' + res.status + ')' };
    return { res };
  }
  return { status: 422, error: 'too many redirects' };
}

export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const here = new URL(request.url), url = feedUrl(here.searchParams.get('url'));
  if (!url) return bad(400, 'give a calendar address that starts with https:// or webcal://');
  if (!env || !env.SALT) return bad(503, 'calendar subscriptions are off for now');
  const who = await clientKey(request.headers.get('cf-connecting-ip'), dayOf(), env.SALT);
  if ((await bump(here.origin, 'icsfeed:' + who)) > FEED.perMinute) return json({ ok: false, error: 'slow down' }, 429, { 'retry-after': '60' });
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(here.origin + '/__void-icsfeed/' + (await sha(url)));
  if (cache) { try { const hit = await cache.match(key); if (hit) return json({ ...(await hit.json()), cached: true }, 200, { 'cache-control': 'private, max-age=300' }); } catch (_) {} }
  let text;
  try {
    const got = await reach(url, fetchFn); if (got.error) return bad(got.status, got.error);
    text = await capped(got.res); if (text == null) return bad(413, 'that calendar is bigger than 2 MB');
  } catch (_) { return bad(504, 'that address did not answer in time'); }
  if (!/BEGIN:VCALENDAR/i.test(text)) return bad(422, 'that address is not a calendar (.ics)');
  // what is still to come or repeats, plus a year back: a feed with ten years of fixtures stays light enough to keep on a phone
  const since = new Date(Date.now() - 366 * 864e5).toISOString().slice(0, 10);
  const events = parseIcs(text).filter((e) => e.rrule || String(e.end).slice(0, 10) >= since).slice(0, FEED.events);
  const out = { ok: true, name: calNameOf(text) || hostName(url), events };
  if (cache) { try { await cache.put(key, new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=' + FEED.cacheSecs } })); } catch (_) {} }
  return json(out, 200, { 'cache-control': 'private, max-age=300' });
}
