/**
 * random-color skill — a random color with hex, RGB and a preview swatch
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random color", "give me a color", "another color".
 */
export function isRandomColor(text) {
  return /^(?:please\s+)?(?:(?:give|show)\s+(?:me\s+)?(?:a|another|one\s+more)\s+color|(?:another|a|random)\s+color|color(?:\s+please)?|what\s+color)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const hex = randomHex();
  const rgb = hexToRgb(hex);
  showPage((p) => {
    p.innerHTML = '<h2>A color</h2><div style="width:120px;height:120px;background:' + hex + ';border-radius:8px;margin:12px 0"></div>'
      + '<p style="font-size:22px;font-weight:300">' + esc(hex.toUpperCase()) + '</p>'
      + '<p>rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')</p>'
      + '<div class="sub">say “another color” for one more</div>';
  });
  return 'random-color';
}

export default {
  name: 'random-color',
  examples: ['random color', 'give me a color', 'another color'],
  nearMisses: ['what color is the sky', 'color theory', 'red color'],
  match(lower, text) { return isRandomColor(text); },
  run,
  suite() {
    const ok = isRandomColor('random color') && isRandomColor('give me a color') && !isRandomColor('what color is the sky');
    return { ok, got: 'match works' };
  }
};
