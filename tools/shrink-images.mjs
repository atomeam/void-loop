// Verse's own photo compressor (lib/photo-edit.js: the palette PNG /photos/ and /photos/tinypng/ make, median cut to 256 colours, written with no
// WebAssembly and no upload) run over Verse's own pictures (owner, 2026-10-26: "Verse uses its own tools"). The share pictures in og/ were full
// colour screenshots of flat text and a gradient, 280-440 KB each; a link preview fetches one each time a page is shared.
//   node tools/shrink-images.mjs [files...]     shrink these PNGs in place (default: void-live-deploy/og/*.png)
//   node tools/shrink-images.mjs --check        exit 1 when a default picture would still shrink by more than a tenth (a new one went in raw)
// A picture is rewritten only when the palette version is at least 10% smaller and differs from it by no more than MAX_ERR on average per channel.
// The og generators (tools/og-tool-sites.mjs, tools/og-sports.mjs) call shrinkFile() on what they draw, so a new one is born small.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { quantize, encodeIndexedPng } from '../void-live-deploy/lib/photo-edit.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const site = path.resolve(here, '..', 'void-live-deploy');
export const MAX_ERR = 2.5; // mean absolute difference per channel (0-255) a shrunk picture may have
export const MIN_GAIN = 0.1;

/** an 8-bit, non-interlaced PNG (grey, RGB, palette, grey+alpha or RGBA) as { w, h, rgba }; null for anything else. Pure over bytes. */
export function decodePng(buf) {
  const b = Buffer.from(buf); if (b.readUInt32BE(0) !== 0x89504e47) return null;
  let o = 8, w = 0, h = 0, depth = 0, type = 0, inter = 0, plte = null, trns = null; const idat = [];
  while (o + 8 <= b.length) { const n = b.readUInt32BE(o), t = b.toString('ascii', o + 4, o + 8), d = b.subarray(o + 8, o + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); depth = d[8]; type = d[9]; inter = d[12]; } else if (t === 'PLTE') plte = d; else if (t === 'tRNS') trns = d; else if (t === 'IDAT') idat.push(d); else if (t === 'IEND') break;
    o += 12 + n; }
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[type]; if (depth !== 8 || inter || !ch || !w || !h) return null;
  const raw = zlib.inflateSync(Buffer.concat(idat)), stride = w * ch, px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) { const f = raw[y * (stride + 1)], src = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1)), row = px.subarray(y * stride, (y + 1) * stride), up = y ? px.subarray((y - 1) * stride, y * stride) : null;
    for (let i = 0; i < stride; i++) { const a = i >= ch ? row[i - ch] : 0, u = up ? up[i] : 0, c = up && i >= ch ? up[i - ch] : 0;
      let v = src[i]; if (f === 1) v += a; else if (f === 2) v += u; else if (f === 3) v += (a + u) >> 1; else if (f === 4) { const p = a + u - c, pa = Math.abs(p - a), pb = Math.abs(p - u), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? u : c; }
      row[i] = v & 255; } }
  const rgba = new Uint8Array(w * h * 4);
  for (let p = 0; p < w * h; p++) { const s = p * ch, d = p * 4;
    if (type === 6) { rgba[d] = px[s]; rgba[d + 1] = px[s + 1]; rgba[d + 2] = px[s + 2]; rgba[d + 3] = px[s + 3]; }
    else if (type === 2) { rgba[d] = px[s]; rgba[d + 1] = px[s + 1]; rgba[d + 2] = px[s + 2]; rgba[d + 3] = 255; }
    else if (type === 0) { rgba[d] = rgba[d + 1] = rgba[d + 2] = px[s]; rgba[d + 3] = 255; }
    else if (type === 4) { rgba[d] = rgba[d + 1] = rgba[d + 2] = px[s]; rgba[d + 3] = px[s + 1]; }
    else { const k = px[s]; rgba[d] = plte[k * 3]; rgba[d + 1] = plte[k * 3 + 1]; rgba[d + 2] = plte[k * 3 + 2]; rgba[d + 3] = trns && k < trns.length ? trns[k] : 255; } }
  return { w, h, rgba };
}

/** the palette version of PNG bytes and how far it is from them: { bytes, before, after, err } (err: mean absolute difference per channel). */
export async function shrinkPng(buf, colours = 256) {
  const img = decodePng(buf); if (!img) return null;
  const { palette, indices } = quantize(img.rgba, img.w, img.h, colours), out = await encodeIndexedPng(indices, palette, img.w, img.h);
  let diff = 0; for (let p = 0; p < indices.length; p++) for (let c = 0; c < 4; c++) diff += Math.abs(img.rgba[p * 4 + c] - palette[indices[p] * 4 + c]);
  return { bytes: Buffer.from(out), before: buf.length, after: out.length, err: diff / (indices.length * 4) };
}
/** shrink one file in place when it pays and looks the same; { file, before, after, err, wrote }. */
export async function shrinkFile(file, { write = true } = {}) {
  const buf = fs.readFileSync(file), r = await shrinkPng(buf);
  if (!r) return { file, before: buf.length, after: buf.length, err: 0, wrote: false, skipped: 'not an 8-bit PNG' };
  const pays = r.after <= r.before * (1 - MIN_GAIN) && r.err <= MAX_ERR;
  if (pays && write) fs.writeFileSync(file, r.bytes);
  return { file, before: r.before, after: pays ? r.after : r.before, err: r.err, wrote: pays && write, would: pays };
}
// og.png (the home page's picture) is left out: its soft glows band in 256 colours, seen when the two were compared side by side (2026-10-26)
export const DEFAULTS = () => [...fs.readdirSync(path.join(site, 'og')).filter((f) => f.endsWith('.png')).map((f) => path.join(site, 'og', f))];

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), check = a.includes('--check'), list = a.filter((x) => !x.startsWith('--'));
  let before = 0, after = 0; const raw = [];
  for (const f of list.length ? list : DEFAULTS()) {
    const r = await shrinkFile(path.resolve(f), { write: !check }); before += r.before; after += r.after;
    if (check && r.would) raw.push(path.relative(site, r.file) + ' (' + Math.round(r.before / 1024) + ' KB, ' + Math.round(r.after / 1024) + ' KB as a palette PNG)');
    if (!check) console.log(path.relative(process.cwd(), r.file) + '  ' + Math.round(r.before / 1024) + ' KB -> ' + Math.round(r.after / 1024) + ' KB' + (r.skipped ? ' (' + r.skipped + ')' : r.wrote ? ', mean error ' + r.err.toFixed(2) : ' (kept: ' + (r.err > MAX_ERR ? 'error ' + r.err.toFixed(2) : 'gain under ' + MIN_GAIN * 100 + '%') + ')'));
  }
  if (check) { console.log((raw.length ? 'FAIL' : 'ok') + ' shrink-images: ' + (raw.length ? raw.length + ' picture(s) went in raw: ' + raw.join(', ') + '. Run node tools/shrink-images.mjs' : 'every share picture is already a palette PNG')); process.exit(raw.length ? 1 : 0); }
  console.log('total ' + Math.round(before / 1024) + ' KB -> ' + Math.round(after / 1024) + ' KB (' + Math.round((1 - after / before) * 100) + '% smaller)');
}
