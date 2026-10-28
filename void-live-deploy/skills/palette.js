/**
 * palette skill — a random color palette on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "show me a palette", "random palette", "color palette".
 */
export function isPalette(text) {
  return /^(?:please\s+)?(?:(?:show|give|generate|make)\s+(?:me\s+)?(?:a\s+)?(?:random\s+)?(?:color\s+)?palette|random\s+palette|color\s+palette|palette)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const colors = Array.from({ length: 5 }, randomHex);
  const swatches = colors.map((c) => `<div style="width:60px;height:60px;background:${c};border-radius:8px;display:inline-block;margin:4px" title="${c}"></div>`).join('');
  const el = showPage((p) => { p.innerHTML = '<h2>Palette</h2><div class="sub">…</div>'; });
  el.innerHTML = '<h2>Palette</h2><div>' + swatches + '</div><div class="sub">' + esc(colors.join(' ')) + '</div><div class="sub">say “another palette” for one more</div>';
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['show me a palette', 'random palette', 'color palette', 'generate a palette'],
  nearMisses: ['what is a palette', 'paint palette', 'color theory'],
  match(lower, text) { return isPalette(text); },
  run,
  suite() {
    const ok = isPalette('show me a palette') && isPalette('random palette') && !isPalette('what is a palette');
    return { ok, got: 'match works' };
  }
};
