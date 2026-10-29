/**
 * palette skill — a harmonious color palette: five colors that belong together, worked out from one base on the color wheel
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random palette", "another palette", "complementary palette", "pastel palette", "triadic palette from #ff8800".
 * Five unrelated random colors ("color palette", "palette") stay with the color skill (asked after this one, so this one leaves them).
 */
import { isColor } from './color.js';

export const SCHEMES = {
  analogous: [0, 30, -30, 60, -60],
  complementary: [0, 180, 0, 180, 0],
  triadic: [0, 120, 240, 120, 240],
  'split complementary': [0, 150, 210, 150, 210],
  tetradic: [0, 90, 180, 270, 0],
  monochrome: [0, 0, 0, 0, 0],
  pastel: [0, 72, 144, 216, 288],
};
const NAMES = Object.keys(SCHEMES).join('|').replace(' ', '[\\s-]');
const ASK = new RegExp('^(?:please\\s+)?(?:(?:show|give|generate|make|create)\\s+(?:me\\s+)?)?(?:a\\s+|an\\s+|another\\s+|some\\s+)?(?:(random|harmonious|matching|new)\\s+|(' + NAMES + ')\\s+)?(?:colou?r\\s+)?(?:palette|scheme|color\\s+scheme|colou?r\\s+combination)(?:\\s+(?:from|for|based\\s+on|around)\\s+(#?[0-9a-f]{6}|#?[0-9a-f]{3}))?$', 'i');

/** what the ask names: { scheme, base } (base a #rrggbb or null), or null when it is not this skill's */
export function paletteOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t || isColor(t)) return null;
  const m = ASK.exec(t);
  if (!m) return null;
  const words = t.toLowerCase();
  // a bare "palette" ask with no word that makes it a harmony is the color skill's
  if (!m[1] && !m[2] && !m[3] && !/\b(?:another|scheme|combination|generate|make|create|show|give)\b/.test(words)) return null;
  const scheme = m[2] ? m[2].toLowerCase().replace('-', ' ') : null;
  let base = m[3] ? m[3].replace('#', '').toLowerCase() : null;
  if (base && base.length === 3) base = base.split('').map((c) => c + c).join('');
  return { scheme, base: base ? '#' + base : null };
}
export const isPalette = (text) => !!paletteOf(text);

const rnd = (n) => { const c = globalThis.crypto; if (c && c.getRandomValues) return c.getRandomValues(new Uint32Array(1))[0] % n; return Math.floor(Math.random() * n); };
export function hexToHsl(hex) {
  const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  if (!d) return [0, 0, Math.round(l * 100)];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [Math.round(((h * 60) + 360) % 360), Math.round(s * 100), Math.round(l * 100)];
}
export function hslToHex(h, s, l) {
  h = ((h % 360) + 360) % 360; s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
}
/** five #rrggbb colors for a scheme around a base hue; lightness steps keep them apart even when the hues repeat */
export function build(scheme, base) {
  const [h, s0, l0] = base ? hexToHsl(base) : [rnd(360), 55 + rnd(30), 45 + rnd(15)];
  const offs = SCHEMES[scheme], pastel = scheme === 'pastel', mono = scheme === 'monochrome';
  const L = mono ? [l0, 20, 35, 65, 85] : [l0, Math.min(85, l0 + 15), Math.max(20, l0 - 15), Math.min(90, l0 + 28), Math.max(15, l0 - 25)];
  return offs.map((o, i) => i === 0 && base ? base : hslToHex(h + o, pastel ? 70 : Math.max(25, s0), pastel ? 82 - i * 2 : L[i]));
}

function run(text, api) {
  const { showPage, esc } = api;
  const ask = paletteOf(text) || { scheme: null, base: null };
  const names = Object.keys(SCHEMES), scheme = ask.scheme || names[rnd(names.length)];
  const colors = build(scheme, ask.base);
  const title = scheme.charAt(0).toUpperCase() + scheme.slice(1) + ' palette';
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(title) + '</h2>'
      + '<div style="display:flex;gap:6px;flex-wrap:wrap">' + colors.map((c) => '<div style="text-align:center"><div style="width:64px;height:64px;border-radius:10px;border:1px solid rgba(255,255,255,.15);background:' + esc(c) + '"></div><code style="font-size:12px">' + esc(c) + '</code></div>').join('') + '</div>'
      + '<div class="sub" style="margin-top:10px">' + esc(ask.base ? 'built around ' + ask.base : 'from a random base color') + ' · say “another palette”, or name one: analogous, complementary, triadic, split complementary, tetradic, monochrome, pastel</div>'
      + '<div class="src">Worked out on this device.</div>';
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['random palette', 'another palette', 'complementary palette', 'pastel color palette', 'triadic palette from #ff8800', 'generate a color scheme'],
  nearMisses: ['color palette', 'palette', 'what is a color', 'paint colors for walls', 'hex to rgb', 'palette knife'],
  match(lower, text) { return isPalette(text); },
  run,
  suite() {
    const c = build('complementary', '#ff0000');
    const ok = isPalette('random palette') && isPalette('analogous palette from #336699') && !isPalette('color palette') && c.length === 5 && c[0] === '#ff0000' && hexToHsl(c[1])[0] === 180;
    return { ok, got: c.join(' ') };
  }
};
