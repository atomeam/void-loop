/**
 * color skill — a random hex color (pure, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite() }
 * "random color", "give me a color", "hex color".
 * Empty surface stays empty.
 */
function isColor(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:(?:a\s+|give\s+me\s+|show\s+me\s+)?(?:random\s+)?(?:hex\s+)?color|random\s+hex|hex\s+color)$/.test(t);
}

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!isColor(text)) return 'none';
  const hex = randomHex();
  showPage((p) => {
    p.innerHTML = '<h2>A color</h2><div style="width:120px;height:120px;background:' + hex + ';border-radius:8px;margin:10px 0"></div><div style="font-size:28px;font-weight:300">' + esc(hex) + '</div><div class="sub">say “another color”</div>';
  });
  return 'color';
}

export default {
  name: 'color',
  examples: ['random color', 'hex color', 'give me a color'],
  nearMisses: ['what is color', 'color theory', 'rgb values'],
  match(lower, text) { return isColor(text); },
  run,
  suite() {
    const hex = randomHex();
    if (!/^#[0-9a-f]{6}$/.test(hex)) return { ok: false, got: 'bad hex' };
    return { ok: true };
  }
};
