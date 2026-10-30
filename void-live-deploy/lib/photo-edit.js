/**
 * photo-edit: the maths and bytes behind /photos/ (Versus' Google Photos floor, its lane of small photo tools: squoosh.app, photopea.com, tinypng.com,
 * exif.tools, exifeditor.io, iloveimg.com; owner, 2026-10-26: "we have to have everything all the sites have"). Compress and convert with a quality
 * slider, TinyPNG-style palette PNGs written here (no WebAssembly, no upload), resize, crop with aspect presets, rotate, adjustments, filters, a
 * full metadata reader (EXIF, GPS, XMP, IPTC, colour profile, PNG text), an undo history, and a zip made on the device. Pure over bytes and pixel
 * arrays; the page does the drawing (canvas) and nothing leaves the device. Tests: tools/photo-edit.test.mjs.
 */
import { zipStore, crc32 } from './pay-share.js';
export { zipStore, crc32 };

export const MAX_PIXELS = 40e6;
/** the size a picture is drawn at when it is too big to edit: { w, h, scaled } within a pixel budget. Pure. */
export function fitWithin(w, h, maxPx = MAX_PIXELS) {
  if (!(w > 0 && h > 0)) return { w: 0, h: 0, scaled: false };
  if (w * h <= maxPx) return { w, h, scaled: false };
  const k = Math.sqrt(maxPx / (w * h)); return { w: Math.max(1, Math.floor(w * k)), h: Math.max(1, Math.floor(h * k)), scaled: true };
}
/** how many undo steps fit in memory for a picture of this size (4 bytes a pixel, about 120 MP in all), 3 to 20. Pure. */
export const historyCap = (w, h) => Math.max(3, Math.min(20, Math.floor(120e6 / Math.max(1, w * h))));

/** an undo/redo history of whole states. Pure. */
export class History {
  constructor(cap = 20) { this.cap = cap; this.past = []; this.future = []; this.now = null; }
  reset(state) { this.past = []; this.future = []; this.now = state; return this; }
  push(state) { if (this.now !== null) this.past.push(this.now); while (this.past.length > this.cap) this.past.shift(); this.now = state; this.future = []; return this; }
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  undo() { if (!this.canUndo) return this.now; this.future.push(this.now); this.now = this.past.pop(); return this.now; }
  redo() { if (!this.canRedo) return this.now; this.past.push(this.now); this.now = this.future.pop(); return this.now; }
}

// ---- crop ----
export const ASPECTS = Object.freeze([['Free', 0], ['1:1', 1], ['4:3', 4 / 3], ['3:2', 3 / 2], ['16:9', 16 / 9], ['3:4', 3 / 4], ['2:3', 2 / 3], ['4:5', 4 / 5], ['9:16', 9 / 16]]);
/** the biggest centred crop box of an aspect (w/h; 0 = free, nearly the whole picture): { x, y, w, h } in picture pixels. Pure. */
export function cropRect(imgW, imgH, aspect = 0) {
  if (!(imgW > 0 && imgH > 0)) return null;
  if (!(aspect > 0)) { const w = Math.max(1, Math.round(imgW * 0.9)), h = Math.max(1, Math.round(imgH * 0.9)); return { x: Math.round((imgW - w) / 2), y: Math.round((imgH - h) / 2), w, h }; }
  let w = imgW, h = w / aspect; if (h > imgH) { h = imgH; w = h * aspect; }
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h)); return { x: Math.round((imgW - w) / 2), y: Math.round((imgH - h) / 2), w, h };
}
/** a rect kept inside the picture, at least `min` on a side. Pure. */
export function clampRect(r, imgW, imgH, min = 8) {
  const w = Math.min(imgW, Math.max(min, Math.round(r.w))), h = Math.min(imgH, Math.max(min, Math.round(r.h)));
  return { x: Math.min(imgW - w, Math.max(0, Math.round(r.x))), y: Math.min(imgH - h, Math.max(0, Math.round(r.y))), w, h };
}
/** the box dragged by its bottom-right corner by (dx, dy) picture pixels, keeping the aspect when one is set. Pure. */
export function resizeRect(r, dx, dy, aspect, imgW, imgH, min = 8) {
  let w = Math.max(min, r.w + dx), h = Math.max(min, r.h + dy);
  if (aspect > 0) { h = w / aspect; if (r.y + h > imgH) { h = imgH - r.y; w = h * aspect; } if (r.x + w > imgW) { w = imgW - r.x; h = w / aspect; } }
  else { w = Math.min(w, imgW - r.x); h = Math.min(h, imgH - r.y); }
  return clampRect({ x: r.x, y: r.y, w, h }, imgW, imgH, min);
}

