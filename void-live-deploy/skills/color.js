/**
 * color skill — random color or hex to rgb (no key, pure)
 * "random color", "what color is #ff00aa", "hex #336699".
 */
function randomColor() {
  return '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
}
function hexToRgb(hex) {
  const m = /^#?([a-f\d]{6})$/i.exec(hex);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function isColor(text) {
  return /^(?:random|pick\s+a)\s+color$|^(?:what\s+color\s+is\s+)?#?[a-f\d]{6}$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
async function run(text, api) {
  const { showPage, esc } = api;
  const raw = String(text || '').trim();
  const hexMatch = raw.match(/#?([a-f\d]{6})/i);
  if (hexMatch) {
    const rgb = hexToRgb(hexMatch[1]);
    if (rgb) {
      showPage((p) => { p.innerHTML = '<h2>Color</h2><div style="width:120px;height:120px;background:#' + hexMatch[1] + ';border-radius:8px;margin:8px 0"></div><p>#' + hexMatch[1].toUpperCase() + ' → rgb(' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + ')</p>'; });
      return 'color';
    }
  }
  const hex = randomColor();
  showPage((p) => { p.innerHTML = '<h2>Random color</h2><div style="width:120px;height:120px;background:' + hex + ';border-radius:8px;margin:8px 0"></div><p>' + hex.toUpperCase() + '</p><div class="sub">say “another color” for one more</div>'; });
  return 'color';
}
function suite() {
  const ok = isColor('random color') && isColor('#ff00aa') && !isColor('what is color');
  return { ok, got: ok ? 'ok' : 'fail' };
}
export default {
  name: 'color',
  examples: ['random color', 'what color is #ff00aa', 'hex #336699'],
  nearMisses: ['what is a color', 'color theory', 'paint the walls'],
  match(lower, text) { return isColor(text); },
  run,
  suite
};
