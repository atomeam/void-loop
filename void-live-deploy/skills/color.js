/**
 * color skill — a random color or a small palette, pure client-side
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random color", "color palette", "give me a color".
 */
export function isColor(text) {
  return /^(?:please\s+)?(?:(?:a\s+|another\s+|random\s+|give\s+me\s+(?:a\s+|another\s+)?)?(?:color|colour)(?:\s+palette)?|palette|random\s+hex)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function hex() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}

function run(text, api) {
  const { showPage, esc } = api;
  const palette = /palette/.test(String(text).toLowerCase());
  const colors = Array.from({ length: palette ? 5 : 1 }, hex);
  showPage((p) => {
    p.innerHTML = '<h2>' + (palette ? 'A palette' : 'A color') + '</h2>'
      + colors.map((c) => '<div style="background:' + c + ';height:60px;border-radius:8px;margin:8px 0;display:flex;align-items:center;justify-content:center;color:#fff;text-shadow:0 1px 2px #000;font-weight:600">' + esc(c) + '</div>').join('')
      + '<div class="sub">say “another color” or “color palette”</div><div class="src">Generated here on this device.</div>';
  });
  return 'color';
}

export default {
  name: 'color',
  examples: ['random color', 'color palette', 'give me a color', 'a colour'],
  nearMisses: ['what color is the sky', 'color theory', 'paint a color'],
  match(lower, text) { return isColor(text); },
  run,
  suite() {
    const ok = isColor('random color') && isColor('color palette') && !isColor('what color is the sky');
    return { ok, got: 'match works' };
  }
};
