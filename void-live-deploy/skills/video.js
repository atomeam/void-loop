/**
 * video skill - Verse plays any video from YouTube, Rumble, Vimeo, Dailymotion, the Internet Archive, PeerTube, Odysee and Twitch
 * right on the stage (owner, 2026-10-15: "it should master youtube and easily pull up any video, rumble and other free platforms
 * too. Verse should be the only site you need").
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), stageKinds }
 * "play lofi beats", "show me the video of the moon landing", "find a rumble video about bitcoin", a pasted link from any of them,
 * then the watch tools: "skip to 2:30", "speed 1.5x", "captions on", "queue <x>", "next", "my queue", "recently watched".
 * Embed only (lib/video.js): each platform's official player, YouTube through youtube-nocookie.com; nothing downloaded or rehosted,
 * so the creator keeps the ads and the views. Search goes through /api/video (edge-cached, no KV, no model). The queue, the
 * recently-watched list and the player settings live in this browser's localStorage only; a play writes nothing to the server.
 */
import { PLATFORMS, OPEN_SEARCH, CAN, parseVideoUrl, embedUrl, watchUrl, videoAskOf, clockOf } from '../lib/video.js';

const KEY = 'a2m.void.video.v1';
const blank = () => ({ current: null, queue: [], recent: [], platform: 'youtube', rate: 1, captions: false, results: [], query: '', note: '', searchUrl: '', tab: 'results' });
let S = null;
const load = () => { if (S) return S; try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch (_) { S = blank(); } return S; };
const keep = () => { try { localStorage.setItem(KEY, JSON.stringify(Object.assign({}, S, { results: S.results.slice(0, 12) }))); } catch (_) {} };
let time = 0, frame = null, cardEl = null;
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const label = (v) => v.title || (PLATFORMS[v.platform] ? PLATFORMS[v.platform].label + ' video' : 'video');
const same = (a, b) => a && b && a.platform === b.platform && a.id === b.id && (a.clip || null) === (b.clip || null);

async function resolve(v) { // a Rumble page link needs its embed id; titles for links come from the platform's oEmbed
  if (v.id && v.title) return v;
  if (!/^(?:rumble|youtube|vimeo|dailymotion)$/.test(v.platform)) return v;
  try { const j = await fetch('/api/video?url=' + encodeURIComponent(watchUrl(v) || v.page)).then((r) => r.json()); if (j && j.ok && j.video) return Object.assign({}, v, j.video); } catch (_) {}
  return v;
}
function post(msg) { if (frame && frame.contentWindow) try { frame.contentWindow.postMessage(typeof msg === 'string' ? msg : JSON.stringify(msg), '*'); } catch (_) {} }
function ytCmd(func, args) { post({ event: 'command', func, args: args || [] }); }
if (typeof addEventListener === 'function') addEventListener('message', (e) => { // the official players report their time; nothing else is read from them
  if (!frame || e.source !== frame.contentWindow) return;
  let d = e.data; if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { return; } }
  if (d && d.event === 'infoDelivery' && d.info && Number.isFinite(d.info.currentTime)) time = d.info.currentTime;
  if (d && d.event === 'onReady' && S && S.rate !== 1) ytCmd('setPlaybackRate', [S.rate]);
  if (d && d.event === 'timeupdate' && d.data && Number.isFinite(d.data.seconds)) time = d.data.seconds;
  if (d && d.event === 'ready' && frame) { post({ method: 'addEventListener', value: 'timeupdate' }); if (S && S.rate !== 1) post({ method: 'setPlaybackRate', value: S.rate }); }
});

function play(v, start, api) {
  load(); S.current = Object.assign({}, v, { start: start != null ? start : v.start || 0 }); S.platform = v.platform; time = S.current.start || 0;
  S.recent = [Object.assign({}, v, { at: Date.now(), start: undefined })].concat(S.recent.filter((r) => !same(r, v))).slice(0, 30);
  keep(); paint(true);
}
function src() { const v = S.current; return v && embedUrl(v, { start: v.start, captions: S.captions, parent: location.hostname, origin: location.origin, autoplay: true }); }

