// /paint/: paint by number (rebuilt 2026-10-28 against the colour-by-number leaders). A picture library in categories, a sheet cut into
// numbered areas, tap an area to fill it, smooth zoom and pan (wheel, pinch, buttons, keys), the chosen number's areas highlighted, hints
// that fly to an area, progress kept on this device after every tap, a reveal and a replay when the picture is done, and your own photo
// turned into a sheet here in the browser. Nothing is uploaded. Every id and line tools/test_void.mjs and the paint probe read is kept.
import { receiveImage, sendImage, canvasBlob } from '/lib/image-handoff.js';
const $ = (id) => document.getElementById(id);
const cv = $('c'), ctx = cv.getContext('2d'), say = (t) => { $('say').textContent = t; };
const S = 4;                 // the sheet is drawn at 4 canvas pixels per picture pixel, so numbers and outlines stay sharp when zoomed
const MIN = 46;              // an area under this many pixels has no room for its number
const KEY_PROGRESS = 'void-paint-progress', KEY_GALLERY = 'void-paint', KEY_OWN = 'void-paint-own';
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const state = { tpl: null, labels: null, region: null, areas: [], paper: null, painted: null, img: null, mask: null, count: 0,
  active: 0, mode: 'fill', done: new Set(), undo: [], brush: 6, hl: true, ring: -1, z: 1, tx: 0, ty: 0, started: 0, revealed: false };
