/**
 * palette skill — a harmonious color palette from a word or color name (generated here, nothing sent)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "color palette for ocean", "palette from blue", "make a palette for sunset"
 */
function hash(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function paletteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:(?:make|generate|create|show|give)\s+(?:me\s+)?)?(?:a\s+|an\s+)?(?:color\s+|colour\s+)?palette(?:\s+(?:for|from|of)\s+(.+))?$/);
  if (!m) return null;
  return { seed: (m[1] || 'void').trim() };
}

export function makePalette(seed) {
  const h = hash(seed) % 360;
  const colors = [];
  for (let i = 0; i < 5; i++) {
    const hue = (h + i * 28) % 360;
    const sat = 55 + (i % 3) * 12;
    const light = 42 + (i % 2) * 18;
    colors.push(`hsl(${hue}, ${sat}%, ${light}%)`);
  }
  return colors;
}

function run(text, api) {
  const want = paletteOf(text);
  if (!want) return 'none';
  const { showPage, esc } = api;
  const colors = makePalette(want.seed);
  showPage((el) => {
    const swatches = colors.map((c) => `<div style="flex:1;height:72px;background:${c};border-radius:8px" title="${esc(c)}"></div>`).join('');
    el.innerHTML = '<h2>Palette for ' + esc(want.seed) + '</h2>'
      + '<div style="display:flex;gap:8px;margin:12px 0">' + swatches + '</div>'
      + '<div class="sub">' + colors.map(esc).join(' · ') + '</div>'
      + '<div class="src">Generated from the word · nothing is sent or stored</div>';
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['color palette for ocean', 'palette from blue', 'make a palette for sunset', 'generate a palette'],
  nearMisses: ['what is a color palette', 'paint palette', 'color theory'],
  match(lower, text) { return !!paletteOf(text); },
  run,
  suite() {
    const p = makePalette('ocean');
    const ok = paletteOf('color palette for ocean') && paletteOf('palette from blue') && !paletteOf('what is a palette')
      && p.length === 5 && p.every((c) => /^hsl\(/.test(c));
    return { ok, got: ok ? 'parsed and made five hsl' : 'failed' };
  },
};
