// /api/video: V01D's video search and link lookup (skills/video.js; owner, 2026-10-15: "V01D should be the only site you need").
//   GET /api/video?q=moon+landing&p=dailymotion   search one platform; p is youtube, dailymotion, archive, peertube, odysee (searchable),
//                                                 or rumble, vimeo, twitch (no public search API: the answer carries the platform's own search link)
//   GET /api/video?url=<a rumble/youtube/vimeo/dailymotion page>   its title, channel, length, thumbnail and (Rumble) the embed id, from the
//                                                 platform's own oEmbed endpoint
// YouTube search uses the YouTube Data API when env.YOUTUBE_API_KEY is set; without it, keylessYouTube() below (Piped, then Wikidata).
// Embed only: nothing is downloaded or rehosted. Free-tier safe: no KV, no D1, no model; answers sit in the edge cache (caches.default) for
// six hours, so a popular search costs one upstream call. Hostile read: the upstream urls are built here from fixed hosts (the ask
// never picks a host), query and url are length-capped, and only plain fields go back.
import { parseVideoUrl, hitsOf, PLATFORMS, OPEN_SEARCH } from '../../lib/video.js';

const JSON_H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=21600' };
const reply = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: JSON_H });
const UA = { 'user-agent': 'Verse/1.0 (+https://a-to-mind.com)', accept: 'application/json' };
async function getJson(u) { const r = await fetch(u, { headers: UA, cf: { cacheTtl: 21600 } }); if (!r.ok) throw new Error('upstream ' + r.status); return r.json(); }

export async function search(platform, q, env) {
  const e = encodeURIComponent(q), searchUrl = PLATFORMS[platform].search(q);
  if (platform === 'youtube') {
    if (!env || !env.YOUTUBE_API_KEY) return keylessYouTube(q, searchUrl);
    const k = encodeURIComponent(env.YOUTUBE_API_KEY);
    const s = await getJson('https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&safeSearch=moderate&maxResults=8&q=' + e + '&key=' + k);
    const ids = (s.items || []).map((i) => i.id && i.id.videoId).filter(Boolean).join(',');
    if (!ids) return { ok: true, platform, hits: [], searchUrl };
    const d = await getJson('https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails&id=' + ids + '&key=' + k);
    return { ok: true, platform, hits: hitsOf('youtube', d), searchUrl };
  }
  if (platform === 'dailymotion') return { ok: true, platform, searchUrl, hits: hitsOf(platform, await getJson('https://api.dailymotion.com/videos?limit=8&flags=no_live&fields=id,title,owner.screenname,duration,thumbnail_360_url&search=' + e)) };
  if (platform === 'archive') return { ok: true, platform, searchUrl, hits: hitsOf(platform, await getJson('https://archive.org/advancedsearch.php?q=' + encodeURIComponent('(' + q + ') AND mediatype:movies') + '&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=runtime&rows=8&output=json')) };
  if (platform === 'peertube') return { ok: true, platform, searchUrl, hits: hitsOf(platform, await getJson('https://sepiasearch.org/api/v1/search/videos?count=8&nsfw=false&search=' + e)) };
  if (platform === 'odysee') return { ok: true, platform, searchUrl, hits: hitsOf(platform, await getJson('https://lighthouse.odysee.tv/search?size=8&from=0&claimType=file&mediaType=video&nsfw=false&resolve=true&s=' + e)) };
  return { ok: true, platform, hits: [], searchUrl, note: PLATFORMS[platform].label + ' has no public search API; open its search, then paste any video link here to play it in Verse' };
}