const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || '') ?? d; } catch (_) { return d; } };
const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } };
const rgb = (hex) => [parseInt(hex.slice(1, 3), 16), parseInt(hex.slice(3, 5), 16), parseInt(hex.slice(5, 7), 16)];
// colours handed over in the link (?colours=1a5fb4,e4572e,...: a palette from /color/, or a shared link): the picture keeps its areas and
// numbers, and each of its colours becomes the handed colour of the same lightness rank, so its dark parts stay dark and its light parts light
export function coloursOf(s) {
  return String(s || '').split(/[,\s]+/).map((x) => x.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)).filter(Boolean).slice(0, 16)
    .map((m) => '#' + (m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]).toLowerCase());
}
const lum = (hex) => { const [r, g, b] = rgb(hex); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export function restyled(palette, colours) {
  let given = [...new Set(colours)].sort((a, b) => lum(a) - lum(b));
  if (given.length === 1) { const c = rgb(given[0]); given = [c.map((v) => v * 0.35), c, c.map((v) => v + (255 - v) * 0.7)].map((k) => '#' + k.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')); }
  const order = palette.map((_, i) => i).sort((a, b) => lum(palette[a]) - lum(palette[b])), n = order.length, m = given.length, out = palette.slice();
  order.forEach((idx, r) => { const t = n > 1 ? (r / (n - 1)) * (m - 1) : (m - 1) / 2, lo = Math.floor(t), hi = Math.min(m - 1, lo + 1), f = t - lo, a = rgb(given[lo]), b = rgb(given[hi]);
    out[idx] = '#' + a.map((v, k) => Math.round(v + (b[k] - v) * f).toString(16).padStart(2, '0')).join(''); });
  return out;
}
let given = typeof location === 'undefined' ? [] : coloursOf(new URLSearchParams(location.search).get('colours') || new URLSearchParams(location.search).get('colors'));
const colourTail = () => (given.length ? '&colours=' + given.map((h) => h.slice(1)).join(',') : '');

// ---------- the sheet ----------
function unpack(tpl) { const labels = new Uint8Array(tpl.w * tpl.h); let i = 0; for (const [v, len] of tpl.rle) { labels.fill(v, i, i + len); i += len; } return labels; }
function areasOf(labels, w, h) {
  const region = new Int32Array(w * h).fill(-1), areas = [];
  for (let p = 0; p < w * h; p++) {
    if (region[p] !== -1) continue;
    const label = labels[p], id = areas.length, stack = [p], px = []; region[p] = id;
    while (stack.length) { const q = stack.pop(); px.push(q); const x = q % w, y = (q / w) | 0;
      if (x + 1 < w && region[q + 1] === -1 && labels[q + 1] === label) { region[q + 1] = id; stack.push(q + 1); }
      if (x > 0 && region[q - 1] === -1 && labels[q - 1] === label) { region[q - 1] = id; stack.push(q - 1); }
      if (y + 1 < h && region[q + w] === -1 && labels[q + w] === label) { region[q + w] = id; stack.push(q + w); }
      if (y > 0 && region[q - w] === -1 && labels[q - w] === label) { region[q - w] = id; stack.push(q - w); } }
    areas.push({ label, px });
  }
  return { region, areas };
}
// how far each pixel is from the edge of its area (chamfer distance): the number sits where its area is widest
function depthOf(labels, w, h) {
  const d = new Float32Array(w * h), BIG = 1e6;
  for (let p = 0; p < w * h; p++) { const x = p % w, y = (p / w) | 0; const edge = x === 0 || y === 0 || x === w - 1 || y === h - 1 || labels[p - 1] !== labels[p] || labels[p + 1] !== labels[p] || labels[p - w] !== labels[p] || labels[p + w] !== labels[p]; d[p] = edge ? 1 : BIG; }
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const p = y * w + x; d[p] = Math.min(d[p], d[p - 1] + 1, d[p - w] + 1, d[p - w - 1] + 1.414, d[p - w + 1] + 1.414); }
  for (let y = h - 2; y > 0; y--) for (let x = w - 2; x > 0; x--) { const p = y * w + x; d[p] = Math.min(d[p], d[p + 1] + 1, d[p + w] + 1, d[p + w + 1] + 1.414, d[p + w - 1] + 1.414); }
  return d;
}
function placeNumbers() {
  const { tpl, labels } = state, depth = depthOf(labels, tpl.w, tpl.h);
  for (const a of state.areas) { let best = a.px[0], bd = -1; for (const p of a.px) if (depth[p] > bd) { bd = depth[p]; best = p; } a.cell = best; a.room = bd; }
}
const numbered = (a) => a.px.length >= MIN;

function drawPaper() {
  const { tpl, labels } = state, w = tpl.w, h = tpl.h;
  const off = document.createElement('canvas'); off.width = w * S; off.height = h * S;
  const g = off.getContext('2d');
  g.fillStyle = '#fcfbf7'; g.fillRect(0, 0, off.width, off.height);
  // a faint tint of each area's own colour, the way the leading apps show what an unpainted area will become
  const tint = document.createElement('canvas'); tint.width = w; tint.height = h;
  const tg = tint.getContext('2d'), ti = tg.createImageData(w, h), pal = tpl.palette.map(rgb);
  for (let p = 0; p < w * h; p++) { const [r, gg, b] = pal[labels[p]], grey = (r * 0.3 + gg * 0.59 + b * 0.11); const v = 236 + grey / 255 * 16; ti.data[p * 4] = v; ti.data[p * 4 + 1] = v; ti.data[p * 4 + 2] = v; ti.data[p * 4 + 3] = 255; }
  tg.putImageData(ti, 0, 0); g.imageSmoothingEnabled = false; g.drawImage(tint, 0, 0, off.width, off.height);
  g.fillStyle = '#5a5566';
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x;
    if (x + 1 < w && labels[p] !== labels[p + 1]) g.fillRect((x + 1) * S - 0.6, y * S, 1.2, S);
    if (y + 1 < h && labels[p] !== labels[p + w]) g.fillRect(x * S, (y + 1) * S - 0.6, S, 1.2);
  }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  for (const a of state.areas) {
    if (!numbered(a)) continue;
    const size = Math.max(4.2, Math.min(15, a.room * 1.25)) * S, x = (a.cell % w + 0.5) * S, y = (((a.cell / w) | 0) + 0.5) * S;
    g.font = '600 ' + size.toFixed(1) + 'px ui-monospace,SFMono-Regular,Menlo,monospace';
    g.lineWidth = size / 5; g.strokeStyle = 'rgba(255,255,255,.9)'; g.strokeText(String(a.label + 1), x, y);
    g.fillStyle = '#2e2a36'; g.fillText(String(a.label + 1), x, y);
  }
  state.paper = off;
}

// ---------- drawing ----------
let pending = 0;
const render = () => { if (!pending) pending = requestAnimationFrame(() => { pending = 0; draw(); }); };
function draw() {
  const { tpl } = state; if (!tpl) return;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(state.paper, 0, 0);
  if (state.hl) ctx.drawImage(highlight(), 0, 0, cv.width, cv.height);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(state.painted, 0, 0, cv.width, cv.height);
  if (state.ring >= 0 && !state.done.has(state.ring)) { const a = state.areas[state.ring]; ctx.save(); ctx.strokeStyle = '#8b7bff'; ctx.lineWidth = 2.5 * S / Math.max(1, state.z / 2); ctx.beginPath(); ctx.arc((a.cell % tpl.w + 0.5) * S, (((a.cell / tpl.w) | 0) + 0.5) * S, Math.max(6, a.room * 1.3) * S, 0, 7); ctx.stroke(); ctx.restore(); }
}
let hlCache = { key: '', c: null };
function highlight() {
  const { tpl } = state, key = tpl.id + ':' + state.active + ':' + state.count;
  if (hlCache.key === key) return hlCache.c;
  const c = hlCache.c || document.createElement('canvas'); c.width = tpl.w; c.height = tpl.h;
  const g = c.getContext('2d'), im = g.createImageData(tpl.w, tpl.h), d = im.data;
  for (let p = 0; p < state.labels.length; p++) if (state.labels[p] === state.active && !state.mask[p]) { d[p * 4] = 139; d[p * 4 + 1] = 123; d[p * 4 + 2] = 255; d[p * 4 + 3] = 92; }
  g.putImageData(im, 0, 0); hlCache = { key, c }; return c;
}
function status() {
  const total = state.labels.length, pct = Math.round(state.count / total * 100);
  $('count').textContent = state.count.toLocaleString() + ' of ' + total.toLocaleString() + ' pixels painted · ' + state.done.size + ' of ' + state.areas.length + ' areas · ' + state.tpl.palette.length + ' colours';
  $('bar').firstElementChild.style.width = pct + '%';
  $('bar').setAttribute('aria-valuenow', String(pct));
  drawPalette(); render();
}
function leftOf(i) { let n = 0; state.areas.forEach((a, id) => { if (a.label === i && !state.done.has(id)) n++; }); return n; }
function drawPalette() {
  const box = $('palette'); box.textContent = '';
  state.tpl.palette.forEach((hex, i) => {
    const left = leftOf(i), b = document.createElement('button');
    b.type = 'button'; b.setAttribute('aria-pressed', String(i === state.active));
    b.setAttribute('aria-label', 'Colour ' + (i + 1) + (left ? ', ' + left + ' areas left' : ', done'));
    const sw = document.createElement('i'); sw.style.background = hex;
    b.append(sw, document.createTextNode(String(i + 1) + (left ? ' · ' + left + ' left' : ' · done')));
    if (!left) b.classList.add('gone');
    b.onclick = () => pick(i);
    box.appendChild(b);
  });
}
function pick(i) { state.active = i; state.ring = -1; $('nextn').textContent = String(i + 1); drawPalette(); render(); say('Colour ' + (i + 1) + ' chosen: its areas are shaded.'); }

// ---------- painting ----------
function setPx(p, colour) { const [r, g, b] = rgb(state.tpl.palette[colour]), d = state.img.data; d[p * 4] = r; d[p * 4 + 1] = g; d[p * 4 + 2] = b; d[p * 4 + 3] = 255; if (!state.mask[p]) { state.mask[p] = 1; state.count++; } }
function flush() { state.painted.getContext('2d').putImageData(state.img, 0, 0); }
function fillArea(id, step) { const a = state.areas[id]; if (!a || state.done.has(id)) return 0; let n = 0; for (const p of a.px) if (!state.mask[p]) { setPx(p, a.label); step.px.push(p); n++; } state.done.add(id); step.ids.push(id); return n || 1; }
/** fill one area; when it was the colour's last numbered area, the specks of that colour too (they carry no number to hunt for) */
function paintArea(id, quiet) {
  const step = { ids: [], px: [] }, n = fillArea(id, step);
  if (!n) return 0;
  const lab = state.areas[id].label;
  if (!state.areas.some((a, k) => a.label === lab && numbered(a) && !state.done.has(k))) state.areas.forEach((a, k) => { if (a.label === lab && !numbered(a)) fillArea(k, step); });
  state.undo.push(step); flush();
  if (!quiet) { keep(); status(); finishedCheck(); }
  return step.px.length;
}
function brushAt(p, colour) {
  const w = state.tpl.w, h = state.tpl.h, x0 = p % w, y0 = (p / w) | 0, rad = state.brush, step = { ids: [], px: [] };
  for (let y = y0 - rad; y <= y0 + rad; y++) for (let x = x0 - rad; x <= x0 + rad; x++) {
    if (x < 0 || y < 0 || x >= w || y >= h || (x - x0) ** 2 + (y - y0) ** 2 > rad * rad) continue;
    const q = y * w + x; if (state.labels[q] !== colour || state.mask[q]) continue;   // only where the number matches
    setPx(q, colour); step.px.push(q);
  }
  if (!step.px.length) return 0;
  state.areas.forEach((a, k) => { if (a.label === colour && !state.done.has(k) && a.px.every((q) => state.mask[q])) { state.done.add(k); step.ids.push(k); } });
  state.undo.push(step); flush(); return step.px.length;
}
function undo() {
  const step = state.undo.pop();
  if (!step) { say('Nothing to undo.'); return; }
  const d = state.img.data; for (const p of step.px) { d[p * 4 + 3] = 0; if (state.mask[p]) { state.mask[p] = 0; state.count--; } }
  for (const id of step.ids) state.done.delete(id);
  flush(); state.revealed = false; keep(); status(); say('Undone.');
}
function clearPainted() {
  const { w, h } = state.tpl; state.img = new ImageData(w, h); state.mask = new Uint8Array(w * h); state.count = 0;
  state.painted.getContext('2d').clearRect(0, 0, w, h); state.done = new Set(); state.undo = []; state.ring = -1; state.revealed = false;
}

// ---------- progress on this device ----------
function keep() {
  if (!state.tpl) return;
  const all = read(KEY_PROGRESS, {});
  if (state.done.size) all[state.tpl.id] = { done: [...state.done], of: state.areas.length, at: Date.now(), name: state.tpl.name };
  else delete all[state.tpl.id];
  write(KEY_PROGRESS, all); markCard(state.tpl.id);
}
const progressOf = (id) => read(KEY_PROGRESS, {})[id] || null;

// ---------- finding and hints ----------
function findArea(colour) {
  let best = -1, size = 0;
  state.areas.forEach((a, id) => { if (a.label === colour && !state.done.has(id) && numbered(a) && a.px.length > size) { best = id; size = a.px.length; } });
  if (best < 0) state.areas.forEach((a, id) => { if (best < 0 && a.label === colour && !state.done.has(id)) best = id; });
  return best;
}
function flyTo(id) {
  const a = state.areas[id], w = state.tpl.w, r = stage.getBoundingClientRect(), base = r.width;
  const z = Math.max(state.z, Math.min(5, Math.max(2, 60 / Math.sqrt(a.px.length) * 2)));
  const cx = (a.cell % w + 0.5) / w * base, cy = (((a.cell / w) | 0) + 0.5) / state.tpl.h * base;
  setView(z, r.width / 2 - cx * z, r.height / 2 - cy * z, true);
}
function ring(id, hinted) {
  state.ring = id; render();
  const a = state.areas[id];
  if (hinted) flyTo(id);
  say((hinted ? 'Hint: ' : '') + 'One area of colour ' + (a.label + 1) + ' is ringed' + (hinted ? ' and zoomed to' : '') + '. Tap it, or press Enter to fill it.');
}
$('next').onclick = () => { const id = findArea(state.active); if (id < 0) { say('Every area of colour ' + (state.active + 1) + ' is done.'); return; } ring(id, false); };
$('hint').onclick = () => {
  let colour = state.active;
  if (!leftOf(colour)) { colour = state.tpl.palette.findIndex((_, i) => leftOf(i) > 0); if (colour < 0) { say('The picture is finished: there is nothing left to find.'); return; } pick(colour); }
  ring(findArea(colour), true);
};
$('hl').onclick = () => { state.hl = !state.hl; $('hl').setAttribute('aria-pressed', String(state.hl)); $('hl').textContent = 'Highlight: ' + (state.hl ? 'on' : 'off'); render(); };

// ---------- zoom and pan ----------
const stage = $('stage'), view = $('view');
function clampView(z, tx, ty) { const r = stage.getBoundingClientRect(), W = r.width, H = r.height; z = Math.min(8, Math.max(1, z)); return [z, Math.min(0, Math.max(W - W * z, tx)), Math.min(0, Math.max(H - H * z, ty))]; }
function setView(z, tx, ty, smooth) {
  [state.z, state.tx, state.ty] = clampView(z, tx, ty);
  view.style.transition = smooth && !reduced ? 'transform .28s ease' : 'none';
  view.style.transform = 'translate(' + state.tx + 'px,' + state.ty + 'px) scale(' + state.z + ')';
  $('zlevel').textContent = Math.round(state.z * 100) + '%';
  stage.classList.toggle('zoomed', state.z > 1.01);
}
function zoomAt(f, cx, cy, smooth) { const r = stage.getBoundingClientRect(), x = cx - r.left, y = cy - r.top, z = Math.min(8, Math.max(1, state.z * f)), k = z / state.z; setView(z, x - (x - state.tx) * k, y - (y - state.ty) * k, smooth); }
const centre = () => { const r = stage.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
$('zin').onclick = () => zoomAt(1.6, ...centre(), true);
$('zout').onclick = () => zoomAt(1 / 1.6, ...centre(), true);
$('zfit').onclick = () => setView(1, 0, 0, true);
stage.addEventListener('wheel', (e) => { e.preventDefault(); zoomAt(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0022)), e.clientX, e.clientY, false); }, { passive: false });

