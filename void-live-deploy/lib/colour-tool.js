/**
 * colour-tool: the pure parts of /color/, the one colour page (owner, 2026-11-03: "our existing color pages should be one or function as one").
 * One current colour is shared by every mode (codes, picker, palette, random, gradient, contrast, shades, blindness), and the address keeps it:
 * /color/?c=ff5733&mode=palette. What each rival the tower fought there offers is here too: every colour model and the nearest names
 * (color-hex.com, hexcolor16.com), an eyedropper, a picker, history and favourites, a GIMP palette (colorzilla.com), the colour in binary
 * (hextobinary.com), and on top of them a WCAG checker that suggests the nearest passing colour, a 50 to 950 scale and eight colour-vision
 * simulations that also work on a picture. Pure, no DOM. Tests: tools/colour-tool.test.mjs.
 */
import { parse, toHex, rgbToHsl, hslToRgb, rgbToLab, contrast, NAMES } from './colour.js';

export const MODES = Object.freeze([
  ['codes', 'Codes'], ['picker', 'Picker'], ['palette', 'Palette'], ['random', 'Random'], ['gradient', 'Gradient'],
  ['contrast', 'Contrast'], ['shades', 'Shades'], ['blindness', 'Colour blindness'],
].map(Object.freeze));
const IDS = MODES.map(([id]) => id);
export const DEFAULT = '6d4aff';
// the words people use for a mode, so ?mode=eyedropper or ?mode=wcag still opens the right one
const ALIAS = { code: 'codes', convert: 'codes', converter: 'codes', info: 'codes', pick: 'picker', eyedropper: 'picker', image: 'picker', palettes: 'palette', scheme: 'palette', schemes: 'palette',
  generator: 'random', gradients: 'gradient', wcag: 'contrast', checker: 'contrast', tints: 'shades', tones: 'shades', scale: 'shades', blind: 'blindness', colorblind: 'blindness', 'colour-blindness': 'blindness', 'color-blindness': 'blindness' };
/** a mode id from a typed word, or 'codes'. Pure. */
export function modeOf(word) { const w = String(word || '').trim().toLowerCase(); return IDS.includes(w) ? w : ALIAS[w] || 'codes'; }
/** a colour from the address: 'ff5733', '#f53', 'tomato', 'rgb(1 2 3)' -> 'ff5733' (6 hex digits, lower case), or null. Pure. */
export function hexOf(text) {
  const t = String(text == null ? '' : text).trim(); if (!t) return null;
  const rgb = parse(/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(t) ? '#' + t : t); return rgb ? toHex(rgb).slice(1).toLowerCase() : null;
}
/** what the address says: { c, mode, scheme, on, kind, n }; anything unreadable falls back to the defaults. Pure. */
export function readState(search) {
  const q = new URLSearchParams(search || '');
  return { c: hexOf(q.get('c')) || DEFAULT, mode: modeOf(q.get('mode')), scheme: SCHEME_IDS.includes(q.get('scheme')) ? q.get('scheme') : null,
    on: hexOf(q.get('on')), kind: RANDOM_KINDS.includes(q.get('kind')) ? q.get('kind') : null, n: [1, 5, 10, 20].includes(Number(q.get('n'))) ? Number(q.get('n')) : null };
}
/** the query for a state, in a fixed order; codes (the default mode) is left out so /color/?c=ff5733 stays the colour's own address. Pure. */
export function writeState(s, extra = {}) {
  const q = new URLSearchParams(); q.set('c', hexOf(s.c) || DEFAULT);
  const mode = modeOf(s.mode); if (mode !== 'codes') q.set('mode', mode);
  if (mode === 'palette' && s.scheme) q.set('scheme', s.scheme);
  if (mode === 'contrast' && s.on) q.set('on', hexOf(s.on) || 'ffffff');
  if (mode === 'random' && s.kind && s.kind !== 'any') q.set('kind', s.kind);
  if (mode === 'random' && s.n && s.n !== 1) q.set('n', String(s.n));
  for (const [k, v] of Object.entries(extra)) if (v != null && v !== '') q.set(k, String(v));
  return '?' + q.toString();
}
/** the address of a mode for a colour: modeLink('palette', 'ff5733') -> '/color/?c=ff5733&mode=palette'. Pure. */
export const modeLink = (mode, c, extra = {}) => '/color/' + writeState({ c, mode, ...extra });