function paint(reloadPlayer) {
  const el = cardEl; if (!el || !el.isConnected) return; load();
  const v = S.current, can = v ? CAN[v.platform] || {} : {};
  const box = el.querySelector('.vd-player');
  if (reloadPlayer || !box.querySelector('iframe') !== !v) {
    box.innerHTML = '';
    if (v && src()) { frame = document.createElement('iframe'); frame.className = 'vd-frame'; frame.src = src(); frame.title = label(v);
      frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write'; frame.allowFullscreen = true; frame.referrerPolicy = 'strict-origin-when-cross-origin';
      frame.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;border:0;border-radius:10px;background:#000';
      frame.addEventListener('load', () => { if (v.platform === 'youtube') post({ event: 'listening', id: 'void' }); if (v.platform === 'vimeo') post({ method: 'addEventListener', value: 'timeupdate' }); });
      box.appendChild(frame); }
    else { frame = null; box.innerHTML = '<div class="vd-empty" style="position:absolute;inset:0;display:grid;place-items:center;opacity:.7;text-align:center;padding:12px">' + (v ? 'That video needs its link looked up · try pasting it again' : 'Search above, or paste a link from YouTube, Rumble, Vimeo, Dailymotion, the Archive, PeerTube, Odysee or Twitch') + '</div>'; }
  }
  el.querySelector('.vd-now').innerHTML = v ? '<b>' + esc(label(v)) + '</b>' + (v.channel ? ' · ' + esc(v.channel) : '') + (v.seconds ? ' · ' + clockOf(v.seconds) : '') + ' · <a href="' + esc(watchUrl(v)) + '" target="_blank" rel="noopener">open on ' + esc(PLATFORMS[v.platform].label) + ' ↗</a>' : '';
  el.querySelectorAll('.vd-plat').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.p === S.platform)); b.style.opacity = b.dataset.p === S.platform ? '1' : '.55'; });
  const sp = el.querySelector('.vd-speed'); sp.value = String(S.rate); sp.disabled = !!v && !can.speed; sp.title = v && !can.speed ? PLATFORMS[v.platform].label + "'s player has its own speed menu" : 'Playback speed';
  const cc = el.querySelector('.vd-cc'); cc.textContent = 'CC ' + (S.captions ? 'on' : 'off'); cc.disabled = !!v && !can.captions;
  el.querySelectorAll('.vd-tab').forEach((b) => { b.setAttribute('aria-pressed', String(b.dataset.t === S.tab)); b.style.opacity = b.dataset.t === S.tab ? '1' : '.55'; });
  el.querySelector('.vd-tab[data-t=queue]').textContent = 'Queue' + (S.queue.length ? ' (' + S.queue.length + ')' : '');
  const list = S.tab === 'queue' ? S.queue : S.tab === 'recent' ? S.recent : S.results;
  const out = el.querySelector('.vd-list');
  out.innerHTML = (S.tab === 'results' && S.note ? '<div class="g-sub vd-note" style="display:block;margin:4px 0">' + esc(S.note) + (S.searchUrl ? ' · <a href="' + esc(S.searchUrl) + '" target="_blank" rel="noopener">search ' + esc(PLATFORMS[S.platform].label) + ' ↗</a>' : '') + '</div>' : '')
    + (list.length ? list.map((h, i) => '<div class="vd-hit" data-i="' + i + '" role="button" tabindex="0" style="display:flex;gap:8px;align-items:center;padding:4px;border-radius:8px;cursor:pointer;' + (same(h, v) ? 'background:rgba(255,255,255,.08)' : '') + '">'
      + (h.thumb ? '<img src="' + esc(h.thumb) + '" alt="" loading="lazy" referrerpolicy="no-referrer" style="width:96px;height:54px;object-fit:cover;border-radius:6px;flex:none;background:#111">' : '<div style="width:96px;height:54px;border-radius:6px;background:#111;flex:none"></div>')
      + '<div style="min-width:0;flex:1"><div class="vd-title" style="font-size:13px;line-height:1.25;max-height:2.5em;overflow:hidden">' + esc(label(h)) + '</div><div class="g-sub" style="display:block;font-size:11px">' + esc([h.channel, h.seconds ? clockOf(h.seconds) : '', PLATFORMS[h.platform] && PLATFORMS[h.platform].label].filter(Boolean).join(' · ')) + '</div></div>'
      + (S.tab === 'results' ? '<button type="button" class="g-btn vd-add" data-i="' + i + '" title="Add to queue" aria-label="Add to queue">+</button>' : S.tab === 'queue' ? '<button type="button" class="g-btn vd-del" data-i="' + i + '" aria-label="Remove from queue">×</button>' : '') + '</div>').join('')
      : '<div class="g-sub" style="display:block;opacity:.7;margin:6px 0">' + (S.tab === 'queue' ? 'Nothing queued · "queue <something>" or + on a result' : S.tab === 'recent' ? 'Nothing watched yet on this device' : S.query ? 'No videos turned up' : '') + '</div>');
}

