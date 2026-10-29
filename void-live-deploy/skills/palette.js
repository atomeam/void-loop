/**
 * palette skill — generate a random color palette on the stage
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "show me colors", "color palette", "random colors".
 */
export function isPalette(text) {
  return /^(?:please\s+)?(?:(?:show|give|generate)\s+(?:me\s+)?(?:a\s+|some\s+|another\s+)?(?:color\s+|colour\s+)?(?:palette|colors|colours)|(?:random|another)\s+(?:color\s+|colour\s+)?(?:palette|colors|colours)|color\s+palette|colours?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

function run(text, api) {
  const { showPage, esc } = api;
  const colors = Array.from({ length: 5 }, randomHex);
  const swatches = colors.map((c) => `<div style="display:inline-block;width:60px;height:60px;background:${c};margin:4px;border-radius:8px;border:1px solid #333" title="${esc(c)}"></div>`).join('');
  const hexes = colors.map((c) => `<code style="margin:0 6px">${esc(c)}</code>`).join('');
  showPage((p) => {
    p.innerHTML = `<h2>Color palette</h2><div>${swatches}</div><div class="sub" style="margin-top:12px">${hexes}</div><div class="sub">say “another palette” for one more</div>`;
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['show me colors', 'color palette', 'random colors', 'another palette'],
  nearMisses: ['what is a color', 'paint colors for walls', 'hex to rgb'],
  match(lower, text) { return isPalette(text); },
  run,
  suite() {
    const ok = isPalette('show me colors') && isPalette('color palette') && !isPalette('what is a color');
    return { ok, got: 'match works' };
  }
};