// Keyless YouTube search (owner, 2026-10-15: "theres prolly a workaround for that youtube problem"), used only while no
// YOUTUBE_API_KEY is set; a key takes over by itself. Layers, first one with hits wins, each with a short timeout:
//   1. public Piped API instances (open source, CORS *, no key); we only read ids, titles and thumbnails and still play
//      through YouTube's own youtube-nocookie embed, so views stay on YouTube. Several hosts, since public ones come and go.
//      Then one public Invidious instance the same way. All asked at once; the first with hits wins.
//   2. Wikidata (CC0, official API): items carrying a YouTube video ID (P1651) that match the words; titles from YouTube's oEmbed.
// Nothing else: DuckDuckGo's terms forbid automated querying, and Invidious' public search API is mostly closed (403/401).
export const PIPED = ['https://api.piped.private.coffee', 'https://pipedapi.ducks.party', 'https://pipedapi.kavin.rocks']; // re-probed 2026-10-15
export const INVIDIOUS = ['https://invidious.f5.si']; // the one public instance with /api/v1/search open (api.invidious.io, 2026-10-15)
const YTID = /^[A-Za-z0-9_-]{11}$/;
async function timed(u, ms = 4000) { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); try { const r = await fetch(u, { headers: UA, signal: c.signal, cf: { cacheTtl: 21600 } }); if (!r.ok) throw new Error('upstream ' + r.status); return await r.json(); } finally { clearTimeout(t); } }
export function pipedHits(j) {
  const s = (x) => String(x == null ? '' : x).slice(0, 200);
  return ((j && j.items) || []).filter((v) => v && v.type === 'stream' && !v.isShort).map((v) => { const m = String(v.url || '').match(/[?&]v=([A-Za-z0-9_-]{11})/); return m ? { platform: 'youtube', id: m[1], title: s(v.title), channel: s(v.uploaderName), seconds: v.duration > 0 ? Math.round(v.duration) : null, thumb: 'https://i.ytimg.com/vi/' + m[1] + '/mqdefault.jpg' } : null; }).filter(Boolean).slice(0, 8);
}
async function wikidataHits(q) {
  const s = await timed('https://www.wikidata.org/w/api.php?action=query&list=search&srlimit=8&format=json&srsearch=' + encodeURIComponent(q + ' haswbstatement:P1651'));
  const ids = ((s.query && s.query.search) || []).map((x) => x.title).filter((t) => /^Q\d+$/.test(t)).join('|'); if (!ids) return [];
  const e = await timed('https://www.wikidata.org/w/api.php?action=wbgetentities&props=claims|labels&languages=en&format=json&ids=' + ids);
  const vids = Object.values(e.entities || {}).map((it) => { const c = (it.claims && it.claims.P1651) || []; const v = c[0] && c[0].mainsnak && c[0].mainsnak.datavalue && c[0].mainsnak.datavalue.value; return YTID.test(v) ? { id: v, label: it.labels && it.labels.en && it.labels.en.value } : null; }).filter(Boolean);
  const out = await Promise.all(vids.map(async (v) => { try { const o = await timed('https://www.youtube.com/oembed?format=json&url=' + encodeURIComponent('https://www.youtube.com/watch?v=' + v.id), 3000); return { platform: 'youtube', id: v.id, title: String(o.title || v.label || '').slice(0, 200), channel: String(o.author_name || '').slice(0, 200), seconds: null, thumb: 'https://i.ytimg.com/vi/' + v.id + '/mqdefault.jpg' }; } catch (_) { return null; } }));
  return out.filter(Boolean);
}
export function invidiousHits(j) {
  const s = (x) => String(x == null ? '' : x).slice(0, 200);
  return (Array.isArray(j) ? j : []).filter((v) => v && v.type === 'video' && YTID.test(v.videoId)).map((v) => ({ platform: 'youtube', id: v.videoId, title: s(v.title), channel: s(v.author), seconds: v.lengthSeconds > 0 ? Math.round(v.lengthSeconds) : null, thumb: 'https://i.ytimg.com/vi/' + v.videoId + '/mqdefault.jpg' })).slice(0, 8);
}
export async function keylessYouTube(q, searchUrl, hosts = PIPED, inv = INVIDIOUS) {
  const e = encodeURIComponent(q), tries = hosts.map((h) => () => timed(h + '/search?filter=videos&q=' + e).then(pipedHits)).concat(inv.map((h) => () => timed(h + '/api/v1/search?type=video&q=' + e).then(invidiousHits)));
  try { const hits = await Promise.any(tries.map((t) => t().then((h) => (h.length ? h : Promise.reject(new Error('empty')))))); return { ok: true, platform: 'youtube', hits, searchUrl, via: 'open-frontend' }; } catch (_) {}
  try { const hits = await wikidataHits(q); if (hits.length) return { ok: true, platform: 'youtube', hits, searchUrl, via: 'wikidata' }; } catch (_) {}
  return { ok: true, platform: 'youtube', hits: [], searchUrl, need: 'YOUTUBE_API_KEY', note: 'YouTube search did not answer just now; paste any YouTube link to play it here, or try the free platforms' };
}

const OEMBED = { youtube: 'https://www.youtube.com/oembed?format=json&url=', rumble: 'https://rumble.com/api/Media/oembed.json?url=', vimeo: 'https://vimeo.com/api/oembed.json?url=', dailymotion: 'https://www.dailymotion.com/services/oembed?url=' };
export async function lookup(url) {
  const v = parseVideoUrl(url);
  if (!v || !OEMBED[v.platform]) return { ok: false, error: 'not a link Verse looks up' };
  const page = v.page || url;
  const j = await getJson(OEMBED[v.platform] + encodeURIComponent(page));
  if (v.platform === 'rumble' && !v.id) { const m = String(j.html || '').match(/rumble\.com\/embed\/(v[a-z0-9]+)/i); if (!m) return { ok: false, error: 'Rumble did not give an embed for that link' }; v.id = m[1]; delete v.needsOembed; }
  const s = (x) => String(x == null ? '' : x).slice(0, 200);
  return { ok: true, video: Object.assign(v, { title: s(j.title), channel: s(j.author_name), seconds: Number.isFinite(+j.duration) ? Math.round(+j.duration) : null, thumb: s(j.thumbnail_url) }) };
}

export async function onRequestGet({ request, env, waitUntil }) {
  const u = new URL(request.url), q = (u.searchParams.get('q') || '').trim().slice(0, 120), p = (u.searchParams.get('p') || 'youtube').toLowerCase(), link = (u.searchParams.get('url') || '').trim().slice(0, 600);
  if (!q && !link) return reply({ ok: false, error: 'ask with ?q=<words>&p=<platform> or ?url=<video link>', platforms: Object.keys(PLATFORMS), searchable: OPEN_SEARCH.concat('youtube') }, 400);
  if (q && !PLATFORMS[p]) return reply({ ok: false, error: 'unknown platform', platforms: Object.keys(PLATFORMS) }, 400);
  const cache = typeof caches !== 'undefined' ? caches.default : null, key = new Request(u.origin + '/api/video?' + (link ? 'url=' + encodeURIComponent(link) : 'p=' + p + '&q=' + encodeURIComponent(q.toLowerCase())) + (p === 'youtube' && env && env.YOUTUBE_API_KEY ? '&k=1' : ''));
  if (cache) { const hit = await cache.match(key).catch(() => null); if (hit) return hit; }
  let out;
  try { out = link ? await lookup(link) : await search(p, q, env); } catch (e) { return reply({ ok: false, error: 'the platform did not answer', searchUrl: q ? PLATFORMS[p].search(q) : undefined }, 502); }
  const res = reply(out, out.ok ? 200 : 404);
  if (cache && out.ok && !out.need) { const put = cache.put(key, res.clone()).catch(() => {}); if (waitUntil) waitUntil(put); }
  return res;
}
