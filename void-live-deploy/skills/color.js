/**
 * color skill — random color or hex
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random color", "give me a color", "hex color".
 */
export function isColor(text) {
  return /^(?:please\s+)?(?:(?:random|a|another)\s+color|color(?:\s+please)?|give\s+me\s+a\s+color|hex\s+color)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function randomHex() {
  return '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const hex = randomHex();
  showPage((p) => {
    p.innerHTML = '<h2>A color</h2><div style="width:120px;height:120px;background:' + hex + ';border-radius:12px;margin:12px auto;border:1px solid rgba(255,255,255,.2)"></div><p style="text-align:center;font-size:24px">' + esc(hex) + '</p><div class="sub">say “another color” for one more</div>';
  });
  return 'color';
}

export default {
  name: 'color',
  examples: ['random color', 'give me a color', 'hex color', 'another color'],
  nearMisses: ['what color is the sky', 'color picker', 'paint color'],
  match(lower, text) { return isColor(text); },
  run,
  suite() {
    const ok = isColor('random color') && isColor('give me a color') && !isColor('what color is the sky');
    return { ok, got: 'match works' };
  }
};