// ---- sizes ----
/** an output size from a target width and/or height (0 = unset) keeping the aspect: { w, h }. A percent scales both. Pure. */
export function outSize(srcW, srcH, { w = 0, h = 0, pct = 0 } = {}) {
  if (!(srcW > 0 && srcH > 0)) return { w: 0, h: 0 };
  if (pct > 0) return { w: Math.max(1, Math.round(srcW * pct / 100)), h: Math.max(1, Math.round(srcH * pct / 100)) };
  if (w > 0 && h > 0) return { w: Math.round(w), h: Math.round(h) };
  if (w > 0) return { w: Math.round(w), h: Math.max(1, Math.round(srcH * w / srcW)) };
  if (h > 0) return { w: Math.max(1, Math.round(srcW * h / srcH)), h: Math.round(h) };
  return { w: srcW, h: srcH };
}
/** "1.2 MB", "340 KB", "812 B" (1 KB = 1,000 bytes, as a form counts). Pure. */
export function sizeLabel(n) { n = Number(n) || 0; return n >= 1e6 ? (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + ' MB' : n >= 1e3 ? (n / 1e3).toFixed(n >= 1e5 ? 0 : 1).replace(/\.0$/, '') + ' KB' : n + ' B'; }
/** the share of the original saved, as a whole percent (negative when the copy is bigger). Pure. */
export const savedPct = (before, after) => (before > 0 ? Math.round((1 - after / before) * 100) : 0);
export const EXT = Object.freeze({ 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' });
/** a safe download name: the original's base name, a suffix, the new extension; names in one batch never repeat. Pure. */
export function outName(name, mime, taken = new Set()) {
  const base = String(name || 'photo').replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'photo', ext = EXT[mime] || 'jpg';
  let n = base + '-verse.' + ext, i = 2; while (taken.has(n)) n = base + '-verse-' + i++ + '.' + ext; taken.add(n); return n;
}
/** the type a file's bytes say it is: 'jpeg' | 'png' | 'webp' | 'gif' | 'avif' | 'bmp' | ''. Pure. */
export function sniff(b) {
  if (!b || b.length < 12) return '';
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  const s = (a, n) => String.fromCharCode(...b.subarray(a, a + n));
  if (s(0, 4) === 'RIFF' && s(8, 4) === 'WEBP') return 'webp';
  if (s(0, 3) === 'GIF') return 'gif';
  if (s(4, 4) === 'ftyp' && /avif|avis/.test(s(8, 8))) return 'avif';
  if (b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  return '';
}

// ---- colour: adjustments and filters ----
/** the looks. sat/con/bri in -100..100, gain per channel, sepia/invert 0..1, lift raises the blacks, vig darkens the corners (0..1). */
export const FILTERS = Object.freeze({
  none: {}, mono: { sat: -100 }, noir: { sat: -100, con: 35, bri: -8, vig: 0.35 }, sepia: { sepia: 1 }, vintage: { sepia: 0.45, con: -10, sat: -15, lift: 14, vig: 0.3 },
  warm: { gain: [1.08, 1.02, 0.9], sat: 8 }, cool: { gain: [0.9, 1.0, 1.1], sat: 4 }, vivid: { sat: 45, con: 15 }, fade: { con: -20, lift: 22, sat: -12 },
  drama: { con: 40, sat: 12, bri: -6, vig: 0.4 }, bright: { bri: 18, con: 8 }, invert: { invert: 1 },
});
export const DEFAULT_ADJ = Object.freeze({ bri: 0, con: 0, sat: 0, sharpen: 0, blur: 0, filter: 'none' });
/** are the adjustments the untouched ones. Pure. */
export const isPlain = (a) => !a || (!a.bri && !a.con && !a.sat && !a.sharpen && !a.blur && (!a.filter || a.filter === 'none'));

/** a box blur of radius r (pixels), done twice for a soft falloff, in place on RGBA. Pure. */
export function blurPixels(d, w, h, r) {
  r = Math.round(r); if (r < 1 || w < 2 || h < 2) return d;
  const tmp = new Uint8ClampedArray(d.length), pass = (src, dst, len, lines, step, lineStep) => {
    const win = 2 * r + 1;
    for (let l = 0; l < lines; l++) { const base = l * lineStep;
      for (let c = 0; c < 4; c++) { let sum = 0;
        for (let k = -r; k <= r; k++) sum += src[base + Math.min(len - 1, Math.max(0, k)) * step + c];
        for (let i = 0; i < len; i++) { dst[base + i * step + c] = sum / win; const add = Math.min(len - 1, i + r + 1), sub = Math.max(0, i - r); sum += src[base + add * step + c] - src[base + sub * step + c]; } } }
  };
  for (let n = 0; n < 2; n++) { pass(d, tmp, w, h, 4, w * 4); pass(tmp, d, h, w, w * 4, 4); }
  return d;
}
/** unsharp mask: the picture plus `amount` (0..100) of what a 1-pixel blur removes, in place. Pure. */
export function sharpenPixels(d, w, h, amount) {
  if (!(amount > 0)) return d; const copy = blurPixels(new Uint8ClampedArray(d), w, h, 1), k = amount / 40;
  for (let i = 0; i < d.length; i += 4) for (let c = 0; c < 3; c++) d[i + c] = d[i + c] + (d[i + c] - copy[i + c]) * k;
  return d;
}
/** the adjustments and the filter applied to RGBA pixels in place (blur, then colour, then sharpen). Radii are for a 1,000 px picture and scale with the size. Pure. */
export function adjustPixels(d, w, h, adj = DEFAULT_ADJ) {
  if (isPlain(adj)) return d;
  const scale = Math.max(w, h) / 1000, f = FILTERS[adj.filter] || {};
  if (adj.blur > 0) blurPixels(d, w, h, adj.blur * scale);
  const bri = ((adj.bri || 0) + (f.bri || 0)) * 2.55, con = Math.max(-99, Math.min(99, (adj.con || 0) + (f.con || 0))), sat = Math.max(-100, (adj.sat || 0) + (f.sat || 0)) / 100;
  const cf = (259 * (con + 255)) / (255 * (259 - con)), gain = f.gain || [1, 1, 1], sep = f.sepia || 0, inv = f.invert || 0, lift = f.lift || 0, vig = f.vig || 0;
  const cx = w / 2, cy = h / 2, maxd = Math.hypot(cx, cy) || 1;
  for (let p = 0, i = 0; i < d.length; i += 4, p++) {
    let r = d[i], g = d[i + 1], b = d[i + 2];
    if (sep) { const sr = 0.393 * r + 0.769 * g + 0.189 * b, sg = 0.349 * r + 0.686 * g + 0.168 * b, sb = 0.272 * r + 0.534 * g + 0.131 * b; r += (sr - r) * sep; g += (sg - g) * sep; b += (sb - b) * sep; }
    if (sat) { const l = 0.299 * r + 0.587 * g + 0.114 * b; r = l + (r - l) * (1 + sat); g = l + (g - l) * (1 + sat); b = l + (b - l) * (1 + sat); }
    r = (r * gain[0] - 128) * cf + 128 + bri; g = (g * gain[1] - 128) * cf + 128 + bri; b = (b * gain[2] - 128) * cf + 128 + bri;
    if (lift) { r += (255 - r) * lift / 255; g += (255 - g) * lift / 255; b += (255 - b) * lift / 255; }
    if (vig) { const x = p % w, y = (p / w) | 0, k = 1 - vig * Math.pow(Math.hypot(x - cx, y - cy) / maxd, 2); r *= k; g *= k; b *= k; }
    if (inv) { r += (255 - 2 * r) * inv; g += (255 - 2 * g) * inv; b += (255 - 2 * b) * inv; }
    d[i] = r; d[i + 1] = g; d[i + 2] = b;
  }
  if (adj.sharpen > 0) sharpenPixels(d, w, h, adj.sharpen);
  return d;
}

// ---- smaller PNGs: a palette (what TinyPNG does), written here ----
/** the colours of RGBA pixels reduced to at most `n` by median cut over a 5-5-5-4 bit histogram: { palette: Uint8Array (RGBA x count), indices: Uint8Array }. Pure. */
export function quantize(d, w, h, n = 256) {
  n = Math.max(2, Math.min(256, n | 0)); const cells = new Map();
  for (let i = 0; i < d.length; i += 4) { const a = d[i + 3], k = ((d[i] >> 3) << 14) | ((d[i + 1] >> 3) << 9) | ((d[i + 2] >> 3) << 4) | (a >> 4); let c = cells.get(k); if (!c) { c = { k, n: 0, r: 0, g: 0, b: 0, a: 0 }; cells.set(k, c); } c.n++; c.r += d[i]; c.g += d[i + 1]; c.b += d[i + 2]; c.a += a; }
  const list = [...cells.values()].map((c) => ({ ...c, R: c.r / c.n, G: c.g / c.n, B: c.b / c.n, A: c.a / c.n }));
  let boxes = [list];
  const spread = (box) => { let lo = [255, 255, 255, 255], hi = [0, 0, 0, 0]; for (const c of box) { const v = [c.R, c.G, c.B, c.A]; for (let j = 0; j < 4; j++) { if (v[j] < lo[j]) lo[j] = v[j]; if (v[j] > hi[j]) hi[j] = v[j]; } } let best = 0, bw = -1; for (let j = 0; j < 4; j++) { const r = (hi[j] - lo[j]) * (j === 3 ? 0.8 : 1); if (r > bw) { bw = r; best = j; } } return { ch: best, range: bw }; };
  while (boxes.length < n) {
    let bi = -1, bs = 0; boxes.forEach((b, i) => { if (b.length < 2) return; const s = spread(b).range * Math.log2(1 + b.reduce((t, c) => t + c.n, 0)); if (s > bs) { bs = s; bi = i; } });
    if (bi < 0 || bs <= 0) break; const box = boxes[bi], ch = ['R', 'G', 'B', 'A'][spread(box).ch]; box.sort((x, y) => x[ch] - y[ch]);
    const total = box.reduce((t, c) => t + c.n, 0); let acc = 0, cut = 1; for (let i = 0; i < box.length - 1; i++) { acc += box[i].n; if (acc >= total / 2) { cut = i + 1; break; } cut = i + 1; }
    boxes.splice(bi, 1, box.slice(0, cut), box.slice(cut));
  }
  const palette = new Uint8Array(boxes.length * 4), lookup = new Map();
  boxes.forEach((box, bi) => { let t = 0, r = 0, g = 0, b = 0, a = 0; for (const c of box) { t += c.n; r += c.r; g += c.g; b += c.b; a += c.a; lookup.set(c.k, bi); } palette.set([Math.round(r / t), Math.round(g / t), Math.round(b / t), Math.round(a / t)], bi * 4); });
  const indices = new Uint8Array(w * h);
  for (let p = 0, i = 0; p < indices.length; p++, i += 4) indices[p] = lookup.get(((d[i] >> 3) << 14) | ((d[i + 1] >> 3) << 9) | ((d[i + 2] >> 3) << 4) | (d[i + 3] >> 4));
  return { palette, indices };
}
const pngChunk = (type, data) => { const out = new Uint8Array(12 + data.length), v = new DataView(out.buffer); v.setUint32(0, data.length); for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i); out.set(data, 8); v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length))); return out; };
/** an indexed PNG from palette indices (zlib by CompressionStream, which every current browser has). Pure over its inputs; async. */
export async function encodeIndexedPng(indices, palette, w, h) {
  const count = palette.length / 4, raw = new Uint8Array((w + 1) * h); for (let y = 0; y < h; y++) raw.set(indices.subarray(y * w, (y + 1) * w), y * (w + 1) + 1);
  const z = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate'))).arrayBuffer());
  const ihdr = new Uint8Array(13), v = new DataView(ihdr.buffer); v.setUint32(0, w); v.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 3;
  const plte = new Uint8Array(count * 3), trns = []; let anyAlpha = false; for (let i = 0; i < count; i++) { plte.set(palette.subarray(i * 4, i * 4 + 3), i * 3); trns.push(palette[i * 4 + 3]); if (palette[i * 4 + 3] < 255) anyAlpha = true; }
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', ihdr), pngChunk('PLTE', plte)]; if (anyAlpha) parts.push(pngChunk('tRNS', new Uint8Array(trns)));
  parts.push(pngChunk('IDAT', z), pngChunk('IEND', new Uint8Array(0)));
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}

