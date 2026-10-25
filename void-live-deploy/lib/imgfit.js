/**
 * imgfit: make a photo exactly the size a form asks for (owner, 2026-10-24: back to the easy sites; pancardresizer.com, a real one-job tool the filtered scan
 * surfaced: a three-step wizard that crops, resizes and compresses a photo or signature to a size in cm and a limit in KB, wrapped in ad, tag-manager,
 * jQuery, Bootstrap and Croppie requests). Here: any size in px, cm, mm or inches (with the dpi the form wants), one of three fits (crop to fill, fit inside,
 * stretch), a size limit in KB that is actually met (the JPEG quality is searched, and when no quality is small enough it says so and what the smallest
 * is, rather than pretend), and the result as a JPEG or as a one-page PDF. Pure maths and bytes; the page does the drawing (canvas) and nothing leaves the device.
 * Tests: tools/imgfit.test.mjs.
 */
export const UNITS = Object.freeze({ px: 1, cm: 1 / 2.54, mm: 1 / 25.4, in: 1 });
export const MAX_SIDE = 8000;

/** a length in pixels from a value, a unit and a dpi: px as they are, cm/mm/in through the dpi, rounded; 0 when it is not a usable size. Pure. */
export function toPx(value, unit = 'px', dpi = 300) {
  const v = Number(value), d = Number(dpi); if (!(v > 0) || !(UNITS[unit] > 0)) return 0;
  const px = unit === 'px' ? v : v * UNITS[unit] * (d > 0 ? d : 300); const r = Math.round(px); return r >= 1 && r <= MAX_SIDE ? r : 0;
}
/** how a source is drawn into an output box: { sx, sy, sw, sh, dx, dy, dw, dh, w, h } for the canvas drawImage call; 'fill' crops the middle to the box's shape, 'fit' keeps
 *  the whole picture inside the box (the output is that smaller box, not padded), 'stretch' squeezes it to the box. Pure. */
export function fitBox(srcW, srcH, outW, outH, mode = 'fill') {
  if (!(srcW > 0 && srcH > 0 && outW > 0 && outH > 0)) return null;
  if (mode === 'stretch') return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: 0, dy: 0, dw: outW, dh: outH, w: outW, h: outH };
  if (mode === 'fit') { const k = Math.min(outW / srcW, outH / srcH), w = Math.max(1, Math.round(srcW * k)), h = Math.max(1, Math.round(srcH * k)); return { sx: 0, sy: 0, sw: srcW, sh: srcH, dx: 0, dy: 0, dw: w, dh: h, w, h }; }
  const want = outW / outH, have = srcW / srcH; let sw = srcW, sh = srcH;
  if (have > want) sw = srcH * want; else sh = srcW / want;
  return { sx: (srcW - sw) / 2, sy: (srcH - sh) / 2, sw, sh, dx: 0, dy: 0, dw: outW, dh: outH, w: outW, h: outH };
}

/** the best JPEG under a size limit: `encode(q)` (q from 0.05 to 0.95) gives the bytes; the search keeps the highest quality that fits `maxBytes`.
 *  { bytes, quality, fits, smallest } - fits false means even the lowest quality is over the limit (bytes is then that smallest one). With no limit it is
 *  the quality 0.92 picture. Pure over the encoder it is given. */
export async function fitSize(encode, maxBytes) {
  if (!(maxBytes > 0)) { const bytes = await encode(0.92); return { bytes, quality: 0.92, fits: true, smallest: bytes.length }; }
  const low = await encode(0.05); if (low.length > maxBytes) return { bytes: low, quality: 0.05, fits: false, smallest: low.length };
  let lo = 0.05, hi = 0.95, best = low, bestQ = 0.05;
  const top = await encode(hi); if (top.length <= maxBytes) return { bytes: top, quality: hi, fits: true, smallest: low.length };
  for (let i = 0; i < 7; i++) { const q = (lo + hi) / 2, b = await encode(q); if (b.length <= maxBytes) { best = b; bestQ = q; lo = q; } else hi = q; }
  return { bytes: best, quality: Math.round(bestQ * 100) / 100, fits: true, smallest: low.length };
}

/** a JPEG's pixel size from its bytes: { w, h } or null. Pure. */
export function jpegSize(b) {
  if (!b || b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  for (let i = 2; i + 9 < b.length;) {
    if (b[i] !== 0xff) { i++; continue; } const m = b[i + 1]; if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { i += 2; continue; }
    const len = (b[i + 2] << 8) | b[i + 3]; if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb)) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + len;
  }
  return null;
}

