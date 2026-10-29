/**
 * media-object skill — local media on the stage (tools pack 5, owner 2026-10-18; numbers 111 to 120). "play a local audio file" and
 * "local video player" put a card on the stage that plays files from this device (111, 112); choose several and it is a playlist (117),
 * the next one starts by itself; each card has its own volume (119) and "mute all media" silences every sound on the page (118);
 * a video takes a subtitle file, .srt or .vtt, from the card (120). "image viewer for local files", "pause a local gif", "rotate a
 * local image" and "crop a local image" put a picture card with a thumbnail strip (116), turn left and right (115), crop to
 * square, 4:3 or 16:9 (114), pause and play for a GIF (113) and a Save PNG that keeps the turn and crop.
 * The files are played from the browser's own blob addresses: they are not uploaded, not saved with the stage (after a reload the card
 * asks for them again, its names and settings stay) and nothing is sent anywhere. Asks without a local-file word stay with the video,
 * music and image skills.
 */
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';
import { mediaIntent, pickItems, modeOf, stepIndex, srtToVtt, fileKind, turn, rotatedSize, cropBox, CROPS, clampVol, MAX_SRT_BYTES } from '../lib/media-local.js';

const REG = new Map(); // thing id -> { items: [{ name, kind, url, size }], media, img, frame, subsUrl }
const MUTE_KEY = 'a2m.void.muteall.v1';
let muteAll = false;
try { muteAll = localStorage.getItem(MUTE_KEY) === '1'; } catch (_) { /* no storage: not muted after a reload */ }

const BTN = 'font:inherit;cursor:pointer;border-radius:9px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;padding:2px 9px;margin:0 4px 4px 0';
const ACCEPT = { audio: 'audio/*,.mp3,.wav,.ogg,.m4a,.flac,.aac,.opus', video: 'video/*,.mp4,.webm,.mov,.m4v', images: 'image/*,.gif', any: 'audio/*,video/*,image/*,.mp3,.wav,.ogg,.m4a,.flac,.mp4,.webm,.mov,.gif' };

/** every audio and video element on the page follows the mute-all switch; the ones it muted are restored when it is turned off. */
export function applyMuteAll(on) {
  muteAll = !!on;
  try { localStorage.setItem(MUTE_KEY, muteAll ? '1' : '0'); } catch (_) { /* fine */ }
  document.querySelectorAll('audio,video').forEach((m) => {
    if (muteAll) { if (m.dataset.wasMuted === undefined) m.dataset.wasMuted = String(m.muted); m.muted = true; }
    else if (m.dataset.wasMuted !== undefined) { m.muted = m.dataset.wasMuted === 'true'; delete m.dataset.wasMuted; }
  });
}

function btn(label, text, fn, cls) {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = text; b.setAttribute('aria-label', label); b.title = label; b.style.cssText = BTN;
  if (cls) b.className = cls;
  b.addEventListener('click', (e) => { e.stopPropagation(); fn(b); });
  return keepOut(b);
}

const loadImage = (url) => new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => bad(new Error('picture')); i.src = url; });

/** paint `src` (an image or canvas) turned `rot` degrees and cropped to `ratio` into `canvas`, at most maxSide wide or tall. */
export function paintTo(canvas, src, iw, ih, rot, ratio, maxSide) {
  const { w: rw, h: rh } = rotatedSize(iw, ih, rot), box = cropBox(rw, rh, ratio);
  const s = Math.min(1, maxSide / Math.max(box.w, box.h));
  canvas.width = Math.max(1, Math.round(box.w * s)); canvas.height = Math.max(1, Math.round(box.h * s));
  const g = canvas.getContext('2d');
  g.save();
  g.translate(-box.x * s, -box.y * s); g.translate(rw * s / 2, rh * s / 2); g.rotate(rot * Math.PI / 180);
  g.drawImage(src, -iw * s / 2, -ih * s / 2, iw * s, ih * s);
  g.restore();
  return canvas;
}

