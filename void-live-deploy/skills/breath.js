/**
 * breath skill — a simple box-breathing card (no key; pure)
 * "start box breathing", "breathe with me", "box breath", "start a breathing exercise".
 */
export function breathOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:start\s+)?(?:a\s+)?box\s+breath(?:ing)?$/i.test(t)) return true;
  if (/^(?:please\s+)?breathe\s+with\s+me$/i.test(t)) return true;
  if (/^(?:please\s+)?(?:start\s+)?(?:a\s+)?breathing\s+exercise$/i.test(t)) return true;
  if (/^box\s+breath$/i.test(t)) return true;
  return false;
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!breathOf(text)) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Box breathing</h2>'; });
  el.innerHTML = '<h2>Box breathing</h2>'
    + '<p>Inhale 4 · Hold 4 · Exhale 4 · Hold 4.</p>'
    + '<p style="font-size:22px;line-height:1.6;font-weight:300">Breathe in through the nose for four. Hold for four. Out through the mouth for four. Hold for four. Repeat.</p>'
    + '<div class="sub">four counts each side; nothing is published from this card</div>';
  return 'breath';
}

export default {
  name: 'breath',
  examples: ['start box breathing', 'breathe with me', 'box breath', 'start a breathing exercise'],
  nearMisses: ['what is breathing', 'how do lungs work', 'weather in Kyoto', 'make a clock'],
  breathOf,
  match(lower, text) { return breathOf(text); },
  run
};