// ---- metadata: everything a file says about itself ----
const T_IFD0 = { 0x010e: 'Description', 0x010f: 'Camera make', 0x0110: 'Camera model', 0x0112: 'Orientation', 0x011a: 'X resolution', 0x011b: 'Y resolution', 0x0131: 'Software', 0x0132: 'Modified', 0x013b: 'Artist', 0x8298: 'Copyright' };
const T_EXIF = { 0x829a: 'Exposure time', 0x829d: 'Aperture', 0x8822: 'Exposure program', 0x8827: 'ISO', 0x9003: 'Taken', 0x9004: 'Digitised', 0x9204: 'Exposure bias', 0x9207: 'Metering', 0x9209: 'Flash', 0x920a: 'Focal length', 0xa002: 'Width (EXIF)', 0xa003: 'Height (EXIF)', 0xa405: 'Focal length (35 mm)', 0xa430: 'Owner', 0xa431: 'Camera serial number', 0xa433: 'Lens make', 0xa434: 'Lens model', 0xa435: 'Lens serial number' };
const T_GPS = { 0x0006: 'Altitude', 0x0007: 'GPS time', 0x001d: 'GPS date' };
const ORIENT = ['', 'Normal', 'Mirrored', 'Rotated 180°', 'Flipped', 'Mirrored, turned left', 'Turned right', 'Mirrored, turned right', 'Turned left'];
const tidy = (n) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000));
function readTiff(b, t, end, add, out) {
  if (t + 8 > end) return; const le = b[t] === 0x49, u16 = (o) => (o + 2 > end ? 0 : le ? b[o] | (b[o + 1] << 8) : (b[o] << 8) | b[o + 1]);
  const u32 = (o) => (o + 4 > end ? 0 : le ? (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0 : ((b[o] << 24) | (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3]) >>> 0);
  const i32 = (o) => u32(o) | 0, SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
  const entries = (ifd) => { const o = t + ifd, n = u16(o), list = []; for (let k = 0; k < n && k < 300; k++) { const e = o + 2 + k * 12; if (e + 12 > end) break; const type = u16(e + 2), count = u32(e + 4), bytes = (SIZE[type] || 1) * count; list.push({ tag: u16(e), type, count, at: bytes <= 4 ? e + 8 : t + u32(e + 8) }); } return list; };
  const nums = (e) => { const v = []; for (let k = 0; k < e.count && k < 8; k++) { const o = e.at; if (e.type === 3) v.push(u16(o + k * 2)); else if (e.type === 4) v.push(u32(o + k * 4)); else if (e.type === 5) { const d = u32(o + k * 8 + 4); v.push(d ? u32(o + k * 8) / d : NaN); } else if (e.type === 10) { const d = i32(o + k * 8 + 4); v.push(d ? i32(o + k * 8) / d : NaN); } else v.push(b[o + k]); } return v; };
  const ascii = (e) => { let s = ''; for (let k = 0; k < e.count - 1 && e.at + k < end; k++) { const c = b[e.at + k]; if (c === 0) break; s += String.fromCharCode(c); } return s.trim(); };
  const show = (e, group, name) => {
    let v; if (e.type === 2) v = ascii(e); else { const n = nums(e); if (!n.length || n.some((x) => !Number.isFinite(x))) return; v = n.length === 1 ? tidy(n[0]) : n.map(tidy).join(', ');
      if (e.tag === 0x0112) v = ORIENT[n[0]] || v; else if (e.tag === 0x829a && n[0] > 0 && n[0] < 1) v = '1/' + Math.round(1 / n[0]) + ' s'; else if (e.tag === 0x829d) v = 'f/' + tidy(n[0]); else if (e.tag === 0x920a || e.tag === 0xa405) v += ' mm'; else if (e.tag === 0x0006) v += ' m'; else if (e.tag === 0x9209) v = n[0] & 1 ? 'Fired' : 'Did not fire'; }
    if (v !== '' && v != null) add({ group, label: name, value: v });
  };
  let exifAt = 0, gpsAt = 0;
  for (const e of entries(u32(t + 4))) { if (e.tag === 0x8769) exifAt = u32(e.at); else if (e.tag === 0x8825) gpsAt = u32(e.at); else if (T_IFD0[e.tag]) show(e, 'Camera', T_IFD0[e.tag]); }
  if (exifAt) for (const e of entries(exifAt)) if (T_EXIF[e.tag]) show(e, /Lens|serial|Owner/i.test(T_EXIF[e.tag]) ? 'Camera' : 'Shot', T_EXIF[e.tag]);
  if (gpsAt) { let latRef = 'N', lonRef = 'E', lat = null, lon = null; const dms = (v) => (v.length === 3 && v.every(Number.isFinite) ? v[0] + v[1] / 60 + v[2] / 3600 : null);
    for (const e of entries(gpsAt)) { if (e.tag === 1) latRef = String.fromCharCode(b[e.at]); else if (e.tag === 3) lonRef = String.fromCharCode(b[e.at]); else if (e.tag === 2 && e.count === 3) lat = dms(nums(e)); else if (e.tag === 4 && e.count === 3) lon = dms(nums(e)); else if (T_GPS[e.tag] && e.tag === 6) show(e, 'Place', T_GPS[e.tag]); }
    if (lat != null && lon != null && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0)) { out.gps = { lat: latRef === 'S' ? -lat : lat, lon: lonRef === 'W' ? -lon : lon }; add({ group: 'Place', label: 'GPS position', value: out.gps.lat.toFixed(5) + ', ' + out.gps.lon.toFixed(5) }); } }
  out.exif = true;
}
/** what a file says about itself: { kind, width, height, items: [{ group, label, value }], has: { exif, gps, xmp, iptc, icc, comment, text }, gps }. Anything unreadable is left out, never guessed. Pure. */
export function readMeta(input) {
  const b = input instanceof Uint8Array ? input : new Uint8Array(input || []), kind = sniff(b), out = { kind, width: 0, height: 0, items: [], has: { exif: false, gps: false, xmp: false, iptc: false, icc: false, comment: false, text: false }, gps: null };
  const add = (it) => out.items.push(it), s = (a, n) => String.fromCharCode(...b.subarray(a, Math.min(b.length, a + n)));
  if (kind === 'jpeg') {
    let i = 2; while (i + 4 <= b.length && b[i] === 0xff) {
      const m = b[i + 1]; if (m === 0xff) { i++; continue; } if (m === 0xd8 || (m >= 0xd0 && m <= 0xd7) || m === 0x01) { i += 2; continue; } if (m === 0xda || m === 0xd9) break;
      const len = (b[i + 2] << 8) | b[i + 3]; if (len < 2) break; const body = i + 4;
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc && !out.width) { out.height = (b[body + 1] << 8) | b[body + 2]; out.width = (b[body + 3] << 8) | b[body + 4]; }
      else if (m === 0xe1 && s(body, 5) === 'Exif\0') readTiff(b, body + 6, Math.min(b.length, i + 2 + len), add, out);
      else if (m === 0xe1 && /^http:\/\/ns\.adobe\.com\/xap/.test(s(body, 29))) { out.has.xmp = true; const x = s(body + 29, Math.min(len, 4000)), c = /<dc:creator>[\s\S]*?<rdf:li[^>]*>([^<]+)</.exec(x); if (c) add({ group: 'Camera', label: 'Creator (XMP)', value: c[1].trim() }); }
      else if (m === 0xed) out.has.iptc = true; else if (m === 0xe2 && s(body, 11) === 'ICC_PROFILE') out.has.icc = true;
      else if (m === 0xfe) { out.has.comment = true; add({ group: 'Other', label: 'Comment', value: s(body, Math.min(len - 2, 200)) }); }
      i += 2 + len;
    }
  } else if (kind === 'png') {
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength); out.width = v.getUint32(16); out.height = v.getUint32(20); let i = 8;
    while (i + 12 <= b.length) { const len = v.getUint32(i), type = s(i + 4, 4), body = i + 8;
      if (type === 'eXIf') readTiff(b, body, Math.min(b.length, body + len), add, out); else if (type === 'iCCP') out.has.icc = true;
      else if (type === 'tEXt' || type === 'iTXt' || type === 'zTXt') { out.has.text = true; const z = b.indexOf(0, body), key = s(body, Math.min(z < 0 ? len : z - body, 40)); if (/^XML:com\.adobe\.xmp$/.test(key)) out.has.xmp = true; else add({ group: 'Other', label: 'Text: ' + key, value: type === 'tEXt' ? s(z + 1, Math.min(len - (z - body) - 1, 200)) : '(compressed)' }); }
      else if (type === 'IEND') break; i += 12 + len; }
  } else if (kind === 'webp') {
    let i = 12; while (i + 8 <= b.length) { const type = s(i, 4), len = b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24), body = i + 8;
      if (type === 'VP8X') { out.width = 1 + (b[body + 4] | (b[body + 5] << 8) | (b[body + 6] << 16)); out.height = 1 + (b[body + 7] | (b[body + 8] << 8) | (b[body + 9] << 16)); }
      else if (type === 'VP8L' && !out.width) { const x = b[body + 1] | (b[body + 2] << 8) | (b[body + 3] << 16) | (b[body + 4] << 24); out.width = 1 + (x & 0x3fff); out.height = 1 + ((x >> 14) & 0x3fff); }
      else if (type === 'VP8 ' && !out.width) { out.width = (b[body + 6] | (b[body + 7] << 8)) & 0x3fff; out.height = (b[body + 8] | (b[body + 9] << 8)) & 0x3fff; }
      else if (type === 'EXIF') readTiff(b, s(body, 6) === 'Exif\0\0' ? body + 6 : body, Math.min(b.length, body + len), add, out); else if (type === 'XMP ') out.has.xmp = true; else if (type === 'ICCP') out.has.icc = true;
      i += 8 + len + (len & 1); }
  }
  out.has.gps = !!out.gps; out.has.exif = out.has.exif || out.items.length > 0;
  return out;
}
/** the privacy findings of a file in a sentence: what a copy would carry (or "no hidden data"). Pure. */
export function privacySentence(m) {
  const found = []; if (m.has.gps) found.push('the place it was taken'); if (m.items.some((x) => /serial/i.test(x.label))) found.push('a camera serial number'); if (m.items.some((x) => x.label === 'Taken')) found.push('when it was taken');
  if (m.items.some((x) => /Camera (make|model)/.test(x.label))) found.push('the camera'); if (m.has.xmp) found.push('editing notes (XMP)'); if (m.has.iptc) found.push('caption and credit (IPTC)'); if (m.has.comment || m.has.text) found.push('text comments');
  return found.length ? 'This file carries ' + found.join(', ') + '.' : 'No camera, place or editing data found in this file.';
}