// taps fill, drags pan (or paint, with the brush on), two fingers pinch
const pts = new Map(); let gesture = null;
const posOf = (e) => { const r = cv.getBoundingClientRect(); return { x: Math.floor((e.clientX - r.left) / r.width * state.tpl.w), y: Math.floor((e.clientY - r.top) / r.height * state.tpl.h) }; };
const inside = ({ x, y }) => x >= 0 && y >= 0 && x < state.tpl.w && y < state.tpl.h;
stage.addEventListener('pointerdown', (e) => {
  if (!state.tpl || e.target.closest('button')) return;
  stage.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (pts.size === 2) { const [a, b] = [...pts.values()]; gesture = { kind: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 }; return; }
  gesture = { kind: 'tap', x0: e.clientX, y0: e.clientY, tx: state.tx, ty: state.ty, last: -1 };
  if (state.mode === 'brush') { gesture.kind = 'brush'; const q = posOf(e); if (inside(q)) { const p = q.y * state.tpl.w + q.x; gesture.last = p; if (brushAt(p, state.active)) { status(); } } }
});
stage.addEventListener('pointermove', (e) => {
  if (!pts.has(e.pointerId) || !gesture) return;
  pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (gesture.kind === 'pinch' && pts.size >= 2) {
    const [a, b] = [...pts.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    zoomAt(d / gesture.d, mx, my, false); setView(state.z, state.tx + mx - gesture.mx, state.ty + my - gesture.my, false); gesture.d = d; gesture.mx = mx; gesture.my = my; return;
  }
  if (gesture.kind === 'brush') { const q = posOf(e); if (!inside(q)) return; const p = q.y * state.tpl.w + q.x; if (p === gesture.last) return; gesture.last = p; if (brushAt(p, state.active)) status(); return; }
  const dx = e.clientX - gesture.x0, dy = e.clientY - gesture.y0;
  if (gesture.kind === 'tap' && Math.hypot(dx, dy) > 7) gesture.kind = 'pan';
  if (gesture.kind === 'pan') setView(state.z, gesture.tx + dx, gesture.ty + dy, false);
});
const up = (e) => {
  if (!pts.has(e.pointerId)) return;
  pts.delete(e.pointerId);
  const g = gesture;
  if (pts.size === 0) gesture = null; else if (g && g.kind === 'pinch') gesture = { kind: 'pan-after', x0: 0, y0: 0 };
  if (!g || e.type === 'pointercancel') return;
  if (g.kind === 'brush') { keep(); finishedCheck(); return; }
  if (g.kind === 'tap') tapAt(posOf(e));
};
stage.addEventListener('pointerup', up); stage.addEventListener('pointercancel', up);
function tapAt(q) {
  if (!inside(q)) return;
  const p = q.y * state.tpl.w + q.x, id = state.region[p], area = state.areas[id];
  if (state.done.has(id)) { say('That area is already painted.'); return; }
  if (area.label !== state.active) { say('That area is number ' + (area.label + 1) + '. Colour ' + (state.active + 1) + ' is chosen.'); nudge(area.label); return; }
  const n = paintArea(id);
  if (n) say('Area ' + (state.active + 1) + ' filled, ' + n + ' pixels.');
}
function nudge(i) { const b = $('palette').children[i]; if (!b) return; b.classList.remove('nudge'); void b.offsetWidth; b.classList.add('nudge'); }
document.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea, select')) return;
  if (e.key === '+' || e.key === '=') { zoomAt(1.4, ...centre(), true); e.preventDefault(); }
  else if (e.key === '-' || e.key === '_') { zoomAt(1 / 1.4, ...centre(), true); e.preventDefault(); }
  else if (e.key === '0') setView(1, 0, 0, true);
  else if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) { undo(); e.preventDefault(); }
  else if (e.key === 'h' || e.key === 'H') $('hint').click();
  else if (/^[1-9]$/.test(e.key) && document.activeElement === stage) { const i = +e.key - 1; if (i < state.tpl.palette.length) pick(i); }
  else if (e.key === 'Enter' && document.activeElement === stage && state.ring >= 0) { const id = state.ring; pick(state.areas[id].label); paintArea(id); say('The ringed area is filled.'); }
  else if (document.activeElement === stage && /^Arrow/.test(e.key)) { const s = 40, m = { ArrowLeft: [s, 0], ArrowRight: [-s, 0], ArrowUp: [0, s], ArrowDown: [0, -s] }[e.key]; setView(state.z, state.tx + m[0], state.ty + m[1], true); e.preventDefault(); }
});

