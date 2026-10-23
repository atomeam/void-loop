/**
 * hexcolor skill — a random hex color (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "random color", "give me a hex color", "hex color".
 */
export function isHexColor(text) {
  return /^(?:please\\s+)?(?:(?:random|a|another)\\s+(?:hex\\s+)?color|hex\\s+color|give\\s+me\\s+(?:a\\s+)?(?:hex\\s+)?color)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const hex = '#' + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0');
  const el = showPage((p) => { p.innerHTML = '<h2>A color</h2><div class="sub">…</div>'; });
  if (!api._pageStill(el)) return 'hexcolor';
  el.innerHTML = '<h2>A color</h2><div style="width:120px;height:120px;background:' + hex + ';border-radius:12px;margin:12px 0"></div><p style="font-size:22px;font-family:monospace">' + esc(hex) + '</p><div class="sub">say “another color” for one more</div>';
  return 'hexcolor';
}

export default {
  name: 'hexcolor',
  examples: ['random color', 'hex color', 'give me a hex color', 'another color'],
  nearMisses: ['what is a color', 'color theory', 'paint a color'],
  match(lower, text) { return isHexColor(text); },
  run,
  suite() {
    const ok = isHexColor('random color') && isHexColor('hex color') && !isHexColor('color theory');
    return { ok, got: 'match works' };
  }
};