/** a one-page PDF holding a JPEG at its real size (pixels at the dpi, in points): bytes. The page is exactly the picture. Pure. */
export function pdfOfJpeg(jpeg, w, h, dpi = 300) {
  const wp = (w * 72 / dpi).toFixed(2), hp = (h * 72 / dpi).toFixed(2), enc = new TextEncoder(), parts = [], offs = []; let pos = 0;
  const push = (x) => { const u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); pos += u.length; };
  const obj = (n, body) => { offs[n] = pos; push(n + ' 0 obj\n' + body + '\nendobj\n'); };
  push('%PDF-1.4\n%âãÏÓ\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>'); obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + wp + ' ' + hp + '] /Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>');
  const content = 'q ' + wp + ' 0 0 ' + hp + ' 0 0 cm /Im0 Do Q'; obj(4, '<< /Length ' + content.length + ' >>\nstream\n' + content + '\nendstream');
  offs[5] = pos; push('5 0 obj\n<< /Type /XObject /Subtype /Image /Width ' + w + ' /Height ' + h + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n'); push(jpeg); push('\nendstream\nendobj\n');
  const xref = pos; let x = 'xref\n0 6\n0000000000 65535 f \n'; for (let n = 1; n <= 5; n++) x += String(offs[n]).padStart(10, '0') + ' 00000 n \n';
  push(x + 'trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  const out = new Uint8Array(pos); let at = 0; for (const p of parts) { out.set(p, at); at += p.length; } return out;
}

// the asks: "resize a photo to 3.5 x 2.5 cm under 50 kb", "compress my image to 100kb", "make this picture 600 by 800 px", "resize my signature to 4.5 by 2 cm"
const THING = '(?:photo|photograph|picture|pic|image|signature|selfie|scan)s?';
const ASK = new RegExp('^(?:please\\s+)?(?:can\\s+you\\s+)?(?:(?:resize|compress|shrink|reduce|crop|scale|make)\\b.{0,30}\\b' + THING + '\\b|' + THING + '\\s+(?:resizer|compressor|resize|compress)|(?:image|photo|picture)\\s+(?:size\\s+)?(?:reducer|resizer|compressor)|(?:reduce|lower|cut)\\s+(?:the\\s+)?(?:file\\s+)?size\\s+of\\s+(?:a|my|this|the)\\s+' + THING + '|pan\\s*card\\s+(?:photo|signature)\\b.*)(?:\\s.*)?$', 'i');
const NOT = /\b(?:exif|metadata|location|gps|scrub|strip|stage|draw|3d|cartoon|figure|model|nude|movie|film|video|local|gif|rotate|pause)\b/i;
/** true for an ask that wants the resizer. Pure. */
// "make" wants a size ("make this picture 600 by 800 px"): "make the image red" is the stage image's colour edge, never the resizer
const MAKE_ONLY = /^(?:please\s+)?(?:can\s+you\s+)?make\b/i;
export const isAsk = (text) => { const t = String(text || '').trim(); return t.length < 140 && ASK.test(t) && !NOT.test(t) && (!MAKE_ONLY.test(t) || /\d/.test(t)); };
/** what size an ask names: { w, h, unit, kb } (any may be missing). "3.5 x 2.5 cm", "600 by 800 px", "under 50 kb", "to 100kb". Pure. */
export function sizeIn(text) {
  const t = String(text || '').toLowerCase(), out = {};
  const d = /(\d+(?:\.\d+)?)\s*(?:x|by|×|\*)\s*(\d+(?:\.\d+)?)\s*(cm|mm|in|inch|inches|px|pixels?)?/.exec(t);
  if (d) { out.w = Number(d[1]); out.h = Number(d[2]); const u = d[3]; out.unit = !u ? 'px' : /^px|^pixel/.test(u) ? 'px' : /^in/.test(u) ? 'in' : u; }
  const k = /(?:under|below|less than|max(?:imum)?|within|to|at most|upto|up to|<=?)?\s*(\d+(?:\.\d+)?)\s*(kb|k|mb)\b/.exec(t); if (k) out.kb = Math.round(Number(k[1]) * (k[2] === 'mb' ? 1024 : 1));
  return out;
}

/** the crop window for "fill" moved and zoomed by a person: the largest window of the output's shape, made `zoom` times smaller (1 or
 *  more) and centred on (cx, cy), fractions of the picture, then kept inside it. The same shape as fitBox, plus the centre it settled on. Pure. */
export function cropBox(srcW, srcH, outW, outH, { zoom = 1, cx = 0.5, cy = 0.5 } = {}) {
  const base = fitBox(srcW, srcH, outW, outH, 'fill'); if (!base) return null;
  const z = Math.max(1, Math.min(10, Number(zoom) || 1)), sw = base.sw / z, sh = base.sh / z;
  const sx = Math.min(srcW - sw, Math.max(0, cx * srcW - sw / 2)), sy = Math.min(srcH - sh, Math.max(0, cy * srcH - sh / 2));
  return { ...base, sx, sy, sw, sh, cx: (sx + sw / 2) / srcW, cy: (sy + sh / 2) / srcH, zoom: z };
}

/** the sizes forms ask for, as the portals and passport offices list them (check the form you are filling: they change): label, w, h,
 *  unit, dpi, largest KB (0 for none). */
export const PRESETS = Object.freeze([
  ['PAN photo (NSDL / Protean)', 2.5, 3.5, 'cm', 200, 50], ['PAN signature (NSDL / Protean)', 4.5, 2, 'cm', 200, 50],
  ['PAN photo (UTIITSL)', 213, 213, 'px', 300, 30], ['PAN signature (UTIITSL)', 400, 200, 'px', 600, 60],
  ['US passport / visa 2 × 2 in', 2, 2, 'in', 300, 240], ['UK passport 35 × 45 mm', 35, 45, 'mm', 300, 0], ['Schengen / EU visa 35 × 45 mm', 35, 45, 'mm', 300, 0],
  ['India passport 2 × 2 in', 51, 51, 'mm', 300, 0], ['Canada passport 50 × 70 mm', 50, 70, 'mm', 300, 0], ['China visa 33 × 48 mm', 33, 48, 'mm', 300, 0],
]);
