/**
 * color skill — show a color from a name or hex (no key)
 * "show me blue", "what color is #ff00aa", "color chartreuse"
 */
const NAMED = {
  red: '#ff0000', green: '#00ff00', blue: '#0000ff', yellow: '#ffff00', cyan: '#00ffff', magenta: '#ff00ff',
  black: '#000000', white: '#ffffff', orange: '#ffa500', purple: '#800080', pink: '#ffc0cb', brown: '#a52a2a',
  gray: '#808080', grey: '#808080', lime: '#00ff00', navy: '#000080', teal: '#008080', olive: '#808000',
  maroon: '#800000', silver: '#c0c0c0', gold: '#ffd700', chartreuse: '#7fff00', coral: '#ff7f50',
  crimson: '#dc143c', indigo: '#4b0082', khaki: '#f0e68c', lavender: '#e6e6fa', salmon: '#fa8072',
  turquoise: '#40e0d0', violet: '#ee82ee'
};

export function colorOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const hex = t.match(/^(?:please\s+)?(?:show\s+(?:me\s+)?(?:the\s+)?(?:color\s+)?|what\s+color\s+is\s+|color\s+)(#?[0-9a-f]{3,8})$/i);
  if (hex) {
    let h = hex[1].toLowerCase();
    if (!h.startsWith('#')) h = '#' + h;
    if (/^#[0-9a-f]{3}$/.test(h) || /^#[0-9a-f]{6}$/.test(h) || /^#[0-9a-f]{8}$/.test(h)) return { hex: h, name: null };
  }
  const name = t.match(/^(?:please\s+)?(?:show\s+(?:me\s+)?(?:the\s+)?(?:color\s+)?|what\s+color\s+is\s+|color\s+)([a-z]+)$/i);
  if (name && NAMED[name[1].toLowerCase()]) return { hex: NAMED[name[1].toLowerCase()], name: name[1].toLowerCase() };
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const hit = colorOf(text);
  if (!hit) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Color</h2><div class="sub">…</div>'; });
  if (!api._pageStill(el)) return 'color';
  const label = hit.name ? hit.name + ' (' + hit.hex + ')' : hit.hex;
  el.innerHTML = '<h2>' + esc(label) + '</h2><div style="width:180px;height:180px;margin:16px auto;border-radius:8px;background:' + hit.hex + ';border:1px solid #444"></div><div class="sub">say another color name or hex</div>';
  return 'color';
}

export function suite() {
  const c = colorOf('show me blue');
  if (!c || c.hex !== '#0000ff' || c.name !== 'blue') return { ok: false, got: 'blue' };
  const h = colorOf('what color is #ff00aa');
  if (!h || h.hex !== '#ff00aa') return { ok: false, got: 'hex' };
  return { ok: true };
}

export default {
  name: 'color',
  examples: ['show me blue', 'what color is #ff00aa', 'color chartreuse'],
  nearMisses: ['what is a color', 'define blue', 'draw a blue circle'],
  match(lower, text) { return !!colorOf(text); },
  run,
  suite
};
