/**
 * dice skill — roll dice with the device's crypto random (no network)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "roll dice", "roll a d20".
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = /^(?:roll|throw)\s+(?:me\s+)?(?:a\s+)?(?:(\d+)\s*d\s*(\d+)|(\d+)\s*dice|a\s+d(\d+)|a\s+die|dice)$/.exec(t);
  if (!m) return null;
  if (m[1] && m[2]) return { n: Math.min(20, +m[1] || 1), sides: Math.min(100, +m[2] || 6) };
  if (m[3]) return { n: Math.min(20, +m[3]), sides: 6 };
  if (m[4]) return { n: 1, sides: Math.min(100, +m[4] || 6) };
  return { n: 1, sides: 6 };
}

export function roll(sides = 6, rand = () => { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }) {
  return 1 + Math.floor(rand() * sides);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const ask = diceOf(text);
  if (!ask) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Dice</h2><div class="sub">…</div>'; });
  const results = Array.from({ length: ask.n }, () => roll(ask.sides));
  const total = results.reduce((a, b) => a + b, 0);
  el.innerHTML = '<h2>' + esc(ask.n + 'd' + ask.sides) + '</h2>'
    + '<div style="font-size:48px;font-weight:300;text-align:center;margin:12px 0">' + esc(results.join(' · ')) + '</div>'
    + (ask.n > 1 ? '<p style="text-align:center">Total: ' + total + '</p>' : '')
    + '<div class="sub">say “roll again” or “roll 2d6” for another</div>'
    + '<div class="src">Fair rolls from this device’s secure random numbers.</div>';
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll dice', 'roll 2d6', 'roll a d20', 'roll 3 dice'],
  nearMisses: ['dice the vegetables', 'what is a die', 'role a dice'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const ok = !!diceOf('roll a die') && diceOf('roll 2d6').n === 2 && diceOf('roll 2d6').sides === 6 && !diceOf('dice the vegetables');
    return { ok, got: 'match works' };
  }
};