// ---- names: the nearest named colours to the eye, as hexcolor16.com lists its "similar colours" ----
const LABS = Object.entries(NAMES).map(([name, hex]) => ({ name, hex, lab: rgbToLab(parse(hex)) }));
/** the n named CSS colours nearest the colour (CIE Lab distance), nearest first: [{ name, hex, distance }]. Pure. */
export function similarNames(text, n = 8) {
  const rgb = parse(text); if (!rgb) return [];
  const lab = rgbToLab(rgb), seen = new Set();
  return LABS.map((x) => ({ name: x.name, hex: x.hex.toUpperCase(), distance: Math.round(Math.hypot(lab.l - x.lab.l, lab.a - x.lab.a, lab.b - x.lab.b) * 10) / 10 }))
    .sort((a, b) => a.distance - b.distance || a.name.localeCompare(b.name)).filter((x) => (seen.has(x.hex) ? false : seen.add(x.hex))).slice(0, n); // grey and gray are one colour
}
/** the colour in binary, a byte a channel (hextobinary.com's job): '11111111 01010111 00110011'. Pure. */
export function binaryOf(text) { const rgb = parse(text); return rgb ? [rgb.r, rgb.g, rgb.b].map((v) => v.toString(2).padStart(8, '0')).join(' ') : ''; }

// ---- random colours: any, or of a kind ----
export const RANDOM_KINDS = Object.freeze(['any', 'pastel', 'vivid', 'dark', 'light', 'muted', 'warm', 'cool', 'grey']);
/** a random colour of a kind as '#rrggbb'; rnd() returns [0, 1). Pure for a given rnd. */
export function randomColour(kind = 'any', rnd = Math.random) {
  const r = (a, b) => a + rnd() * (b - a), hsl = (h, s, l) => toHex(hslToRgb(((h % 360) + 360) % 360, s, l)).toLowerCase();
  switch (kind) {
    case 'pastel': return hsl(r(0, 360), r(55, 90), r(78, 90));
    case 'vivid': return hsl(r(0, 360), r(85, 100), r(45, 58));
    case 'dark': return hsl(r(0, 360), r(30, 90), r(10, 28));
    case 'light': return hsl(r(0, 360), r(30, 90), r(80, 94));
    case 'muted': return hsl(r(0, 360), r(10, 35), r(35, 70));
    case 'warm': return hsl(r(-40, 60), r(55, 95), r(40, 65)); // reds, oranges and yellows
    case 'cool': return hsl(r(160, 280), r(45, 90), r(35, 65)); // greens through blues to violet
    case 'grey': { const v = Math.floor(r(0, 256)); return toHex({ r: v, g: v, b: v }).toLowerCase(); }
    default: return '#' + Math.floor(rnd() * 0x1000000).toString(16).padStart(6, '0');
  }
}

// ---- contrast (WCAG 2.2: 1.4.3 text AA 4.5 / large 3, 1.4.6 AAA 7 / large 4.5, 1.4.11 interface parts 3) ----
/** the WCAG verdicts for text in one colour on another: { ratio, aa, aaLarge, aaa, aaaLarge, ui }, or null. Pure. */
export function contrastReport(fg, bg) {
  const a = parse(fg), b = parse(bg); if (!a || !b) return null;
  const ratio = Math.round(contrast(a, b) * 100) / 100, raw = contrast(a, b);
  return { ratio, aa: raw >= 4.5, aaLarge: raw >= 3, aaa: raw >= 7, aaaLarge: raw >= 4.5, ui: raw >= 3 };
}
/** the colour nearest the foreground (same hue and saturation, lightness moved the least) whose text on the background reaches the target
 *  ratio, as '#RRGGBB'; the foreground itself when it already does; null when no lightness reaches it. Pure. */
