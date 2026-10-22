/**
 * random-color skill — give a random hex color
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random color", "give me a color", "pick a color".
 * Empty stage stays empty; the card shows the color swatch and hex.
 */
export function isColor(text) {
  return /^(?:please\s+)?(?:(?:give\s+me\s+)?(?:a\s+)?random\s+color|pick\s+(?:me\s+)?(?:a\s+)?color|random\s+hex)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

export function suite() {
  const ok = isColor('random color') && isColor('give me a color') && !isColor('what color is the sky');
  if (!ok) throw new Error('color match failed');
  return true;
}

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!isColor(text)) return 'none';
  const hex = randomHex();
  showPage((p) => {
    p.innerHTML = '<h2>Random color</h2><div style="width:120px;height:120px;background:' + hex + ';border-radius:8px;margin:16px auto;border:1px solid #333"></div><p style="font-size:24px;text-align:center;font-family:monospace">' + esc(hex) + '</p><div class="sub">say “random color” for another</div>';
  });
  return 'random-color';
}

export default {
  name: 'random-color',
  examples: ['random color', 'give me a color', 'pick a color'],
  nearMisses: ['what color is blue', 'color theory', 'hex to rgb'],
  match(lower, text) { return isColor(text); },
  run,
  suite,
};
