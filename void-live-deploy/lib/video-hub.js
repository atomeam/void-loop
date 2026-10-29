/**
 * video-hub: the pure part of /video/ (owner, 2026-10-26: the video floor, YouTube, gets a Verse page). The catalogue is Verse's own films plus openly
 * licensed video (Wikimedia Commons, where every file carries a free licence, and Internet Archive items marked public domain or Creative Commons),
 * each shown with its licence and credit; anything else (YouTube, PeerTube, Dailymotion, Odysee) plays through the platform's own embed (lib/video.js).
 * Playlists, watch later, history, resume points and recommendations live on the visitor's device. Nothing here touches the network or the DOM:
 * it builds addresses, reads API answers into items, parses chapters and captions, ranks recommendations and maps keys. Tests: tools/video-hub.test.mjs.
 */
export const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
export const COMMONS_API = 'https://commons.wikimedia.org/w/api.php';
export const ARCHIVE = 'https://archive.org';
const s = (x, max = 300) => String(x == null ? '' : x).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
const one = (v) => (Array.isArray(v) ? v[0] : v);
const num = (x) => (Number.isFinite(+x) && +x > 0 ? +x : null);
/** HTML (Commons descriptions and credits) to plain text. Pure. */
export const plain = (html, max = 600) => s(String(html == null ? '' : html).replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'"), max);

// ---------- the first shelf: well known open films, resolved when played (Commons by file name, the Archive by identifier) ----------
export const SEED = Object.freeze([
  { source: 'commons', id: 'Big_Buck_Bunny_4K.webm', title: 'Big Buck Bunny', year: 2008, by: 'Blender Foundation', licence: 'CC BY 3.0', tags: ['animation', 'short film', 'blender', 'comedy'] },
  { source: 'commons', id: 'Sintel_movie_4K.webm', title: 'Sintel', year: 2010, by: 'Blender Foundation', licence: 'CC BY 3.0', tags: ['animation', 'short film', 'blender', 'fantasy', 'dragon'] },
  { source: 'commons', id: 'Tears_of_Steel_in_4k_-_Official_Blender_Foundation_release.webm', title: 'Tears of Steel', year: 2012, by: 'Blender Foundation', licence: 'CC BY 3.0', tags: ['science fiction', 'short film', 'blender', 'visual effects'] },
  { source: 'archive', id: 'night_of_the_living_dead', title: 'Night of the Living Dead', year: 1968, by: 'George A. Romero', licence: 'Public domain', tags: ['horror', 'feature film', 'zombies', 'classic'] },
  { source: 'archive', id: 'his_girl_friday', title: 'His Girl Friday', year: 1940, by: 'Howard Hawks', licence: 'Public domain', tags: ['comedy', 'feature film', 'classic', 'newspaper'] },
  { source: 'archive', id: 'DuckandC1951', title: 'Duck and Cover', year: 1951, by: 'Federal Civil Defense Administration', licence: 'Public domain', tags: ['documentary', 'short film', 'history', 'cold war'] },
]);

// ---------- Wikimedia Commons: every file there carries a free licence ----------
const VI = 'url|size|mime|mediatype|extmetadata|derivatives';
/** the API address that finds videos on Commons for some words (CORS with origin=*). Pure. */
export function commonsSearchUrl(q, limit = 12) {
  const p = new URLSearchParams({ action: 'query', format: 'json', origin: '*', generator: 'search', gsrnamespace: '6', gsrlimit: String(limit), gsrsearch: 'filetype:video ' + s(q, 120), prop: 'videoinfo', viprop: VI, viurlwidth: '480' });
  return COMMONS_API + '?' + p;
}
/** the API address for named Commons files ("Big_Buck_Bunny_4K.webm", with or without "File:"). Pure. */
export function commonsFilesUrl(names) {
  const titles = [].concat(names).map((n) => 'File:' + String(n).replace(/^File:/i, '').replace(/ /g, '_')).join('|');
  return COMMONS_API + '?' + new URLSearchParams({ action: 'query', format: 'json', origin: '*', titles, prop: 'videoinfo', viprop: VI, viurlwidth: '480' });
}
/** a Commons caption track as WebVTT text, for a file and a language. Pure. */
export const commonsCaptionsUrl = (name, lang = 'en') => COMMONS_API + '?' + new URLSearchParams({ action: 'timedtext', title: 'File:' + String(name).replace(/^File:/i, ''), lang, trackformat: 'vtt', origin: '*' });
/** a Commons answer -> items, in the order of the search. Pure. */
export function commonsItems(j) {
  const pages = Object.values((j && j.query && j.query.pages) || {}).filter((p) => p && p.videoinfo && p.videoinfo[0]);
  pages.sort((a, b) => (a.index || 0) - (b.index || 0));
  const out = [];
  for (const p of pages) {
    const v = p.videoinfo[0], m = v.extmetadata || {}, val = (k) => (m[k] && m[k].value) || '';
    if (!/^video\//.test(v.mime || '') && v.mediatype !== 'VIDEO') continue;
    if (!/^https:\/\/upload\.wikimedia\.org\//.test(v.url || '')) continue;
    const name = String(p.title || '').replace(/^File:/, '');
    const quality = (v.derivatives || []).filter((d) => d && /^https:\/\/upload\.wikimedia\.org\//.test(d.src || '') && /^video\//.test(d.type || '')).map((d) => ({ src: d.src, type: String(d.type).split(';')[0], height: +d.height || 0, label: d.height ? d.height + 'p' : s(d.transcodekey || d.shorttitle, 30) }));
    quality.push({ src: v.url, type: String(v.mime).split(';')[0], height: +v.height || 0, label: 'Original' + (v.height ? ' (' + v.height + 'p)' : '') });
    const cats = plain(val('Categories'), 400).split('|').map((c) => c.trim().toLowerCase()).filter((c) => c && c.length < 60).slice(0, 8);
    out.push({ source: 'commons', id: name, title: s(plain(val('ObjectName'), 160) || name.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' '), 160), by: plain(val('Artist'), 160), licence: plain(val('LicenseShortName'), 60) || 'Free licence',
      licenceUrl: /^https?:\/\//.test(val('LicenseUrl')) ? val('LicenseUrl') : '', description: plain(val('ImageDescription'), 1200), seconds: num(v.duration) ? Math.round(v.duration) : null, thumb: /^https:\/\/upload\.wikimedia\.org\//.test(v.thumburl || '') ? v.thumburl : '',
      page: /^https:\/\/commons\.wikimedia\.org\//.test(v.descriptionurl || '') ? v.descriptionurl : 'https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(name), file: v.url, size: num(v.size), quality: dedupe(quality), tags: cats, download: true });
  }
  return out;
}
const dedupe = (q) => { const seen = new Set(); return q.filter((x) => !seen.has(x.src) && seen.add(x.src)).sort((a, b) => a.height - b.height); };

// ---------- Internet Archive: only items marked public domain or Creative Commons, or in its public domain film collections ----------
/** the search address for films on the Archive (CORS open); the licence is checked on each answer (archiveLicence). Pure. */
export function archiveSearchUrl(q, rows = 30) {
  const fl = ['identifier', 'title', 'creator', 'year', 'licenseurl', 'collection', 'subject', 'runtime', 'description'];
  return ARCHIVE + '/advancedsearch.php?' + 'q=' + encodeURIComponent('(' + s(q, 120) + ') AND mediatype:(movies)') + fl.map((f) => '&fl[]=' + f).join('') + '&rows=' + rows + '&output=json';
}
// the Prelinger Archives are public domain by the donor's grant; the Feature Films collection is the one lib/movies.js legalArchive() already trusts
const PD_COLLECTIONS = ['prelinger', 'feature_films'];
/** the licence an Archive item may be played and saved under, or '' when it is not marked free. Pure. */
export function archiveLicence(doc) {
  const lic = String(one(doc && doc.licenseurl) || ''), cols = [].concat((doc && doc.collection) || []).map(String);
  const cc = /creativecommons\.org\/licenses\/([a-z-]+)\/(\d\.\d)/i.exec(lic);
  if (cc) return 'CC ' + cc[1].toUpperCase() + ' ' + cc[2];
  if (/creativecommons\.org\/publicdomain\/zero/i.test(lic)) return 'CC0';
  if (/publicdomain/i.test(lic)) return 'Public domain';
  if (cols.some((c) => PD_COLLECTIONS.includes(c))) return 'Public domain';
  return '';
}
/** an Archive search answer -> the free items only. Pure. */
export function archiveItems(j) {
  const docs = (j && j.response && j.response.docs) || [];
  return docs.filter((d) => /^[A-Za-z0-9._-]{1,100}$/.test(String(d.identifier || '')) && archiveLicence(d)).map((d) => ({
    source: 'archive', id: d.identifier, title: s(one(d.title), 160) || d.identifier, by: s(one(d.creator), 160), year: num(String(one(d.year) || '').slice(0, 4)), licence: archiveLicence(d),
    licenceUrl: /^https?:\/\//.test(String(one(d.licenseurl) || '')) ? String(one(d.licenseurl)) : '', description: plain(one(d.description), 1200), seconds: runtime(one(d.runtime)),
    thumb: ARCHIVE + '/services/img/' + d.identifier, page: ARCHIVE + '/details/' + d.identifier, tags: [].concat(d.subject || []).map((x) => s(x, 40).toLowerCase()).filter(Boolean).slice(0, 8), download: true }));
}
const runtime = (r) => { const t = String(r || '').trim(); let m = /^(\d+):(\d\d):(\d\d)$/.exec(t); if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3]; m = /^(\d+):(\d\d)$/.exec(t); if (m) return +m[1] * 60 + +m[2]; m = /^(\d+)\s*min/i.exec(t); return m ? +m[1] * 60 : null; };
/** the metadata address of one Archive item. Pure. */
export const archiveMetaUrl = (id) => ARCHIVE + '/metadata/' + encodeURIComponent(id);
/** an item's metadata -> { quality: [{src, type, label, size}], captions: [{src, label}], licence, title, by, description }; the smallest mp4 first. Pure. */
export function archivePlayable(meta) {
  const id = meta && meta.metadata && meta.metadata.identifier, files = (meta && meta.files) || [];
  if (!id || !/^[A-Za-z0-9._-]{1,100}$/.test(id)) return null;
  const url = (n) => ARCHIVE + '/download/' + encodeURIComponent(id) + '/' + String(n).split('/').map(encodeURIComponent).join('/');
  const vids = files.filter((f) => f && f.name && /\.(?:mp4|webm|ogv)$/i.test(f.name) && (+f.size || 0) > 0).map((f) => ({ src: url(f.name), type: /\.webm$/i.test(f.name) ? 'video/webm' : /\.ogv$/i.test(f.name) ? 'video/ogg' : 'video/mp4', size: +f.size, height: +f.height || 0, label: (f.height ? f.height + 'p · ' : '') + (f.format || f.name.split('.').pop()) + ' · ' + mb(+f.size) }));
  vids.sort((a, b) => a.size - b.size);
  const captions = files.filter((f) => f && /\.(?:vtt|srt)$/i.test(f.name || '')).map((f) => ({ src: url(f.name), label: s(f.name.replace(/^.*?([a-z]{2,3})?\.(?:vtt|srt)$/i, (m0, l) => (l || 'Captions')), 20), srt: /\.srt$/i.test(f.name) }));
  const md = meta.metadata, lic = archiveLicence(md);
  return { quality: vids, captions, licence: lic, title: s(one(md.title), 160), by: s(one(md.creator), 160), description: plain(one(md.description), 1200) };
}
const mb = (n) => (n >= 1e9 ? (n / 1e9).toFixed(1) + ' GB' : Math.max(1, Math.round(n / 1e6)) + ' MB');
export { mb as sizeLabel };

// ---------- a link or a name typed into the box ----------
/** a Commons file page or upload link -> its file name, or ''. Pure. */
export function commonsFileOf(text) {
  const t = String(text || '').trim();
  let m = /commons\.wikimedia\.org\/wiki\/File:([^?#\s]+)/i.exec(t); if (m) return decodeURIComponent(m[1]).replace(/ /g, '_');
  m = /upload\.wikimedia\.org\/wikipedia\/commons\/(?:transcoded\/)?[0-9a-f]\/[0-9a-f]{2}\/([^/?#\s]+\.(?:webm|ogv|mp4|mpg|mpeg))/i.exec(t); if (m) return decodeURIComponent(m[1]);
  return '';
}

// ---------- chapters: "0:00 Opening" lines in a description, or marks the viewer set ----------
/** chapters from a description: lines that start (or end) with a time; needs two or more, in order. Pure. */
export function chaptersOf(text) {
  const out = [];
  for (const raw of String(text || '').split(/\n|(?=\s(?:\d{1,2}:)?\d{1,2}:\d{2}\s)/)) {
    const l = raw.trim(), m = /^[(\[]?((?:\d{1,2}:)?\d{1,2}:\d{2})[)\]]?\s*[-–—:.]?\s*(.{1,80})$/.exec(l) || /^(.{1,80}?)\s*[-–—(]?\s*((?:\d{1,2}:)?\d{1,2}:\d{2})\)?$/.exec(l);
    if (!m) continue;
    const [time, title] = /\d:\d\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]], p = time.split(':').map(Number), t = p.reduce((a, b) => a * 60 + b, 0);
    if (out.length && t <= out[out.length - 1].t) continue;
    out.push({ t, title: s(title, 80) });
  }
  return out.length >= 2 ? out : [];
}
/** which chapter a time falls in (index), or -1. Pure. */
export const chapterAt = (ch, t) => { let i = -1; for (let k = 0; k < (ch || []).length; k++) if (ch[k].t <= t) i = k; return i; };

// ---------- captions: SubRip to WebVTT, so a .srt from the Archive or the viewer's device plays ----------
export function srtToVtt(text) {
  const t = String(text || '').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trim();
  if (/^WEBVTT/.test(t)) return t + '\n';
  return 'WEBVTT\n\n' + t.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2').replace(/^\d+\n(?=\d{2}:\d{2}:\d{2}\.\d{3} -->)/gm, '') + '\n';
}

// ---------- recommendations from the viewer's own history, worked out on the device ----------
const STOP = new Set('the a an of and or to in on for with from by at is it this that film video movie official full hd 4k webm ogv mp4 part'.split(' '));
export const wordsOf = (it) => [...new Set((String((it && it.title) || '') + ' ' + ((it && it.tags) || []).join(' ') + ' ' + String((it && it.by) || '')).toLowerCase().match(/[a-zà-ÿ0-9]{3,}/g) || [])].filter((w) => !STOP.has(w));
export const keyOf = (it) => (it ? it.source + ':' + it.id : '');
/** the pool ranked for this viewer: words shared with what they watched (recent counts more, finished counts more), the sources they use, never what
 *  they finished or are watching. { item, score, why } with why naming the watched item it is most like. Pure. */
export function recommend(history, pool, n = 8, now = Date.now()) {
  const seen = new Map(), weight = new Map(), src = new Map();
  for (const h of history || []) {
    const age = Math.max(0, (now - (h.at || now)) / 864e5), w = (h.done ? 1.5 : 1) / (1 + age / 7);
    seen.set(keyOf(h), h); src.set(h.source, (src.get(h.source) || 0) + w);
    for (const word of wordsOf(h)) weight.set(word, (weight.get(word) || 0) + w);
  }
  const out = [], picked = new Set();
  for (const it of pool || []) {
    const k = keyOf(it); if (!it || picked.has(k)) continue; const h = seen.get(k); if (h && (h.done || h.current)) continue;
    let score = 0, best = null, bestN = 0;
    for (const word of wordsOf(it)) score += weight.get(word) || 0;
    for (const hh of history || []) { const shared = wordsOf(hh).filter((w) => wordsOf(it).includes(w)).length; if (shared > bestN && keyOf(hh) !== k) { bestN = shared; best = hh; } }
    score += 0.2 * (src.get(it.source) || 0); if (h) score += 0.5; // started and left: worth finishing
    picked.add(k); out.push({ item: it, score, why: best ? best.title : '' });
  }
  return out.filter((x) => x.score > 0 || !(history || []).length).sort((a, b) => b.score - a.score).slice(0, n);
}

// ---------- keyboard: the keys people already know from the big players ----------
export const KEYS = Object.freeze([['k', 'play'], [' ', 'play'], ['j', 'back10'], ['l', 'fwd10'], ['ArrowLeft', 'back5'], ['ArrowRight', 'fwd5'], ['ArrowUp', 'volup'], ['ArrowDown', 'voldown'], ['m', 'mute'], ['f', 'full'], ['c', 'captions'], ['i', 'pip'], ['<', 'slower'], ['>', 'faster'], [',', 'frameback'], ['.', 'framefwd'], ['n', 'next'], ['Home', 'start'], ['End', 'end']]);
/** the action for a key press, or ''; digits 0 to 9 jump to that tenth of the video ('seek:3'). Pure. */
export function keyAction(key, { shift = false } = {}) {
  if (/^[0-9]$/.test(key)) return 'seek:' + key;
  if (shift && (key === 'N' || key === 'n')) return 'next';
  if (shift && key === 'P') return 'prev';
  const k = key.length === 1 && key !== ' ' ? key.toLowerCase() : key; const hit = KEYS.find(([x]) => x === k || x === key); return hit ? hit[1] : '';
}
/** the next speed up or down the list from the current one. Pure. */
export const stepSpeed = (cur, dir) => { const i = SPEEDS.findIndex((x) => x >= cur - 1e-9); const j = Math.min(SPEEDS.length - 1, Math.max(0, (i < 0 ? SPEEDS.length - 1 : i) + dir)); return SPEEDS[j]; };

// ---------- a quality to start with: the largest that fits the screen and the connection ----------
export function pickQuality(q, { width = 1280, saveData = false, slow = false } = {}) {
  const list = (q || []).filter((x) => x && x.src); if (!list.length) return null;
  const cap = saveData || slow ? 360 : width <= 480 ? 480 : width <= 1280 ? 720 : 1080;
  const sized = list.filter((x) => x.height > 0 && x.height <= cap);
  if (sized.length) return sized.sort((a, b) => b.height - a.height)[0];
  const small = list.filter((x) => x.size > 0).sort((a, b) => a.size - b.size); // the Archive without heights: the smallest decent file
  return (small.find((x) => x.size > 8e6) || small[0] || list[0]);
}

// ---------- playlists shared by link: a list of items in the part after # (nothing stored anywhere) ----------
const b64u = (str) => btoa(unescape(encodeURIComponent(str))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (t) => decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/'))));
const SOURCES = ['commons', 'archive', 'verse', 'youtube', 'peertube', 'dailymotion', 'odysee', 'vimeo', 'rumble'];
/** a playlist -> "#pl=..." (name and items: source, id, title, host). Pure. */
export function playlistLink(name, items) {
  const body = { n: s(name, 60), i: (items || []).slice(0, 100).map((x) => [x.source, x.id, s(x.title, 100), x.host || ''].filter((v, k) => k < 3 || v)) };
  return '#pl=' + b64u(JSON.stringify(body));
}
/** "#pl=..." -> { name, items } with every item checked, or null. Pure. */
export function playlistFrom(hash) {
  const m = /^#?pl=([A-Za-z0-9_-]{4,20000})$/.exec(String(hash || '')); if (!m) return null;
  try {
    const b = JSON.parse(unb64u(m[1])); if (!b || !Array.isArray(b.i)) return null;
    const items = b.i.filter((x) => Array.isArray(x) && SOURCES.includes(x[0]) && typeof x[1] === 'string' && /^[\w.:@%()'!,~$+=&-]{1,200}$/.test(x[1]) && (!x[3] || /^[a-z0-9.-]{3,100}$/i.test(x[3])))
      .map((x) => ({ source: x[0], id: x[1], title: s(x[2], 100) || x[1], ...(x[3] ? { host: x[3] } : {}) }));
    return { name: s(b.n, 60) || 'Shared playlist', items };
  } catch (_) { return null; }
}
/** move an item of a list from one place to another; a new list. Pure. */
export const moveItem = (list, from, to) => { const a = (list || []).slice(); if (from < 0 || from >= a.length || to < 0 || to >= a.length) return a; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; };
/** the item after the current one in a playlist, or null at the end (loop wraps). Pure. */
export const nextIn = (list, cur, loop = false) => { const i = (list || []).findIndex((x) => keyOf(x) === cur); if (i < 0) return (list || [])[0] || null; return list[i + 1] || (loop ? list[0] : null); };
/** matches for the words in the items given: every word in the title, the credit or the tags. Pure. */
export function filterItems(items, q) {
  const words = String(q || '').toLowerCase().match(/[a-zà-ÿ0-9]+/g) || []; if (!words.length) return (items || []).slice();
  return (items || []).filter((it) => { const hay = (it.title + ' ' + (it.by || '') + ' ' + (it.tags || []).join(' ') + ' ' + (it.year || '')).toLowerCase(); return words.every((w) => hay.includes(w)); });
}
/** the share link for an item at a time. Pure. */
export function itemLink(base, it, t = 0) {
  const q = new URLSearchParams(); q.set('v', it.source + ':' + it.id); if (it.host) q.set('h', it.host); if (t >= 1) q.set('t', String(Math.floor(t)));
  return base + '?' + q;
}
/** "?v=commons:Name.webm&t=30" -> { source, id, host, t }, or null. Pure. */
export function itemFromQuery(search) {
  const q = new URLSearchParams(search || ''), v = q.get('v') || ''; const m = /^([a-z]+):(.{1,200})$/.exec(v);
  if (!m || !SOURCES.includes(m[1]) || !/^[\w.:@%()'!,~$+=&-]{1,200}$/.test(m[2])) return null;
  const h = q.get('h') || ''; return { source: m[1], id: m[2], ...(h && /^[a-z0-9.-]{3,100}$/i.test(h) ? { host: h } : {}), t: Math.max(0, Math.floor(+q.get('t') || 0)) };
}