function setItems(th, files) {
  const reg = REG.get(th.id);
  if (reg) { reg.items.forEach((i) => URL.revokeObjectURL(i.url)); if (reg.subsUrl) URL.revokeObjectURL(reg.subsUrl); }
  const list = Array.from(files).filter((f) => { const k = fileKind(f); return k && k !== 'sub'; });
  const { items } = pickItems(list);
  const withUrl = items.map((it, i) => ({ ...it, url: URL.createObjectURL(list[i]) }));
  if (!withUrl.length) { REG.delete(th.id); return 0; }
  REG.set(th.id, { items: withUrl, media: null, img: null, frame: null, subsUrl: '' });
  th.names = withUrl.map((i) => i.name); th.mode = modeOf(withUrl); th.index = 0; th.gifPaused = false; th.rots = {}; th.subsName = '';
  return withUrl.length;
}

function mediaElement(th, reg) {
  const it = reg.items[th.index || 0];
  const m = document.createElement(it.kind === 'video' ? 'video' : 'audio');
  m.controls = true; m.preload = 'metadata'; m.src = it.url; m.volume = clampVol(th.vol == null ? 1 : th.vol); m.muted = muteAll;
  m.style.cssText = 'width:100%;max-height:240px;border-radius:8px;background:#000';
  m.setAttribute('aria-label', 'playing ' + it.name);
  if (muteAll) m.dataset.wasMuted = 'false';
  m.addEventListener('ended', () => { const n = stepIndex(th.index || 0, reg.items.length, 1, !!th.loop); if (n >= 0) { th.index = n; reg.media = null; rebuildAll(th, true); } });
  keepOut(m);
  return m;
}

const rebuilders = new Map(); // thing id -> function rebuilding its card in place
function rebuildAll(th, play) { const f = rebuilders.get(th.id); if (f) f(play); }

function mount(th, stageApi) {
  const el = cardEl(th, stageApi, 'media-card');
  el.style.width = 'min(92vw,420px)'; el.dataset.mode = th.mode || '';
  const save = () => stageApi.save();
  const build = (play) => {
    el.textContent = '';
    el.dataset.mode = REG.get(th.id) ? (th.mode || '') : '';
    const reg = REG.get(th.id);
    const head = document.createElement('div'); head.style.cssText = 'font-weight:600;margin-bottom:6px';
    head.textContent = reg ? (th.mode === 'player' ? 'Local player' : 'Local pictures') : 'Local media';
    el.appendChild(head);
    if (!reg) return buildPicker(el, th, stageApi, build, save);
    if (th.mode === 'player') buildPlayer(el, th, reg, build, save, play); else buildImages(el, th, reg, build, save);
    const again = btn('choose other files', 'Other files', () => { const r = REG.get(th.id); if (r) { r.items.forEach((i) => URL.revokeObjectURL(i.url)); } REG.delete(th.id); build(); }); // the card goes back to its picker
    el.appendChild(again);
  };
  rebuilders.set(th.id, build);
  build();
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

function buildPicker(el, th, stageApi, build, save) {
  const p = document.createElement('div');
  const hint = th.names && th.names.length ? 'Choose ' + th.names.slice(0, 3).join(', ') + (th.names.length > 3 ? ' and ' + (th.names.length - 3) + ' more' : '') + ' again: files stay on this device and are not kept after a reload.' : 'Choose ' + ({ audio: 'audio files', video: 'a video', images: 'pictures or a GIF', any: 'audio, video or pictures' }[th.hint || 'any']) + ' from this device. Choose several for a playlist or a strip. Nothing is uploaded.';
  p.textContent = hint; p.style.cssText = 'font-size:13px;opacity:.85;margin-bottom:8px';
  const inp = document.createElement('input');
  inp.type = 'file'; inp.multiple = true; inp.accept = ACCEPT[th.hint || 'any'] || ACCEPT.any; inp.className = 'media-file'; inp.setAttribute('aria-label', 'choose local files');
  inp.style.cssText = 'max-width:100%;font:inherit;color:inherit';
  const take = (files) => { if (setItems(th, files)) { save(); build(); } else p.textContent = 'Those files cannot be played here. Try mp3, wav, mp4, webm, png, jpg or gif.'; };
  inp.addEventListener('change', () => take(inp.files));
  keepOut(inp);
  el.addEventListener('dragover', (e) => { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).includes('Files')) e.preventDefault(); });
  el.addEventListener('drop', (e) => { if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); take(e.dataTransfer.files); } });
  el.append(p, inp);
}