async function search(query, platform, api, { autoplay = false, quiet = false } = {}) {
  load(); S.query = query; S.platform = platform || S.platform || 'youtube'; S.tab = 'results'; S.note = 'searching ' + PLATFORMS[S.platform].label + '…'; S.results = []; S.searchUrl = ''; paint(); // ellipsis-ok: progress text, not a cut
  let j = null; try { j = await fetch('/api/video?p=' + S.platform + '&q=' + encodeURIComponent(query)).then((r) => r.json()); } catch (_) {}
  if (j && j.ok && !j.hits.length && j.need && !platform) { // no YouTube key on this server: the free platforms answer instead
    const yt = j.searchUrl; for (const p of OPEN_SEARCH) { let k = null; try { k = await fetch('/api/video?p=' + p + '&q=' + encodeURIComponent(query)).then((r) => r.json()); } catch (_) {} if (k && k.ok && k.hits.length) { j = Object.assign(k, { note: 'YouTube search is not switched on yet, so these are from ' + PLATFORMS[p].label + ' · paste any YouTube link to play it here', searchUrl: yt }); S.platform = p; break; } }
  }
  S.results = (j && j.ok && j.hits) || []; S.note = j ? j.note || (S.results.length ? '' : 'nothing on ' + PLATFORMS[S.platform].label + ' for that') : 'the search did not answer'; S.searchUrl = (j && j.searchUrl) || PLATFORMS[S.platform].search(query);
  if (S.results.length && j.searchUrl && !j.note) S.searchUrl = '';
  keep(); paint();
  if (autoplay && S.results[0]) play(S.results[0], 0, api);
  return S.results;
}

