/**
 * palette skill — "make a color palette", "colors for teal", "generate a palette".
 * Client-side harmonious colors from a seed hue. Nothing is sent. Empty surface stays empty.
 */
export function paletteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:make|generate|create|give me|show)\s+(?:a\s+)?(?:color\s+)?palette(?:\s+(?:for|of|with)\s+(.+))?$/) || t.match(/^(?:color\s+scheme|colors)\s+(?:for|of)\s+(.+)$/);
  return m ? (m[1] || 'random') : null;
}

function hsl(h, s, l) { return `hsl(${h % 360}, ${s}%, ${l}%)`; }
function colorsFor(seed) {
  const base = seed === 'random' ? Math.floor(Math.random() * 360) : (seed.charCodeAt(0) * 7) % 360;
  return [
    { name: 'primary', hex: hsl(base, 70, 50) },
    { name: 'accent', hex: hsl(base + 30, 65, 55) },
    { name: 'light', hex: hsl(base, 40, 85) },
    { name: 'dark', hex: hsl(base, 50, 25) },
    { name: 'complement', hex: hsl(base + 180, 60, 45) },
  ];
}

function run(text, api) {
  const seed = paletteOf(text);
  if (!seed) return 'none';
  const { showPage, esc } = api;
  const cols = colorsFor(seed);
  const swatches = cols.map((c) => '<div style="display:inline-block;margin:4px;text-align:center"><div style="width:64px;height:64px;background:' + c.hex + ';border-radius:8px;border:1px solid rgba(255,255,255,.2)"></div><div class="sub" style="font-size:11px">' + esc(c.name) + '</div></div>').join('');
  showPage((p) => {
    p.innerHTML = '<h2>Color palette</h2><div class="sub">Seed: ' + esc(seed) + '</div><div style="margin:12px 0">' + swatches + '</div><div class="src">Generated in this browser. Nothing is sent.</div>';
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['make a color palette', 'colors for teal', 'generate a palette', 'color scheme for blue'],
  nearMisses: ['what colors do you like', 'paint a picture', 'hex color of red'],
  match(lower, text) { return !!paletteOf(text); },
  run,
  suite() {
    return { ok: paletteOf('make a color palette') === 'random' && paletteOf('colors for teal') === 'teal' && paletteOf('hello') === null };
  },
};