// ---------- the finish ----------
function finishedCheck() {
  if (state.revealed || state.done.size !== state.areas.length) return;
  state.revealed = true;
  const secs = state.started ? Math.round((Date.now() - state.started) / 1000) : 0;
  setView(1, 0, 0, true);
  $('rtitle').textContent = state.tpl.name + ' is finished';
  $('rline').textContent = state.areas.length + ' areas in ' + state.tpl.palette.length + ' colours' + (secs > 5 ? ', painted in ' + (secs >= 120 ? Math.round(secs / 60) + ' minutes' : secs + ' seconds') : '') + '. Here is the whole picture.';
  $('reveal').hidden = false; $('reveal').classList.toggle('play', !reduced);
  say('Finished! ' + state.tpl.name + ' is complete. Watch the replay, download it, or pick the next picture.');
  const all = read(KEY_PROGRESS, {}); if (all[state.tpl.id]) { all[state.tpl.id].finished = true; write(KEY_PROGRESS, all); markCard(state.tpl.id); }
  replay();
}
function replay() {
  const order = [...state.done], img = new ImageData(state.tpl.w, state.tpl.h), tmp = document.createElement('canvas'); tmp.width = state.tpl.w; tmp.height = state.tpl.h;
  const pc = $('rc'), g = pc.getContext('2d'); pc.width = state.tpl.w * 2; pc.height = state.tpl.h * 2; g.imageSmoothingEnabled = false;
  const pal = state.tpl.palette.map(rgb); let i = 0; const per = Math.max(1, Math.ceil(order.length / (reduced ? 1 : 90)));
  const stepOnce = () => {
    for (let k = 0; k < per && i < order.length; k++, i++) for (const p of state.areas[order[i]].px) { const c = pal[state.labels[p]]; img.data[p * 4] = c[0]; img.data[p * 4 + 1] = c[1]; img.data[p * 4 + 2] = c[2]; img.data[p * 4 + 3] = 255; }
    tmp.getContext('2d').putImageData(img, 0, 0); g.fillStyle = '#fcfbf7'; g.fillRect(0, 0, pc.width, pc.height); g.drawImage(tmp, 0, 0, pc.width, pc.height);
    if (i < order.length) requestAnimationFrame(stepOnce);
  };
  stepOnce();
}
$('rclose').onclick = () => { $('reveal').hidden = true; };
$('rreplay').onclick = () => replay();
$('rpng').onclick = () => $('png').click();
$('rnext').onclick = () => { $('reveal').hidden = true; const list = PICTURES.filter((t) => !(progressOf(t.id) || {}).finished && t.id !== state.tpl.id); const t = list[0] || PICTURES[0]; open(t); };

