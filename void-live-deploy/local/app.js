// /local/: the radio and TV stations near a visitor, playing in the page (lib/local-media.js; functions/api/local.js for the place and the radio;
// /local/tv/<CC>.json for TV, written by tools/local-tv.mjs). A stream plays from the station's own server: an <audio> for radio, a <video>
// for TV, with hls.js (vendor/, loaded only when an HLS stream is played) where the browser has no HLS of its own. A stream that does not
// play says so on its row and offers the station's own link. Saved stations stay on this device.
import { tvNear, groupTv, placeName, linkOf, httpsOf, placeFromLink } from '/lib/local-media.js';
import { mountRelated } from '/lib/toolkit.js';

const $ = (id) => document.getElementById(id);
const KEY = 'a2m.void.local.v1', HLS = '/vendor/hls.js-1.7.3/hls.light.min.mjs';
const audio = $('audio'), video = $('video');
let place = null, from = '', tab = 'radio', radio = [], tv = [], tvIndex = null, hls = null, current = null, watchdog = 0;

const load = () => { try { const s = JSON.parse(localStorage.getItem(KEY) || '{}'); return { saved: Array.isArray(s.saved) ? s.saved.slice(0, 50) : [] }; } catch (_) { return { saved: [] }; } };
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };
const state = load();
const el = (tag, props = {}, ...kids) => { const n = document.createElement(tag); for (const [k, v] of Object.entries(props)) { if (k === 'dataset') Object.assign(n.dataset, v); else if (k in n) n[k] = v; else n.setAttribute(k, v); } n.append(...kids.filter((k) => k != null)); return n; };
const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (_) { return ''; } };
const getJson = async (u) => { const r = await fetch(u, { headers: { accept: 'application/json' } }); const j = await r.json().catch(() => null); if (!j) throw new Error('status ' + r.status); return j; };

// ---- the place
function showWhere() {
  $('where').replaceChildren(...(place ? ['Stations near ', el('b', { textContent: placeName(place) }), from === 'connection' ? el('span', { className: 'hint', textContent: ' (from your connection, roughly)' }) : ''] : ['Type a town or city to find its stations.']));
  $('radio-head').textContent = place ? 'Radio stations near ' + (place.city || placeName(place)) : 'Radio stations near you';
  $('tv-head').textContent = place ? 'TV stations near ' + (place.city || placeName(place)) : 'TV stations near you';
  document.dispatchEvent(new Event('tk:card'));
}
async function setPlace(p, how) {
  place = p; from = how; showWhere();
  if (how !== 'link') history.replaceState(null, '', how === 'connection' ? linkOf({ tab: tab === 'tv' ? 'tv' : '' }) : linkOf({ place: p.city || placeName(p), tab: tab === 'tv' ? 'tv' : '' }));
  await Promise.all([loadRadio(), loadTv()]);
}
async function findPlace(name) {
  $('where').textContent = 'Looking for ' + name + '…';
  try { const j = await getJson('/api/local?place=' + encodeURIComponent(name)); if (!j.ok) throw new Error(j.say || 'not found'); await setPlace(j.place, 'typed'); }
  catch (e) { $('where').textContent = String(e && e.message || '').startsWith('No place') ? e.message : 'That place could not be looked up just now. Try another name.'; }
}

