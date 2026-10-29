// lib/sprite-sheet.js: the cleanup half of a sprite tool from the owner's repos (archive/repos/fire-ember-mountain-cabin/.grok/skills/generate2dsprite,
// scripts/generate2dsprite.py, from agent-sprite-forge; MIT License, Copyright (c) 2026 0x0funky, kept in that folder's LICENSE). A sheet drawn on a
// magenta (#ff00ff) background comes in; the magenta is keyed out, the sheet is cut into a rows x cols grid, each cell is trimmed, its edge fringe
// cleaned and its sprite cropped (all of it, or only the largest connected piece), scaled to fit a square cell with the same 0.85 margin and center or
// feet alignment, and the frames are laid out again on one transparent sheet. The thresholds and steps are the Python ones; one change: scaling is
// nearest neighbour, not Lanczos, so pixel art keeps its hard edges. Images are ImageData-shaped { width, height, data: RGBA bytes }. Pure: no DOM.
// Tests: tools/sprite-sheet.test.mjs.

export const DEFAULTS = Object.freeze({ threshold: 100, edgeThreshold: 150, fitScale: 0.85, trimBorderPx: 4, edgeCleanDepth: 3, align: 'center', sharedScale: false, componentMode: 'all', componentPadding: 0, minComponentArea: 1 });
export const MAX_SIDE = 4096;

/** a blank (transparent) image */
export const blank = (width, height) => ({ width, height, data: new Uint8ClampedArray(width * height * 4) });
const copy = (img) => ({ width: img.width, height: img.height, data: new Uint8ClampedArray(img.data) });
const magentaDist = (d, i) => Math.sqrt((d[i] - 255) ** 2 + d[i + 1] ** 2 + (d[i + 2] - 255) ** 2);
const clear = (d, i) => { d[i] = d[i + 1] = d[i + 2] = d[i + 3] = 0; };

/** key out the magenta: every pixel near #ff00ff goes clear, then a flood from the border also clears the pinker fringe it reaches (remove_bg_magenta) */
export function removeMagenta(img, { threshold = DEFAULTS.threshold, edgeThreshold = DEFAULTS.edgeThreshold } = {}) {
  const out = copy(img), d = out.data, w = out.width, h = out.height;
  for (let i = 0; i < d.length; i += 4) if (d[i + 3] !== 0 && magentaDist(d, i) < threshold) clear(d, i);
  // each pixel enters the queue once (marked when queued): the same pixels as the Python's visited set, without its repeats
  const seen = new Uint8Array(w * h), queue = new Int32Array(w * h);
  let n = 0;
  const add = (x, y) => { if (x >= 0 && x < w && y >= 0 && y < h && !seen[y * w + x]) { seen[y * w + x] = 1; queue[n++] = y * w + x; } };
  for (let x = 0; x < w; x++) { add(x, 0); add(x, h - 1); }
  for (let y = 0; y < h; y++) { add(0, y); add(w - 1, y); }
  for (let q = 0; q < n; q++) {
    const p = queue[q], x = p % w, y = (p - x) / w, i = p * 4;
    if (d[i + 3] !== 0) { if (magentaDist(d, i) < edgeThreshold) clear(d, i); else continue; }
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (dx || dy) add(x + dx, y + dy);
  }
  return out;
}

/** the part of an image inside box [x0, y0, x1, y1) */
export function crop(img, [x0, y0, x1, y1]) {
  const w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0), out = blank(w, h);
  for (let y = 0; y < h; y++) out.data.set(img.data.subarray(((y0 + y) * img.width + x0) * 4, ((y0 + y) * img.width + x0 + w) * 4), y * w * 4);
  return out;
}