// ---------- export, share, gallery ----------
// the painting as it stands: the paper under any area not yet filled, the filled colours over it
function paintingCanvas() {
  const out = document.createElement('canvas'); out.width = state.tpl.w * S; out.height = state.tpl.h * S;
  const g = out.getContext('2d'); g.fillStyle = '#fcfbf7'; g.fillRect(0, 0, out.width, out.height);
  if (state.done.size < state.areas.length) g.drawImage(state.paper, 0, 0);
  g.imageSmoothingEnabled = false; g.drawImage(state.painted, 0, 0, out.width, out.height);
  return out;
}
// the whole picture in its own colours, painted or not: a gradient read from a half-painted sheet would be mostly paper white
function wholeCanvas() {
  const { w, h } = state.tpl, pal = state.tpl.palette.map(rgb), c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let p = 0; p < w * h; p++) { const k = pal[state.labels[p]]; img.data[p * 4] = k[0]; img.data[p * 4 + 1] = k[1]; img.data[p * 4 + 2] = k[2]; img.data[p * 4 + 3] = 255; }
  g.putImageData(img, 0, 0); return c;
}
$('png').onclick = () => {
  const a = document.createElement('a'); a.href = paintingCanvas().toDataURL('image/png'); a.download = (state.tpl.id || 'painting') + '.png'; a.click();
  say('PNG downloaded.');
};
// the painting into the photo pages, already open there (lib/image-handoff.js): a press keeps one PNG on this device and opens the page
{ const row = $('related'), label = row && row.querySelector('.tk-label');
  for (const [text, path] of [['Post your painting on a board', '/boards/?img=handoff'], ['Save your painting as a PDF', '/pdf/?img=handoff'], ['Take its colours as a gradient', '/gradient/?img=handoff'], ['Resize your painting', '/resize-image/?img=handoff'], ['Edit your painting in photo tools', '/photos/?img=handoff']]) { // each goes straight after the label, so the last here shows first
    const a = document.createElement('a'); a.href = path; a.textContent = text; a.className = 'tk-hand';
    a.addEventListener('click', (e) => { e.preventDefault(); if (!state.tpl || !state.painted) return;
      sendImage(path, () => canvasBlob(path.startsWith('/gradient/') ? wholeCanvas() : paintingCanvas()), { name: (state.tpl.name || state.tpl.id || 'painting') + '.png', fromPage: '/paint/' })
        .then((ok) => { if (!ok) say('Your painting could not be kept for the next page in this browser.'); }); });
    if (label) label.after(' ', a); }
}
$('share').onclick = () => {
  const done = [...state.done].sort((a, b) => a - b).join(','), q = '/paint/?p=' + encodeURIComponent(state.tpl.id) + '&done=' + done + colourTail();
  history.replaceState(null, '', q);
  const own = /^own-/.test(state.tpl.id) ? ' This picture is your own photo, so the link opens it only on this device.' : '';
  navigator.clipboard?.writeText(location.origin + q).then(() => say('Link copied: it carries the areas you finished.' + own), () => say('The link is in the address bar.' + own));
};
$('save').onclick = () => {
  const list = read(KEY_GALLERY, []);
  list.unshift({ p: state.tpl.id, name: state.tpl.name, done: state.done.size, at: Date.now() });
  write(KEY_GALLERY, list.slice(0, 12)); drawGallery(); say('Saved on this device.');
};
function drawGallery() {
  const ul = $('gallery'); ul.textContent = '';
  for (const row of read(KEY_GALLERY, [])) {
    const li = document.createElement('li'), a = document.createElement('button'), b = document.createElement('span');
    a.type = 'button'; a.className = 'link'; a.textContent = row.name + ' · ' + row.done + ' areas';
    a.onclick = () => { const t = PICTURES.find((x) => x.id === row.p); if (t) open(t); };
    b.textContent = new Date(row.at).toLocaleDateString();
    li.append(a, b); ul.appendChild(li);
  }
}

