// Video transitions (2026-10-30, /converter/ Add Transition to Video): the 58 transitions that onlineconverter.com offers, drawn on this
// device, one picture at a time. blend() takes the last picture of the first video (a) and the first picture of the second (b), both RGBA
// pixels of the same size, and the progress p (1 at the start of the transition, 0 at the end), and writes the picture between them.
// Pure: no DOM, so node tests run it. A transition into or out of one video uses a plain colour picture for the other side.

export const TRANSITIONS = Object.freeze([
  ['fade', 'Fade'], ['wipeleft', 'Wipe Left'], ['wiperight', 'Wipe Right'], ['wipeup', 'Wipe Up'], ['wipedown', 'Wipe Down'],
  ['slideleft', 'Slide Left'], ['slideright', 'Slide Right'], ['slideup', 'Slide Up'], ['slidedown', 'Slide Down'],
  ['smoothleft', 'Smooth Left'], ['smoothright', 'Smooth Right'], ['smoothup', 'Smooth Up'], ['smoothdown', 'Smooth Down'],
  ['wipebl', 'Wipe Bottom Left'], ['wipebr', 'Wipe Bottom Right'], ['wipetl', 'Wipe Top Left'], ['wipetr', 'Wipe Top Right'],
  ['diagbl', 'Diagonal Bottom Left'], ['diagbr', 'Diagonal Bottom Right'], ['diagtl', 'Diagonal Top Left'], ['diagtr', 'Diagonal Top Right'],
  ['hlslice', 'Horizontal Left Slice'], ['hrslice', 'Horizontal Right Slice'], ['horzopen', 'Horizontal Open'], ['horzclose', 'Horizontal Close'],
  ['hblur', 'Horizontal Blur'], ['vuslice', 'Vertical Up Slice'], ['vdslice', 'Vertical Down Slice'], ['vertopen', 'Vertical Open'],
  ['vertclose', 'Vertical Close'], ['squeezev', 'Squeeze Vertical'], ['squeezeh', 'Squeeze Horizontal'], ['rectcrop', 'Rect Crop'],
  ['circlecrop', 'Circle Crop'], ['circleclose', 'Circle Close'], ['circleopen', 'Circle Open'], ['fadeblack', 'Fade Black'],
  ['fadewhite', 'Fade White'], ['fadegrays', 'Fade Grays'], ['distance', 'Distance'], ['radial', 'Radial'], ['dissolve', 'Dissolve'],
  ['pixelize', 'Pixelize'], ['zoomin', 'Zoom In'], ['fadefast', 'Fade Fast'], ['fadeslow', 'Fade Slow'],
  ['hlwind', 'Horizontal Left Wind'], ['hrwind', 'Horizontal Right Wind'], ['vuwind', 'Vertical Up Wind'], ['vdwind', 'Vertical Down Wind'],
  ['coverleft', 'Cover Left'], ['coverright', 'Cover Right'], ['coverup', 'Cover Up'], ['coverdown', 'Cover Down'],
  ['revealleft', 'Reveal Left'], ['revealright', 'Reveal Right'], ['revealup', 'Reveal Up'], ['revealdown', 'Reveal Down'],
]);
export const KINDS = TRANSITIONS.map((t) => t[0]);

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const ss = (e0, e1, v) => { const t = clamp((v - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const fract = (v) => v - Math.floor(v);
const ss32 = (e0, e1, v) => { const t = Math.fround(clamp(Math.fround(Math.fround(v - e0) / Math.fround(e1 - e0)), 0, 1)); return Math.fround(Math.fround(t * t) * Math.fround(3 - Math.fround(2 * t))); };
const fract32 = (v) => Math.fround(v - Math.floor(v));
// a slice edge: 32-bit, as the reference renderer counts it, so each slice ends on the same pixel
const slice = (u) => (p) => ss32(-0.5, 0, Math.fround(u - Math.fround(p * 1.5))) > fract32(Math.fround(10 * u));
// a fixed noise, the same on every run, so a video made twice comes out the same
const noise = (x, y) => fract(Math.sin(x * 12.9898 + y * 78.233) * 43758.545);

/** writes the transition picture into out. a, b, out: RGBA bytes (Uint8ClampedArray or Uint8Array) of w x h; p: 1 (all a) to 0 (all b) */
export function blend(kind, a, b, out, w, h, p) {
  if (!KINDS.includes(kind)) throw new Error('no transition called ' + kind);
  p = Math.fround(clamp(+p, 0, 1)); // 32-bit, as video tools count it, so an edge lands on the same pixel
  if (p === 1 || p === 0) { out.set(p === 1 ? a : b); for (let i = 3; i < out.length; i += 4) out[i] = 255; return out; } // the ends are the pictures themselves
  const px = PIXEL[kind];
  if (px) {
    const f = px(w, h, p);
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) f(a, b, out, i, x, y);
  } else WHOLE[kind](a, b, out, w, h, p);
  for (let i = 3; i < out.length; i += 4) out[i] = 255;
  return out;
}

// wind: a soft edge that moves across, each row (or column) a little ahead or behind by its own random amount
const wind = (u, r, p) => ss(0, -0.2, u * 0.8 + 0.2 * r - p * 1.2);
// one pixel from a, b or a mix; wa is the share of a
const put = (o, i, s, j) => { o[i] = s[j]; o[i + 1] = s[j + 1]; o[i + 2] = s[j + 2]; };
const mixAt = (o, i, a, b, wa) => { const wb = 1 - wa; o[i] = a[i] * wa + b[i] * wb; o[i + 1] = a[i + 1] * wa + b[i + 1] * wb; o[i + 2] = a[i + 2] * wa + b[i + 2] * wb; };
const pick = (wa) => (a, b, o, i, x, y) => mixAt(o, i, a, b, wa(x, y));
// a and b moved: the pixel at (x, y) shows a or b at another place
const shift = (w, fn) => (a, b, o, i, x, y) => { const [s, sx, sy] = fn(x, y); put(o, i, s === 0 ? a : b, (sy * w + sx) * 4); };
const sel = (fromA) => (a, b, o, i, x, y) => put(o, i, fromA(x, y) ? a : b, i);
const f32 = Math.fround;
const mod = (v, n) => ((v % n) + n) % n;

// the transitions worked out one pixel at a time: kind -> (w, h, p) -> per-pixel function
const PIXEL = {
  fade: (w, h, p) => pick(() => p),
  wipeleft: (w, h, p) => { const z = Math.trunc(f32(w * p)); return sel((x) => x <= z); },
  wiperight: (w, h, p) => { const z = Math.trunc(f32(w * (1 - p))); return sel((x) => x > z); },
  wipeup: (w, h, p) => { const z = Math.trunc(f32(h * p)); return sel((x, y) => y <= z); },
  wipedown: (w, h, p) => { const z = Math.trunc(f32(h * (1 - p))); return sel((x, y) => y > z); },
  slideleft: (w, h, p) => { const z = Math.trunc(f32(-p * w)); return shift(w, (x, y) => { const zx = z + x; return [zx >= 0 && zx < w ? 1 : 0, mod(zx, w), y]; }); },
  slideright: (w, h, p) => { const z = Math.trunc(f32(p * w)); return shift(w, (x, y) => { const zx = z + x; return [zx >= 0 && zx < w ? 1 : 0, mod(zx, w), y]; }); },
  slideup: (w, h, p) => { const z = Math.trunc(f32(-p * h)); return shift(w, (x, y) => { const zy = z + y; return [zy >= 0 && zy < h ? 1 : 0, x, mod(zy, h)]; }); },
  slidedown: (w, h, p) => { const z = Math.trunc(f32(p * h)); return shift(w, (x, y) => { const zy = z + y; return [zy >= 0 && zy < h ? 1 : 0, x, mod(zy, h)]; }); },
  smoothleft: (w, h, p) => pick((x) => 1 - ss(0, 1, 1 + x / w - p * 2)),
  smoothright: (w, h, p) => pick((x) => 1 - ss(0, 1, 1 + (w - 1 - x) / w - p * 2)),
  smoothup: (w, h, p) => pick((x, y) => 1 - ss(0, 1, 1 + y / h - p * 2)),
  smoothdown: (w, h, p) => pick((x, y) => 1 - ss(0, 1, 1 + (h - 1 - y) / h - p * 2)),
  wipetl: (w, h, p) => { const zw = Math.trunc(f32(w * p)), zh = Math.trunc(f32(h * p)); return sel((x, y) => x <= zw && y <= zh); },
  wipetr: (w, h, p) => { const zw = Math.trunc(f32(w * (1 - p))), zh = Math.trunc(f32(h * p)); return sel((x, y) => x > zw && y <= zh); },
  wipebl: (w, h, p) => { const zw = Math.trunc(f32(w * p)), zh = Math.trunc(f32(h * (1 - p))); return sel((x, y) => x <= zw && y > zh); },
  wipebr: (w, h, p) => { const zw = Math.trunc(f32(w * (1 - p))), zh = Math.trunc(f32(h * (1 - p))); return sel((x, y) => x > zw && y > zh); },
  diagtl: (w, h, p) => pick((x, y) => 1 - ss(0, 1, 1 + (x / w) * (y / h) - p * 2)),
  diagtr: (w, h, p) => pick((x, y) => 1 - ss(0, 1, 1 + ((w - 1 - x) / w) * (y / h) - p * 2)),
  diagbl: (w, h, p) => pick((x, y) => 1 - ss(0, 1, 1 + (x / w) * ((h - 1 - y) / h) - p * 2)),
  diagbr: (w, h, p) => pick((x, y) => 1 - ss(0, 1, 1 + ((w - 1 - x) / w) * ((h - 1 - y) / h) - p * 2)),
  horzopen: (w, h, p) => pick((x, y) => 1 - ss(0, 1, 2 - Math.abs(2 * y / h - 1) - p * 2)),
  horzclose: (w, h, p) => pick((x, y) => 1 - ss(0, 1, 1 + Math.abs(2 * y / h - 1) - p * 2)),
  vertopen: (w, h, p) => pick((x) => 1 - ss(0, 1, 2 - Math.abs(2 * x / w - 1) - p * 2)),
  vertclose: (w, h, p) => pick((x) => 1 - ss(0, 1, 1 + Math.abs(2 * x / w - 1) - p * 2)),
  hlslice: (w, h, p) => sel((x) => !slice(Math.fround(x / w))(p)),
  hrslice: (w, h, p) => sel((x) => !slice(Math.fround((w - 1 - x) / w))(p)),
  vuslice: (w, h, p) => sel((x, y) => !slice(Math.fround(y / h))(p)),
  vdslice: (w, h, p) => sel((x, y) => !slice(Math.fround((h - 1 - y) / h))(p)),
  squeezeh: (w, h, p) => (a, b, o, i, x, y) => { const z = f32(0.5 + f32(f32(y / h) - 0.5) / p); if (z < 0 || z > 1) put(o, i, b, i); else put(o, i, a, (Math.min(h - 1, Math.round(f32(z * (h - 1)))) * w + x) * 4); },
  squeezev: (w, h, p) => (a, b, o, i, x, y) => { const z = f32(0.5 + f32(f32(x / w) - 0.5) / p); if (z < 0 || z > 1) put(o, i, b, i); else put(o, i, a, (y * w + Math.min(w - 1, Math.round(f32(z * (w - 1))))) * 4); },
  rectcrop: (w, h, p) => { const d = Math.abs(f32(p - 0.5)), zw = Math.trunc(f32(d * w)), zh = Math.trunc(f32(d * h)), cx = Math.trunc(w / 2), cy = Math.trunc(h / 2); return (a, b, o, i, x, y) => { if (Math.abs(x - cx) < zw && Math.abs(y - cy) < zh) put(o, i, p < 0.5 ? b : a, i); else o[i] = o[i + 1] = o[i + 2] = 0; }; },
  circlecrop: (w, h, p) => { const z = Math.pow(2 * Math.abs(p - 0.5), 3) * Math.hypot(w / 2, h / 2); return (a, b, o, i, x, y) => { if (Math.hypot(x - w / 2, y - h / 2) <= z) put(o, i, p < 0.5 ? b : a, i); else o[i] = o[i + 1] = o[i + 2] = 0; }; },
  circleopen: (w, h, p) => { const R = Math.hypot(w / 2, h / 2); return pick((x, y) => ss(0, 1, Math.hypot(x - w / 2, y - h / 2) / R + (p - 0.5) * 3)); },
  circleclose: (w, h, p) => { const R = Math.hypot(w / 2, h / 2); return pick((x, y) => ss(0, 1, 1 - Math.hypot(x - w / 2, y - h / 2) / R + (p - 0.5) * 3)); },
  radial: (w, h, p) => pick((x, y) => 1 - ss(0, 1, Math.atan2(x - w / 2, y - h / 2) - (p - 0.5) * Math.PI * 2.5)),
  fadeblack: (w, h, p) => through(p, 0),
  fadewhite: (w, h, p) => through(p, 255),
  dissolve: (w, h, p) => sel((x, y) => noise(x, y) * 2 + p * 2 - 1.5 >= 0.5),
  hlwind: (w, h, p) => pick((x, y) => wind(x / w, noise(0, y / h), p)),
  hrwind: (w, h, p) => pick((x, y) => wind(1 - x / w, noise(0, y / h), p)),
  vuwind: (w, h, p) => pick((x, y) => wind(y / h, noise(x / w, 0), p)),
  vdwind: (w, h, p) => pick((x, y) => wind(1 - y / h, noise(x / w, 0), p)),
  coverleft: (w, h, p) => { const z = Math.trunc(f32(w * p)); return shift(w, (x, y) => (x >= z ? [1, x - z, y] : [0, x, y])); },
  coverright: (w, h, p) => { const z = Math.trunc(f32(w * p)); return shift(w, (x, y) => (x < w - z ? [1, x + z, y] : [0, x, y])); },
  coverup: (w, h, p) => { const z = Math.trunc(f32(h * p)); return shift(w, (x, y) => (y >= z ? [1, x, y - z] : [0, x, y])); },
  coverdown: (w, h, p) => { const z = Math.trunc(f32(h * p)); return shift(w, (x, y) => (y < h - z ? [1, x, y + z] : [0, x, y])); },
  revealleft: (w, h, p) => { const z = Math.trunc(f32(w * p)); return shift(w, (x, y) => (x < z ? [0, x + w - z, y] : [1, x, y])); },
  revealright: (w, h, p) => { const z = Math.trunc(f32(w * p)); return shift(w, (x, y) => (x >= w - z ? [0, x - w + z, y] : [1, x, y])); },
  revealup: (w, h, p) => { const z = Math.trunc(f32(h * p)); return shift(w, (x, y) => (y < z ? [0, x, y + h - z] : [1, x, y])); },
  revealdown: (w, h, p) => { const z = Math.trunc(f32(h * p)); return shift(w, (x, y) => (y >= h - z ? [0, x, y - h + z] : [1, x, y])); },
};
// through a colour: a fades out to it in the first fifth, b comes out of it over the rest
function through(p, k) {
  const wa = p * ss(0.8, 1, p), wb = (1 - p) * ss(0, 0.8, 1 - p), wk = (1 - wa - wb) * k;
  return (a, b, o, i) => { o[i] = a[i] * wa + b[i] * wb + wk; o[i + 1] = a[i + 1] * wa + b[i + 1] * wb + wk; o[i + 2] = a[i + 2] * wa + b[i + 2] * wb + wk; };
}
// the transitions that need the whole picture at once
const WHOLE = {
  // each pixel the mean of the row from it to the right, over a length that grows to half the width at the middle of the transition
  hblur: (a, b, o, w, h, p) => { const prog = p <= 0.5 ? p * 2 : (1 - p) * 2, size = Math.trunc(1 + Math.fround(Math.fround(w / 2) * Math.fround(prog))); rowMeans(a, b, o, w, h, p, size); },
  // squares that grow to a twentieth of the short side at the middle, each the colour at its centre
  pixelize: (a, b, o, w, h, p) => { const d = Math.min(p, Math.fround(1 - p)), dist = Math.ceil(Math.fround(d * 50)) / 50, sq = Math.fround(2 * dist * Math.min(w, h) / 20); blocks(a, b, o, w, h, p, sq); },
  // a grows from its centre until it fills the picture with its middle, then b comes in over it
  zoomin: (a, b, o, w, h, p) => { const z = ss(0.5, 1, p), m = ss(0, 0.5, p); for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) { const sx = clamp(Math.round((w - 1) / 2 + (x - (w - 1) / 2) * z), 0, w - 1), sy = clamp(Math.round((h - 1) / 2 + (y - (h - 1) / 2) * z), 0, h - 1), j = (sy * w + sx) * 4; for (let c = 0; c < 3; c++) o[i + c] = a[j + c] * m + b[i + c] * (1 - m); } },
  fadegrays: (a, b, o, w, h, p) => { const ka = ss(0.8, 1, p), kb = ss(0, 0.8, 1 - p); for (let i = 0; i < o.length; i += 4) { const ga = gray(a, i), gb = gray(b, i); for (let c = 0; c < 3; c++) o[i + c] = (a[i + c] * ka + ga * (1 - ka)) * p + (b[i + c] * kb + gb * (1 - kb)) * (1 - p); } },
  distance: (a, b, o, w, h, p) => { for (let i = 0; i < o.length; i += 4) { let d = 0; for (let c = 0; c < 3; c++) { const v = (a[i + c] - b[i + c]) / 255; d += v * v; } const near = Math.sqrt(d) <= p; for (let c = 0; c < 3; c++) o[i + c] = (near ? a[i + c] : b[i + c]) * p + b[i + c] * (1 - p); } },
  fadefast: (a, b, o, w, h, p) => byDiff(a, b, o, (d) => Math.pow(p, 1 + Math.log(1 + d / 255))),
  fadeslow: (a, b, o, w, h, p) => byDiff(a, b, o, (d) => Math.pow(p, 1 + Math.log(2 - d / 255))),
};
// a and b mixed per colour value, with a share of a that hangs on how far apart the two values are (a table of 256, made once a picture)
function byDiff(a, b, o, share) {
  const m = new Float32Array(256); for (let d = 0; d < 256; d++) m[d] = share(d);
  for (let i = 0; i < o.length; i += 4) for (let c = 0; c < 3; c++) { const va = a[i + c], vb = b[i + c], k = m[va > vb ? va - vb : vb - va]; o[i + c] = va * k + vb * (1 - k); }
}
const gray = (s, i) => (s[i] + s[i + 1] + s[i + 2]) / 3;
// a and b mixed, each pixel the mean of the n pixels from it to the right (fewer at the right edge); a running sum keeps it fast
function rowMeans(a, b, o, w, h, p, n) {
  const sa = new Float64Array((w + 1) * 3), sb = new Float64Array((w + 1) * 3);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, k = x * 3; for (let c = 0; c < 3; c++) { sa[k + 3 + c] = sa[k + c] + a[i + c]; sb[k + 3 + c] = sb[k + c] + b[i + c]; } }
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, e = Math.min(w, x + n), m = e - x; for (let c = 0; c < 3; c++) o[i + c] = ((sa[e * 3 + c] - sa[x * 3 + c]) * p + (sb[e * 3 + c] - sb[x * 3 + c]) * (1 - p)) / m; }
  }
}
// a and b mixed, shown in squares of s pixels (s may be fractional), each the colour at the square's centre
function blocks(a, b, o, w, h, p, s) {
  for (let y = 0; y < h; y++) {
    const sy = s > 0 ? Math.min(h - 1, Math.trunc(Math.fround((Math.floor(y / s) + 0.5) * s))) : y;
    for (let x = 0; x < w; x++) { const i = (y * w + x) * 4, sx = s > 0 ? Math.min(w - 1, Math.trunc(Math.fround((Math.floor(x / s) + 0.5) * s))) : x, j = (sy * w + sx) * 4; for (let c = 0; c < 3; c++) o[i + c] = a[j + c] * p + b[j + c] * (1 - p); }
  }
}
