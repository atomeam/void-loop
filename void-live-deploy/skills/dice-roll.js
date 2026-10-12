/**
 * dice-roll skill — roll one or more dice
 * "roll a die", "roll the dice", "roll 2d6", "dice roll"
 */
export function diceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  if (/^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+)?(?:die|dice)|dice\s+roll)$/.test(t)) return { n: 1, sides: 6 };
  const m = t.match(/^(?:please\s+)?roll\s+(\d+)d(\d+)$/);
  if (m) {
    const n = +m[1], sides = +m[2];
    if (n >= 1 && n <= 20 && sides >= 2 && sides <= 100) return { n, sides };
  }
  return null;
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = diceOf(text);
  if (!q) return 'none';
  const rolls = Array.from({ length: q.n }, () => Math.floor(Math.random() * q.sides) + 1);
  const total = rolls.reduce((a, b) => a + b, 0);
  const label = q.n === 1 ? `d${q.sides}` : `${q.n}d${q.sides}`;
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:36px;text-align:center;margin:16px 0;font-weight:300">' + esc(rolls.join(' + ') + (q.n > 1 ? ' = ' + total : '')) + '</p><div class="sub">' + esc(label) + ' · say “roll the dice” for another</div>';
  });
  return 'dice-roll';
}
export default {
  name: 'dice-roll',
  examples: ['roll a die', 'roll the dice', 'roll 2d6', 'dice roll'],
  nearMisses: ['what are dice', 'roll the credits', 'dice game rules'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const ok = !!diceOf('roll a die') && !!diceOf('roll 2d6') && !diceOf('what are dice');
    return { ok, got: ok ? 'pass' : 'parse failed' };
  }
};
