/**
 * palette skill — generate a simple color palette (pure)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "color palette", "generate a color palette", "make a palette".
 */
export function paletteOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  return /^(?:please\s+)?(?:generate|make|create|give\s+me)\s+(?:a\s+|me\s+a\s+)?(?:color|colour)\s+palette|^(?:color|colour)\s+palette$/.test(t);
}
function randHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}
async function run(text, api) {
  if (!paletteOf(text)) return 'none';
  const { showPage, esc } = api;
  const colors = [randHex(), randHex(), randHex(), randHex(), randHex()];
  showPage((el) => {
    el.innerHTML = '<h2>Color palette</h2><div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">'
      + colors.map((c) => '<div style="width:60px;height:60px;border-radius:8px;background:' + esc(c) + ';border:1px solid rgba(255,255,255,.2)" title="' + esc(c) + '"></div>').join('')
      + '</div><div class="sub">' + colors.map(esc).join(' · ') + '</div><div class="sub">say “color palette” for another</div>';
  });
  return 'palette';
}
export default {
  name: 'palette',
  examples: ['color palette', 'generate a color palette', 'make a palette'],
  nearMisses: ['what is a color palette', 'paint palette', 'what color is red'],
  match(lower, text) { return paletteOf(text); },
  run,
  suite() {
    const ok = paletteOf('color palette') && paletteOf('generate a color palette') && !paletteOf('what is a color palette');
    return { ok, got: ok ? 'pass' : 'parser fail' };
  }
};
