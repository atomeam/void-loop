/**
 * palette skill — a small set of harmonious colors
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite }
 * "show a color palette", "random colors", "give me a palette".
 */
export function isPalette(text) {
  return /^(?:please\s+)?(?:show\s+(?:me\s+)?(?:a\s+)?(?:color\s+)?palette|random\s+colors?|give\s+me\s+(?:a\s+)?palette|color\s+palette)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function randomHex() {
  return '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const colors = [randomHex(), randomHex(), randomHex(), randomHex(), randomHex()];
  const swatches = colors.map(c => '<div style="display:inline-block;width:80px;height:80px;background:' + c + ';margin:4px;border-radius:4px" title="' + c + '"></div>').join('');
  showPage((p) => {
    p.innerHTML = '<h2>Color palette</h2><div>' + swatches + '</div><div class="sub">five random colors · say “show a color palette” for another</div>';
  });
  return 'palette';
}

export function suite() {
  return { ok: isPalette('show a color palette') && isPalette('random colors') && isPalette('give me a palette') && !isPalette('what is a palette') && !isPalette('show the map') };
}

export default {
  name: 'palette',
  examples: ['show a color palette', 'random colors', 'give me a palette'],
  nearMisses: ['what is a palette', 'show the map', 'make it blue'],
  match(lower, text) { return isPalette(text); },
  run,
  suite
};