/** the box around every pixel that is not fully clear, or null (PIL getbbox on the alpha) */
export function bboxOf(img) {
  let x0 = img.width, y0 = img.height, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (img.data[(y * img.width + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  return x1 < 0 ? null : [x0, y0, x1 + 1, y1 + 1];
}

/** cut px off every side, when the image is bigger than that (trim_border) */
export const trimBorder = (img, px = DEFAULTS.trimBorderPx) => (img.width > px * 2 && img.height > px * 2 ? crop(img, [px, px, img.width - px, img.height - px]) : img);

/** clear near-black and near-magenta pixels in the outer `depth` rows and columns, the fringe a grid line or the key leaves (clean_edges) */
export function cleanEdges(img, depth = DEFAULTS.edgeCleanDepth) {
  const out = copy(img), d = out.data, w = out.width, h = out.height;
  const hit = (x, y) => { if (x < 0 || x >= w || y < 0 || y >= h) return; const i = (y * w + x) * 4; if (d[i + 3] && ((d[i] < 40 && d[i + 1] < 40 && d[i + 2] < 40) || magentaDist(d, i) < 150)) clear(d, i); };
  for (let k = 0; k < depth; k++) { for (let x = 0; x < w; x++) { hit(x, k); hit(x, h - 1 - k); } for (let y = 0; y < h; y++) { hit(k, y); hit(w - 1 - k, y); } }
  return out;
}

/** the 4-connected pieces of the image, biggest first: [{ area, bbox, touchesEdge }] (connected_components) */
export function components(img, minArea = 1) {
  const w = img.width, h = img.height, d = img.data, seen = new Uint8Array(w * h), out = [];
  for (let s = 0; s < w * h; s++) {
    if (!d[s * 4 + 3] || seen[s]) continue;
    const queue = [s]; seen[s] = 1;
    let area = 0, x0 = w, y0 = h, x1 = 0, y1 = 0, touchesEdge = false;
    for (let q = 0; q < queue.length; q++) {
      const p = queue[q], x = p % w, y = (p - x) / w;
      area++; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touchesEdge = true;
      for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) { const n = ny * w + nx; if (nx >= 0 && nx < w && ny >= 0 && ny < h && d[n * 4 + 3] && !seen[n]) { seen[n] = 1; queue.push(n); } }
    }
    if (area >= minArea) out.push({ area, bbox: [x0, y0, x1 + 1, y1 + 1], touchesEdge });
  }
  return out.sort((a, b) => b.area - a.area);
}

/** a nearest-neighbour copy at the new size, sampled at pixel centres the way PIL's NEAREST is (a float step added each pixel; the same picks for
 *  every size pair up to 89 x 89, checked against Pillow), so pixel art keeps its hard edges */
export function scale(img, width, height) {
  const out = blank(width, height), kx = img.width / width, ky = img.height / height, xs = new Int32Array(width);
  for (let x = 0, xx = 0.5 * kx; x < width; x++, xx += kx) xs[x] = Math.min(img.width - 1, Math.floor(xx));
  for (let y = 0, yy = 0.5 * ky; y < height; y++, yy += ky) {
    const sy = Math.min(img.height - 1, Math.floor(yy));
    for (let x = 0; x < width; x++) { const si = (sy * img.width + xs[x]) * 4, di = (y * width + x) * 4; out.data[di] = img.data[si]; out.data[di + 1] = img.data[si + 1]; out.data[di + 2] = img.data[si + 2]; out.data[di + 3] = img.data[si + 3]; }
  }
  return out;
}

/** draw src over dst at (x, y), alpha over (PIL paste with the frame as its own mask) */
export function paste(dst, src, px, py) {
  for (let y = 0; y < src.height; y++) {
    const dy = py + y; if (dy < 0 || dy >= dst.height) continue;
    for (let x = 0; x < src.width; x++) {
      const dx = px + x; if (dx < 0 || dx >= dst.width) continue;
      const si = (y * src.width + x) * 4, di = (dy * dst.width + dx) * 4, a = src.data[si + 3] / 255; if (!a) continue;
      const ba = dst.data[di + 3] / 255, oa = a + ba * (1 - a);
      for (let c = 0; c < 3; c++) dst.data[di + c] = Math.round((src.data[si + c] * a + dst.data[di + c] * ba * (1 - a)) / oa);
      dst.data[di + 3] = Math.round(oa * 255);
    }
  }
  return dst;
}

const pad = ([x0, y0, x1, y1], p, w, h) => [Math.max(0, x0 - p), Math.max(0, y0 - p), Math.min(w, x1 + p), Math.min(h, y1 + p)];

/** cut a keyed sheet into rows x cols frames of cellSize square, each sprite cropped and fitted (split_grid). { frames, info } */
export function splitGrid(img, rows, cols, cellSize, opts = {}) {
  const o = { ...DEFAULTS, ...opts }, keyed = removeMagenta(img, o), cw = Math.floor(keyed.width / cols), ch = Math.floor(keyed.height / rows);
  const cropped = [], info = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    let f = crop(keyed, [c * cw, r * ch, (c + 1) * cw, (r + 1) * ch]);
    if (o.trimBorderPx > 0) f = trimBorder(f, o.trimBorderPx);
    if (o.edgeCleanDepth > 0) f = cleanEdges(f, o.edgeCleanDepth);
    const parts = components(f, o.minComponentArea), pick = o.componentMode === 'largest' && parts.length ? parts[0] : null;
    const box = pick ? pad(pick.bbox, o.componentPadding, f.width, f.height) : bboxOf(f);
    if (box) f = crop(f, box);
    cropped.push(f); info.push({ grid: [r, c], parts: parts.length, crop: box });
  }
  let common = null;
  if (o.sharedScale) { const mw = Math.max(0, ...cropped.map((f) => f.width)), mh = Math.max(0, ...cropped.map((f) => f.height)); if (mw && mh) common = Math.min(cellSize / mw, cellSize / mh) * o.fitScale; }
  const frames = cropped.map((f, i) => {
    const cell = blank(cellSize, cellSize);
    if (!f.width || !f.height) { info[i].size = [0, 0]; info[i].at = [0, 0]; return cell; }
    const k = common || Math.min(cellSize / f.width, cellSize / f.height) * o.fitScale, nw = Math.max(1, Math.floor(f.width * k)), nh = Math.max(1, Math.floor(f.height * k));
    const x = Math.floor((cellSize - nw) / 2), y = o.align === 'bottom' || o.align === 'feet' ? cellSize - nh - Math.max(0, Math.floor(cellSize * (1 - o.fitScale) * 0.5)) : Math.floor((cellSize - nh) / 2);
    paste(cell, scale(f, nw, nh), x, y); info[i].size = [nw, nh]; info[i].at = [x, y];
    return cell;
  });
  return { frames, info };
}

/** lay the frames out again on one transparent rows x cols sheet (compose_sheet) */
export function composeSheet(frames, rows, cols, cellSize) {
  const sheet = blank(cols * cellSize, rows * cellSize);
  frames.forEach((f, i) => paste(sheet, f, (i % cols) * cellSize, Math.floor(i / cols) * cellSize));
  return sheet;
}

/** the grid an ask names ("4x2", "4 by 2", "4 columns 2 rows") and a cell size ("64px"), or the defaults (4 x 1, 64). Pure. */
export function gridOf(text) {
  const t = String(text || '').toLowerCase(), clamp = (n, lo, hi, d) => (Number.isFinite(n) && n >= lo && n <= hi ? n : d);
  let cols = 4, rows = 1;
  const x = t.match(/\b(\d{1,2})\s*(?:x|by|×)\s*(\d{1,2})\b/);
  if (x) { cols = +x[1]; rows = +x[2]; }
  const c = t.match(/\b(\d{1,2})\s*(?:columns?|cols?|frames?)\b/), r = t.match(/\b(\d{1,2})\s*rows?\b/);
  if (c) cols = +c[1]; if (r) rows = +r[1];
  const s = t.match(/\b(\d{2,3})\s*(?:px|pixels?)\b/);
  return { cols: clamp(cols, 1, 16, 4), rows: clamp(rows, 1, 16, 1), cell: clamp(s ? +s[1] : 64, 16, 512, 64) };
}

/* The licence of the code this file ports (archive/repos/fire-ember-mountain-cabin/.grok/skills/generate2dsprite/LICENSE), kept with the port as it asks:

MIT License

Copyright (c) 2026 0x0funky

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
