/**
 * color skill — a random color (local hex + swatch, no network)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random color", "give me a color", "color of the day".
 */
export function isColor(text) {
  return /^(?:please\s+)?(?:(?:give\s+me\s+|tell\s+me\s+|show\s+me\s+)?(?:a\s+|another\s+|random\s+|new\s+)?color(?:\s+please)?|color\s+of\s+the\s+day|random\s+colour)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function hex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const h = hex();
  showPage((p) => {
    p.innerHTML = '<h2>A color</h2><div style="width:160px;height:160px;border-radius:12px;background:' + esc(h) + ';margin:12px 0;border:1px solid #333"></div><p style="font-size:24px;font-family:ui-monospace,monospace;font-weight:300">' + esc(h) + '</p><div class="sub">say “another color” for one more</div>';
  });
  return 'color';
}

export default {
  name: 'color',
  examples: ['random color', 'give me a color', 'color of the day', 'another color'],
  nearMisses: ['what is color', 'color theory', 'hex color picker'],
  match(lower, text) { return isColor(text); },
  run,
  suite() {
    const ok = isColor('random color') && isColor('give me a color') && !isColor('what is color');
    return { ok, got: 'match works' };
  }
};
