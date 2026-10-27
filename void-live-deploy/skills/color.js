/**
 * color skill — a random color from a public API (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random color", "give me a color", "what's a random color".
 */
export function isColor(text) {
  return /^(?:please\s+)?(?:(?:give|show|tell)\s+(?:me\s+)?(?:a\s+)?(?:random\s+)?color|(?:random|a)\s+color|color(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>A color</h2><div class="sub">…</div>'; });
  try {
    const j = await fetch('https://www.thecolorapi.com/random?format=json', { headers: { accept: 'application/json' } }).then((r) => r.json());
    if (!api._pageStill(el)) return 'color';
    if (!j || !j.hex || !j.hex.value) throw 0;
    const hex = j.hex.value;
    const name = (j.name && j.name.value) || hex;
    el.innerHTML = '<h2>A color</h2><div style="background:' + esc(hex) + ';width:120px;height:120px;border-radius:12px;margin:12px 0"></div><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(name) + ' <code>' + esc(hex) + '</code></p><div class="sub">say “random color” for another</div>'
      + '<div class="src">Source: <a href="https://www.thecolorapi.com/" target="_blank" rel="noopener">The Color API</a></div>';
    return 'color';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>A color</h2><div style="background:#4a90e2;width:120px;height:120px;border-radius:12px"></div><p>#4a90e2</p>';
    return 'color';
  }
}

export default {
  name: 'color',
  examples: ['random color', 'give me a color', 'a color', 'show me a color'],
  nearMisses: ['what color is the sky', 'color theory', 'red color'],
  match(lower, text) { return isColor(text); },
  run,
  suite() {
    const ok = isColor('random color') && isColor('give me a color') && !isColor('what color is the sky');
    return { ok, got: 'match works' };
  }
};
