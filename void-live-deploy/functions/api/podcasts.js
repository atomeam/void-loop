// The podcasts page's own API (void-live-deploy/podcasts/, lib/podcasts.js). GET only, one route, six asks:
//   ?q=<words>                 -> { ok, shows }    Apple's free iTunes Search for podcasts (no key)
//   ?top=<cc>[&genre=<id>]     -> { ok, shows }    the top-podcasts chart of a country (and a category), Apple's public chart feeds
//   ?id=<itunes id>            -> { ok, show }     one show: iTunes lookup for its feed address, then the feed read
//   ?feed=<https address>      -> { ok, show }     any podcast feed (RSS) read into rows: show, episodes, notes, durations, chapters and transcript links
//   ?chapters=<https address>  -> { ok, chapters } a chapters file named by a feed (Podcast Namespace JSON)
//   ?transcript=<https address>[&kind=vtt|srt|json|html|text] -> { ok, lines } a transcript file named by a feed
// Audio is never fetched or proxied here: an episode's address goes to the page and the browser streams it from the publisher.
//
// WHAT A STRANGER COULD MAKE THIS DO, AND WHY IT IS BOUNDED. This is an open GET that fetches an address a stranger supplies (feed, chapters,
// transcript), the classic server-side request forgery shape, so every part of it is held:
//   - the address must be https, on the standard port, with no sign-in in it, on a public name: no IP address in any spelling, no localhost,
//     no internal suffix, no single-label host (lib/podcasts.js whyNot). It is checked again on EVERY redirect hop (redirects are followed by
//     hand, at most 4), so a feed that redirects to a private address is refused. A name that resolves to a private IP cannot be checked from a
//     Worker (there is no DNS call), but a Cloudflare Worker's fetch does not reach private networks, only the public internet;
//   - it only reads: GET, no cookies, no caller headers passed on, no body; the answer is parsed here and only normalised JSON leaves (never the
//     publisher's raw bytes, never HTML, scripts or any content type the caller picks);
//   - it spends little: at most 3 MB read (the stream is cut, complete items kept), 8 seconds, 300 episodes, notes cut to 1,500 characters,
//     answers kept on the edge 15 minutes per address so a burst of callers makes one fetch, 20 misses a minute per caller on top of the guard;
//   - it cannot be aimed at Verse's own services: this host's own names are refused (the one exception is Verse Out Loud's own feed, read from
//     the site's static files);
//   - the iTunes asks use fixed hosts and paths; the caller picks only a search phrase (100 characters), a two-letter country from a closed
//     list and a category from a closed list. No model, no token, no database, no write; a failure is never cached.
import { rateLimited } from './answer.js';
import { whyNot, parseFeed, parseChapters, parseTranscript, fromItunes, fromChart, fromFyyd, GENRES, COUNTRIES } from '../../lib/podcasts.js';

export const RL_MAX = 20, TTL = 900, MAX_BYTES = 3 * 1024 * 1024, MAX_BYTES_SMALL = 1024 * 1024, TIMEOUT_MS = 8000, MAX_HOPS = 4, SELF_FEED = 'https://a-to-mind.com/podcast/rss.xml';
const OWN = /(?:^|\.)(?:a-to-mind\.com|pages\.dev|workers\.dev)$/i;
const json = (o, status = 200, extra = {}) => Response.json(o, { status, headers: extra });
const cc = new Set(COUNTRIES.map((c) => c[0])), genres = new Set(GENRES.map((g) => String(g[0])));

