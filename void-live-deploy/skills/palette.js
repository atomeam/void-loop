/**
 * palette skill — a random color palette generated locally (no API, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "give me a palette", "random colors", "color scheme".
 */
export function isPalette(text) {
  return /^(?:please\s+)?(?:give\s+(?:me\s+)?(?:a|another|one\s+more)\s+(?:color\s+)?palette|(?:another|a|random)\s+(?:color\s+)?palette|palette(?:\s+please)?|random\s+colors|color\s+scheme|generate\s+(?:a\s+)?palette)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const colors = Array.from({ length: 5 }, randomHex);
  const swatches = colors.map((c) => `<div style="display:inline-block;width:60px;height:60px;background:${c};margin:4px;border-radius:8px;border:1px solid rgba(255,255,255,0.2)" title="${esc(c)}"></div>`).join('');
  const hexes = colors.map((c) => `<code style="margin:0 6px">${esc(c)}</code>`).join('');
  showPage((p) => {
    p.innerHTML = '<h2>A palette</h2><div style="margin:12px 0">' + swatches + '</div><p>' + hexes + '</p><div class="sub">say “another palette” for one more</div>';
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['give me a palette', 'random colors', 'color scheme', 'another palette'],
  nearMisses: ['what is a palette', 'color theory', 'paint palette'],
  match(lower, text) { return isPalette(text); },
  run,
  suite() {
    const ok = isPalette('give me a palette') && isPalette('random colors') && !isPalette('what is a palette');
    return { ok, got: 'match works' };
  }
};
