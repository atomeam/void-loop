/**
 * colour: one colour in every model, its shades, its schemes and whether text on it can be read (owner, 2026-10-24: back to the easy sites; color-hex.com
 * blocks every automated visit, so it sent Verse down to hexcolor16.com, Tranco 63,673, a hex-code page of swatches among ad and tag-manager scripts).
 * Copies the best of each: color-hex.com's every-model table (hex, RGB, HSL, HSV, CMYK, CIE Lab), coolors.co's tints and shades, Adobe Color's harmony
 * rules (complementary, analogous, triadic, split-complementary, tetradic, on the RGB wheel the web uses), and WebAIM's contrast checker (the WCAG 2
 * ratio against white and black, which text sizes pass AA and AAA). The nearest CSS colour name is found by CIEDE76 distance in Lab, so it is the
 * nearest to the eye, not to the numbers. Pure; the page, the card and the ask all use it.
 * Tests: tools/colour.test.mjs.
 */
// the 148 CSS colour names (CSS Color 4), as hex
const NAMED = 'aliceblue f0f8ff antiquewhite faebd7 aqua 00ffff aquamarine 7fffd4 azure f0ffff beige f5f5dc bisque ffe4c4 black 000000 blanchedalmond ffebcd blue 0000ff '
  + 'blueviolet 8a2be2 brown a52a2a burlywood deb887 cadetblue 5f9ea0 chartreuse 7fff00 chocolate d2691e coral ff7f50 cornflowerblue 6495ed cornsilk fff8dc crimson dc143c '
  + 'cyan 00ffff darkblue 00008b darkcyan 008b8b darkgoldenrod b8860b darkgray a9a9a9 darkgreen 006400 darkgrey a9a9a9 darkkhaki bdb76b darkmagenta 8b008b '
  + 'darkolivegreen 556b2f darkorange ff8c00 darkorchid 9932cc darkred 8b0000 darksalmon e9967a darkseagreen 8fbc8f darkslateblue 483d8b darkslategray 2f4f4f '
  + 'darkslategrey 2f4f4f darkturquoise 00ced1 darkviolet 9400d3 deeppink ff1493 deepskyblue 00bfff dimgray 696969 dimgrey 696969 dodgerblue 1e90ff firebrick b22222 '
  + 'floralwhite fffaf0 forestgreen 228b22 fuchsia ff00ff gainsboro dcdcdc ghostwhite f8f8ff gold ffd700 goldenrod daa520 gray 808080 green 008000 greenyellow adff2f '
  + 'grey 808080 honeydew f0fff0 hotpink ff69b4 indianred cd5c5c indigo 4b0082 ivory fffff0 khaki f0e68c lavender e6e6fa lavenderblush fff0f5 lawngreen 7cfc00 '
  + 'lemonchiffon fffacd lightblue add8e6 lightcoral f08080 lightcyan e0ffff lightgoldenrodyellow fafad2 lightgray d3d3d3 lightgreen 90ee90 lightgrey d3d3d3 '
  + 'lightpink ffb6c1 lightsalmon ffa07a lightseagreen 20b2aa lightskyblue 87cefa lightslategray 778899 lightslategrey 778899 lightsteelblue b0c4de lightyellow ffffe0 '
  + 'lime 00ff00 limegreen 32cd32 linen faf0e6 magenta ff00ff maroon 800000 mediumaquamarine 66cdaa mediumblue 0000cd mediumorchid ba55d3 mediumpurple 9370db '
  + 'mediumseagreen 3cb371 mediumslateblue 7b68ee mediumspringgreen 00fa9a mediumturquoise 48d1cc mediumvioletred c71585 midnightblue 191970 mintcream f5fffa '
  + 'mistyrose ffe4e1 moccasin ffe4b5 navajowhite ffdead navy 000080 oldlace fdf5e6 olive 808000 olivedrab 6b8e23 orange ffa500 orangered ff4500 orchid da70d6 '
  + 'palegoldenrod eee8aa palegreen 98fb98 paleturquoise afeeee palevioletred db7093 papayawhip ffefd5 peachpuff ffdab9 peru cd853f pink ffc0cb plum dda0dd '
  + 'powderblue b0e0e6 purple 800080 rebeccapurple 663399 red ff0000 rosybrown bc8f8f royalblue 4169e1 saddlebrown 8b4513 salmon fa8072 sandybrown f4a460 '
  + 'seagreen 2e8b57 seashell fff5ee sienna a0522d silver c0c0c0 skyblue 87ceeb slateblue 6a5acd slategray 708090 slategrey 708090 snow fffafa springgreen 00ff7f '
  + 'steelblue 4682b4 tan d2b48c teal 008080 thistle d8bfd8 tomato ff6347 turquoise 40e0d0 violet ee82ee wheat f5deb3 white ffffff whitesmoke f5f5f5 yellow ffff00 '
  + 'yellowgreen 9acd32';