export function nearestPassing(fg, bg, target = 4.5) {
  const a = parse(fg), b = parse(bg); if (!a || !b) return null;
  if (contrast(a, b) >= target) return toHex(a).toUpperCase();
  const { h, s, l } = rgbToHsl(a);
  for (let d = 0.5; d <= 100; d += 0.5) for (const k of [l - d, l + d]) {
    if (k < 0 || k > 100) continue; const c = hslToRgb(h, s, k); if (contrast(c, b) >= target) return toHex(c).toUpperCase();
  }
  return null;
}

// ---- shades ----
/** n colours from the colour towards white, black or grey (tints, shades, tones), nearest first. Pure. */
export function steps(text, n = 10, to = 'white') {
  const rgb = parse(text); if (!rgb) return []; n = Math.max(1, Math.min(30, Math.round(n) || 10));
  const ks = Array.from({ length: n }, (_, i) => (i + 1) / (n + 1));
  if (to === 'grey') { const { h, s, l } = rgbToHsl(rgb); return ks.map((k) => toHex(hslToRgb(h, s * (1 - k), l)).toUpperCase()); }
  const t = to === 'black' ? 0 : 255; return ks.map((k) => toHex({ r: rgb.r + (t - rgb.r) * k, g: rgb.g + (t - rgb.g) * k, b: rgb.b + (t - rgb.b) * k }).toUpperCase());
}
// how much white (to 500) or black (from 500) each step of a design-system scale mixes in
const SCALE = [[50, 0.95, 255], [100, 0.9, 255], [200, 0.75, 255], [300, 0.6, 255], [400, 0.3, 255], [500, 0, 255], [600, 0.15, 0], [700, 0.3, 0], [800, 0.45, 0], [900, 0.6, 0], [950, 0.75, 0]];
/** a design-system scale with the colour at 500: [{ step, hex }] for 50, 100, ... 900, 950. Pure. */
export function scaleOf(text) {
  const rgb = parse(text); if (!rgb) return [];
  return SCALE.map(([step, k, t]) => ({ step, hex: toHex({ r: rgb.r + (t - rgb.r) * k, g: rgb.g + (t - rgb.g) * k, b: rgb.b + (t - rgb.b) * k }).toUpperCase() }));
}

// ---- palette files ----
const slug = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'palette';
/** a palette as CSS custom properties. Pure. */
export function cssVars(name, list) { return ':root {\n' + list.map((c, i) => '  --' + slug(name) + '-' + (i + 1) + ': ' + String(c).toLowerCase() + ';').join('\n') + '\n}\n'; }
/** a palette as a GIMP / Inkscape / Krita palette file (.gpl), the format ColorZilla's palette editor reads. Pure. */
export function gpl(name, list) {
  const rows = list.map((c) => { const v = parse(c); return v ? String(v.r).padStart(3) + ' ' + String(v.g).padStart(3) + ' ' + String(v.b).padStart(3) + '\t' + toHex(v).slice(1).toUpperCase() : null; }).filter(Boolean);
  return 'GIMP Palette\nName: ' + String(name || 'Palette').replace(/[\r\n]+/g, ' ').slice(0, 60) + '\nColumns: ' + Math.min(16, rows.length || 1) + '\n#\n' + rows.join('\n') + '\n';
}
/** a palette as a design-token JSON (the Tailwind theme shape for a scale, a list otherwise). Pure. */
export function tokens(name, list) { return JSON.stringify({ [slug(name)]: Object.fromEntries(list.map((c, i) => [String(i + 1), String(c).toLowerCase()])) }, null, 2) + '\n'; }

// ---- pictures ----
/** the k most common colours of RGBA pixel data (4 bits a channel, then the average of each bucket), skipping see-through pixels and
 *  buckets too close to one already chosen: ['#rrggbb', ...], most common first. Pure. */
export function dominant(data, k = 6, minGap = 24) {
  const buckets = new Map();
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    const b = buckets.get(key) || { n: 0, r: 0, g: 0, b: 0 }; b.n++; b.r += data[i]; b.g += data[i + 1]; b.b += data[i + 2]; buckets.set(key, b);
  }
  const out = [];
  for (const b of [...buckets.values()].sort((x, y) => y.n - x.n)) {
    const c = { r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n) };
    if (out.every((o) => Math.hypot(o.r - c.r, o.g - c.g, o.b - c.b) >= minGap)) out.push(c);
    if (out.length >= k) break;
  }
  return out.map((c) => toHex(c).toLowerCase());
}

