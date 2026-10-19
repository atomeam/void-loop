/**
 * palette skill — harmonious color palettes from a name or hex (asked by Grok for growth).
 * "color palette for blue", "make a palette from #ff5500", "sunset palette".
 * Pure HSL generation; no external call. Empty surface stays empty.
 */
const HUES = { red: 0, orange: 30, yellow: 60, green: 120, blue: 210, purple: 270, pink: 330, sunset: 25, ocean: 200, forest: 140 };

export function paletteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:(?:make|create|generate|give me)\s+(?:a\s+)?)?(?:color\s+)?palette\s+(?:for|from|of)\s+(.+)$/);
  if (!m) return null;
  const seed = m[1].replace(/^#/, '');
  if (/^[0-9a-f]{6}$/.test(seed)) {
    const r = parseInt(seed.slice(0, 2), 16) / 255, g = parseInt(seed.slice(2, 4), 16) / 255, b = parseInt(seed.slice(4, 6), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
      else if (max === g) h = ((b - r) / d + 2) / 6;
      else h = ((r - g) / d + 4) / 6;
    }
    return { hue: Math.round(h * 360), from: '#' + seed };
  }
  const name = Object.keys(HUES).find((k) => seed.includes(k));
  return name ? { hue: HUES[name], from: name } : { hue: 180, from: seed };
}

export function makePalette(hue) {
  const colors = [];
  for (let i = 0; i < 5; i++) {
    const h = (hue + i * 30) % 360;
    const s = 70 - i * 5;
    const l = 50 + i * 5;
    colors.push(`hsl(${h}, ${s}%, ${l}%)`);
  }
  return colors;
}

function run(text, api) {
  const { showPage, esc } = api;
  const q = paletteOf(text);
  if (!q) return 'none';
  const colors = makePalette(q.hue);
  showPage((el) => {
    el.innerHTML = '<h2>Color palette</h2><div class="sub">from ' + esc(q.from) + '</div>'
      + colors.map((c) => '<div style="display:inline-block;width:80px;height:60px;background:' + c + ';margin:4px;border-radius:6px" title="' + c + '"></div>').join('')
      + '<div class="src">Generated in this browser · no upload</div>';
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['color palette for blue', 'make a palette from #ff5500', 'sunset palette'],
  nearMisses: ['what is a palette', 'paint palette', 'color theory'],
  match(lower, text) { return !!paletteOf(text); },
  run,
  suite() {
    const q = paletteOf('color palette for blue');
    const p = makePalette(210);
    return { ok: q && q.hue === 210 && p.length === 5 && /hsl/.test(p[0]) && paletteOf('hello') === null };
  },
};
