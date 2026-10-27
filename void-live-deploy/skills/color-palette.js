/**
 * color-palette skill — a random color palette (local generation, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "color palette", "give me a palette", "random colors".
 */
export function isPalette(text) {
  return /^(?:please\s+)?(?:(?:give\s+(?:me\s+)?)?(?:a\s+|another\s+|random\s+)?(?:color\s+)?palette|random\s+colors?|palette(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function hslToHex(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const base = Math.floor(Math.random() * 360);
  const colors = [0, 30, 60, 150, 210].map(offset => hslToHex((base + offset) % 360, 60 + Math.random() * 30, 45 + Math.random() * 20));
  const swatches = colors.map(c => '<div style="display:inline-block;width:60px;height:60px;background:' + c + ';margin:4px;border-radius:6px;border:1px solid rgba(255,255,255,.2)" title="' + c + '"></div>').join('');
  const el = showPage((p) => {
    p.innerHTML = '<h2>A color palette</h2><div>' + swatches + '</div><p style="font-family:monospace;font-size:14px">' + esc(colors.join(' ')) + '</p><div class="sub">say “another palette” for one more</div>';
  });
  return 'color-palette';
}

export default {
  name: 'color-palette',
  examples: ['color palette', 'give me a palette', 'random colors', 'another palette'],
  nearMisses: ['what is a palette', 'color theory', 'paint colors'],
  match(lower, text) { return isPalette(text); },
  run,
  suite() {
    const ok = isPalette('color palette') && isPalette('random colors') && !isPalette('what is a palette');
    return { ok, got: 'match works' };
  }
};