function buildPlayer(el, th, reg, build, save, play) {
  const idx = th.index || 0, it = reg.items[idx];
  if (!reg.media || reg.mediaIdx !== idx) { reg.media = mediaElement(th, reg); reg.mediaIdx = idx; if (it.kind === 'video' && reg.subsUrl && reg.subsFor === idx) addTrack(reg, th.subsName || 'subtitles'); }
  const holder = document.createElement('div'); holder.appendChild(reg.media); el.appendChild(holder);
  if (play) reg.media.play().catch(() => { /* needs a tap */ });
  const row = document.createElement('div'); row.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;margin-top:6px';
  const go = (dir) => { const n = stepIndex(th.index || 0, reg.items.length, dir, true); if (n >= 0 && n !== th.index) { th.index = n; reg.media = null; save(); build(true); } };
  if (reg.items.length > 1) { row.appendChild(btn('previous', '⏮', () => go(-1), 'media-prev')); row.appendChild(btn('next', '⏭', () => go(1), 'media-next')); const lp = btn('repeat the playlist', th.loop ? 'repeat on' : 'repeat off', () => { th.loop = !th.loop; save(); build(); }, 'media-loop'); lp.setAttribute('aria-pressed', String(!!th.loop)); row.appendChild(lp); }
  const lab = document.createElement('label'); lab.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:13px;margin:0 8px 4px 0';
  const vol = document.createElement('input'); vol.type = 'range'; vol.min = '0'; vol.max = '1'; vol.step = '0.05'; vol.value = String(clampVol(th.vol == null ? 1 : th.vol)); vol.className = 'media-vol'; vol.setAttribute('aria-label', 'volume of this player'); vol.style.width = '110px';
  vol.addEventListener('input', () => { th.vol = clampVol(vol.value); if (reg.media) reg.media.volume = th.vol; save(); });
  keepOut(vol); lab.append('volume ', vol); row.appendChild(lab);
  if (it.kind === 'video') {
    const sub = document.createElement('input'); sub.type = 'file'; sub.accept = '.srt,.vtt,text/vtt'; sub.className = 'media-subs'; sub.setAttribute('aria-label', 'subtitle file'); sub.style.cssText = 'max-width:150px;font-size:12px;color:inherit';
    sub.addEventListener('change', async () => {
      const f = sub.files && sub.files[0]; if (!f) return;
      if (f.size > MAX_SRT_BYTES) { status.textContent = 'That subtitle file is too big.'; return; }
      const raw = await f.text(), vtt = /^﻿?WEBVTT/.test(raw) ? raw : srtToVtt(raw);
      if (!vtt) { status.textContent = 'No subtitles found in that file.'; return; }
      if (reg.subsUrl) URL.revokeObjectURL(reg.subsUrl);
      reg.subsUrl = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' })); reg.subsFor = idx; th.subsName = f.name.slice(0, 60);
      addTrack(reg, th.subsName); save(); status.textContent = 'Subtitles on: ' + th.subsName;
    });
    keepOut(sub); row.appendChild(sub);
  }
  el.appendChild(row);
  const status = document.createElement('div'); status.className = 'media-status'; status.setAttribute('role', 'status'); status.style.cssText = 'font-size:12px;opacity:.8;min-height:1em'; status.textContent = it.kind === 'video' && th.subsName && reg.subsFor === idx ? 'Subtitles on: ' + th.subsName : '';
  el.appendChild(status);
  if (reg.items.length > 1) {
    const ol = document.createElement('ol'); ol.className = 'media-list'; ol.style.cssText = 'margin:4px 0;padding-left:1.3em;font-size:13px';
    reg.items.forEach((x, i) => { const li = document.createElement('li'); const b = btn('play ' + x.name, x.name, () => { th.index = i; reg.media = null; save(); build(true); }); b.style.cssText += ';border:0;padding:0;text-align:left;' + (i === idx ? 'font-weight:700;text-decoration:underline' : ''); if (i === idx) b.setAttribute('aria-current', 'true'); li.appendChild(b); ol.appendChild(li); });
    el.appendChild(ol);
  }
}

