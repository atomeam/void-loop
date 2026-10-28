/**
 * color skill — a random color with name, hex, and CSS sample (pure, no API)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random color", "give me a color", "pick a color".
 */
const COLORS = [
  { name: 'Crimson', hex: '#DC143C' },
  { name: 'Teal', hex: '#008080' },
  { name: 'Gold', hex: '#FFD700' },
  { name: 'Indigo', hex: '#4B0082' },
  { name: 'Coral', hex: '#FF7F50' },
  { name: 'Olive', hex: '#808000' },
  { name: 'Magenta', hex: '#FF00FF' },
  { name: 'Navy', hex: '#000080' },
  { name: 'Lime', hex: '#00FF00' },
  { name: 'Maroon', hex: '#800000' },
  { name: 'Sky Blue', hex: '#87CEEB' },
  { name: 'Chocolate', hex: '#D2691E' }
];
export function isColor(text) {
  return /^(?:please\s+)?(?:(?:give\s+me\s+|pick\s+|show\s+me\s+)?(?:a\s+|another\s+|random\s+)?color|random\s+color|color\s+please)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const c = COLORS[Math.floor(Math.random() * COLORS.length)];
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(c.name) + '</h2><div style="width:120px;height:120px;background:' + c.hex + ';border-radius:16px;margin:16px 0;box-shadow:0 4px 12px rgba(0,0,0,.3)"></div><p style="font-size:20px;font-family:monospace">' + esc(c.hex) + '</p><div class="sub">say “another color” for one more</div>';
  });
  return 'color';
}

export default {
  name: 'color',
  examples: ['random color', 'give me a color', 'pick a color', 'another color'],
  nearMisses: ['what color is the sky', 'color theory', 'paint colors'],
  match(lower, text) { return isColor(text); },
  run,
  suite() {
    const ok = isColor('random color') && isColor('give me a color') && !isColor('what color is the sky');
    return { ok, got: 'match works' };
  }
};
