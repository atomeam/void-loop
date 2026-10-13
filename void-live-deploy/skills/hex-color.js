/**
 * hex-color skill — "what is the hex for red", "hex for blue", "color hex of green".
 * Empty surface stays empty: shows the hex on a page. A small built-in map, no network.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

const COLORS = {
  red: '#ff0000', blue: '#0000ff', green: '#008000', yellow: '#ffff00', black: '#000000',
  white: '#ffffff', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', brown: '#a52a2a',
  gray: '#808080', grey: '#808080', cyan: '#00ffff', magenta: '#ff00ff'
};

export function hexOf(text) {
  const t = CLEAN(text);
  const m = t.match(/^(?:please\s+)?(?:what(?:\'s| is)\s+the\s+)?(?:hex(?:\s+code)?\s+(?:for|of)\s+|color\s+hex\s+(?:for|of)\s+)([a-z]+)$/);
  if (m && COLORS[m[1]]) return { name: m[1], hex: COLORS[m[1]] };
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const hit = hexOf(text);
  if (!hit) return 'none';
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(hit.name) + '</h2><p style="font-size:32px;font-weight:300;background:' + hit.hex + ';color:#000;padding:12px;border-radius:8px">' + hit.hex + '</p>'
      + '<div class="sub">say “hex for blue” for another</div>';
  });
  return 'hex-color';
}

export default {
  name: 'hex-color',
  examples: ['what is the hex for red', 'hex for blue', 'color hex of green'],
  nearMisses: ['what is red', 'hex dump', 'color theory'],
  match(lower, text) { return !!hexOf(text || lower); },
  run,
  suite() {
    const red = hexOf('what is the hex for red');
    const blue = hexOf('hex for blue');
    const miss = hexOf('what is red');
    const ok = red && red.hex === '#ff0000' && blue && blue.hex === '#0000ff' && !miss;
    return { ok, got: ok ? 'hexes' : 'miss' };
  }
};
