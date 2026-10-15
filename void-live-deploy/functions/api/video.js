// /api/video: V01D's video search and link lookup (skills/video.js; owner, 2026-10-15: "V01D should be the only site you need").
//   GET /api/video?q=moon+landing&p=dailymotion   search one platform; p is youtube, dailymotion, archive, peertube, odysee (searchable),
//                                                 or rumble, vimeo, twitch (no public search API: the answer carries the platform's own search link)
//   GET /api/video?url=<a rumble/youtube/vimeo/dailymotion page>   its title, channel, length, thumbnail and (Rumble) the embed id, from the
//                                                 platform's own oEmbed endpoint
// YouTube search uses the YouTube Data API only when env.YOUTUBE_API_KEY is set; without it the answer says so and links YouTube's own search.
// Embed only: nothing is downloaded or rehosted. Free-tier safe: no KV, no D1, no model; answers sit in the edge cache (caches.default) for
// six hours, so a popular search costs one upstream call. Hostile read: the upstream urls are built here from fixed hosts (the ask
// never picks a host), query and url are length-capped, and only plain fields go back.
import { parseVideoUrl, hitsOf, PLATFORMS, OPEN_SEARCH } from '../../lib/video.js';

const JSON_H = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'public, max-age=21600' };
const reply = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: JSON_H });
const UA = { 'user-agent': 'V01D/1.0 (+https://a-to-mind.com)', accept: 'application/json' };
async function getJson(u) { const r = await fetch(u, { headers: UA, cf: { cacheTtl: 21600 } }); if (!r.ok) throw new Error('upstream ' + r.status); return r.json(); }

export async function search(platform, q, env) {
  const e = encodeURIComponent(q), searchUrl = PLATFORMS[platform].search(q);
  if (platform === 'youtube') {
    if (!env || !env.YOUTUBE_API_KEY) return { ok: true, platform, hits: [], searchUrl, need: 'YOUTUBE_API_KEY', note: 'YouTube search needs a YouTube Data API key on the server; paste any YouTube link to play it here, or try the free platforms' };
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
  return { ok: true, platform, hits: [], searchUrl, note: PLATFORMS[platform].label + ' has no public search API; open its search, then paste any video link here to play it in V01D' };
}

const OEMBED = { youtube: 'https://www.youtube.com/oembed?format=json&url=', rumble: 'https://rumble.com/api/Media/oembed.json?url=', vimeo: 'https://vimeo.com/api/oembed.json?url=', dailymotion: 'https://www.dailymotion.com/services/oembed?url=' };
export async function lookup(url) {
  const v = parseVideoUrl(url);
  if (!v || !OEMBED[v.platform]) return { ok: false, error: 'not a link V01D looks up' };
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
  if (cache && out.ok) { const put = cache.put(key, res.clone()).catch(() => {}); if (waitUntil) waitUntil(put); }
  return res;
}
