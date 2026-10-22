/**
 * dice skill — roll dice on ask.
 * "roll a die", "roll 2d6", "dice".
 * Empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  const m = t.match(/^(?:roll\s+)?(?:a\s+)?(\d+)?d(\d+)(?:\s+dice)?$|^roll\s+a\s+die$|^dice$/);
  if (!m) return null;
  if (t === 'roll a die' || t === 'dice') return { n: 1, sides: 6 };
  const n = m[1] ? Number(m[1]) : 1, sides = Number(m[2]);
  return (n >= 1 && n <= 20 && sides >= 2 && sides <= 100) ? { n, sides } : null;
}

function roll(n, sides) {
  const rolls = []; let total = 0;
  for (let i = 0; i < n; i++) { const r = 1 + Math.floor(Math.random() * sides); rolls.push(r); total += r; }
  return { rolls, total };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const want = diceOf(text);
  if (!want) return 'none';
  const { rolls, total } = roll(want.n, want.sides);
  const shown = want.n > 1 ? rolls.join(' + ') + ' = ' + total : String(total);
  showPage((p) => { p.innerHTML = '<h2>Dice</h2><p style="font-size:28px;line-height:1.3;font-weight:400">' + esc(shown) + '</p><div class="sub">' + want.n + 'd' + want.sides + '</div>'; });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'dice'],
  nearMisses: ['what is a die', 'dice games', 'how to roll'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const one = diceOf('roll a die'), two = diceOf('roll 2d6'), bad = diceOf('roll 99d1000');
    const ok = one && one.n === 1 && one.sides === 6 && two && two.n === 2 && two.sides === 6 && !bad;
    return { ok };
  },
};
