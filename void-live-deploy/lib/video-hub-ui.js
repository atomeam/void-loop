/**
 * video-hub-ui: the screen of /video/ and the pages of the video lane (lib/video-sites.js). mountVideo(root, { panels, src, de }) builds the panels a page
 * asks for: search, the player, continue watching, recommendations, watch later, playlists, history and the videos saved on this device. Openly licensed
 * files (Wikimedia Commons, the Internet Archive's public domain and Creative Commons items) and Verse's own films play in the page's own player, with
 * speed, quality, captions, chapters, keys and picture-in-picture; YouTube, PeerTube, Dailymotion, Odysee and Vimeo play through the platform's own
 * embed (lib/video.js), so their terms, creators and counts stay theirs. Everything the visitor keeps stays in this browser. English and German.
 * Pure logic: lib/video-hub.js. Tests: tools/video-hub.test.mjs, tools/video-code-page.mjs.
 */
import * as H from '/lib/video-hub.js';
import { DE } from '/lib/video-hub-de.js';
import { parseVideoUrl, embedUrl, watchUrl, PLATFORMS, clockOf } from '/lib/video.js';

const KEY = 'a2m.void.video.v1', SAVED = 'void-video-saved', SW_CACHE = 'void-shell-v2';
const isDe = () => /^de\b/i.test(navigator.language || '') || new URLSearchParams(location.search).get('lang') === 'de';
export const t = (x) => (isDe() && DE[x]) || x;
const esc = (x) => String(x == null ? '' : x).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = (sel, r = document) => r.querySelector(sel);
const mk = (tag, attrs = {}, text) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs)) { if (v === false || v == null) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v); } if (text != null) e.textContent = text; return e; };
function mem() { try { const m = JSON.parse(localStorage.getItem(KEY) || '{}'); return m && typeof m === 'object' ? m : {}; } catch (_) { return {}; } }
function keep(patch) { const m = Object.assign(mem(), patch); try { localStorage.setItem(KEY, JSON.stringify(m)); } catch (_) { /* full or blocked: the page still works */ } return m; }
const SOURCE = { commons: 'Wikimedia Commons', archive: 'Internet Archive', verse: 'Verse', local: 'This device', youtube: 'YouTube', peertube: 'PeerTube', dailymotion: 'Dailymotion', odysee: 'Odysee', vimeo: 'Vimeo', rumble: 'Rumble' };
const NATIVE = new Set(['commons', 'archive', 'verse', 'local']);
const slim = (it) => ({ source: it.source, id: it.id, title: it.title, ...(it.by ? { by: it.by } : {}), ...(it.thumb ? { thumb: it.thumb } : {}), ...(it.tags ? { tags: it.tags.slice(0, 8) } : {}), ...(it.host ? { host: it.host } : {}), ...(it.licence ? { licence: it.licence } : {}), ...(it.seconds ? { seconds: it.seconds } : {}), ...(it.year ? { year: it.year } : {}) });
const sameKey = (a, b) => H.keyOf(a) === H.keyOf(b);
let cfg = {}, cur = null, video = null, frame = null, queue = null, verseFilms = [], results = [], tracks = [], lastSave = 0, blobUrl = '';
const say = (id, msg) => { const n = document.getElementById(id); if (n) n.textContent = msg; };
// the screen says when it waits on the network (aria-busy): a screen reader hears it, and the tower gate reads the page once it is done
let busyN = 0; const busy = async (job) => { const app = document.getElementById('app'); busyN++; if (app) app.setAttribute('aria-busy', 'true'); try { return await job(); } finally { if (--busyN <= 0 && app) { busyN = 0; app.setAttribute('aria-busy', 'false'); } } };

