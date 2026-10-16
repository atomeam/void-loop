/**
 * palette skill — generate a color palette card.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "generate a palette", "random color palette", "show me a palette card".
 * Draws five harmonious colors in this browser. Empty surface stays empty.
 */
export function paletteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:generate|make|show|give me)\s+(?:a\s+)?(?:random\s+)?(?:color\s+)?palette(?:\s+card)?$|color\s+palette$/i.test(t);
}

function hsl(h, s, l) { return `hsl(${h}, ${s}%, ${l}%)`; }

function makePalette() {
  const base = Math.floor(Math.random() * 360);
  return [0, 30, 60, 150, 210].map((off) => hsl((base + off) % 360, 70, 55));
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!paletteOf(text)) return 'none';
  const colors = makePalette();
  const el = showPage((p) => {
    p.innerHTML = '<h2>Color palette</h2><div class="sub">five harmonious colors</div>'
      + '<div style="display:flex;gap:8px;margin:16px 0">' + colors.map((c) => '<div style="flex:1;height:80px;background:' + c + ';border-radius:8px" title="' + esc(c) + '"></div>').join('') + '</div>'
      + '<div class="src">drawn in this browser · say it again for a new one</div>';
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['generate a palette', 'random color palette', 'show me a palette card', 'color palette'],
  nearMisses: ['what is a palette', 'paint a picture', 'color the sky'],
  match(lower, text) { return paletteOf(text); },
  run,
  suite() {
    return { ok: paletteOf('generate a palette') && paletteOf('random color palette') && !paletteOf('hello') && !paletteOf('what is a palette') };
  },
};
