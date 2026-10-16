/**
 * palette skill — generate a harmonious color palette on the card.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "color palette", "make a palette", "generate harmonious colors", "palette for teal".
 * Empty surface stays empty.
 */
export function paletteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:(?:make|generate|create|give me|show)\s+(?:me\s+)?)?(?:a\s+|an\s+)?(?:color\s+|colour\s+)?palette(?:\s+(?:for|of|in)\s+(.+))?$/)
    || t.match(/^(?:harmonious\s+)?(?:color|colour)\s+scheme(?:\s+(?:for|of)\s+(.+))?$/);
  return m ? (m[1] || 'random').trim() : null;
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

function generatePalette(seed = 'random') {
  let hue = 0;
  if (seed === 'random') hue = Math.floor(Math.random() * 360);
  else {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) % 360;
    hue = h;
  }
  const base = hslToHex(hue, 70, 55);
  const complements = [
    hslToHex((hue + 30) % 360, 65, 60),
    hslToHex((hue + 60) % 360, 60, 50),
    hslToHex((hue + 180) % 360, 55, 45),
    hslToHex((hue + 210) % 360, 50, 65),
  ];
  return [base, ...complements];
}

async function run(text, api) {
  const { showPage, esc } = api;
  const seed = paletteOf(text);
  if (!seed) return 'none';
  const colors = generatePalette(seed);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Color palette' + (seed !== 'random' ? ' for ' + esc(seed) : '') + '</h2>'
      + '<div class="palette" style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">'
      + colors.map((c) => '<div style="background:' + c + ';width:64px;height:64px;border-radius:8px;box-shadow:0 2px 6px rgba(0,0,0,.3)" title="' + c + '"></div>').join('')
      + '</div><div class="sub">' + colors.map((c) => '<code>' + c + '</code>').join(' · ') + '</div>'
      + '<div class="src">Generated in this browser. Nothing is uploaded.</div>';
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['color palette', 'make a palette', 'generate a color scheme', 'palette for teal', 'harmonious colours'],
  nearMisses: ['what is a palette', 'paint palette', 'color theory', 'best colors for branding'],
  match(lower, text) { return !!paletteOf(text); },
  run,
  suite() {
    return { ok: paletteOf('color palette') === 'random' && paletteOf('palette for teal') === 'teal' && paletteOf('hello') === null };
  },
};