// ---- radio
function radioItem(r, { mine = false } = {}) {
  const kept = state.saved.some((s) => s.id === r.id);
  const sub = [r.tags.join(', '), [r.codec, r.kbps ? r.kbps + ' kbps' : ''].filter(Boolean).join(' '), r.km != null ? r.km + ' km away' : r.where].filter(Boolean).join(' · ');
  const li = el('li', { dataset: { id: r.id, kind: 'radio' } },
    el('div', { className: 'st' }, r.icon ? el('img', { src: r.icon, alt: '', loading: 'lazy', referrerPolicy: 'no-referrer', onerror() { this.replaceWith(el('span', { className: 'ph', textContent: '📻' })); } }) : el('span', { className: 'ph', textContent: '📻' }),
      el('div', {}, el('b', { textContent: r.name }), el('small', { textContent: sub }))),
    el('div', { className: 'acts' },
      r.play ? el('button', { type: 'button', className: 'go', textContent: 'Play', onclick: () => playRadio(r, li) }) : null,
      !r.play && (r.home || r.stream) ? el('a', { className: 'btn go', href: r.home || r.stream, target: '_blank', rel: 'noopener', textContent: 'Listen on its site' }) : null,
      r.play && r.home ? el('a', { className: 'btn', href: r.home, target: '_blank', rel: 'noopener', textContent: host(r.home) || 'Station site' }) : null,
      el('button', { type: 'button', textContent: kept ? '★ Saved' : '☆ Save', 'aria-pressed': String(kept), onclick: () => toggleSave(r) })));
  if (!r.play) li.append(el('span', { className: 'why', textContent: "This station's stream cannot play inside a secure page. Its own site plays it." }));
  if (mine) li.dataset.mine = '1';
  return li;
}
function toggleSave(r) {
  const i = state.saved.findIndex((s) => s.id === r.id);
  if (i >= 0) state.saved.splice(i, 1); else state.saved.unshift(r);
  save(); drawRadio();
}
function drawRadio() {
  $('mine').hidden = !state.saved.length;
  $('mine-list').replaceChildren(...state.saved.map((r) => radioItem(r, { mine: true })));
  $('radio-list').replaceChildren(...radio.map((r) => radioItem(r)));
  $('tab-radio').textContent = 'Radio' + (radio.length ? ' (' + radio.length + ')' : '');
  markPlaying();
}
async function loadRadio() {
  radio = []; drawRadio();
  const note = $('radio-note');
  if (!place || place.lat == null) { note.textContent = place ? 'Your connection gives no point to measure from. Type a town or city.' : ''; return; }
  note.className = 'note'; note.textContent = 'Finding radio stations…';
  try {
    const q = new URLSearchParams({ lat: place.lat, lon: place.lon, cc: place.country || '' }); if (place.region) q.set('region', place.region);
    const j = await getJson('/api/local?' + q); if (!j.ok) throw new Error(j.say);
    radio = j.stations || [];
    note.textContent = radio.length ? radio.length + ' stations within about 100 km or naming ' + (place.region || 'this region') + ', nearest first. ' + radio.filter((r) => r.play).length + ' play right here.' : 'No radio stations are listed near ' + placeName(place) + ' yet. Try a bigger town nearby.';
  } catch (e) { note.className = 'note bad'; note.textContent = 'The radio directory did not answer just now. Try again in a minute.'; }
  drawRadio();
}

// ---- TV
function tvItem(g) {
  const nets = g.subs.map((s) => s.n).filter(Boolean);
  const where = g.why === 'region' ? 'across ' + (place && place.region || 'the region') : g.km != null && g.km > 0 ? g.km + ' km away' : 'in ' + (place && place.city || 'town');
  const li = el('li', { dataset: { id: g.t, kind: 'tv' } },
    el('div', { className: 'st' }, el('span', { className: 'ph', textContent: '📺' }), el('div', {}, el('b', { textContent: g.t }), el('small', { textContent: [nets.join(', '), where].filter(Boolean).join(' · ') }))),
    el('div', { className: 'acts' }, ...g.subs.filter((s) => s.s.length).map((s) => el('button', { type: 'button', className: 'go', textContent: 'Play' + (s.n && g.subs.length > 1 ? ' ' + s.n : ''), onclick: () => playTv(g, s, li) })),
      ...(() => { const sites = [...new Set(g.subs.map((s) => s.w).filter(Boolean))].slice(0, 2); return sites.map((w) => el('a', { className: 'btn', href: w, target: '_blank', rel: 'noopener', textContent: host(w) || 'Site' })); })()));
  if (!g.play) li.append(el('span', { className: 'hint', style: 'flex-basis:100%;margin:0', textContent: g.why === 'region' ? 'No free stream listed; on cable or satellite in the region.' : 'No free stream listed; free over the air with an antenna.' }));
  return li;
}
function drawTv() {
  $('tv-list').replaceChildren(...tv.map(tvItem));
  $('tab-tv').textContent = 'TV' + (tv.length ? ' (' + tv.length + ')' : '');
  markPlaying();
}
async function loadTv() {
  tv = []; drawTv(); const note = $('tv-note'); note.className = 'note';
  if (!place) { note.textContent = ''; return; }
  try {
    tvIndex = tvIndex || await getJson('/local/tv/index.json');
    const cc = place.country; if (!tvIndex.countries[cc]) { note.textContent = 'No local TV stations are listed for ' + placeName(place) + ' yet.'; return; }
    note.textContent = 'Finding TV stations…';
    const file = await getJson('/local/tv/' + cc + '.json');
    tv = groupTv(tvNear(file, place));
    const n = tv.filter((g) => g.play).length;
    note.textContent = tv.length ? tv.length + ' stations broadcasting within about 120 km or across ' + (place.region || 'the region') + '. ' + n + (n === 1 ? ' has' : ' have') + ' a free live stream that plays here.' : 'No local TV stations are listed near ' + placeName(place) + ' yet.';
  } catch (_) { note.className = 'note bad'; note.textContent = 'The TV list did not load just now. Try again in a minute.'; }
  drawTv();
}

