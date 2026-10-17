/**
 * palette skill — generate a color palette for design inspiration.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "color palette", "generate a palette", "palette for teal", "random color palette".
 * Pure generation in the browser; nothing is sent. Empty surface stays empty.
 */
export function paletteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:(?:generate|make|create|show|give me|open)\s+)?(?:a\s+|an\s+|the\s+)?(?:color|colour)\s+palette(?:\s+(?:for|from|of)\s+(.+))?$/.test(t)
    || /^(?:random\s+)?(?:color|colour)\s+palette$/.test(t)
    || /^palette(?:\s+(?:for|from)\s+(.+))?$/.test(t)) {
    const m = t.match(/(?:for|from|of)\s+(.+)$/);
    return m ? m[1].trim() : 'random';
  }
  return null;
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

export function generatePalette(base = 'random') {
  let h = Math.floor(Math.random() * 360);
  if (base !== 'random') {
    const named = { red: 0, orange: 30, yellow: 60, green: 120, teal: 180, blue: 210, purple: 270, pink: 330 };
    h = named[base.toLowerCase()] || (base.startsWith('#') ? parseInt(base.slice(1), 16) % 360 : h);
  }
  const colors = [];
  for (let i = 0; i < 5; i++) {
    const hh = (h + i * 30) % 360;
    const s = 60 + Math.random() * 30;
    const l = 40 + Math.random() * 30;
    colors.push(hslToHex(hh, s, l));
  }
  return colors;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const base = paletteOf(text);
  if (!base) return 'none';
  const colors = generatePalette(base);
  const swatches = colors.map(c => `<div style="display:inline-block;width:80px;height:80px;background:${c};margin:4px;border-radius:8px;vertical-align:top" title="${c}"></div><div style="font-size:12px;text-align:center">${esc(c)}</div>`).join('');
  showPage((p) => {
    p.innerHTML = `<h2>Color palette${base !== 'random' ? ' · ' + esc(base) : ''}</h2><div style="text-align:center;margin:12px 0">${swatches}</div><div class="sub">Generated in this browser. Click a swatch to copy its hex (coming).</div>`;
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['color palette', 'generate a palette', 'palette for teal', 'random color palette'],
  nearMisses: ['what is a palette', 'paint palette', 'color theory'],
  match(lower, text) { return !!paletteOf(text); },
  run,
  suite() {
    return { ok: paletteOf('color palette') === 'random' && paletteOf('palette for blue') === 'blue' && generatePalette('teal').length === 5 };
  },
};