// ---------- the network: each source on its own, a failure says which ----------
async function getJson(u, ms = 9000) { const c = new AbortController(), k = setTimeout(() => c.abort(), ms); try { const r = await fetch(u, { signal: c.signal }); if (!r.ok) throw new Error(String(r.status)); return await r.json(); } finally { clearTimeout(k); } }
async function loadVerse() { if (verseFilms.length) return verseFilms; try { const j = await getJson('/api/films', 6000); verseFilms = (j.films || []).filter((f) => f && /^[a-z0-9][a-z0-9-]{2,95}$/.test(f.id) && f.src).map((f) => ({ source: 'verse', id: f.id, title: String(f.title || f.id).slice(0, 160), by: 'Verse', licence: t('Verse’s own film'), description: String(f.description || '').slice(0, 1200), tags: (f.tags || []).slice(0, 8), src: f.src, page: '/films/', quality: [{ src: f.src, type: 'video/mp4', height: 0, label: t('Original') }] })); } catch (_) { verseFilms = []; } return verseFilms; }
async function searchOpen(q) {
  const [c, a] = await Promise.allSettled([getJson(H.commonsSearchUrl(q)).then(H.commonsItems), getJson(H.archiveSearchUrl(q)).then(H.archiveItems)]);
  const miss = []; if (c.status !== 'fulfilled') miss.push('Wikimedia Commons'); if (a.status !== 'fulfilled') miss.push('Internet Archive');
  const A = c.status === 'fulfilled' ? c.value : [], B = a.status === 'fulfilled' ? a.value : [], out = [];
  for (let i = 0; i < Math.max(A.length, B.length); i++) { if (A[i]) out.push(A[i]); if (B[i]) out.push(B[i]); }
  return { items: out, miss };
}
async function searchPlatform(p, q) {
  const j = await getJson('/api/video?p=' + p + '&q=' + encodeURIComponent(q));
  return (j.hits || []).map((h) => ({ source: h.platform, id: h.id, ...(h.host ? { host: h.host } : {}), title: h.title || h.id, by: h.channel || '', seconds: h.seconds || null, thumb: /^https:\/\//.test(h.thumb || '') ? h.thumb : '', page: watchUrl(h) || '' }));
}
const doSearch = (q, src) => busy(() => searchNow(q, src));
async function searchNow(q, src) {
  q = String(q || '').trim().slice(0, 120); if (!q) return;
  say('v-status', t('Searching…')); const m = mem(), kept = [...H.SEED, ...verseFilms, ...(m.history || []), ...(m.later || []), ...Object.values(m.lists || {}).flat(), ...(m.saved || []).map((x) => x.item)];
  if (!navigator.onLine) { results = H.filterItems(dedupe(kept), q); show(results, t('Kept on this device'), q); say('v-status', t('Offline: these are the videos kept on this device that match.')); return; }
  let items = [], miss = [];
  const plat = async (p) => { try { return await searchPlatform(p, q); } catch (_) { miss.push(SOURCE[p]); return []; } };
  if (src === 'verse') { await loadVerse(); items = H.filterItems(verseFilms, q); }
  else if (src === 'open' || src === 'all') { const o = await searchOpen(q); items = o.items; miss = o.miss; if (src === 'all') { const [y, pt] = await Promise.all([plat('youtube'), plat('peertube')]); items = items.concat(y, pt); await loadVerse(); items = H.filterItems(verseFilms, q).concat(items); } }
  else items = await plat(src);
  results = items; keep({ pool: dedupe(items.map(slim).concat(m.pool || [])).slice(0, 80) });
  show(items, t('Results for') + ' “' + q + '”', q);
  say('v-status', (items.length ? items.length + ' ' + t('videos') : t('Nothing found.')) + (miss.length ? ' ' + miss.join(', ') + ' ' + t('did not answer just now.') : ''));
}
const dedupe = (list) => { const seen = new Set(); return list.filter((x) => x && !seen.has(H.keyOf(x)) && seen.add(H.keyOf(x))); };

// ---------- cards ----------
function card(it, extra, onPlay) {
  const li = mk('li', { class: 'vcard' }), b = mk('button', { type: 'button', class: 'vplay', 'aria-label': t('Play') + ' ' + it.title });
  const th = mk('span', { class: 'thumb' }); if (it.thumb) th.append(mk('img', { src: it.thumb, alt: '', loading: 'lazy', width: '320', height: '180', referrerpolicy: 'no-referrer' }));
  if (it.seconds) th.append(mk('span', { class: 'dur' }, clockOf(it.seconds)));
  b.append(th, mk('span', { class: 'vt' }, it.title)); b.addEventListener('click', () => (onPlay ? onPlay() : play(it, { autoplay: true })));
  const meta = mk('p', { class: 'vm' }, [SOURCE[it.source] || it.source, it.licence, it.by, it.year].filter(Boolean).join(' · '));
  li.append(b, meta); if (extra) li.append(extra); return li;
}
function show(items, title, q) {
  const s = document.getElementById('v-results'); if (!s) return; $('h2', s).textContent = title; const ul = $('ul', s); ul.textContent = '';
  for (const it of items) ul.append(card(it));
  const out = $('.out', s); out.textContent = '';
  if (q) { out.append(mk('span', { class: 'soft' }, t('Also search') + ': ')); for (const [p, href] of [['YouTube', PLATFORMS.youtube.search(q)], ['Wikimedia Commons', 'https://commons.wikimedia.org/w/index.php?search=' + encodeURIComponent('filetype:video ' + q)], ['Internet Archive', PLATFORMS.archive.search(q)], ['PeerTube', PLATFORMS.peertube.search(q)]]) out.append(mk('a', { href, target: '_blank', rel: 'noopener noreferrer', class: 'chip' }, p)); }
}

// ---------- the player ----------
function stage() { const s = document.getElementById('v-stage'); s.textContent = ''; video = null; frame = null; if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = ''; } for (const x of tracks) URL.revokeObjectURL(x.url); tracks = []; return s; }
async function resolve(it) {
  if (it.source === 'commons' && !it.quality) { const j = await getJson(H.commonsFilesUrl([it.id])); const r = H.commonsItems(j)[0]; if (!r) throw new Error('missing'); return { ...it, ...r, title: it.title || r.title, tags: (it.tags || []).concat(r.tags || []) }; }
  if (it.source === 'archive' && !it.quality) { const meta = await getJson(H.archiveMetaUrl(it.id)), p = H.archivePlayable(meta); if (!p || !p.quality.length) throw new Error('missing'); return { ...it, ...p, title: it.title || p.title, by: it.by || p.by, licence: p.licence || '', download: !!p.licence, page: H.ARCHIVE + '/details/' + it.id, thumb: it.thumb || H.ARCHIVE + '/services/img/' + it.id }; }
  if (it.source === 'verse' && !it.src) { const f = (await loadVerse()).find((x) => x.id === it.id); if (!f) throw new Error('missing'); return f; }
  return it;
}
async function savedSrc(it) { try { const m = mem(), s = (m.saved || []).find((x) => x.key === H.keyOf(it)); if (!s || !('caches' in window)) return null; const r = await (await caches.open(SAVED)).match(s.src); return r ? { blob: await r.blob(), src: s.src } : null; } catch (_) { return null; } }
export const play = (it0, o = {}) => busy(() => playNow(it0, o));
async function playNow(it0, { t: at = null, autoplay = false, from = null } = {}) {
  if (!it0) return; queue = from || (queue && queue.items.some((x) => sameKey(x, it0)) ? queue : null);
  const sec = document.getElementById('v-player'); if (!sec) return; sec.hidden = false; const box = stage(); say('v-pstatus', t('Loading…'));
  $('#v-title').textContent = it0.title || it0.id; $('#v-meta').textContent = ''; $('#v-chapters').textContent = '';
  let it = it0;
  if (NATIVE.has(it.source)) {
    const off = it.source !== 'local' ? await savedSrc(it) : null;
    if (!off && it.source !== 'local') { try { it = await resolve(it); } catch (_) { say('v-pstatus', navigator.onLine ? t('This video could not be found at its source just now.') : t('Offline, and this video is not saved on this device.')); return; } }
    cur = it; video = mk('video', { controls: true, playsinline: true, preload: 'metadata', crossorigin: it.source === 'local' || it.source === 'verse' ? null : 'anonymous', ...(it.thumb ? { poster: it.thumb } : {}) });
    box.append(video);
    if (off) { blobUrl = URL.createObjectURL(off.blob); video.src = blobUrl; video.dataset.q = off.src; say('v-pstatus', t('Playing the copy saved on this device.')); }
    else if (it.source === 'local') { video.src = it.src; say('v-pstatus', ''); }
    else { const q = H.pickQuality(it.quality, { width: Math.round(innerWidth * (devicePixelRatio || 1)), saveData: !!(navigator.connection && navigator.connection.saveData), slow: /2g/.test((navigator.connection && navigator.connection.effectiveType) || '') }); video.src = q ? q.src : it.file || it.src; video.dataset.q = video.src; say('v-pstatus', ''); }
    const m = mem(), h = (m.history || []).find((x) => sameKey(x, it)), start = at != null ? at : h && !h.done ? h.pos || 0 : 0;
    video.playbackRate = m.speed || 1; video.defaultPlaybackRate = m.speed || 1;
    video.addEventListener('loadedmetadata', () => { if (start > 1 && start < video.duration - 2) video.currentTime = start; drawChapters(); }, { once: true });
    video.addEventListener('timeupdate', onTime); video.addEventListener('ended', onEnded); video.addEventListener('ratechange', () => { const sp = $('#v-speed'); if (sp) sp.value = String(video.playbackRate); keep({ speed: video.playbackRate }); });
    video.addEventListener('error', () => { if (video.error) say('v-pstatus', t('The browser could not play this file. Try another quality, or open it at its source.')); });
    if (it.source === 'commons' && !off) loadCommonsCaptions(it); else if (it.captions && it.captions.length && !off) for (const c of it.captions.slice(0, 4)) addTrackFrom(c.src, c.label, c.srt);
    if (autoplay) video.play().catch(() => {});
  } else {
    cur = it; const v = { platform: it.source, id: it.id, ...(it.host ? { host: it.host } : {}) }, m = mem();
    const url = embedUrl(v, { start: at || 0, captions: !!m.cc, autoplay: autoplay, origin: location.origin, lang: isDe() ? 'de' : 'en' });
    if (!url) { say('v-pstatus', t('This video cannot be played here: open it at its source.')); return; }
    // YouTube's player needs to know which page it is on: the site sends no referrer, so the frame says its own origin (and nothing more)
    frame = mk('iframe', { src: url, title: it.title || SOURCE[it.source], allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen; web-share', allowfullscreen: true, referrerpolicy: 'strict-origin-when-cross-origin', loading: 'eager' });
    box.append(frame); say('v-pstatus', t('Played by') + ' ' + SOURCE[it.source] + t('’s own player: its controls, its captions and its counts.'));
    if (it.source === 'youtube' && (m.speed || 1) !== 1) frame.addEventListener('load', () => setTimeout(() => ytCmd('setPlaybackRate', [m.speed]), 800));
    if (!it.by && ['youtube', 'vimeo', 'dailymotion'].includes(it.source)) getJson('/api/video?url=' + encodeURIComponent(watchUrl(v))).then((j) => { if (j && j.video && cur && sameKey(cur, it)) { cur.title = j.video.title || cur.title; cur.by = j.video.channel; $('#v-title').textContent = cur.title; meta(); } }).catch(() => {});
    record(0, 0, false);
  }
  meta(); controls(); nowPlaying(); drawQueue(); try { history.replaceState(null, '', H.itemLink(location.pathname, it, at || 0) + (location.hash.startsWith('#pl=') ? location.hash : '')); } catch (_) { /* no history here */ }
  if (autoplay) sec.scrollIntoView({ block: 'start', behavior: 'smooth' });
}
function meta() {
  const it = cur, p = $('#v-meta'); if (!it || !p) return; p.textContent = '';
  p.append(mk('span', {}, SOURCE[it.source] || it.source));
  if (it.licence) { p.append(' · '); p.append(it.licenceUrl ? mk('a', { href: it.licenceUrl, target: '_blank', rel: 'noopener noreferrer' }, it.licence) : mk('span', {}, it.licence)); }
  if (it.by) p.append(' · ' + t('by') + ' ' + it.by);
  if (it.page) { p.append(' · '); p.append(mk('a', { href: it.page, target: '_blank', rel: 'noopener noreferrer', id: 'v-open' }, t('Open on') + ' ' + (SOURCE[it.source] || t('its site')))); }
  const d = $('#v-desc'); if (d) { d.textContent = it.description || ''; d.hidden = !it.description; }
}
function nowPlaying() {
  const el = document.getElementById('v-qnow'); if (!el || !cur) return; if (!video) { el.textContent = t('Playing:') + ' ' + (SOURCE[cur.source] || '') + t('’s own player'); return; }
  const q = (cur.quality || []).find((x) => x.src === video.dataset.q); el.textContent = t('Playing:') + ' ' + (q ? q.label + (q.size ? ' · ' + H.sizeLabel(q.size) : '') : cur.source === 'local' ? t('your file') : t('Original'));
}
function controls() {
  const it = cur, nat = !!video, sp = $('#v-speed'), ql = $('#v-quality'), cc = $('#v-cc'), pip = $('#v-pip'), sv = $('#v-save'), dl = $('#v-dl');
  sp.value = String(mem().speed || 1); sp.disabled = !nat && it.source !== 'youtube';
  ql.textContent = ''; ql.append(mk('option', { value: '' }, t('Auto')));
  for (const q of (nat && it.quality) || []) { const o = mk('option', { value: q.src }, q.label); if (video && video.dataset.q === q.src) o.selected = true; ql.append(o); }
  ql.disabled = !nat || !(it.quality && it.quality.length > 1); $('#v-ccfile-l').hidden = !nat; cc.disabled = !nat; drawTracks();
  pip.hidden = !(nat && document.pictureInPictureEnabled);
  const can = nat && it.download && it.source !== 'local'; sv.hidden = !can; dl.hidden = !can;
  if (can) { const src = (video && video.dataset.q) || it.file || ''; dl.href = src; const saved = (mem().saved || []).some((x) => x.key === H.keyOf(it)); sv.textContent = saved ? t('Saved on this device: remove') : t('Save for offline'); }
  $('#v-mark').disabled = !nat; $('#v-later').textContent = (mem().later || []).some((x) => sameKey(x, it)) ? t('In watch later ✓') : t('Watch later');
  const sel = $('#v-addpl'); sel.textContent = ''; sel.append(mk('option', { value: '' }, t('Add to a playlist…'))); for (const n of Object.keys(mem().lists || {})) sel.append(mk('option', { value: n }, n)); sel.append(mk('option', { value: '+' }, t('New playlist…')));
  $('#v-next').hidden = !queue;
}
function drawTracks() { const cc = $('#v-cc'); if (!cc) return; cc.textContent = ''; cc.append(mk('option', { value: '' }, t('Captions off'))); tracks.forEach((x, i) => cc.append(mk('option', { value: String(i) }, x.label))); const on = video && [...video.textTracks].findIndex((x) => x.mode === 'showing'); cc.value = on >= 0 ? String(on) : ''; }
function addTrack(vtt, label, lang = '') {
  if (!video) return; const url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' })), tr = mk('track', { kind: 'subtitles', label, src: url, ...(lang ? { srclang: lang } : {}) });
  video.append(tr); tracks.push({ url, label }); const want = mem().cc; setTimeout(() => { const list = [...video.textTracks]; if (want && list.length === 1) list[0].mode = 'showing'; else if (list.length) list[list.length - 1].mode = list[list.length - 1].mode === 'showing' ? 'showing' : 'disabled'; drawTracks(); }, 0);
}
async function addTrackFrom(src, label, srt) { try { const r = await fetch(src); if (!r.ok) return; const txt = await r.text(); addTrack(H.srtToVtt(txt), label); } catch (_) { /* no captions */ } }
async function loadCommonsCaptions(it) { for (const lang of isDe() ? ['de', 'en'] : ['en', 'de']) { try { const r = await fetch(H.commonsCaptionsUrl(it.id, lang)); if (!r.ok) continue; const txt = await r.text(); if (/^WEBVTT/.test(txt) && /-->/.test(txt) && cur === it) addTrack(txt, lang === 'de' ? 'Deutsch' : 'English', lang); } catch (_) { /* none */ } } }
function chaptersFor(it) { const own = (mem().chapters || {})[H.keyOf(it)] || []; const from = H.chaptersOf(it.description || ''); return [...from, ...own].sort((a, b) => a.t - b.t).filter((c, i, a) => !i || c.t !== a[i - 1].t); }
function drawChapters() {
  const ol = $('#v-chapters'); if (!ol || !cur) return; ol.textContent = ''; const ch = chaptersFor(cur); $('#v-chh').hidden = !ch.length;
  ch.forEach((c, i) => { const li = mk('li'), b = mk('button', { type: 'button', class: 'chip', 'data-i': String(i) }, clockOf(c.t) + ' ' + c.title); b.addEventListener('click', () => { if (video) { video.currentTime = c.t; video.play().catch(() => {}); } }); li.append(b); ol.append(li); });
}
function onTime() {
  if (!video || !cur) return; const now = Date.now(), ch = chaptersFor(cur), i = H.chapterAt(ch, video.currentTime);
  document.querySelectorAll('#v-chapters button').forEach((b) => b.classList.toggle('on', +b.dataset.i === i));
  if (now - lastSave > 4000) { lastSave = now; record(video.currentTime, video.duration || 0, false); }
}
function onEnded() { record(video.duration || 0, video.duration || 0, true); const nx = queue && H.nextIn(queue.items, H.keyOf(cur), !!queue.loop); if (nx) play(nx, { autoplay: true, from: queue }); else drawLists(); }
function record(pos, dur, done) {
  if (!cur || cur.source === 'local' || mem().pause) return; const m = mem(), hist = (m.history || []).filter((x) => !sameKey(x, cur));
  hist.unshift({ ...slim(cur), at: Date.now(), pos: Math.round(pos), dur: Math.round(dur || 0), done: done || (dur > 0 && pos / dur > 0.94) });
  keep({ history: hist.slice(0, 200) }); if (done) drawLists();
}
function ytCmd(func, args = []) { try { frame && frame.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args }), '*'); } catch (_) { /* the frame is gone */ } }
function act(a) {
  if (a === 'next') { const nx = queue && H.nextIn(queue.items, H.keyOf(cur), !!queue.loop); if (nx) play(nx, { autoplay: true, from: queue }); return true; }
  if (!video) return false; const v = video;
  switch (a) {
    case 'play': v.paused ? v.play().catch(() => {}) : v.pause(); break;
    case 'back10': v.currentTime = Math.max(0, v.currentTime - 10); break; case 'fwd10': v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 10); break;
    case 'back5': v.currentTime = Math.max(0, v.currentTime - 5); break; case 'fwd5': v.currentTime = Math.min(v.duration || 1e9, v.currentTime + 5); break;
    case 'volup': v.volume = Math.min(1, v.volume + 0.1); break; case 'voldown': v.volume = Math.max(0, v.volume - 0.1); break; case 'mute': v.muted = !v.muted; break;
    case 'full': document.fullscreenElement ? document.exitFullscreen().catch(() => {}) : (v.requestFullscreen ? v.requestFullscreen().catch(() => {}) : 0); break;
    case 'captions': { const l = [...v.textTracks]; if (!l.length) return true; const on = l.findIndex((x) => x.mode === 'showing'); l.forEach((x) => (x.mode = 'disabled')); if (on < 0) l[0].mode = 'showing'; keep({ cc: on < 0 }); drawTracks(); say('v-pstatus', on < 0 ? t('Captions on') : t('Captions off')); break; }
    case 'pip': pipToggle(); break;
    case 'slower': case 'faster': v.playbackRate = H.stepSpeed(v.playbackRate, a === 'faster' ? 1 : -1); say('v-pstatus', t('Speed') + ' ' + v.playbackRate + '×'); break;
    case 'frameback': v.pause(); v.currentTime = Math.max(0, v.currentTime - 1 / 25); break; case 'framefwd': v.pause(); v.currentTime += 1 / 25; break;
    case 'start': v.currentTime = 0; break; case 'end': v.currentTime = Math.max(0, (v.duration || 0) - 0.1); break;
    default: { const m = /^seek:(\d)$/.exec(a); if (m && v.duration) v.currentTime = v.duration * (+m[1] / 10); else return false; }
  }
  return true;
}
async function pipToggle() { try { if (document.pictureInPictureElement) await document.exitPictureInPicture(); else if (video) await video.requestPictureInPicture(); } catch (_) { say('v-pstatus', t('Picture-in-picture is not available for this video.')); } }
async function saveToggle() {
  const it = cur; if (!it || !it.download) return; const m = mem(), k = H.keyOf(it), has = (m.saved || []).find((x) => x.key === k);
  try {
    const c = await caches.open(SAVED);
    if (has) { await c.delete(has.src); keep({ saved: (m.saved || []).filter((x) => x.key !== k) }); say('v-pstatus', t('Removed from this device.')); controls(); drawLists(); return; }
    const q = (it.quality || []).find((x) => x.src === (video && video.dataset.q)) || H.pickQuality(it.quality, { width: 640 }); const src = q ? q.src : it.file;
    if (q && q.size > 6e8) { say('v-pstatus', t('That file is over 600 MB: pick a smaller quality first.')); return; }
    say('v-pstatus', t('Saving for offline…')); const r = await fetch(src); if (!r.ok) throw new Error(String(r.status)); const blob = await r.blob();
    await c.put(src, new Response(blob, { headers: { 'content-type': blob.type || (q && q.type) || 'video/mp4' } }));
    keep({ saved: [{ key: k, src, size: blob.size, item: slim(it), at: Date.now() }].concat((mem().saved || []).filter((x) => x.key !== k)) });
    say('v-pstatus', t('Saved on this device') + ' (' + H.sizeLabel(blob.size) + '). ' + t('It plays with the network cut.')); controls(); drawLists();
  } catch (_) { say('v-pstatus', t('Could not save this file here. Use Download file instead.')); }
}