// ---------- the library ----------
let PICTURES = [], CATS = [], cat = 'All';
const cache = new Map();
async function fetchOne(t) {
  if (t.tpl) return t.tpl;
  if (cache.has(t.id)) return cache.get(t.id);
  const r = await fetch(t.file); if (!r.ok) throw new Error('picture ' + t.id + ': ' + r.status);
  const tpl = await r.json(); cache.set(t.id, tpl); return tpl;
}
function ownPictures() { return read(KEY_OWN, []).map((tpl) => ({ id: tpl.id, name: tpl.name, cat: 'Your photos', tpl })); }
function drawCats() {
  const box = $('cats'); box.textContent = '';
  const cats = ['All', ...CATS.filter((c) => PICTURES.some((t) => t.cat === c)), 'In progress'];
  for (const c of cats) { const b = document.createElement('button'); b.type = 'button'; b.textContent = c; b.setAttribute('aria-pressed', String(c === cat)); b.onclick = () => { cat = c; drawCats(); drawLibrary(); }; box.appendChild(b); }
}
const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { io.unobserve(e.target); thumb(e.target); } }), { rootMargin: '120px' }) : null;
function drawLibrary() {
  const box = $('templates'); box.textContent = '';
  const shown = PICTURES.filter((t) => cat === 'All' || (cat === 'In progress' ? (progressOf(t.id) && !progressOf(t.id).finished) : t.cat === cat));
  if (!shown.length) { const p = document.createElement('p'); p.className = 'sub'; p.textContent = cat === 'In progress' ? 'Nothing started yet: pick any picture and your progress is kept here.' : 'No pictures here yet.'; box.appendChild(p); }
  for (const t of shown) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'card'; b.dataset.id = t.id;
    b.setAttribute('aria-pressed', String(state.tpl && state.tpl.id === t.id));
    const c = document.createElement('canvas'); c.width = c.height = 88; c.setAttribute('aria-hidden', 'true');
    const name = document.createElement('span'); name.className = 'nm'; name.textContent = t.name;
    const badge = document.createElement('span'); badge.className = 'badge';
    b.append(c, name, badge); b.onclick = () => open(t);
    box.appendChild(b); markCard(t.id, b);
    if (io) io.observe(b); else thumb(b);
  }
}
function markCard(id, el) {
  const b = el || $('templates').querySelector('[data-id="' + CSS.escape(id) + '"]'); if (!b) return;
  const pr = progressOf(id), badge = b.querySelector('.badge');
  badge.textContent = pr ? (pr.finished ? 'Done ✓' : Math.round(pr.done.length / (pr.of || 1) * 100) + '%') : '';
  if (b.dataset.drawn) thumb(b, true);
}
async function thumb(b) {
  const t = PICTURES.find((x) => x.id === b.dataset.id); if (!t) return;
  let tpl; try { tpl = await fetchOne(t); } catch (_) { return; }
  const labels = unpack(tpl), pr = progressOf(t.id), pal = tpl.palette.map(rgb), w = tpl.w, h = tpl.h;
  const doneAreas = new Set(pr ? pr.done : []), full = pr && pr.finished;
  let region = null; if (doneAreas.size && !full) region = areasOf(labels, w, h).region;
  const tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h; const g = tmp.getContext('2d'), im = g.createImageData(w, h);
  for (let p = 0; p < w * h; p++) { const c = pal[labels[p]], on = full || (region && doneAreas.has(region[p])) || (!pr); const k = on ? 1 : 0.25; const grey = c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11;
    im.data[p * 4] = on ? c[0] : grey * k + 230 * (1 - k); im.data[p * 4 + 1] = on ? c[1] : grey * k + 230 * (1 - k); im.data[p * 4 + 2] = on ? c[2] : grey * k + 230 * (1 - k); im.data[p * 4 + 3] = 255; }
  g.putImageData(im, 0, 0); const cc = b.querySelector('canvas').getContext('2d'); cc.imageSmoothingEnabled = true; cc.drawImage(tmp, 0, 0, 88, 88);
  b.dataset.drawn = '1';
}

