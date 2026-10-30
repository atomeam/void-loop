/**
 * palettes: colour palettes built around one colour, for /color/ (the tower's color-hex.com floor shows community palettes that use a colour;
 * Verse has no community, so it makes them from the colour by the usual rules and says so), how the colour looks to people with each kind of
 * colour blindness (Machado, Oliveira and Fernandes 2009, full severity, in linear RGB), and the 216 web-safe colours. Every palette starts
 * with the colour itself. Pure. Tests: tools/palettes.test.mjs.
 */
import { parse, toHex, hslToRgb, rgbToHsl } from './colour.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const H = (h, s, l) => toHex(hslToRgb(((h % 360) + 360) % 360, clamp(s, 0, 100), clamp(l, 0, 100)));

/** eight palettes of five, each holding the colour first: [{ name, colors: ['#RRGGBB', ...] }]. Pure. */
export function palettesFor(text) {
  const rgb = parse(text); if (!rgb) return [];
  const me = toHex(rgb).toUpperCase(), { h, s, l } = rgbToHsl(rgb), up = l > 60 ? -1 : 1;
  // a grey has no hue to turn, so a palette that comes out short is filled with lighter and darker steps of the colour
  const dedupe = (list) => { const out = [me]; for (const x of [...list, ...[12, 24, 36, 48, 60, 72].map((d) => H(h, s, l + d * up))]) { const u = x.toUpperCase(); if (out.length < 5 && !out.includes(u)) out.push(u); } return out; };
  return [
    { name: 'Monochrome', colors: dedupe([-20, -10, 15, 30].map((k) => H(h, s, clamp(l + k, 10, 92)))) }, // steps either side, never down to black or up to white
    { name: 'Analogous', colors: dedupe([H(h - 40, s, l), H(h - 20, s, l), H(h + 20, s, l), H(h + 40, s, l)]) },
    { name: 'Complementary', colors: dedupe([H(h, s, l + 20 * up), H(h, s * 0.4, 92), H(h + 180, s, l), H(h + 180, s, l - 18 * up)]) },
    { name: 'Triadic', colors: dedupe([H(h + 120, s * 0.85, l), H(h + 240, s * 0.85, l), H(h + 120, s * 0.6, l + 20 * up), H(h + 240, s * 0.6, l + 20 * up)]) },
    { name: 'Pastel', colors: dedupe([H(h, 70, 86), H(h + 40, 70, 86), H(h + 180, 60, 86), H(h + 220, 60, 88)]) },
    { name: 'Muted', colors: dedupe([H(h - 15, s * 0.35, l + 10 * up), H(h + 15, s * 0.35, l - 10 * up), H(h, s * 0.25, 70), H(h, s * 0.3, 30)]) },
    { name: 'With neutrals', colors: dedupe([H(h, 25, 97), H(h, 12, 85), H(h, 8, 55), H(h, 25, 14)]) },
    { name: 'Bold contrast', colors: dedupe([H(h + 180, clamp(s + 20, 0, 100), 50), H(h + 90, clamp(s + 10, 0, 100), 45), '#FFFFFF', H(h, 30, 10)]) },
  ];
}

// Machado et al. 2009 at full severity, applied to linear RGB
const SIM = {
  protanopia: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deuteranopia: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritanopia: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const gam = (v) => Math.round(clamp(v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055, 0, 1) * 255);
/** how the colour looks with protanopia, deuteranopia, tritanopia and achromatopsia: [{ kind, label, hex }]. Pure. */
export function blindness(text) {
  const rgb = parse(text); if (!rgb) return [];
  const c = [lin(rgb.r), lin(rgb.g), lin(rgb.b)], out = [];
  for (const [kind, label] of [['protanopia', 'Protanopia (no red cones)'], ['deuteranopia', 'Deuteranopia (no green cones)'], ['tritanopia', 'Tritanopia (no blue cones)']]) {
    const m = SIM[kind], v = m.map((row) => row[0] * c[0] + row[1] * c[1] + row[2] * c[2]); out.push({ kind, label, hex: toHex({ r: gam(v[0]), g: gam(v[1]), b: gam(v[2]) }) });
  }
  const y = gam(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]); out.push({ kind: 'achromatopsia', label: 'Achromatopsia (no colour)', hex: toHex({ r: y, g: y, b: y }) });
  return out;
}

/** the 216 web-safe colours (each channel 00, 33, 66, 99, CC or FF), in the usual order. Pure. */
export const WEB_SAFE = Object.freeze([0, 51, 102, 153, 204, 255].flatMap((r) => [0, 51, 102, 153, 204, 255].flatMap((g) => [0, 51, 102, 153, 204, 255].map((b) => toHex({ r, g, b })))));
/** the nearest web-safe colour. Pure. */
export const webSafe = (text) => { const rgb = parse(text); if (!rgb) return null; const q = (v) => Math.round(v / 51) * 51; return toHex({ r: q(rgb.r), g: q(rgb.g), b: q(rgb.b) }); };
