/**
 * random-color skill — a random color with its hex and a simple name.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random color", "give me a color", "color me".
 * Empty surface stays empty.
 */
export function isRandomColor(text) {
  return /^(?:please\s+)?(?:(?:give\s+(?:me\s+)?(?:a\s+)?|show\s+(?:me\s+)?(?:a\s+)?)?(?:random\s+)?color|(?:another\s+)?color(?:\s+please)?|color\s+me)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

function colorName(hex) {
  // simple name based on hue-ish
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  if (r > 200 && g < 100 && b < 100) return 'red';
  if (g > 200 && r < 100 && b < 100) return 'green';
  if (b > 200 && r < 100 && g < 100) return 'blue';
  if (r > 200 && g > 200 && b < 100) return 'yellow';
  if (r > 150 && g < 100 && b > 150) return 'purple';
  if (r > 200 && g > 100 && b < 100) return 'orange';
  return 'a color';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const hex = randomHex();
  const name = colorName(hex);
  showPage((p) => {
    p.innerHTML = '<h2>A color</h2><div style="width:120px;height:120px;background:' + hex + ';border-radius:12px;margin:12px 0;border:1px solid rgba(255,255,255,.2)"></div><p style="font-size:22px;font-weight:300">' + esc(name) + ' &middot; ' + esc(hex) + '</p><div class="sub">say “another color” for one more</div>';
  });
  return 'random-color';
}

export default {
  name: 'random-color',
  examples: ['random color', 'give me a color', 'color me', 'another color'],
  nearMisses: ['what is a color', 'color theory', 'paint a wall'],
  match(lower, text) { return isRandomColor(text); },
  run,
  suite() {
    const ok = isRandomColor('random color') && isRandomColor('give me a color') && !isRandomColor('what is a color');
    return { ok, got: 'match works' };
  }
};