function mount(th, stageApi) {
  load();
  const el = document.createElement('div'); cardEl = el;
  el.className = 'thing kept-card game-card video-card'; el.dataset.id = th.id;
  el.style.cssText = 'left:' + th.x + 'px;top:' + th.y + 'px;width:min(560px, calc(100vw - 20px))';
  const F = 'background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.16);border-radius:8px;padding:5px 8px;font:inherit;color-scheme:dark;';
  el.innerHTML = '<div class="g-head"><span class="g-title">Video</span><span class="g-sub">official players · nothing downloaded</span></div>'
    + '<div class="vd-plats" style="display:flex;flex-wrap:wrap;gap:4px;margin:6px 0">' + Object.entries(PLATFORMS).map(([k, p]) => '<button type="button" class="g-btn vd-plat" data-p="' + k + '">' + esc(p.label) + '</button>').join('') + '</div>'
    + '<form class="vd-form" style="display:flex;gap:6px;margin:0 0 8px"><input class="vd-q" type="search" aria-label="Search videos or paste a link" placeholder="search, or paste a video link" style="' + F + 'flex:1;min-width:0"><button class="g-btn" type="submit">Go</button></form>'
    + '<div class="vd-player" style="position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden"></div>'
    + '<div class="vd-now g-sub" style="display:block;margin:6px 0;font-size:12px"></div>'
    + '<div class="vd-ctl" style="display:flex;flex-wrap:wrap;gap:4px;align-items:center"><button type="button" class="g-btn vd-prev" aria-label="Previous">⏮</button><button type="button" class="g-btn vd-back" aria-label="Back 10 seconds">−10s</button><button type="button" class="g-btn vd-fwd" aria-label="Forward 10 seconds">+10s</button><button type="button" class="g-btn vd-next" aria-label="Next in queue">⏭</button>'
    + '<select class="vd-speed" aria-label="Playback speed" style="' + F + '">' + [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2].map((r) => '<option value="' + r + '">' + r + '×</option>').join('') + '</select><button type="button" class="g-btn vd-cc">CC off</button>'
    + '<input class="vd-at" aria-label="Jump to time" placeholder="2:30" style="' + F + 'width:64px"><button type="button" class="g-btn vd-jump">jump</button></div>'
    + '<div style="display:flex;gap:4px;margin-top:8px"><button type="button" class="g-btn vd-tab" data-t="results">Results</button><button type="button" class="g-btn vd-tab" data-t="queue">Queue</button><button type="button" class="g-btn vd-tab" data-t="recent">Recently watched</button></div>'
    + '<div class="vd-list" style="max-height:260px;overflow:auto;margin-top:4px"></div>';
  el.querySelectorAll('input,select,button,.vd-list,.vd-player').forEach((n) => { n.addEventListener('pointerdown', (e) => e.stopPropagation()); n.addEventListener('keydown', (e) => e.stopPropagation()); });
  el.querySelector('.vd-form').addEventListener('submit', (e) => { e.preventDefault(); const q = el.querySelector('.vd-q').value.trim(); if (!q) return; const v = parseVideoUrl(q); if (v) resolve(v).then((r) => play(r, null)); else search(q, S.platform); });
  el.querySelectorAll('.vd-plat').forEach((b) => b.addEventListener('click', () => { S.platform = b.dataset.p; keep(); if (S.query) search(S.query, S.platform); else paint(); }));
  el.querySelectorAll('.vd-tab').forEach((b) => b.addEventListener('click', () => { S.tab = b.dataset.t; keep(); paint(); }));
  el.querySelector('.vd-list').addEventListener('click', (e) => {
    const list = S.tab === 'queue' ? S.queue : S.tab === 'recent' ? S.recent : S.results, add = e.target.closest('.vd-add'), del = e.target.closest('.vd-del'), hit = e.target.closest('.vd-hit');
    if (add) { const h = list[+add.dataset.i]; if (h && !S.queue.some((q) => same(q, h))) S.queue.push(h); keep(); paint(); return; }
    if (del) { S.queue.splice(+del.dataset.i, 1); keep(); paint(); return; }
    if (hit) { const h = list[+hit.dataset.i]; if (h) { if (S.tab === 'queue') S.queue.splice(+hit.dataset.i, 1); play(h, 0); } }
  });
  el.querySelector('.vd-prev').addEventListener('click', () => step(-1));
  el.querySelector('.vd-next').addEventListener('click', () => step(1));
  el.querySelector('.vd-back').addEventListener('click', () => seek(time - 10));
  el.querySelector('.vd-fwd').addEventListener('click', () => seek(time + 10));
  el.querySelector('.vd-jump').addEventListener('click', () => { const s = (el.querySelector('.vd-at').value || '').trim(); const a = videoAskOf('skip to ' + s, { hasCard: true }); if (a && a.kind === 'seek') seek(a.at); });
  el.querySelector('.vd-speed').addEventListener('change', (e) => speed(+e.target.value));
  el.querySelector('.vd-cc').addEventListener('click', () => captions(!S.captions));
  stageApi.bindDrag(el, th); stageApi.stage.appendChild(el);
  paint(true);
}
function seek(at) {
  const v = S.current; if (!v) return 'nothing is playing';
  at = Math.max(0, Math.round(at)); time = at;
  if (v.platform === 'youtube') { ytCmd('seekTo', [at, true]); ytCmd('playVideo'); }
  else if (v.platform === 'vimeo') post({ method: 'setCurrentTime', value: at });
  else { S.current = Object.assign({}, v, { start: at }); keep(); paint(true); }
  return 'at ' + clockOf(at);
}
function speed(r) {
  S.rate = Math.min(2, Math.max(0.25, Math.round(r * 4) / 4)); keep();
  const v = S.current, can = v ? CAN[v.platform] || {} : { speed: true };
  if (v && v.platform === 'youtube') ytCmd('setPlaybackRate', [S.rate]); else if (v && v.platform === 'vimeo') post({ method: 'setPlaybackRate', value: S.rate });
  paint(); return can.speed ? 'speed ' + S.rate + '×' : PLATFORMS[v.platform].label + "'s player keeps its own speed menu (the gear on the video)";
}
function captions(on) {
  S.captions = !!on; keep(); const v = S.current; const can = v ? CAN[v.platform] || {} : { captions: true };
  if (v && can.captions) { S.current = Object.assign({}, v, { start: Math.round(time) }); keep(); paint(true); } else paint();
  return can.captions ? 'captions ' + (on ? 'on' : 'off') + (on ? ' where the video has them' : '') : PLATFORMS[v.platform].label + "'s player has no captions switch Verse can reach";
}
function step(dir) {
  if (dir > 0) { const n = S.queue.shift(); if (!n) { keep(); paint(); return 'the queue is empty'; } play(n, 0); return 'playing ' + label(n); }
  const prev = S.recent.find((r) => !same(r, S.current)); if (!prev) return 'nothing before this one'; play(prev, 0); return 'back to ' + label(prev);
}