async function open(t, doneFromLink) {
  let tpl;
  try { tpl = await fetchOne(t); } catch (_) { $('credit').textContent = t.name + ' could not be loaded just now; try again in a moment.'; return; }
  loadTemplate({ ...tpl, id: t.id, name: t.name || tpl.name, ...(given.length ? { palette: restyled(tpl.palette, given) } : {}) });
  $('restyle').hidden = !given.length;
  const saved = progressOf(t.id), list = doneFromLink || (saved ? saved.done : []);
  for (const id of list) { const a = state.areas[id]; if (a && !state.done.has(id)) paintArea(id, true); }
  if (list.length) { keep(); status(); if (!doneFromLink) say('Welcome back: ' + state.done.size + ' of ' + state.areas.length + ' areas of ' + tpl.name + ' were kept on this device.'); }
  state.revealed = state.done.size === state.areas.length;
  if (!doneFromLink) history.replaceState(null, '', '/paint/?p=' + encodeURIComponent(t.id) + colourTail());
  if (innerWidth < 700 && document.activeElement && document.activeElement.closest('#templates')) stage.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
}
function loadTemplate(tpl) {
  state.tpl = tpl; state.labels = unpack(tpl);
  const { region, areas } = areasOf(state.labels, tpl.w, tpl.h); state.region = region; state.areas = areas; placeNumbers();
  state.painted = document.createElement('canvas'); state.painted.width = tpl.w; state.painted.height = tpl.h;
  cv.width = tpl.w * S; cv.height = tpl.h * S; cv.setAttribute('aria-label', 'The painting ' + tpl.name + ' so far');
  hlCache = { key: '', c: null }; drawPaper(); clearPainted(); state.active = 0; state.started = Date.now(); $('nextn').textContent = '1';
  $('reveal').hidden = true; setView(1, 0, 0, false);
  $('credit').textContent = '';
  if (tpl.credit) { $('credit').append(document.createTextNode(tpl.credit + ' ')); if (tpl.source) { const a = document.createElement('a'); a.href = tpl.source; a.textContent = 'Source.'; a.rel = 'noopener'; $('credit').append(a); } }
  $('title').textContent = tpl.name;
  [...$('templates').children].forEach((b) => b.setAttribute && b.setAttribute('aria-pressed', String(b.dataset.id === tpl.id)));
  status();
}

$('mode').onclick = () => {
  state.mode = state.mode === 'brush' ? 'fill' : 'brush';
  $('mode').textContent = 'Brush: ' + (state.mode === 'brush' ? 'on' : 'off'); $('mode').setAttribute('aria-pressed', String(state.mode === 'brush'));
  say(state.mode === 'brush' ? 'Brush on: drag to paint; two fingers still zoom.' : 'Tap an area to fill it; drag to move around.');
};
$('undo').onclick = undo;
$('owncol').onclick = () => { // back to the picture's own colours; what is painted stays painted
  const t = PICTURES.find((x) => x.id === state.tpl.id); given = []; if (t) open(t).then(() => say('Back to the picture\u2019s own colours.'));
};
$('reset').onclick = () => { if (!state.tpl) return; clearPainted(); keep(); status(); say('Started over.'); };

