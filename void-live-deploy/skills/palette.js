/**
 * palette skill — a random color palette. "random palette", "color palette", "make a palette"
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export function isPalette(text) {
  return /^(?:please\s+)?(?:(?:make|generate|give\s+me|show)\s+(?:me\s+)?(?:a\s+)?(?:random\s+)?(?:color\s+)?palette|random\s+(?:color\s+)?palette|color\s+palette)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function hsl(h, s, l) {
  return `hsl(${h}, ${s}%, ${l}%)`;
}

function generate() {
  const base = Math.floor(Math.random() * 360);
  return [0, 30, 60, 120, 180].map((o) => hsl((base + o) % 360, 70, 50 + Math.floor(Math.random() * 20)));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const colors = generate();
  const swatches = colors.map((c) => `<div style="background:${c};width:60px;height:60px;border-radius:8px;display:inline-block;margin:4px" title="${esc(c)}"></div>`).join('');
  const el = showPage((p) => {
    p.innerHTML = `<h2>Color palette</h2><div>${swatches}</div><div class="sub">say “another palette” for a new one</div><p>${colors.map(esc).join('<br>')}</p>`;
  });
  return 'palette';
}

export default {
  name: 'palette',
  examples: ['random palette', 'color palette', 'make a palette'],
  nearMisses: ['paint palette', 'what is a palette'],
  match(lower, text) { return isPalette(text); },
  run,
  suite() {
    const ok = isPalette('random palette') && isPalette('color palette') && !isPalette('art palette');
    return { ok, got: 'match works' };
  }
};
