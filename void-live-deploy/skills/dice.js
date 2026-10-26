/**
 * dice skill — roll NdM dice (crypto random, no network)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a d20", "roll 2d6", "dice roll", "roll dice".
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:roll\s+(?:a\s+)?dice|dice\s+roll|roll\s+dice)$/.test(t)) return { n: 1, sides: 6 };
  const m = /^(?:please\s+)?roll\s+(?:a\s+)?(?:(\d{1,2})\s*d\s*(\d{1,3})|d\s*(\d{1,3}))$/.exec(t);
  if (m) {
    const n = m[1] ? Math.min(20, Math.max(1, +m[1])) : 1;
    const sides = Math.min(100, Math.max(2, +(m[2] || m[3])));
    return { n, sides };
  }
  return null;
}

function roll(n, sides) {
  const a = new Uint32Array(n);
  crypto.getRandomValues(a);
  return Array.from(a, x => (x % sides) + 1);
}

async function run(text, api) {
  const want = diceOf(text);
  if (!want) return 'none';
  const { showPage, esc } = api;
  const rolls = roll(want.n, want.sides);
  const sum = rolls.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:28px;font-weight:700;letter-spacing:.05em">' + esc(rolls.join(' + ')) + (want.n > 1 ? ' = ' + sum : '') + '</p><div class="sub">' + want.n + 'd' + want.sides + '</div><div class="src">From this device’s secure random numbers, no network.</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'dice roll', 'roll dice', 'roll d6'],
  nearMisses: ['what is a dice', 'dice game', 'roll up'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const ok = diceOf('roll a d20') && diceOf('roll 2d6') && !diceOf('what is a dice');
    return { ok, got: 'match works' };
  }
};
