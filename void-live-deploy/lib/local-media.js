// lib/local-media.js: the local radio and TV near a visitor (/local/, functions/api/local.js, tools/local-tv.mjs; owner, 2026-10-30: "Verse
// should pick up local tv and radio"). Radio comes from Radio Browser, the open community directory (radio-browser.info: free to use, public
// domain data, stations checked daily); TV from the iptv-org database of channels and their local broadcast areas, with the streams its
// playlists list that a browser can play straight from their own host. Nothing is restreamed or proxied: a stream plays from where it is,
// and a station whose stream cannot play in the page gets its own link instead. Pure throughout. Tests: tools/local-media.test.mjs.

export const RADIO_KM = 100, TV_KM = 120, MAX_RADIO = 60, MAX_TV = 80;
const IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

/** an address a page on https can play from where it is: https, the standard port, a host name (never a bare IP, never local). Pure. */
export function playableStream(raw) {
  let u; try { u = new URL(String(raw || '')); } catch (_) { return false; }
  if (u.protocol !== 'https:' || u.port && u.port !== '443' || u.username || u.password) return false;
  if (/eyJ[\w-]{8,}\.[\w-]{8,}\./.test(u.href)) return false; // a signed playback token (a JWT) expires and is not ours to republish
  const h = u.hostname.toLowerCase();
  return !!h && !IPV4.test(h) && !h.includes(':') && !h.startsWith('[') && h.includes('.') && !/(?:^|\.)(?:localhost|local|internal|lan|home)$/.test(h);
}
/** an http address tried as https (most stream hosts answer both); null when even that cannot play here. Pure. */
export function httpsOf(raw) {
  const s = String(raw || '').trim(); if (playableStream(s)) return s;
  if (!/^http:\/\//i.test(s)) return null;
  let u; try { u = new URL(s); } catch (_) { return null; }
  if (u.port && u.port !== '80') return null; // a stream on its own port (Icecast :8000) has no https twin there
  u.protocol = 'https:'; u.port = ''; return playableStream(u.href) ? u.href : null;
}
const GENERIC = /^(?:SD|HD|FHD|UHD|4K|Main|Default|Live|Feed)$/i;
/** a TV station's title and network from an iptv-org channel and feed: a call sign (WPVI-TV) carrying a network (ABC), or the channel's own
 *  name for its main feed (PhillyCAM). Pure. */
export function stationTitle(channel, feed) {
  const cn = String(channel && channel.name || '').trim(), fn = String(feed && feed.name || '').trim();
  if (!fn || GENERIC.test(fn) || fn === cn) return { title: cn, network: '' };
  if (/^[KWCX][A-Z0-9]{2,5}(?:-[A-Z0-9]{1,3})?$/.test(fn)) return { title: fn, network: cn };
  return { title: cn + ' ' + fn, network: '' };
}
/** kilometres between two [lat, lon] points (haversine). Pure. */
export function km(a, b) {
  const r = Math.PI / 180, dLa = (b[0] - a[0]) * r, dLo = (b[1] - a[1]) * r;
  const h = Math.sin(dLa / 2) ** 2 + Math.cos(a[0] * r) * Math.cos(b[0] * r) * Math.sin(dLo / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
/** the region code (US-PA) a place's region name or code means in a country's TV file, or ''. Pure. */
export function regionCodeOf(file, place) {
  if (!file || !place) return '';
  const cc = String(place.country || '').toUpperCase(), code = String(place.regionCode || '').toUpperCase();
  if (code && file.regions[cc + '-' + code]) return cc + '-' + code;
  const want = fold(place.region); if (!want) return '';
  for (const [k, name] of Object.entries(file.regions)) if (fold(name) === want) return k;
  return '';
}
/** the TV stations of a country's file that serve a place, nearest first: a station whose city is within TV_KM (by its place), or named for
 *  the visitor's own city, or broadcast to the visitor's whole region. Each row gains km (rounded, or null) and why ('city' | 'near' | 'region'). Pure. */
export function tvNear(file, place, { radius = TV_KM, max = MAX_TV } = {}) {
  if (!file || !Array.isArray(file.stations) || !place) return [];
  const here = Number.isFinite(place.lat) && Number.isFinite(place.lon) ? [place.lat, place.lon] : null;
  const region = regionCodeOf(file, place), city = fold(place.city);
  const out = [];
  for (const s of file.stations) {
    let best = null, why = '';
    for (const a of s.a) {
      if (a.startsWith('ct/')) {
        const c = file.cities[a.slice(3)]; if (!c) continue;
        const d = here && c[2] ? km(here, c[2]) : null;
        if (city && fold(c[0]) === city && (!region || c[1] === region)) { const k = d == null ? 0 : d; if (best == null || k < best) { best = k; why = 'city'; } continue; }
        if (d != null && d <= radius && (best == null || d < best)) { best = d; why = 'near'; }
      } else if (region && a === 's/' + region && !why) { why = 'region'; }
    }
    if (why) out.push({ ...s, km: best == null ? null : Math.round(best), why });
  }
  const rank = (r) => (r.why === 'region' ? 1 : 0);
  out.sort((x, y) => rank(x) - rank(y) || (x.km ?? 1e9) - (y.km ?? 1e9) || (y.s ? 1 : 0) - (x.s ? 1 : 0) || x.t.localeCompare(y.t));
  return out.slice(0, max);
}
const cleanText = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
const httpsLink = (s) => { const v = String(s || '').trim(); try { const u = new URL(v); return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : ''; } catch (_) { return ''; } };
/** one Radio Browser station as a row the page draws: the stream to play (https, or null when it cannot play here), the station's own page,
 *  its picture (https only), up to three tags, codec and bitrate, how far (km) when both ends have a place. Pure. */
export function radioRow(s) {
  if (!s || typeof s !== 'object' || !s.stationuuid) return null;
  const raw = String(s.url_resolved || s.url || '').trim(), icon = httpsLink(s.favicon);
  return {
    id: cleanText(s.stationuuid, 40), name: cleanText(s.name, 90) || 'A station', play: httpsOf(raw), stream: httpsLink(raw), home: httpsLink(s.homepage),
    icon: icon.startsWith('https:') ? icon : '', tags: String(s.tags || '').split(',').map((t) => cleanText(t, 24)).filter(Boolean).slice(0, 3),
    codec: cleanText(s.codec, 12), kbps: Number(s.bitrate) > 0 ? Math.round(Number(s.bitrate)) : 0, hls: Number(s.hls) === 1,
    where: cleanText(s.state, 50), km: Number.isFinite(Number(s.geo_distance)) && s.geo_distance != null ? Math.round(Number(s.geo_distance) / 1000) : null, votes: Number(s.votes) || 0,
  };
}
/** Radio Browser answers (by distance, by region) merged into one list: each station once (same id or the same stream), nearest first with
 *  the most voted among stations without a place, at most MAX_RADIO. Pure. */
export function mergeRadio(...lists) {
  const seen = new Set(), out = [];
  for (const list of lists) for (const s of Array.isArray(list) ? list : []) {
    const r = radioRow(s); if (!r) continue;
    const k2 = r.stream.replace(/^https?:\/\//, '').replace(/\/$/, '').toLowerCase();
    if (seen.has(r.id) || (k2 && seen.has(k2))) continue; seen.add(r.id); if (k2) seen.add(k2); out.push(r);
  }
  out.sort((a, b) => (a.km == null) - (b.km == null) || (a.km != null && b.km != null ? a.km - b.km : 0) || b.votes - a.votes);
  return out.slice(0, MAX_RADIO);
}
/** the place a request's Cloudflare data names: { city, region, regionCode, country, lat, lon } (lat and lon rounded to a tenth), or null. Pure. */
export function placeFromCf(cf) {
  if (!cf) return null;
  const lat = Number(cf.latitude), lon = Number(cf.longitude), country = String(cf.country || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(country) || country === 'XX' || country === 'T1') return null;
  return { city: cleanText(cf.city, 80), region: cleanText(cf.region, 80), regionCode: cleanText(cf.regionCode, 6).toUpperCase(), country,
    lat: Number.isFinite(lat) ? Math.round(lat * 10) / 10 : null, lon: Number.isFinite(lon) ? Math.round(lon * 10) / 10 : null };
}
/** a place from an Open-Meteo geocoder result, in the same shape. Pure. */
export function placeFromGeocoder(g) {
  if (!g || !Number.isFinite(g.latitude) || !Number.isFinite(g.longitude) || !/^[A-Za-z]{2}$/.test(String(g.country_code || ''))) return null;
  return { city: cleanText(g.name, 80), region: cleanText(g.admin1, 80), regionCode: '', country: String(g.country_code).toUpperCase(),
    lat: Math.round(g.latitude * 100) / 100, lon: Math.round(g.longitude * 100) / 100 };
}
/** a place another page hands over in the link, in the same shape: ?place=<name>&ll=<lat>,<lon>&cc=<country code>, as a flight's arrival
 *  airport sends it, so the stations are found at that exact point with no name to look up. null when any part is missing or wrong. Pure. */
export function placeFromLink(search) {
  const q = new URLSearchParams(search || ''), city = cleanText(q.get('place'), 80), cc = String(q.get('cc') || '').toUpperCase();
  const ll = String(q.get('ll') || '').split(','), lat = Number(ll[0]), lon = Number(ll[1]);
  if (!city || ll.length !== 2 || ll.some((x) => x.trim() === '') || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180 || !/^[A-Z]{2}$/.test(cc)) return null;
  return { city, region: '', regionCode: '', country: cc, lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100 };
}
/** /flights/ with this place as where the trip lands (the page picks the airport near it), or null without a position. Pure. */
export function flightsLink(place) {
  const lat = Number(place && place.lat), lon = Number(place && place.lon);
  if (!place || place.lat == null || place.lon == null || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return '/flights/?tonear=' + (Math.round(lat * 1e4) / 1e4) + ',' + (Math.round(lon * 1e4) / 1e4);
}
/** the place in words: "Philadelphia, Pennsylvania" (the country code after it when it is not the US). Pure. */
export const placeName = (p) => !p ? '' : [p.city, p.region].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(', ') + (p.country && p.country !== 'US' ? ' (' + p.country + ')' : '');
/** TV rows of one station folded together: a call sign carries each network it airs (KYW-DT: CBS, Dabl, Start TV), each with its own stream
 *  and site; the order of tvNear is kept. Pure. */
export function groupTv(rows) {
  const out = [], at = new Map();
  for (const r of Array.isArray(rows) ? rows : []) {
    const sub = { id: r.id, n: r.n || '', s: Array.isArray(r.s) ? r.s : [], w: r.w || '' };
    if (at.has(r.t)) { const g = at.get(r.t); g.subs.push(sub); if (sub.s.length) g.play = true; continue; }
    const g = { t: r.t, km: r.km, why: r.why, subs: [sub], play: sub.s.length > 0 }; at.set(r.t, g); out.push(g);
  }
  for (const g of out) g.subs.sort((a, b) => (b.s.length ? 1 : 0) - (a.s.length ? 1 : 0));
  return out;
}

export { linkOf, localAsk } from './local-ask.js';