// ---------- the lists kept on the device ----------
function listRow(id, title, items, opts = {}) {
  const s = document.getElementById(id); if (!s) return; const ul = $('ul', s); ul.textContent = ''; $('.empty', s).hidden = !!items.length;
  items.forEach((it, i) => {
    const row = mk('div', { class: 'acts' });
    if (opts.move) { row.append(mk('button', { type: 'button', 'aria-label': t('Move up'), onclick: () => opts.move(i, i - 1), disabled: i === 0 }, '↑'), mk('button', { type: 'button', 'aria-label': t('Move down'), onclick: () => opts.move(i, i + 1), disabled: i === items.length - 1 }, '↓')); }
    if (opts.remove) row.append(mk('button', { type: 'button', onclick: () => opts.remove(i) }, t('Remove')));
    if (opts.extra) row.append(...opts.extra(it));
    ul.append(card(it.item || it, row.childNodes.length ? row : null));
  });
}
function drawLists() {
  const m = mem(), hist = m.history || [];
  listRow('v-continue', '', hist.filter((h) => !h.done && h.pos > 5 && h.source !== 'local').slice(0, 8), { extra: (h) => [mk('span', { class: 'soft' }, t('at') + ' ' + clockOf(h.pos) + (h.dur ? ' / ' + clockOf(h.dur) : ''))] });
  listRow('v-later', '', m.later || [], { move: (a, b) => { keep({ later: H.moveItem(mem().later, a, b) }); drawLists(); }, remove: (i) => { const l = (mem().later || []).slice(); l.splice(i, 1); keep({ later: l }); drawLists(); if (cur) controls(); } });
  listRow('v-history', '', hist.slice(0, 30), { extra: (h) => [mk('span', { class: 'soft' }, h.done ? t('watched') : t('at') + ' ' + clockOf(h.pos || 0))] });
  listRow('v-saved', '', (m.saved || []).map((x) => ({ ...x.item, sz: x.size })), { extra: (x) => [mk('span', { class: 'soft' }, H.sizeLabel(x.sz || 0))] });
  const pool = dedupe([...results, ...(m.pool || []), ...verseFilms, ...H.SEED]), recs = H.recommend(hist, pool, 8);
  const rs = document.getElementById('v-recs'); if (rs) { const ul = $('ul', rs); ul.textContent = ''; for (const r of recs) ul.append(card(r.item, r.why ? mk('p', { class: 'soft why' }, t('Because you watched') + ' ' + r.why) : null)); $('.empty', rs).hidden = !!recs.length; $('.note', rs).textContent = hist.length ? t('Worked out on this device from what you watched here; nothing about it leaves this browser.') : t('Watch something and this list learns from it, on this device only.'); }
  drawPlaylists(); const pz = $('#v-pause'); if (pz) pz.checked = !!m.pause;
}
function drawPlaylists() {
  const s = document.getElementById('v-lists'); if (!s) return; const box = $('.lists', s); box.textContent = ''; const lists = mem().lists || {};
  $('.empty', s).hidden = !!Object.keys(lists).length;
  for (const [name, items] of Object.entries(lists)) {
    const d = mk('details', { class: 'pl' }), sm = mk('summary', {}, name + ' · ' + items.length + ' ' + t('videos')); d.append(sm);
    const acts = mk('div', { class: 'row' });
    acts.append(mk('button', { type: 'button', class: 'go', disabled: !items.length, onclick: () => play(items[0], { autoplay: true, from: { name, items, loop: false } }) }, t('Play all')),
      mk('button', { type: 'button', disabled: !items.length, onclick: () => { const sh = items.slice().sort(() => Math.random() - 0.5); play(sh[0], { autoplay: true, from: { name, items: sh, loop: false } }); } }, t('Shuffle')),
      mk('button', { type: 'button', onclick: () => share(location.origin + location.pathname + H.playlistLink(name, items), t('Copied the playlist link: it holds the whole list.')) }, t('Share playlist link')),
      mk('button', { type: 'button', onclick: () => { const l = { ...mem().lists }; delete l[name]; keep({ lists: l }); drawLists(); if (cur) controls(); } }, t('Delete playlist')));
    d.append(acts); const ul = mk('ul', { class: 'grid' }); d.append(ul);
    items.forEach((it, i) => { const row = mk('div', { class: 'acts' }); const mv = (a, b) => { const l = { ...mem().lists }; l[name] = H.moveItem(l[name], a, b); keep({ lists: l }); drawPlaylists(); };
      row.append(mk('button', { type: 'button', 'aria-label': t('Move up'), disabled: i === 0, onclick: () => mv(i, i - 1) }, '↑'), mk('button', { type: 'button', 'aria-label': t('Move down'), disabled: i === items.length - 1, onclick: () => mv(i, i + 1) }, '↓'), mk('button', { type: 'button', onclick: () => { const l = { ...mem().lists }; l[name] = l[name].filter((_, k) => k !== i); keep({ lists: l }); drawPlaylists(); } }, t('Remove')));
      ul.append(card(it, row, () => play(it, { autoplay: true, from: { name, items, loop: false } }))); });
    box.append(d);
  }
}
function drawQueue() { const s = document.getElementById('v-queue'); if (!s) return; s.hidden = !queue; if (!queue) return; $('h3', s).textContent = t('Playing from') + ' ' + queue.name; const ol = $('ol', s); ol.textContent = ''; for (const it of queue.items) { const b = mk('button', { type: 'button', class: 'qi' + (cur && sameKey(it, cur) ? ' on' : '') }, it.title); b.onclick = () => play(it, { autoplay: true, from: queue }); const li = mk('li'); li.append(b); ol.append(li); } }
async function share(url, done) { try { if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) { await navigator.share({ title: document.title, url }); return; } } catch (e) { if (e && e.name === 'AbortError') return; } try { await navigator.clipboard.writeText(url); say('v-sharemsg', done || t('Copied the link.')); } catch (_) { say('v-sharemsg', url); } }

