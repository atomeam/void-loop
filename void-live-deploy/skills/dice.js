/**
 * dice skill — roll dice, local only (no API, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "2d20+5", "dice".
 * Empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  let m = t.match(/^(?:roll\s+)?(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/);
  if (m) return { n: Math.min(+m[1], 20), sides: Math.min(+m[2], 100), mod: +(m[3] || 0) };
  if (/^(?:roll\s+(?:a\s+)?(?:die|dice)|dice\s+roll|roll\s+dice)$/.test(t)) return { n: 1, sides: 6, mod: 0 };
  return null;
}

function roll(n, sides) {
  const rolls = [];
  let sum = 0;
  for (let i = 0; i < n; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    sum += r;
  }
  return { rolls, sum };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const spec = diceOf(text);
  if (!spec) return 'none';
  const { rolls, sum } = roll(spec.n, spec.sides);
  const total = sum + spec.mod;
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:28px;font-weight:300">' + esc(rolls.join(' + ')) + (spec.mod ? ' + ' + spec.mod : '') + ' = ' + total + '</p>'
      + '<div class="sub">' + spec.n + 'd' + spec.sides + (spec.mod ? '+' + spec.mod : '') + '</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', '2d20+5'],
  nearMisses: ['what are dice', 'dice game', 'how to play dice'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const s = diceOf('roll 2d6');
    return { ok: !!s && s.n === 2 && s.sides === 6 && diceOf('2d20+5') && !diceOf('hello') };
  },
};
