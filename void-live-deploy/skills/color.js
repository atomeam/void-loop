/**
 * color skill — pick a random color
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "pick a color", "random color", "what color", "give me a color".
 * Shows hex and a swatch. Empty surface stays empty.
 */
export function isColor(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  return /^(?:please\s+)?(?:pick\s+(?:a\s+)?color|random\s+color|what\s+color|give\s+me\s+a\s+color|color\s+please)$/.test(t);
}

function randomHex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

function run(text, api) {
  const { showPage, esc } = api;
  const hex = randomHex();
  showPage((p) => {
    p.innerHTML = '<h2>A color</h2><div style="width:120px;height:120px;border-radius:12px;background:' + hex + ';margin:12px 0;border:1px solid rgba(255,255,255,.2)"></div><p style="font-size:28px;font-weight:300">' + esc(hex) + '</p><div class="sub">say “pick a color” for another</div>';
  });
  return 'color';
}

export default {
  name: 'color',
  examples: ['pick a color', 'random color', 'what color', 'give me a color'],
  nearMisses: ['what is color', 'color theory', 'hex color'],
  match(lower, text) { return isColor(text); },
  run,
  suite() { return { ok: isColor('pick a color') && !isColor('blue') }; }
};
