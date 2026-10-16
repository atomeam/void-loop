/**
 * dice skill — roll dice
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "dice roll", "3d20".
 * Pure rolls, empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (/^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:die|dice)|dice\s+roll)$/.test(t)) return { n: 1, sides: 6 };
  const m = t.match(/^(?:please\s+)?(?:roll\s+)?(\d+)d(\d+)$/);
  if (m) { const n = +m[1], s = +m[2]; if (n >= 1 && n <= 20 && s >= 2 && s <= 100) return { n, sides: s }; }
  return null;
}

function roll(n, sides) {
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

function run(text, api) {
  const { showPage, esc } = api;
  const q = diceOf(text);
  if (!q) return 'none';
  const r = roll(q.n, q.sides);
  const line = r.rolls.join(' + ') + ' = ' + r.total;
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:32px;font-weight:300;margin:8px 0">' + esc(q.n + 'd' + q.sides) + '</p><p style="font-size:24px">' + esc(line) + '</p><div class="sub">say “roll 2d6” or “roll a die” for another</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'dice roll', '3d20'],
  nearMisses: ['what is a die', 'dice game', 'roll the credits'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() { return { ok: !!diceOf('roll a die') && diceOf('2d6').n === 2 && !diceOf('hello') }; }
};