// ---- colour vision (Machado, Oliveira and Fernandes 2009, in linear RGB); the -anomaly kinds are the -opia matrix at 60% severity,
//      mixed with the identity, and achromatomaly is 60% of the way to grey: an approximation, labelled so ----
const M = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
export const VISION = Object.freeze([
  ['protanopia', 'Protanopia', 'no red cones, about 1 in 100 men', 'protan', 1], ['deuteranopia', 'Deuteranopia', 'no green cones, about 1 in 100 men', 'deutan', 1],
  ['tritanopia', 'Tritanopia', 'no blue cones, rare', 'tritan', 1], ['protanomaly', 'Protanomaly', 'weak red cones, about 1 in 100 men', 'protan', 0.6],
  ['deuteranomaly', 'Deuteranomaly', 'weak green cones, the most common: about 5 in 100 men', 'deutan', 0.6], ['tritanomaly', 'Tritanomaly', 'weak blue cones, rare', 'tritan', 0.6],
  ['achromatopsia', 'Achromatopsia', 'no colour at all, very rare', 'grey', 1], ['achromatomaly', 'Achromatomaly', 'little colour, very rare', 'grey', 0.6],
].map(([id, name, who, m, k]) => Object.freeze({ id, name, who, m, k })));
const LIN = Array.from({ length: 256 }, (_, v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
const gam = (v) => { v = Math.max(0, Math.min(1, v)); return Math.round((v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055) * 255); };
/** a 3 × 3 matrix in linear RGB for a kind of colour vision (VISION ids), or null. Pure. */
export function visionMatrix(id) {
  const v = VISION.find((x) => x.id === id); if (!v) return null;
  const full = v.m === 'grey' ? [[0.2126, 0.7152, 0.0722], [0.2126, 0.7152, 0.0722], [0.2126, 0.7152, 0.0722]] : M[v.m];
  return full.map((row, i) => row.map((x, j) => x * v.k + (i === j ? 1 - v.k : 0)));
}
/** how a colour looks with a kind of colour vision: '#RRGGBB', or null. Pure. */
export function simulate(text, id) {
  const rgb = parse(text), m = visionMatrix(id); if (!rgb || !m) return null;
  const c = [LIN[rgb.r], LIN[rgb.g], LIN[rgb.b]], o = m.map((row) => gam(row[0] * c[0] + row[1] * c[1] + row[2] * c[2]));
  return toHex({ r: o[0], g: o[1], b: o[2] }).toUpperCase();
}
/** the same for RGBA pixel data, in place (alpha kept); returns the data. */
export function simulatePixels(data, id) {
  const m = visionMatrix(id); if (!m) return data;
  for (let i = 0; i + 3 < data.length; i += 4) {
    const r = LIN[data[i]], g = LIN[data[i + 1]], b = LIN[data[i + 2]];
    data[i] = gam(m[0][0] * r + m[0][1] * g + m[0][2] * b); data[i + 1] = gam(m[1][0] * r + m[1][1] * g + m[1][2] * b); data[i + 2] = gam(m[2][0] * r + m[2][1] * g + m[2][2] * b);
  }
  return data;
}

// ---- palette schemes (skills/palette.js build, the same rules the chat uses) ----
export const SCHEME_IDS = Object.freeze(['analogous', 'complementary', 'triadic', 'split-complementary', 'tetradic', 'monochrome', 'pastel']);
/** the skill's scheme name for an address id: 'split-complementary' -> 'split complementary'. Pure. */
export const schemeName = (id) => String(id || '').replace('-', ' ');
/** the address id for a skill's scheme name. Pure. */
export const schemeId = (name) => String(name || '').toLowerCase().replace(/\s+/g, '-');
/** the hue, saturation and lightness of a colour, rounded, for the sliders. Pure. */
export function hslOf(text) { const rgb = parse(text); if (!rgb) return null; const { h, s, l } = rgbToHsl(rgb); return { h: Math.round(h) % 360, s: Math.round(s), l: Math.round(l) }; }