// ---------- panels ----------
const PANELS = {};
const pane = (id, title, inner, cls = 'panel') => { const s = mk('section', { class: cls, id, 'aria-labelledby': id + '-h' }); s.innerHTML = '<h2 id="' + id + '-h">' + esc(t(title)) + '</h2>' + inner; return s; };
PANELS.search = (c) => {
  const s = pane('v-find', c.searchTitle || 'Find a video', '<form id="v-form" class="row" role="search"><input type="search" id="v-q" aria-label="' + esc(t('Search videos')) + '" placeholder="' + esc(t('Search: big buck bunny, moon landing, cooking…')) + '" autocomplete="off"><select id="v-src" aria-label="' + esc(t('Where to search')) + '"></select><button type="submit" class="go">' + esc(t('Search')) + '</button></form>'
    + '<form id="v-linkf" class="row"><input type="url" id="v-link" aria-label="' + esc(t('Play a link')) + '" placeholder="' + esc(t('Or paste a video link: YouTube, PeerTube, Vimeo, Archive, Commons…')) + '"><button type="submit">' + esc(t('Play the link')) + '</button><label class="btn" for="v-file">' + esc(t('Play a file from this device')) + '</label><input type="file" id="v-file" class="pick" accept="video/*"></form><p class="live" id="v-status" role="status"></p>');
  const sel = $('#v-src', s); for (const [v, l] of [['open', 'Open video (Commons and Archive)'], ['all', 'Everywhere'], ['verse', 'Verse films'], ['youtube', 'YouTube'], ['peertube', 'PeerTube'], ['dailymotion', 'Dailymotion'], ['odysee', 'Odysee']]) sel.append(mk('option', { value: v }, t(l)));
  sel.value = c.src || 'open';
  $('#v-form', s).addEventListener('submit', (e) => { e.preventDefault(); doSearch($('#v-q').value, sel.value); try { const u = new URL(location.href); u.searchParams.set('q', $('#v-q').value); u.searchParams.set('src', sel.value); history.replaceState(null, '', u.pathname + u.search + u.hash); } catch (_) { /* fine */ } });
  $('#v-linkf', s).addEventListener('submit', (e) => { e.preventDefault(); openLink($('#v-link').value); });
  $('#v-file', s).addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) play({ source: 'local', id: f.name.slice(0, 100), title: f.name.slice(0, 160), src: URL.createObjectURL(f), licence: t('Your file, played on this device') }, { autoplay: true }); });
  return s;
};
function openLink(raw) {
  const text = String(raw || '').trim(); if (!text) return; const cf = H.commonsFileOf(text);
  if (cf) return play({ source: 'commons', id: cf, title: cf.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ') }, { autoplay: true });
  const v = parseVideoUrl(text);
  if (v && v.platform === 'archive') return play({ source: 'archive', id: v.id, title: v.id }, { autoplay: true, t: v.start || null });
  if (v && v.id && ['youtube', 'peertube', 'dailymotion', 'odysee', 'vimeo', 'rumble'].includes(v.platform)) return play({ source: v.platform, id: v.id, ...(v.host ? { host: v.host } : {}), title: SOURCE[v.platform] + ' ' + t('video'), page: watchUrl(v) }, { autoplay: true, t: v.start || null });
  say('v-status', t('That link is not a video page Verse can play. Paste a YouTube, PeerTube, Vimeo, Dailymotion, Odysee, Archive or Commons link.'));
}
PANELS.player = () => {
  const s = pane('v-player', 'Now playing', '<div id="v-stage" class="vstage"></div><p class="live" id="v-pstatus" role="status"></p><h3 id="v-title"></h3><p class="vm" id="v-meta"></p>'
    + '<div class="row ctl"><label class="lab">' + esc(t('Speed')) + ' <select id="v-speed">' + H.SPEEDS.map((x) => '<option value="' + x + '">' + x + '×</option>').join('') + '</select></label>'
    + '<label class="lab">' + esc(t('Quality')) + ' <select id="v-quality"></select></label><span class="soft" id="v-qnow"></span><label class="lab">' + esc(t('Captions')) + ' <select id="v-cc"></select></label><label class="btn" id="v-ccfile-l" for="v-ccfile">' + esc(t('Load captions (.vtt, .srt)')) + '</label><input type="file" id="v-ccfile" class="pick" accept=".vtt,.srt,text/vtt">'
    + '<button type="button" id="v-pip">' + esc(t('Picture-in-picture')) + '</button></div>'
    + '<div class="row ctl"><button type="button" id="v-later">' + esc(t('Watch later')) + '</button><select id="v-addpl" aria-label="' + esc(t('Add to a playlist')) + '"></select><button type="button" id="v-share">' + esc(t('Share at this moment')) + '</button><button type="button" id="v-save">' + esc(t('Save for offline')) + '</button><a id="v-dl" class="btn" target="_blank" rel="noopener noreferrer" download>' + esc(t('Download file')) + '</a><button type="button" id="v-next" hidden>' + esc(t('Next in playlist')) + '</button></div>'
    + '<div class="row ctl"><input type="text" id="v-chname" aria-label="' + esc(t('Chapter name')) + '" placeholder="' + esc(t('Chapter name')) + '" maxlength="80"><button type="button" id="v-mark">' + esc(t('Mark a chapter here')) + '</button></div>'
    + '<h3 id="v-chh" hidden>' + esc(t('Chapters')) + '</h3><ol id="v-chapters" class="chips plainl"></ol><p id="v-desc" class="desc" hidden></p>'
    + '<div id="v-queue" class="seg" hidden><h3></h3><ol class="plainl"></ol></div>'
    + '<details class="keys"><summary>' + esc(t('Keyboard shortcuts')) + '</summary><p class="soft">' + esc(t('k or space play and pause · j and l 10 s back and on · ← → 5 s · ↑ ↓ volume · m mute · f full screen · c captions · i picture-in-picture · < > speed · , . one frame · 0 to 9 jump to that tenth · Shift+N next in the playlist')) + '</p></details>', 'panel player');
  s.hidden = true;
  $('#v-speed', s).addEventListener('change', (e) => { const x = +e.target.value; keep({ speed: x }); if (video) video.playbackRate = x; else if (cur && cur.source === 'youtube') ytCmd('setPlaybackRate', [x]); });
  $('#v-quality', s).addEventListener('change', (e) => { if (!video || !cur) return; const src = e.target.value || (H.pickQuality(cur.quality, { width: innerWidth }) || {}).src; if (!src) return; const at = video.currentTime, was = !video.paused; video.src = src; video.dataset.q = src; video.addEventListener('loadedmetadata', () => { video.currentTime = at; if (was) video.play().catch(() => {}); }, { once: true }); $('#v-dl').href = src; nowPlaying(); });
  $('#v-cc', s).addEventListener('change', (e) => { if (!video) return; const l = [...video.textTracks]; l.forEach((x, i) => (x.mode = String(i) === e.target.value ? 'showing' : 'disabled')); keep({ cc: e.target.value !== '' }); });
  $('#v-ccfile', s).addEventListener('change', async (e) => { const f = e.target.files && e.target.files[0]; if (!f) return; addTrack(H.srtToVtt(await f.text()), f.name.slice(0, 40)); setTimeout(() => { const l = [...video.textTracks]; l.forEach((x, i) => (x.mode = i === l.length - 1 ? 'showing' : 'disabled')); drawTracks(); }, 50); say('v-pstatus', t('Captions loaded from your file.')); });
  $('#v-pip', s).addEventListener('click', pipToggle);
  $('#v-later', s).addEventListener('click', () => { if (!cur || cur.source === 'local') return; const l = mem().later || []; keep({ later: l.some((x) => sameKey(x, cur)) ? l.filter((x) => !sameKey(x, cur)) : [slim(cur)].concat(l) }); controls(); drawLists(); });
  $('#v-addpl', s).addEventListener('change', (e) => { if (!cur || cur.source === 'local') { e.target.value = ''; return; } let n = e.target.value; if (n === '+') { n = (prompt(t('Name of the new playlist')) || '').trim().slice(0, 60); } if (!n) { e.target.value = ''; return; } const lists = { ...(mem().lists || {}) }; lists[n] = (lists[n] || []).filter((x) => !sameKey(x, cur)).concat(slim(cur)); keep({ lists }); say('v-pstatus', t('Added to') + ' ' + n + '.'); controls(); drawLists(); });
  $('#v-share', s).addEventListener('click', () => { if (!cur || cur.source === 'local') return; const at = video ? video.currentTime : 0; share(location.origin + H.itemLink(location.pathname, cur, at), t('Copied the link') + (at >= 1 ? ' (' + t('starts at') + ' ' + clockOf(at) + ').' : '.')); });
  $('#v-save', s).addEventListener('click', saveToggle);
  $('#v-next', s).addEventListener('click', () => act('next'));
  $('#v-mark', s).addEventListener('click', () => { if (!video || !cur) return; const name = ($('#v-chname').value || '').trim().slice(0, 80) || t('Chapter') + ' ' + (chaptersFor(cur).length + 1); const all = { ...(mem().chapters || {}) }, k = H.keyOf(cur); all[k] = (all[k] || []).concat({ t: Math.floor(video.currentTime), title: name }); keep({ chapters: all }); $('#v-chname').value = ''; drawChapters(); say('v-pstatus', t('Chapter marked at') + ' ' + clockOf(video.currentTime) + '.'); });
  return s;
};
PANELS.results = (c) => { const s = pane('v-results', c.shelfTitle || 'Start here: open films', '<p class="note">' + esc(t(c.shelfNote || 'Films free to watch and keep: each shows its licence and who made it.')) + '</p><ul class="grid"></ul><p class="out row"></p>'); return s; };
PANELS.continue = () => pane('v-continue', 'Continue watching', '<p class="empty soft">' + esc(t('Videos you leave part way through come back here, at the moment you stopped.')) + '</p><ul class="grid"></ul>');
PANELS.recs = () => pane('v-recs', 'Recommended for you', '<p class="note"></p><p class="empty soft">' + esc(t('Nothing to suggest yet.')) + '</p><ul class="grid"></ul>');
PANELS.later = () => pane('v-later', 'Watch later', '<p class="empty soft">' + esc(t('Press Watch later under a video to keep it here.')) + '</p><ul class="grid"></ul>');
PANELS.lists = () => {
  const s = pane('v-lists', 'Playlists', '<form class="row" id="v-newpl"><input type="text" id="v-plname" maxlength="60" aria-label="' + esc(t('Name of the new playlist')) + '" placeholder="' + esc(t('Name of the new playlist')) + '"><button type="submit">' + esc(t('New playlist')) + '</button></form><p class="empty soft">' + esc(t('No playlists yet. Make one, then add videos from the player.')) + '</p><div class="lists"></div>');
  $('#v-newpl', s).addEventListener('submit', (e) => { e.preventDefault(); const n = $('#v-plname').value.trim().slice(0, 60); if (!n) return; const lists = { ...(mem().lists || {}) }; if (!lists[n]) lists[n] = []; keep({ lists }); $('#v-plname').value = ''; drawLists(); if (cur) controls(); });
  return s;
};
PANELS.history = () => {
  const s = pane('v-history', 'History', '<div class="row"><label class="chk"><input type="checkbox" id="v-pause"> ' + esc(t('Pause history')) + '</label><button type="button" id="v-clear">' + esc(t('Clear history')) + '</button></div><p class="empty soft">' + esc(t('What you watch here is listed on this device only.')) + '</p><ul class="grid"></ul>');
  $('#v-pause', s).addEventListener('change', (e) => keep({ pause: e.target.checked }));
  $('#v-clear', s).addEventListener('click', () => { keep({ history: [] }); drawLists(); });
  return s;
};
PANELS.saved = () => pane('v-saved', 'Saved on this device', '<p class="empty soft">' + esc(t('Open films you save play here with the network cut. Only files whose licence allows it can be saved.')) + '</p><ul class="grid"></ul>');

function keepForOffline() {
  try { if (!('caches' in window)) return; caches.open(SW_CACHE).then((c) => Promise.all([location.pathname, location.pathname + 'app.js', '/lib/video-hub-ui.js', '/lib/video-hub.js', '/lib/video-hub-de.js', '/lib/video.js', '/lib/toolkit.js', '/lib/tool-sites.js', '/lib/video-sites.js'].map((u) => c.match(u).then((hit) => hit || c.add(u)).catch(() => {})))).catch(() => {}); } catch (_) { /* no cache here */ }
}
/** mounts the panels a page asks for: { panels: [...], src: 'open' | 'all' | 'verse' | 'youtube' | ..., de: { h1, intro } }. */
export async function mountVideo(root, c = {}) {
  cfg = c; root.textContent = ''; root.setAttribute('aria-busy', 'true');
  for (const p of c.panels || ['search', 'player', 'results', 'continue', 'recs', 'later', 'lists', 'history', 'saved']) if (PANELS[p]) root.append(PANELS[p](c));
  if (!document.getElementById('v-player')) root.prepend(PANELS.player(c));
  const foot = mk('div', { class: 'row' }); foot.innerHTML = '<button type="button" id="v-sharepage">' + esc(t('Share link')) + '</button> <span class="live" id="v-sharemsg" role="status"></span>'; root.append(foot);
  $('#v-sharepage').addEventListener('click', () => share(location.href.replace(/#(?!pl=).*$/, '')));
  root.append(mk('p', { class: 'note' }, t('Open video from Wikimedia Commons (every file under a free licence, credited as its page asks) and the Internet Archive (only items marked public domain or Creative Commons). Other platforms play in their own official players. Your lists, history and saved files stay in this browser.')));
  if (isDe()) { document.documentElement.lang = 'de'; if (c.de) { const h = document.querySelector('h1'), p = document.querySelector('.intro'); if (h && c.de.h1) h.textContent = c.de.h1; if (p && c.de.intro) p.textContent = c.de.intro; if (c.de.h1) document.title = c.de.h1 + ' · Verse'; } }
  // the player's keys work anywhere on the page except while typing in a field (and Space or Enter still press a focused button)
  addEventListener('keydown', (e) => { const tag = (e.target && e.target.tagName) || ''; if (e.ctrlKey || e.metaKey || e.altKey || /^(INPUT|SELECT|TEXTAREA)$/.test(tag) || (e.target && e.target.isContentEditable) || ((tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') && (e.key === ' ' || e.key === 'Enter'))) return; const a = H.keyAction(e.key, { shift: e.shiftKey }); if (a && act(a)) e.preventDefault(); });
  addEventListener('online', () => say('v-status', '')); addEventListener('offline', () => say('v-status', t('Offline: search looks through the videos kept on this device.')));
  const q = new URLSearchParams(location.search), shelf = c.shelf === 'verse' ? await loadVerse() : H.SEED.slice();
  if (c.shelf !== 'verse') loadVerse().then(() => drawLists());
  show(shelf, t(c.shelfTitle || 'Start here: open films'));
  drawLists();
  const pl = H.playlistFrom(location.hash); if (pl && pl.items.length) { const lists = { ...(mem().lists || {}) }; let n = pl.name; if (lists[n] && JSON.stringify(lists[n].map(H.keyOf)) !== JSON.stringify(pl.items.map(H.keyOf))) n += ' (2)'; lists[n] = pl.items; keep({ lists }); drawLists(); say('v-status', t('A shared playlist came from the link and is kept here:') + ' ' + n + '.'); }
  if (q.get('q')) { const sel = $('#v-src'); if (sel && q.get('src')) sel.value = q.get('src'); const qq = $('#v-q'); if (qq) qq.value = q.get('q'); doSearch(q.get('q'), (sel && sel.value) || c.src || 'open'); }
  const want = H.itemFromQuery(location.search); if (want) { const known = [...H.SEED, ...(mem().history || []), ...(mem().later || [])].find((x) => x.source === want.source && x.id === want.id); play(known || { source: want.source, id: want.id, ...(want.host ? { host: want.host } : {}), title: want.id }, { t: want.t || null }); }
  if (!busyN) root.setAttribute('aria-busy', 'false');
  document.documentElement.dataset.videoReady = '1';
  keepForOffline();
}