export const NAMES = Object.freeze(Object.fromEntries(NAMED.split(' ').reduce((a, w, i, all) => (i % 2 ? a : a.concat([[w, '#' + all[i + 1]]])), [])));

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const hex2 = (n) => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');
/** an RGB triple as #rrggbb. Pure. */
export const toHex = ({ r, g, b }) => '#' + hex2(r) + hex2(g) + hex2(b);

/** a colour from what someone typed: "#f53", "ff5733", "rgb(255, 87, 51)", "255 87 51", "hsl(11, 100%, 60%)", "tomato": { r, g, b } or null. Pure. */
export function parse(text) {
  const t = String(text == null ? '' : text).trim().toLowerCase().replace(/\s+/g, ' ');
  if (!t) return null;
  if (Object.prototype.hasOwnProperty.call(NAMES, t.replace(/ /g, ''))) return parse(NAMES[t.replace(/ /g, '')]);
  let m = /^#?([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(t);
  if (m) { let h = m[1]; if (h.length <= 4) h = h.slice(0, 3).split('').map((c) => c + c).join(''); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }; }
  m = /^(?:rgba?\s*\(\s*)?(\d{1,3}(?:\.\d+)?)\s*[, ]\s*(\d{1,3}(?:\.\d+)?)\s*[, ]\s*(\d{1,3}(?:\.\d+)?)(?:\s*[,/]\s*[\d.]+%?)?\s*\)?$/.exec(t);
  if (m) { const [r, g, b] = [m[1], m[2], m[3]].map(Number); return r <= 255 && g <= 255 && b <= 255 ? { r: Math.round(r), g: Math.round(g), b: Math.round(b) } : null; }
  m = /^hsla?\s*\(\s*(-?\d+(?:\.\d+)?)(?:deg)?\s*[, ]\s*(\d+(?:\.\d+)?)%\s*[, ]\s*(\d+(?:\.\d+)?)%(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/.exec(t);
  if (m) { const s = Number(m[2]), l = Number(m[3]); return s <= 100 && l <= 100 ? hslToRgb(Number(m[1]), s, l) : null; }
  return null;
}

/** hue, saturation and lightness (degrees and percents) as RGB. Pure. */
export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { r: Math.round(f(0) * 255) || 0, g: Math.round(f(8) * 255) || 0, b: Math.round(f(4) * 255) || 0 }; // never -0
}
/** RGB as { h, s, l } (degrees, percents, unrounded). Pure. */
export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2; let h = 0;
  if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d ? (d / (1 - Math.abs(2 * l - 1))) * 100 : 0, l: l * 100 };
}
/** RGB as { h, s, v } (HSV, also called HSB). Pure. */
export function rgbToHsv({ r, g, b }) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, { h } = rgbToHsl({ r, g, b });
  return { h, s: mx ? (d / mx) * 100 : 0, v: (mx / 255) * 100 };
}
/** RGB as { c, m, y, k } percents (the naive device-free conversion every colour site gives). Pure. */
export function rgbToCmyk({ r, g, b }) {
  const k = 1 - Math.max(r, g, b) / 255; if (k >= 1) return { c: 0, m: 0, y: 0, k: 100 };
  return { c: ((1 - r / 255 - k) / (1 - k)) * 100, m: ((1 - g / 255 - k) / (1 - k)) * 100, y: ((1 - b / 255 - k) / (1 - k)) * 100, k: k * 100 };
}
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
/** WCAG relative luminance, 0 (black) to 1 (white). Pure. */
export const luminance = ({ r, g, b }) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
/** RGB as CIE L*a*b* (D65). Pure. */
export function rgbToLab({ r, g, b }) {
  const R = lin(r), G = lin(g), B = lin(b), f = (t) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  const x = f((0.4124 * R + 0.3576 * G + 0.1805 * B) / 0.95047), y = f(0.2126 * R + 0.7152 * G + 0.0722 * B), z = f((0.0193 * R + 0.1192 * G + 0.9505 * B) / 1.08883);
  return { l: 116 * y - 16, a: 500 * (x - y), b: 200 * (y - z) };
}
// the rest of the models the colour sites list (color-hex.com: XYZ, Yxy, Hunter Lab; the CSS ones: LCh, Oklab, OKLCH, HWB; and the decimal)
/** RGB as CIE XYZ (D65, 0 to about 100). Pure. */
export function rgbToXyz({ r, g, b }) {
  const R = lin(r), G = lin(g), B = lin(b);
  return { x: (0.4124 * R + 0.3576 * G + 0.1805 * B) * 100, y: (0.2126 * R + 0.7152 * G + 0.0722 * B) * 100, z: (0.0193 * R + 0.1192 * G + 0.9505 * B) * 100 };
}
/** RGB as CIE Yxy: the luminance Y and the chromaticity x, y (black is 0, 0.3127, 0.329, the D65 white point). Pure. */
export function rgbToYxy(rgb) { const { x, y, z } = rgbToXyz(rgb), s = x + y + z; return s ? { Y: y, x: x / s, y: y / s } : { Y: 0, x: 0.3127, y: 0.329 }; }
/** RGB as Hunter Lab (D65). Pure. */
export function rgbToHunterLab(rgb) {
  const { x, y, z } = rgbToXyz(rgb), Xn = 95.047, Yn = 100, Zn = 108.883, ka = (175 / 198.04) * (Xn + Yn), kb = (70 / 218.11) * (Yn + Zn), q = Math.sqrt(y / Yn);
  return q ? { l: 100 * q, a: ka * ((x / Xn - y / Yn) / q), b: kb * ((y / Yn - z / Zn) / q) } : { l: 0, a: 0, b: 0 };
}
/** RGB as CIE L*u*v* (CIELUV, D65). Pure. */
export function rgbToLuv(rgb) {
  const { x, y, z } = rgbToXyz(rgb), Xn = 95.047, Yn = 100, Zn = 108.883, d = x + 15 * y + 3 * z, dn = Xn + 15 * Yn + 3 * Zn;
  const t = y / Yn, l = t > 216 / 24389 ? 116 * Math.cbrt(t) - 16 : (24389 / 27) * t;
  if (!d) return { l: 0, u: 0, v: 0 };
  return { l, u: 13 * l * (4 * x / d - 4 * Xn / dn), v: 13 * l * (9 * y / d - 9 * Yn / dn) };
}
const polar = (a, b) => ({ c: Math.hypot(a, b), h: Math.hypot(a, b) < 1e-9 ? 0 : (Math.atan2(b, a) * 180 / Math.PI + 360) % 360 });
/** RGB as CIE LCh(ab), the polar form of Lab. Pure. */
export function rgbToLch(rgb) { const { l, a, b } = rgbToLab(rgb); return { l, ...polar(a, b) }; }
/** RGB as Oklab (Björn Ottosson's perceptual space, used by CSS oklab()). Pure. */
export function rgbToOklab({ r, g, b }) {
  const R = lin(r), G = lin(g), B = lin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B), m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B), s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  return { l: 0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s, a: 1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s, b: 0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s };
}
/** RGB as OKLCH, the polar form of Oklab (CSS oklch()). Pure. */
export function rgbToOklch(rgb) { const { l, a, b } = rgbToOklab(rgb); return { l, ...polar(a, b) }; }
/** RGB as HWB: hue, whiteness, blackness in percent (CSS hwb()). Pure. */
export function rgbToHwb({ r, g, b }) { return { h: rgbToHsl({ r, g, b }).h, w: (Math.min(r, g, b) / 255) * 100, b: (1 - Math.max(r, g, b) / 255) * 100 }; }
/** the colour as one decimal number, 0 to 16777215 (0xRRGGBB). Pure. */
export const rgbToDecimal = ({ r, g, b }) => r * 65536 + g * 256 + b;

