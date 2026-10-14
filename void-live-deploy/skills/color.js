/**
 * color skill — a random color as a swatch (no key; pure local)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random color", "give me a color", "a random color".
 */
export function isColor(text) {
  return /^(?:please\s+)?(?:give\s+me\s+|show\s+me\s+|pick\s+|generate\s+|make\s+)?(?:a\s+|another\s+)?(?:random\s+)?color(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

export function hex(rnd = Math.random) {
  return '#' + Math.floor(rnd() * 0xffffff).toString(16).padStart(6, '0');
}

async function run(text, api) {
  const { showPage, esc } = api;
  const c = hex();
  showPage((p) => {
    p.innerHTML = '<h2>A color</h2><div style="width:140px;height:140px;border-radius:16px;background:' + c + ';margin:14px 0;box-shadow:0 8px 24px rgba(0,0,0,.35)"></div><p style="font-size:28px;font-weight:300;letter-spacing:1px">' + esc(c) + '</p><div class="sub">say “random color” for another</div>';
  });
  return 'color';
}

export default {
  name: 'color',
  examples: ['random color', 'give me a color', 'a random color', 'pick a color'],
  nearMisses: ['what color is the sky', 'define color', 'paint the wall blue', 'what is a color'],
  match(lower, text) { return isColor(text); },
  run,
  suite() {
    const matched = isColor('random color') && isColor('give me a color') && isColor('a random color') && !isColor('what is a color');
    const h = hex(() => 0.5);
    return { ok: matched && h === '#7fffff', got: matched ? h : 'match failed' };
  }
};
