/**
 * palette skill: generate a color palette from a base color or random.
 * "color palette", "palette from blue", "make a palette", "random palette".
 * Pure; card shows swatches. Empty surface stays empty.
 */
export function paletteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:(?:make|generate|create|show|give me)\s+)?(?:a\s+|an\s+|the\s+)?(?:random\s+)?(?:color\s+|colour\s+)?palette(?:\s+please)?$/.test(t)) return { base: null };
  const m = t.match(/^(?:please\s+)?(?:(?:make|generate|create|show)\s+)?(?:a\s+|an\s+)?(?:color\s+|colour\s+)?palette\s+(?:from|of|based\s+on)\s+([a-z]+(?:\s+[a-z]+)?)(?:\s+please)?$/);
  if (m) return { base: m[1].trim() };
  return null;
}

const NAMED = { red: '#e74c3c', blue: '#3498db', green: '#2ecc71', yellow: '#f1c40f', purple: '#9b59b6', orange: '#e67e22', pink: '#e91e63', teal: '#1abc9c', gray: '#95a5a6', black: '#2c3e50' };

function generate(base) {
  const start = base && NAMED[base] ? NAMED[base] : '#' + Math.floor(Math.random()*0xffffff).toString(16).padStart(6, '0');
  const colors = [start];
  for (let i = 1; i < 5; i++) {
    const n = parseInt(start.slice(1), 16);
    const shift = (Math.random() - 0.5) * 0x404040;
    const c = Math.max(0, Math.min(0xffffff, n + shift | 0));
    colors.push('#' + c.toString(16).padStart(6, '0'));
  }
  return colors;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const want = paletteOf(text);
  if (!want) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Color palette</h2><p>Generating…</p>'; });
  if (!el) return 'palette';
  const colors = generate(want.base);
  let html = '<h2>Color palette' + (want.base ? ' · from ' + esc(want.base) : '') + '</h2><div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0">';
  for (const c of colors) {
    html += '<div style="background:' + c + ';width:60px;height:60px;border-radius:8px;border:1px solid rgba(255,255,255,.2)" title="' + c + '"></div>';
  }
  html += '</div><button class="palette-reroll" type="button">New palette</button><p class="src">Generated in this browser. Nothing is stored or sent.</p>';
  el.innerHTML = html;
  const btn = el.querySelector('.palette-reroll');
  if (btn) btn.addEventListener('click', () => {
    const cs = generate(want.base);
    const box = el.querySelector('div');
    box.innerHTML = cs.map(c => '<div style="background:' + c + ';width:60px;height:60px;border-radius:8px;border:1px solid rgba(255,255,255,.2)" title="' + c + '"></div>').join('');
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['color palette', 'palette from blue', 'random palette', 'make a palette', 'generate a colour palette from red'],
  nearMisses: ['what colors', 'paint palette', 'palette knife', 'color theory'],
  match(lower, text) { return !!paletteOf(text || lower); },
  run,
  suite() {
    return { ok: paletteOf('color palette') !== null && paletteOf('palette from blue')?.base === 'blue' && paletteOf('hello') === null };
  },
};