/** the WCAG 2 contrast ratio of two colours, 1 to 21. Pure. */
export function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); }
/** what a ratio passes: { aa, aaLarge, aaa, aaaLarge }. Pure. */
export const passes = (ratio) => ({ aa: ratio >= 4.5, aaLarge: ratio >= 3, aaa: ratio >= 7, aaaLarge: ratio >= 4.5 });

/** the nearest CSS colour name to the eye (Lab distance): { name, hex, exact, distance }. Pure. */
export function nearestName(rgb) {
  const lab = rgbToLab(rgb); let best = null;
  for (const [name, hex] of Object.entries(NAMES)) {
    const o = rgbToLab(parse(hex)), d = Math.hypot(lab.l - o.l, lab.a - o.a, lab.b - o.b);
    if (!best || d < best.distance - 1e-9) best = { name, hex, distance: d };
  }
  return { ...best, exact: best.distance < 1e-6, distance: Math.round(best.distance * 10) / 10 };
}
/** n steps from the colour to white (tints) and to black (shades), mixed in RGB as the colour sites do: { tints, shades } of hex, nearest first. Pure. */
export function tintsAndShades(rgb, n = 9) {
  const mix = (to, k) => toHex({ r: rgb.r + (to - rgb.r) * k, g: rgb.g + (to - rgb.g) * k, b: rgb.b + (to - rgb.b) * k });
  const steps = Array.from({ length: n }, (_, i) => (i + 1) / (n + 1));
  return { tints: steps.map((k) => mix(255, k)), shades: steps.map((k) => mix(0, k)) };
}
/** n tones: the same hue and lightness with less and less saturation, down to grey (hexcolor16.com's third row), nearest first. Pure. */
export function tones(rgb, n = 9) {
  const { h, s, l } = rgbToHsl(rgb);
  return Array.from({ length: n }, (_, i) => toHex(hslToRgb(h, s * (1 - (i + 1) / (n + 1)), l)));
}
/** the harmony rules, by hue turns on the HSL wheel: { complementary, analogous, triadic, split, tetradic, square }, each a list of hex starting
 *  with the colour. Tetradic is the rectangle (two complementary pairs 60° apart), square the four 90° apart, as hexcolor16.com and Adobe Color
 *  name them. Pure. */