const cards = (api) => Object.values(api.stage.things()).filter((t) => t && t.kind === 'video');
const hasCard = () => typeof document !== 'undefined' && !!document.querySelector('.video-card');
function ensure(api) { if (!cards(api).length) api.summon('video', { center: true }); else if (api.stage.center) api.stage.center(cards(api)[0].id); }

export async function runAsk(q, api) {
  load();
  if (q.kind === 'close') { const c = cards(api); if (!c.length) { api.say('no video is up'); return 'video'; } for (const t of c) delete api.stage.things()[t.id]; frame = null; api.stage.save(); api.stage.render(); api.say('video put away · your queue is kept'); return 'video'; }
  if (q.kind === 'clear-recent') { S.recent = []; keep(); paint(); api.say('recently watched cleared on this device'); return 'video'; }
  if (q.kind === 'clear-queue') { S.queue = []; keep(); paint(); api.say('queue cleared'); return 'video'; }
  ensure(api);
  if (q.kind === 'recent' || q.kind === 'list') { S.tab = q.kind === 'recent' ? 'recent' : 'queue'; keep(); paint(); api.say(q.kind === 'recent' ? S.recent.length + ' watched on this device · kept here only' : S.queue.length ? S.queue.length + ' in the queue · "next" plays the next one' : 'the queue is empty'); return 'video'; }
  if (q.kind === 'seek') { api.say(seek(q.at != null ? q.at : time + q.by)); return 'video'; }
  if (q.kind === 'speed') { api.say(speed(q.rate != null ? q.rate : S.rate + q.step)); return 'video'; }
  if (q.kind === 'captions') { api.say(captions(q.on)); return 'video'; }
  if (q.kind === 'next') { api.say(step(1)); return 'video'; }
  if (q.kind === 'prev') { api.say(step(-1)); return 'video'; }
  if (q.kind === 'platform') { S.platform = q.platform; keep(); if (S.query) await search(S.query, q.platform, api); else paint(); api.say('searching ' + PLATFORMS[q.platform].label); return 'video'; }
  if (q.kind === 'queue') {
    let v = q.video ? await resolve(q.video) : null;
    if (!v) { const hits = await search(q.query, q.platform, api); v = hits[0]; }
    if (!v) { api.say('nothing turned up to queue'); return 'video'; }
    if (!S.current) { play(v, null, api); api.say('playing ' + label(v)); return 'video'; }
    S.queue.push(v); S.tab = 'queue'; keep(); paint(); api.say('queued ' + label(v) + ' · ' + S.queue.length + ' up next'); return 'video';
  }
  if (q.video) { const v = await resolve(q.video); play(v, null, api); api.say('playing ' + label(v) + ' · official ' + PLATFORMS[v.platform].label + ' player'); return 'video'; }
  const hits = await search(q.query, q.platform, api, { autoplay: q.kind === 'play' });
  api.say(hits.length ? (q.kind === 'play' ? 'playing ' + label(hits[0]) + ' · more below' : hits.length + ' videos from ' + PLATFORMS[S.platform].label + ' · tap one to play') : S.note || 'no videos turned up');
  return 'video';
}
async function run(text, api) { const q = videoAskOf(text, { hasCard: hasCard() }); return q ? runAsk(q, api) : 'none'; }

export default {
  name: 'video',
  examples: ['play the moon landing video', 'show me the video of the apollo 11 launch', 'find a rumble video about bitcoin', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'https://rumble.com/v77xmv8-nasas-artemis-ii-launch.html', 'search vimeo for big buck bunny', 'skip to 2:30', 'speed 1.5x', 'captions on', 'queue lofi beats video', 'recently watched', 'close the video'],
  nearMisses: ['play chess', 'play tic tac toe', 'play music', 'https://example.org/guides/getting-started', 'what is a video codec', 'next'],
  match(lower, text) { return !!videoAskOf(text || lower, { hasCard: hasCard() }); },
  run,
  stageKinds: { video: { mount } },
};
