/**
 * palette skill — "show me a color palette", "random colors", "color scheme".
 * Generates a simple harmonious palette of 5 colors on the card. Empty surface stays empty.
 * Uses HSL for harmony. Nothing sent or kept.
 */
function hsl(h, s, l) { return `hsl(${h} ${s}% ${l}%)`; }

export function paletteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|give|generate|make)(?: me)?(?: a| an)? )?(?:random |new )?(?:color |colour )?(?:palette|scheme|swatch(?:es)?)$/.test(t) || /^color palette$/.test(t);
}

function randomPalette() {
  const base = Math.floor(Math.random() * 360);
  return [0, 30, 60, 120, 180].map((off, i) => hsl((base + off) % 360, 60 + i * 5, 45 + i * 4));
}

async function run(text, api) {
  if (!paletteOf(text)) return 'none';
  const { showPage, esc } = api;
  const colors = randomPalette();
  const el = showPage((p) => {
    p.innerHTML = '<h2>Color palette</h2><div class="sub">A fresh set of 5 harmonious colors.</div>'
      + '<div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">' + colors.map(c => '<div style="width:48px;height:48px;border-radius:8px;background:' + c + ';border:1px solid rgba(255,255,255,.2)" title="' + esc(c) + '"></div>').join('') + '</div>'
      + '<pre style="font-size:12px;background:rgba(0,0,0,.3);padding:8px;border-radius:6px">' + colors.map(c => esc(c)).join('\n') + '</pre>'
      + '<div class="src">Generated in this browser. Nothing is saved or sent.</div>';
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['show me a color palette', 'random colors', 'color scheme', 'generate a palette'],
  nearMisses: ['what is a palette', 'paint palette', 'color theory'],
  match(lower, text) { return paletteOf(text); },
  run,
  suite() {
    return { ok: paletteOf('show me a color palette') && !paletteOf('hello world') };
  },
};