export function schemes(rgb) {
  const { h, s, l } = rgbToHsl(rgb), at = (d) => toHex(hslToRgb(h + d, s, l)), self = toHex(rgb);
  return { complementary: [self, at(180)], analogous: [at(-30), self, at(30)], triadic: [self, at(120), at(240)], split: [self, at(150), at(210)], tetradic: [self, at(60), at(180), at(240)], square: [self, at(90), at(180), at(270)] };
}
const r1 = (x) => Math.round(x * 10) / 10, r0 = Math.round;
/** everything about one colour, rounded for reading. Pure. */
export function describe(rgb) {
  const hsl = rgbToHsl(rgb), hsv = rgbToHsv(rgb), cmyk = rgbToCmyk(rgb), lab = rgbToLab(rgb), white = { r: 255, g: 255, b: 255 }, black = { r: 0, g: 0, b: 0 };
  const onWhite = contrast(rgb, white), onBlack = contrast(rgb, black);
  return {
    hex: toHex(rgb).toUpperCase(), rgb: { ...rgb }, hsl: { h: r0(hsl.h) % 360, s: r0(hsl.s), l: r0(hsl.l) }, hsv: { h: r0(hsv.h) % 360, s: r0(hsv.s), v: r0(hsv.v) },
    cmyk: { c: r0(cmyk.c), m: r0(cmyk.m), y: r0(cmyk.y), k: r0(cmyk.k) }, lab: { l: r1(lab.l), a: r1(lab.a), b: r1(lab.b) },
    ...(() => { const xyz = rgbToXyz(rgb), yxy = rgbToYxy(rgb), hl = rgbToHunterLab(rgb), lch = rgbToLch(rgb), luv = rgbToLuv(rgb), ok = rgbToOklab(rgb), okc = rgbToOklch(rgb), hwb = rgbToHwb(rgb), r3 = (x) => Math.round(x * 1000) / 1000;
      return { xyz: { x: r1(xyz.x), y: r1(xyz.y), z: r1(xyz.z) }, yxy: { Y: r1(yxy.Y), x: r3(yxy.x), y: r3(yxy.y) }, hunterLab: { l: r1(hl.l), a: r1(hl.a), b: r1(hl.b) },
        lch: { l: r1(lch.l), c: r1(lch.c), h: r1(lch.h) % 360 }, luv: { l: r1(luv.l), u: r1(luv.u), v: r1(luv.v) }, oklab: { l: r3(ok.l), a: r3(ok.a), b: r3(ok.b) }, oklch: { l: r3(okc.l), c: r3(okc.c), h: r1(okc.h) % 360 },
        hwb: { h: r0(hwb.h) % 360, w: r0(hwb.w), b: r0(hwb.b) }, decimal: rgbToDecimal(rgb) }; })(),
    luminance: Math.round(luminance(rgb) * 1000) / 1000, name: nearestName(rgb),
    contrast: { white: Math.round(onWhite * 100) / 100, black: Math.round(onBlack * 100) / 100, text: onBlack >= onWhite ? '#000000' : '#FFFFFF' },
    ...tintsAndShades(rgb), tones: tones(rgb), schemes: schemes(rgb),
  };
}
/** the colour an ask names: "#ff5733", "hex ff5733", "color tomato", "what colour is rgb(1,2,3)", "ff5733 color" - the typed colour text or ''. Pure. */
export function askColour(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?.!]+$/, '');
  let m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(t); if (m) return '#' + m[1];
  if (/^(?:rgb|hsl)a?\s*\([^)]{3,40}\)$/.test(t) && parse(t)) return t; // a CSS colour function pasted on its own
  m = /^(?:(?:what|which)\s+(?:colou?r|shade)\s+is\s+|show\s+(?:me\s+)?(?:the\s+)?(?:colou?r\s+)?|(?:hex\s+)?colou?r\s+(?:code\s+)?|hex\s+(?:code\s+)?)(#?[0-9a-f]{6}|#[0-9a-f]{3}|rgb\s*\([^)]*\)|hsl\s*\([^)]*\)|[a-z]+)$/.exec(t);
  if (m && parse(m[1]) && (/[0-9(#]/.test(m[1]) || Object.prototype.hasOwnProperty.call(NAMES, m[1]))) return m[1];
  m = /^(#?[0-9a-f]{6}|[a-z]+)\s+(?:colou?r|hex(?:\s+code)?|colou?r\s+code)$/.exec(t);
  if (m && parse(m[1]) && (/\d/.test(m[1]) || Object.prototype.hasOwnProperty.call(NAMES, m[1]))) return m[1];
  if (/^(?:colou?r\s+(?:picker|codes?|chart|tool|palette\s+generator|schemes?)|hex\s+colou?r(?:\s+(?:picker|codes?|chart))?|html\s+colou?r\s+codes?|colou?r\s+contrast\s+checker)$/.test(t)) return '#6d4aff';
  return '';
}
