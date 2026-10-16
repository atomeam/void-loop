/**
 * palette skill — generate a random color palette.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random color palette", "give me colors", "new palette".
 * Pure client-side HSL. Empty surface stays empty.
 */
export function paletteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:(?:generate|make|create|give|new|random)\s+(?:me\s+)?(?:a\s+)?(?:random\s+)?(?:color|colour)?\s*palette|color palette|colour palette|give me colors|random colors)$/.test(t);
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!paletteOf(text)) return 'none';
  const base = Math.floor(Math.random() * 360);
  const colors = [0, 30, 60, 180, 210].map((off) => hslToHex((base + off) % 360, 70, 55));
  const swatches = colors.map((c) => `<div style="background:${c};width:48px;height:48px;border-radius:6px;display:inline-block;margin:4px" title="${esc(c)}"></div>`).join('');
  showPage((p) => {
    p.innerHTML = '<h2>Color palette</h2><div>' + swatches + '</div><pre style="font-size:14px;background:rgba(0,0,0,.3);padding:12px;border-radius:8px">' + esc(colors.join('\n')) + '</pre>'
      + '<p class="sub">random complementary · nothing leaves this browser</p>';
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['random color palette', 'give me colors', 'new palette', 'color palette'],
  nearMisses: ['what is a color', 'paint', 'draw', 'hex color'],
  match(lower, text) { return paletteOf(text || lower); },
  run,
  suite() {
    return { ok: paletteOf('random color palette') && !paletteOf('hello') };
  },
};
