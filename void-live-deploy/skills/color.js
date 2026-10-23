/**
 * color skill — mix colors or show a color. "mix red and blue", "what color is #ff0000", "show me purple".
 */
const COLORS = { red: '#ff0000', green: '#00ff00', blue: '#0000ff', yellow: '#ffff00', purple: '#800080', orange: '#ffa500', black: '#000000', white: '#ffffff', cyan: '#00ffff', magenta: '#ff00ff' };

export function isColor(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:mix\s+\w+\s+and\s+\w+|what\s+color\s+is\s+#?[0-9a-f]{3,6}|show\s+(?:me\s+)?(?:a\s+)?\w+\s+color|color\s+\w+)$/.test(t);
}

function mix(c1, c2) {
  const a = COLORS[c1] || c1, b = COLORS[c2] || c2;
  if (!a.startsWith('#') || !b.startsWith('#')) return null;
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const r = ((pa >> 16) + (pb >> 16)) / 2 | 0;
  const g = (((pa >> 8) & 0xff) + ((pb >> 8) & 0xff)) / 2 | 0;
  const bl = ((pa & 0xff) + (pb & 0xff)) / 2 | 0;
  return '#' + ((r << 16) | (g << 8) | bl).toString(16).padStart(6, '0');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Color</h2><div class="sub">mixing…</div>'; });
  const t = String(text || '').trim().toLowerCase();
  let html = '<h2>Color</h2>', hex = null;
  const mixM = t.match(/mix\s+(\w+)\s+and\s+(\w+)/);
  if (mixM) {
    hex = mix(mixM[1], mixM[2]);
    html += '<p>Mixed ' + esc(mixM[1]) + ' and ' + esc(mixM[2]) + '</p>';
  } else {
    const m = t.match(/#?([0-9a-f]{6})/);
    hex = m ? '#' + m[1] : (COLORS[t.split(' ').pop()] || null);
  }
  if (hex) html += '<div style="width:120px;height:120px;background:' + hex + ';border-radius:8px;margin:10px 0"></div><p>' + esc(hex) + '</p>';
  else html += '<p>Try "mix red and blue" or "show me purple".</p>';
  if (api._pageStill && !api._pageStill(el)) return 'color';
  el.innerHTML = html;
  return 'color';
}

export default {
  name: 'color',
  examples: ['mix red and blue', 'show me purple', 'what color is #ff0000'],
  nearMisses: ['what is color', 'color theory', 'paint color'],
  match(lower, text) { return isColor(text); },
  run,
  suite() {
    const ok = isColor('mix red and blue') && mix('red', 'blue') && !isColor('paint color');
    return { ok, got: 'match and mix work' };
  }
};
