/**
 * color skill — a random color with a swatch and hex (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random color", "pick a color", "give me a color".
 */
export function isColor(text) {
  return /^(?:please\s+)?(?:(?:give\s+me\s+|pick\s+|show\s+me\s+)?(?:a\s+)?(?:random\s+)?color|(?:another|a|random)\s+color|color(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

async function run(text, api) {
  const { showPage, esc } = api;
  const hex = randomHex();
  const rgb = hexToRgb(hex);
  const el = showPage((p) => {
    p.innerHTML = '<h2>A color</h2><div style="width:120px;height:120px;background:' + hex + ';border-radius:12px;margin:12px 0;border:1px solid rgba(255,255,255,.2)"></div><p style="font-size:28px;font-weight:300;letter-spacing:1px">' + esc(hex.toUpperCase()) + '</p><div class="sub">RGB ' + rgb.join(', ') + '</div><div class="sub">say “another color” for one more</div>';
  });
  return 'color';
}

export default {
  name: 'color',
  examples: ['random color', 'pick a color', 'give me a color', 'another color'],
  nearMisses: ['what color is the sky', 'color theory', 'paint a color'],
  match(lower, text) { return isColor(text); },
  run,
  suite() {
    const ok = isColor('random color') && isColor('pick a color') && !isColor('what color is the sky');
    return { ok, got: 'match works' };
  }
};