function addTrack(reg, label) {
  if (!reg.media || reg.media.tagName !== 'VIDEO' || !reg.subsUrl) return;
  reg.media.querySelectorAll('track').forEach((t) => t.remove());
  const tr = document.createElement('track'); tr.kind = 'subtitles'; tr.label = label; tr.srclang = 'en'; tr.src = reg.subsUrl; tr.default = true;
  reg.media.appendChild(tr);
  try { tr.track.mode = 'showing'; } catch (_) { /* shown by default */ }
}

function buildImages(el, th, reg, build, save) {
  const idx = th.index || 0, it = reg.items[idx], rot = (th.rots && th.rots[idx]) || 0, ratio = CROPS[th.crop || 'none'] || null;
  const view = document.createElement('div'); view.className = 'media-view'; view.style.cssText = 'display:flex;justify-content:center;background:rgba(0,0,0,.35);border-radius:8px;padding:4px;min-height:60px';
  el.appendChild(view);
  const note = document.createElement('div'); note.className = 'media-status'; note.setAttribute('role', 'status'); note.style.cssText = 'font-size:12px;opacity:.8;min-height:1em;margin-top:4px';
  const show = async () => {
    try {
      const playing = it.kind === 'gif' && !th.gifPaused;
      if (playing) {
        const img = document.createElement('img'); img.src = it.url; img.alt = it.name; img.className = 'media-gif'; img.style.cssText = 'max-width:100%;max-height:300px;transform:rotate(' + rot + 'deg);transition:transform .2s'; view.textContent = ''; view.appendChild(img); reg.live = img;
        note.textContent = ratio ? 'Crop shows once the GIF is paused.' : '';
        return;
      }
      const src = it.kind === 'gif' && reg.frame ? reg.frame : (reg.img && reg.imgIdx === idx ? reg.img : await loadImage(it.url));
      if (!(it.kind === 'gif' && reg.frame)) { reg.img = src; reg.imgIdx = idx; }
      const iw = src.naturalWidth || src.width, ih = src.naturalHeight || src.height;
      const c = document.createElement('canvas'); c.className = 'media-canvas'; c.style.cssText = 'max-width:100%;max-height:300px'; c.setAttribute('role', 'img'); c.setAttribute('aria-label', it.name + (rot ? ', turned ' + rot + ' degrees' : '') + (ratio ? ', cropped ' + th.crop : ''));
      paintTo(c, src, iw, ih, rot, ratio, 900);
      c.dataset.w = c.width; c.dataset.h = c.height; c.dataset.rot = rot; c.dataset.crop = th.crop || 'none';
      view.textContent = ''; view.appendChild(c); note.textContent = it.name + ' · ' + iw + ' x ' + ih;
    } catch (_) { view.textContent = ''; note.textContent = 'This picture cannot be shown.'; }
  };
  const bar = document.createElement('div'); bar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;margin-top:6px';
  const turnBy = (dir) => { th.rots = th.rots || {}; th.rots[idx] = turn(th.rots[idx] || 0, dir); save(); build(); };
  bar.appendChild(btn('turn left', '↺', () => turnBy(-1), 'media-left'));
  bar.appendChild(btn('turn right', '↻', () => turnBy(1), 'media-right'));
  const sel = document.createElement('select'); sel.className = 'media-crop'; sel.setAttribute('aria-label', 'crop'); sel.style.cssText = BTN;
  for (const [k, label] of [['none', 'no crop'], ['square', 'square'], ['4:3', '4:3'], ['16:9', '16:9']]) { const o = document.createElement('option'); o.value = k; o.textContent = label; o.style.color = '#000'; if ((th.crop || 'none') === k) o.selected = true; sel.appendChild(o); }
  sel.addEventListener('change', () => { th.crop = sel.value; save(); build(); }); keepOut(sel); bar.appendChild(sel);
  if (it.kind === 'gif') {
    const pb = btn(th.gifPaused ? 'play the GIF' : 'pause the GIF', th.gifPaused ? '▶ play' : '⏸ pause', () => {
      if (!th.gifPaused) { // keep the frame on screen now
        const live = reg.live; const fr = document.createElement('canvas');
        try { if (!live || !live.naturalWidth) throw new Error('not loaded yet'); fr.width = live.naturalWidth; fr.height = live.naturalHeight; fr.getContext('2d').drawImage(live, 0, 0); reg.frame = fr; } catch (_) { reg.frame = null; note.textContent = 'The GIF is still loading, try again.'; }
        th.gifPaused = !!reg.frame;
      } else { reg.frame = null; th.gifPaused = false; }
      save(); build();
    }, 'media-gif-toggle');
    pb.setAttribute('aria-pressed', String(!!th.gifPaused)); bar.appendChild(pb);
  }
  bar.appendChild(btn('save as PNG', 'Save PNG', async () => {
    try {
      const src = it.kind === 'gif' && reg.frame ? reg.frame : (reg.img && reg.imgIdx === idx ? reg.img : await loadImage(it.url));
      const c = paintTo(document.createElement('canvas'), src, src.naturalWidth || src.width, src.naturalHeight || src.height, rot, ratio, 4096);
      const blob = await new Promise((ok) => c.toBlob(ok, 'image/png')); if (!blob) return;
      const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = it.name.replace(/\.[a-z0-9]+$/i, '') + '-edited.png'; a.style.display = 'none'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (_) { note.textContent = 'Could not save that picture.'; }
  }, 'media-save'));
  el.appendChild(bar); el.appendChild(note);
  if (reg.items.length > 1) {
    const strip = document.createElement('div'); strip.className = 'media-strip'; strip.style.cssText = 'display:flex;gap:4px;overflow-x:auto;padding:4px 0';
    reg.items.forEach((x, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'media-thumb'; b.setAttribute('aria-label', 'show ' + x.name); b.title = x.name; if (i === idx) b.setAttribute('aria-current', 'true');
      b.style.cssText = 'flex:0 0 auto;width:52px;height:52px;padding:0;border-radius:6px;overflow:hidden;cursor:pointer;background:#000;border:2px solid ' + (i === idx ? '#ffd166' : 'transparent');
      const im = document.createElement('img'); im.src = x.url; im.alt = ''; im.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block'; b.appendChild(im);
      b.addEventListener('click', (e) => { e.stopPropagation(); th.index = i; reg.frame = null; reg.img = null; th.gifPaused = false; save(); build(); }); keepOut(b); strip.appendChild(b); });
    el.appendChild(strip);
  }
  show();
}

/** the stage kind's ask hook is not used: the skill's run makes the card. */
async function run(text, api) {
  const it = mediaIntent(text);
  if (!it) return 'none';
  const st = api.stage;
  if (it.op === 'mute') { applyMuteAll(it.on); api.say(it.on ? 'all media muted' : 'media sound back'); return 'media-object'; }
  if (it.op === 'volume') {
    const th = st.selected() && st.things()[st.selected()];
    if (!th || th.kind !== 'media') { api.say('pick a media card first'); return 'media-object'; }
    th.vol = it.value; const reg = REG.get(th.id); if (reg && reg.media) reg.media.volume = th.vol;
    st.save(); st.render(); api.say('volume ' + Math.round(th.vol * 100) + '%');
    return 'media-object';
  }
  addThing(st, 'media', { hint: it.hint, names: [], mode: '', vol: 1 });
  st.save(); st.render();
  api.say('choose your files on the card · they stay on this device');
  return 'media-object';
}

export default {
  name: 'media-object',
  examples: ['play a local audio file', 'local video player', 'playlist of local files', 'image viewer for local files', 'pause a local gif', 'rotate a local image', 'crop a local image', 'mute all media', 'unmute all media', 'set the media volume to 40%'],
  nearMisses: ['play lofi beats', 'play music', 'pick a song', 'show this image https://example.org/cat.png', 'what is a gif', 'mute the music', 'play despacito', 'crop the image'],
  mediaIntent,
  match(lower, text) { return !!mediaIntent(text || lower); },
  run,
  decorate() { if (muteAll) applyMuteAll(true); },
  stageKinds: { media: { mount } },
};
