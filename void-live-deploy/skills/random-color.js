/**
 * random-color skill — a random hex color with a swatch
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "give me a random color", "random color", "pick a color".
 */
export function isRandomColor(text) {
  return /^(?:please\s+)?(?:give\s+(?:me\s+)?(?:a\s+)?|pick\s+(?:a\s+)?)?(?:random\s+)?color$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const hex = randomHex();
  showPage((el) => {
    el.innerHTML = '<h2>Random color</h2>'
      + '<div style="width:120px;height:120px;background:' + hex + ';border-radius:8px;margin:12px auto;border:1px solid #333"></div>'
      + '<p style="font-size:28px;font-weight:700;text-align:center;font-family:ui-monospace,monospace">' + esc(hex) + '</p>'
      + '<div class="sub">say “another color” for a new one</div>';
  });
  return 'random-color';
}

export default {
  name: 'random-color',
  examples: ['give me a random color', 'random color', 'pick a color', 'another color'],
  nearMisses: ['color of the sky', 'what color is red', 'random fact'],
  match(lower, text) { return isRandomColor(text); },
  run,
  suite() {
    const ok = isRandomColor('give me a random color') && isRandomColor('random color') && !isRandomColor('color of the sky');
    return { ok, got: 'match works' };
  }
};