// ---------- your own photo ----------
// cut into areas here, in the browser, and never uploaded: k-means colours, a smoothing pass, then every speck merged into its neighbour
function photoSheet(img, k) {
  const S2 = 200, small = document.createElement('canvas'); small.width = small.height = S2;
  const g = small.getContext('2d', { willReadFrequently: true }), s = Math.min(img.width, img.height);
  g.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, S2, S2);
  const d = g.getImageData(0, 0, S2, S2).data, n = S2 * S2, px = new Float32Array(n * 3);
  for (let p = 0; p < n; p++) { px[p * 3] = d[p * 4]; px[p * 3 + 1] = d[p * 4 + 1]; px[p * 3 + 2] = d[p * 4 + 2]; }
  // seeds spread over the picture's own colours (farthest-point), then a few rounds of k-means
  const cent = [[px[0], px[1], px[2]]], dist = new Float32Array(n).fill(Infinity);
  while (cent.length < k) { let far = 0, fd = -1; const c = cent[cent.length - 1]; for (let p = 0; p < n; p += 3) { const dd = (px[p * 3] - c[0]) ** 2 + (px[p * 3 + 1] - c[1]) ** 2 + (px[p * 3 + 2] - c[2]) ** 2; if (dd < dist[p]) dist[p] = dd; if (dist[p] > fd) { fd = dist[p]; far = p; } } cent.push([px[far * 3], px[far * 3 + 1], px[far * 3 + 2]]); }
  const lab = new Uint8Array(n);
  for (let it = 0; it < 6; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    for (let p = 0; p < n; p++) { let b = 0, bd = Infinity; for (let c = 0; c < k; c++) { const dd = (px[p * 3] - cent[c][0]) ** 2 + (px[p * 3 + 1] - cent[c][1]) ** 2 + (px[p * 3 + 2] - cent[c][2]) ** 2; if (dd < bd) { bd = dd; b = c; } } lab[p] = b; const sm = sum[b]; sm[0] += px[p * 3]; sm[1] += px[p * 3 + 1]; sm[2] += px[p * 3 + 2]; sm[3]++; }
    sum.forEach((sm, c) => { if (sm[3]) cent[c] = [sm[0] / sm[3], sm[1] / sm[3], sm[2] / sm[3]]; });
  }
  for (let pass = 0; pass < 2; pass++) { const out = lab.slice(); for (let y = 1; y < S2 - 1; y++) for (let x = 1; x < S2 - 1; x++) { const cnt = new Uint8Array(k); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) cnt[lab[(y + dy) * S2 + x + dx]]++; let b = lab[y * S2 + x]; for (let c = 0; c < k; c++) if (cnt[c] > cnt[b]) b = c; out[y * S2 + x] = b; } lab.set(out); }
  for (let pass = 0; pass < 4; pass++) {
    const { region, areas } = areasOf(lab, S2, S2); let changed = false;
    for (const a of areas) { if (a.px.length >= MIN) continue; const near = new Map(); for (const q of a.px) { const x = q % S2; for (const r of [q - 1, q + 1, q - S2, q + S2]) { if (r < 0 || r >= n || (r === q - 1 && x === 0) || (r === q + 1 && x === S2 - 1)) continue; if (region[r] !== region[q]) near.set(lab[r], (near.get(lab[r]) || 0) + 1); } } const best = [...near.entries()].sort((x, y) => y[1] - x[1])[0]; if (best) { for (const q of a.px) lab[q] = best[0]; changed = true; } }
    if (!changed) break;
  }
  const used = [...new Set(lab)].sort((a, b) => a - b), map = new Map(used.map((c, i) => [c, i]));
  const palette = used.map((c) => '#' + cent[c].map((v) => Math.round(v).toString(16).padStart(2, '0')).join(''));
  const runs = []; let prev = -1, cnt = 0; for (const v0 of lab) { const v = map.get(v0); if (v === prev) cnt++; else { if (prev >= 0) runs.push([prev, cnt]); prev = v; cnt = 1; } } runs.push([prev, cnt]);
  return { w: S2, h: S2, palette, rle: runs };
}
$('up').onchange = (e) => { const file = e.target.files?.[0]; if (file) paintFile(file); };
// a photo becomes a sheet: chosen here, or handed over by another page (lib/image-handoff.js, ?img=handoff)
function paintFile(file) {
  say('Cutting your photo into numbered areas…');
  const img = new Image();
  img.onload = () => {
    const k = +$('detail').value || 12, sheet = photoSheet(img, k), id = 'own-' + Date.now().toString(36);
    const tpl = { id, name: file.name.replace(/\.[^.]+$/, '').slice(0, 40) || 'My photo', category: 'Your photos', credit: 'Your own image, cut into areas here; it never leaves this device.', ...sheet };
    const own = read(KEY_OWN, []); own.unshift(tpl); while (own.length && !write(KEY_OWN, own.slice(0, 6))) own.pop();
    PICTURES = [...ownPictures(), ...PICTURES.filter((t) => t.cat !== 'Your photos')]; if (!CATS.includes('Your photos')) CATS.unshift('Your photos');
    cat = 'Your photos'; drawCats(); drawLibrary();
    open({ id, name: tpl.name, cat: 'Your photos', tpl }).then(() => say('Your photo is now a colouring sheet: ' + state.areas.length + ' areas in ' + tpl.palette.length + ' colours. It is kept in Your photos on this device.'));
    URL.revokeObjectURL(img.src);
  };
  img.onerror = () => say('That file could not be read as a picture.');
  img.src = URL.createObjectURL(file);
}

async function boot() {
  // the address as it came in: opening a picture below rewrites it to ?p=…, which would drop a handed-over ?img=handoff
  const arrived = { search: location.search, pathname: location.pathname, hash: location.hash };
  let index;
  try { const r = await fetch('/paint/templates/index.json'); index = await r.json(); }
  catch (_) { index = { categories: ['Masterpieces'], pictures: [{ id: 'wave', name: 'The Great Wave', cat: 'Masterpieces', file: '/paint/templates/wave.json' }, { id: 'starry', name: 'The Starry Night', cat: 'Masterpieces', file: '/paint/templates/starry.json' }] }; }
  const own = ownPictures();
  CATS = [...(own.length ? ['Your photos'] : []), ...index.categories];
  PICTURES = [...index.pictures, ...own];
  drawCats(); drawLibrary(); drawGallery();
  const params = new URLSearchParams(location.search), wanted = params.get('p') || 'wave';
  const first = PICTURES.find((t) => t.id === wanted) || PICTURES[0];
  const link = params.has('done') ? (params.get('done') || '').split(',').filter((s) => s !== '').map(Number) : null;
  await open(first, link);
  if (link && link.length) keep();
  await receiveImage((file) => paintFile(file), arrived);
}
boot().catch((err) => { $('count').textContent = 'The paintings did not load.'; say(String(err.message || err)); });
if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); }); // opens offline after one visit (sw.js TOOLS)