/** what a request asks: { kind, value } or null when it is none of the six. Pure. */
export function askIn(url) {
  const p = new URL(url).searchParams, get = (k) => String(p.get(k) || '').replace(/\s+/g, ' ').trim();
  if (get('feed')) return { kind: 'feed', value: get('feed') };
  if (get('chapters')) return { kind: 'chapters', value: get('chapters') };
  if (get('transcript')) return { kind: 'transcript', value: get('transcript'), as: /^(?:vtt|srt|json|html|text)$/.test(get('kind')) ? get('kind') : 'text' };
  if (get('id')) return /^\d{1,12}$/.test(get('id')) ? { kind: 'id', value: get('id') } : null;
  if (get('top')) { const c = get('top').toLowerCase(), g = get('genre') || '0'; return cc.has(c) && genres.has(g) ? { kind: 'top', value: c, genre: g } : null; }
  if (get('q')) return /^[\p{L}\p{M}\p{N}\s'’&.,:!?-]{1,100}$/u.test(get('q')) ? { kind: 'q', value: get('q') } : null;
  return null;
}
/** an address a stranger gave, checked for the fetch: { ok, url } or { ok: false, why }. Pure. */
export function checkAddress(raw) {
  const why = whyNot(raw); if (why) return { ok: false, why };
  const host = new URL(raw).hostname; if (OWN.test(host) && raw !== SELF_FEED) return { ok: false, why: 'not a public publisher address' };
  return { ok: true, url: new URL(raw).href };
}
/** read a response body up to `max` bytes (the stream is cancelled past it); { text, cut }. */
export async function readCapped(res, max) {
  if (!res.body || !res.body.getReader) { const t = await res.text(); return t.length > max ? { text: t.slice(0, max), cut: true } : { text: t, cut: false }; }
  const rd = res.body.getReader(), dec = new TextDecoder('utf-8', { fatal: false }); let text = '', n = 0, cut = false;
  for (;;) { const { done, value } = await rd.read(); if (done) break; n += value.byteLength; if (n > max) { text += dec.decode(value.subarray(0, value.byteLength - (n - max)), { stream: true }); cut = true; try { await rd.cancel(); } catch (_) {} break; } text += dec.decode(value, { stream: true }); }
  return { text: text + dec.decode(), cut };
}
/** the SSRF-safe fetch: each hop checked, redirects by hand, a time limit, a size cap. { ok, text, cut, type, url } or { ok: false, kind, say }. */
export async function safeFetch(raw, { fetchFn = fetch, assets = null, max = MAX_BYTES, accept = 'application/rss+xml, application/xml, text/xml, application/json, text/plain, text/vtt, */*;q=0.5' } = {}) {
  let url = raw; const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      const ok = checkAddress(url); if (!ok.ok) return { ok: false, kind: 'refused', say: 'That address cannot be read here (' + ok.why + ').' };
      url = ok.url;
      const res = url === SELF_FEED && assets ? await assets.fetch(new Request(url)) : await fetchFn(url, { redirect: 'manual', signal: ctl.signal, headers: { accept, 'user-agent': 'VerseBot/1.0 (+https://a-to-mind.com/podcasts/)' } });
      if (res.status >= 300 && res.status < 400) { const loc = res.headers.get('location'); if (!loc) return { ok: false, kind: 'away', say: 'The feed redirected nowhere.' }; try { url = new URL(loc, url).href; } catch (_) { return { ok: false, kind: 'away', say: 'The feed redirected to a bad address.' }; } continue; }
      if (!res.ok) return { ok: false, kind: 'away', say: 'The publisher answered ' + res.status + '.' };
      const type = String(res.headers.get('content-type') || '').toLowerCase().split(';')[0].trim();
      if (/^(?:audio|video|image)\//.test(type) || type === 'application/octet-stream' && /\.(?:mp3|m4a|mp4|wav|ogg)(?:$|\?)/i.test(url)) return { ok: false, kind: 'notfeed', say: 'That address is an audio or picture file, not a feed.' };
      const body = await readCapped(res, max); return { ok: true, text: body.text, cut: body.cut, type, url };
    }
    return { ok: false, kind: 'away', say: 'The feed redirected too many times.' };
  } catch (e) { return { ok: false, kind: 'away', say: e && e.name === 'AbortError' ? 'The publisher took too long.' : 'The publisher did not answer.' }; } finally { clearTimeout(timer); }
}
// Apple's directory answered the Worker badly with no user agent (the live 502 of 28 Oct 2026), so every directory ask names itself
const UA = 'VerseBot/1.0 (+https://a-to-mind.com/podcasts/)';
const itunes = async (url, fetchFn) => { const r = await fetchFn(url, { headers: { accept: 'application/json', 'user-agent': UA } }); if (!r.ok) throw new Error('status ' + r.status); return r.json(); };
// fyyd.de: a free, keyless second directory, asked only when Apple fails; the answer then carries a note naming its source
export const FYYD_NOTE = 'Apple did not answer just now, so these shows come from fyyd.de, a second open podcast directory.';
export const FYYD_HOT_NOTE = 'The Apple chart did not answer just now, so these are the most listened shows on fyyd.de, not a chart of one country.';
const fyyd = async (path, fetchFn) => fromFyyd(await itunes('https://api.fyyd.de/0.2/' + path, fetchFn));
/** the answer to one ask. { ok: true, ... } or { ok: false, kind, say }. */
export async function look(ask, { fetchFn = fetch, assets = null } = {}) {
  try {
    if (ask.kind === 'q') { try { const j = await itunes('https://itunes.apple.com/search?media=podcast&entity=podcast&limit=25&term=' + encodeURIComponent(ask.value), fetchFn); return { ok: true, shows: ((j && j.results) || []).map(fromItunes).filter(Boolean) }; } catch (_) {}
      return { ok: true, shows: await fyyd('search/podcast?count=25&title=' + encodeURIComponent(ask.value), fetchFn), source: 'fyyd', note: FYYD_NOTE }; }
    if (ask.kind === 'top') {
      const legacy = 'https://itunes.apple.com/' + ask.value + '/rss/toppodcasts/limit=30' + (ask.genre !== '0' ? '/genre=' + ask.genre : '') + '/json';
      let shows = []; try { shows = fromChart(await itunes(legacy, fetchFn)); } catch (_) {}
      if (!shows.length && ask.genre === '0') try { shows = fromChart(await itunes('https://rss.applemarketingtools.com/api/v2/' + ask.value + '/podcasts/top/30/podcasts.json', fetchFn)); } catch (_) {}
      if (!shows.length) { const hot = await fyyd('feature/podcast/hot?count=30', fetchFn); if (hot.length) return { ok: true, shows: hot, source: 'fyyd', note: FYYD_HOT_NOTE }; }
      return { ok: true, shows };
    }
    if (ask.kind === 'id') {
      const j = await itunes('https://itunes.apple.com/lookup?entity=podcast&id=' + ask.value, fetchFn), row = fromItunes(((j && j.results) || [])[0]);
      if (!row || !row.feed) return { ok: false, kind: 'missing', say: 'That show has no public feed.' };
      const out = await look({ kind: 'feed', value: row.feed }, { fetchFn, assets }); if (!out.ok) return out;
      return { ok: true, show: { ...out.show, id: row.id, image: out.show.image || row.image, title: out.show.title || row.title } };
    }
    if (ask.kind === 'feed') {
      const got = await safeFetch(ask.value, { fetchFn, assets }); if (!got.ok) return got;
      const show = parseFeed(got.text, got.url, got.cut); if (!show) return { ok: false, kind: 'notfeed', say: 'That address is not a podcast feed with episodes.' };
      return { ok: true, show };
    }
    if (ask.kind === 'chapters') { const got = await safeFetch(ask.value, { fetchFn, max: MAX_BYTES_SMALL }); if (!got.ok) return got; return { ok: true, chapters: parseChapters(got.text) }; }
    if (ask.kind === 'transcript') { const got = await safeFetch(ask.value, { fetchFn, max: MAX_BYTES_SMALL }); if (!got.ok) return got; return { ok: true, lines: parseTranscript(got.text, ask.as) }; }
  } catch (_) {}
  return { ok: false, kind: 'away', say: 'The directory did not answer just now.' };
}
export async function onRequestGet({ request, env, fetchFn = fetch }) {
  const u = new URL(request.url), ask = askIn(request.url);
  if (!ask) return json({ ok: false, kind: 'missing', say: 'Ask for a search (?q=history), a chart (?top=us), a show (?id=1234 or ?feed=https://…), its chapters or transcript.' }, 400);
  if (ask.kind === 'feed' || ask.kind === 'chapters' || ask.kind === 'transcript') { const c = checkAddress(ask.value); if (!c.ok) return json({ ok: false, kind: 'refused', say: 'That address cannot be read here (' + c.why + ').' }, 400); }
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(u.origin + '/__void-podcasts/' + ask.kind + '/' + encodeURIComponent((ask.value + '|' + (ask.genre || '') + (ask.as || '')).toLowerCase()));
  if (cache) { try { const hit = await cache.match(key); if (hit) return json({ ...(await hit.json()), cached: true }, 200, { 'cache-control': 'public, max-age=300' }); } catch (_) {} }
  if (await rateLimited(request, env || {}, 'podcasts', RL_MAX)) return json({ ok: false, kind: 'limited', say: 'That is a lot of podcast searches in a minute. Give me a moment and ask again.' }, 429);
  const out = await look(ask, { fetchFn, assets: env && env.ASSETS });
  if (!out.ok) return json(out, out.kind === 'refused' ? 400 : out.kind === 'missing' || out.kind === 'notfeed' ? 422 : 503, { 'cache-control': 'no-store' }); // 503, not 502: Cloudflare covers a Function's 502 with its own page, so the JSON reason never arrived
  if (cache) { try { await cache.put(key, new Response(JSON.stringify(out), { headers: { 'cache-control': 'max-age=' + TTL } })); } catch (_) {} }
  return json(out, 200, { 'cache-control': 'public, max-age=300' });
}