// ---- playing
function stop() {
  clearTimeout(watchdog);
  if (hls) { try { hls.destroy(); } catch (_) {} hls = null; }
  audio.pause(); audio.removeAttribute('src'); audio.load();
  video.pause(); video.removeAttribute('src'); video.load(); $('screen').hidden = true;
}
function markPlaying() {
  for (const li of document.querySelectorAll('li[data-id]')) {
    const on = !!current && li.dataset.kind === current.kind && li.dataset.id === current.id;
    li.classList.toggle('playing', on);
    if (on && current.state) li.dataset.state = current.state; else if (!on) delete li.dataset.state;
    const old = li.querySelector('.fail'); if (old && !(on && current.state === 'failed')) old.remove();
    if (on && current.state === 'failed' && !old) li.append(el('span', { className: 'why fail', textContent: 'This stream did not play here. ' }, current.site ? el('a', { href: current.site, target: '_blank', rel: 'noopener', textContent: 'Try the station\'s own site' }) : ''));
  }
}
function setNow(st) {
  if (!current) return; current.state = st;
  $('bar').hidden = false; $('now-name').textContent = current.name;
  $('now-sub').textContent = st === 'playing' ? 'Live' + (current.sub ? ' · ' + current.sub : '') : st === 'failed' ? 'Did not play here' : st === 'paused' ? 'Paused' : 'Connecting…';
  $('toggle').textContent = st === 'playing' || st === 'loading' ? 'Pause' : 'Play'; $('toggle').setAttribute('aria-label', $('toggle').textContent);
  const site = $('now-site'); site.hidden = !current.site; if (current.site) site.href = current.site;
  markPlaying();
}
async function attach(media, url, isHls, onFail) {
  if (!isHls || (media.canPlayType('application/vnd.apple.mpegurl') && !window.MediaSource)) { media.src = url; return; }
  let Hls; try { ({ default: Hls } = await import(HLS)); } catch (_) { media.src = url; return; }
  if (!Hls.isSupported()) { media.src = url; return; }
  hls = new Hls({ enableWorker: true, lowLatencyMode: false, maxBufferLength: 20 });
  hls.on(Hls.Events.ERROR, (_, d) => { if (d && d.fatal) onFail(); });
  hls.loadSource(url); hls.attachMedia(media);
}
const isHlsUrl = (u) => /\.m3u8(?:$|\?)/i.test(u) || /\/hls\//i.test(u);
function begin(media, item, urls) {
  let i = 0; const token = {}; current.token = token;
  const fail = () => { if (current && current.token === token) { if (++i < urls.length) { stop(); go(); } else { stop(); setNow('failed'); } } };
  const go = async () => {
    setNow('loading'); if (media === video) $('screen').hidden = false;
    await attach(media, urls[i], item.hls || isHlsUrl(urls[i]), fail);
    media.onerror = fail; media.onplaying = () => { if (current && current.token === token) { clearTimeout(watchdog); setNow('playing'); } };
    media.onpause = () => { if (current && current.token === token && current.state === 'playing') setNow('paused'); };
    clearTimeout(watchdog); watchdog = setTimeout(() => { if (current && current.token === token && current.state === 'loading' && media.readyState < 2) fail(); }, 20000);
    try { await media.play(); } catch (e) { if (e && e.name === 'NotAllowedError') setNow('paused'); else if (!hls) fail(); }
  };
  go();
}
function playRadio(r) {
  stop(); current = { kind: 'radio', id: r.id, name: r.name, sub: [r.codec, r.kbps ? r.kbps + ' kbps' : ''].filter(Boolean).join(' '), site: r.home || r.stream, media: audio };
  begin(audio, r, [r.play]);
}
function playTv(g, s) {
  stop(); current = { kind: 'tv', id: g.t, name: g.t + (s.n ? ' · ' + s.n : ''), sub: s.n, site: s.w, media: video };
  const urls = s.s.map(httpsOf).filter(Boolean); if (!urls.length) { setNow('failed'); return; }
  begin(video, { hls: true }, urls);
  $('screen').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
$('toggle').addEventListener('click', () => {
  if (!current) return; const m = current.media;
  if (current.state === 'failed') return;
  if (m.paused) { m.play().catch(() => {}); setNow('loading'); } else { m.pause(); setNow('paused'); }
});
$('vol').addEventListener('input', () => { audio.volume = video.volume = Number($('vol').value); });

// ---- tabs, the form, the start
function setTab(t) {
  tab = t === 'tv' ? 'tv' : 'radio';
  $('tab-radio').setAttribute('aria-selected', String(tab === 'radio')); $('tab-tv').setAttribute('aria-selected', String(tab === 'tv'));
  $('radio').hidden = tab !== 'radio'; $('tv').hidden = tab !== 'tv';
  const u = new URL(location.href); if (tab === 'tv') u.searchParams.set('tab', 'tv'); else u.searchParams.delete('tab'); history.replaceState(null, '', u.pathname + u.search);
}
$('tab-radio').addEventListener('click', () => setTab('radio')); $('tab-tv').addEventListener('click', () => setTab('tv'));
$('form').addEventListener('submit', (e) => { e.preventDefault(); const n = $('q').value.trim(); if (n) findPlace(n); });
$('gps').addEventListener('click', () => {
  if (!navigator.geolocation) { $('where').textContent = 'This browser cannot share its location. Type a town or city.'; return; }
  $('gps').disabled = true;
  navigator.geolocation.getCurrentPosition((pos) => {
    $('gps').disabled = false; const lat = Math.round(pos.coords.latitude * 100) / 100, lon = Math.round(pos.coords.longitude * 100) / 100;
    setPlace({ ...(place || {}), city: place && from === 'connection' ? place.city : '', lat, lon }, 'device');
  }, () => { $('gps').disabled = false; $('where').textContent = 'Your location was not shared. Type a town or city instead.'; }, { maximumAge: 600000, timeout: 15000 });
});

mountRelated($('related'), '/local/', [
  { label: 'The weather here', href: () => (place && place.city ? '/weather/?q=' + encodeURIComponent(place.city) : null) },
  { label: 'The time here', href: () => (place && place.city ? '/time/?c=' + encodeURIComponent(place.city) : null) },
], { card: () => (place && place.city ? 'local radio in ' + place.city : '') });

const params = new URLSearchParams(location.search);
setTab(params.get('tab'));
drawRadio();
const linked = placeFromLink(location.search);
if (linked) { $('q').value = linked.city; setPlace(linked, 'link'); }
else if (params.get('place')) { $('q').value = params.get('place'); findPlace(params.get('place')); }
else getJson('/api/local').then((j) => { if (j.ok) setPlace(j.place, 'connection'); else { $('where').textContent = j.say || 'Type a town or city to find its stations.'; } })
  .catch(() => { $('where').textContent = 'Verse could not reach the station directory just now, so it does not know where you are. Type a town or city to try again.'; });
