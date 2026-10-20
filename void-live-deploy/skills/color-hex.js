/**
 * color-hex skill — turn a hex color into RGB.
 * "hex to rgb #ff0000", "what color is #336699", "rgb of #00ff00".
 * Empty surface stays empty: only answers when a hex is given.
 */
export function hexToRgb(hex) {
  const h = String(hex || '').replace(/^#/, '').trim();
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

export function colorOf(text) {
  const m = String(text || '').match(/#?([0-9a-f]{6})/i);
  return m ? '#' + m[1].toLowerCase() : null;
}

function run(text, api) {
  const { showPage, esc } = api;
  const hex = colorOf(text);
  const rgb = hexToRgb(hex);
  if (!rgb) {
    showPage((p) => { p.innerHTML = '<h2>Color</h2><p>Give a hex like #ff0000.</p>'; });
    return 'color-hex';
  }
  showPage((p) => {
    p.innerHTML = '<h2>Color ' + esc(hex) + '</h2>'
      + '<div style="width:80px;height:80px;background:' + esc(hex) + ';border-radius:8px;margin:8px 0"></div>'
      + '<p>RGB: ' + rgb.r + ', ' + rgb.g + ', ' + rgb.b + '</p>'
      + '<div class="sub">say another hex</div>';
  });
  return 'color-hex';
}

export default {
  name: 'color-hex',
  examples: ['hex to rgb #ff0000', 'what color is #336699', 'rgb of #00ff00'],
  nearMisses: ['color theory', 'paint the wall red', 'what is rgb'],
  match(lower, text) { return !!colorOf(text) && /hex|rgb|color/i.test(String(text || '')); },
  run,
  suite() {
    const rgb = hexToRgb('#ff0000');
    return { ok: rgb && rgb.r === 255 && rgb.g === 0 && rgb.b === 0 && colorOf('hex #00ff00') === '#00ff00' && hexToRgb('zz') === null };
  },
};
