/**
 * dice skill — roll dice (asked by Grok for growth).
 * "roll 2d6", "roll a d20", "3d8+2".
 * Pure; empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:roll\s+)?(\d+)?d(\d+)(?:\s*\+\s*(\d+))?$/);
  if (!m) return null;
  const n = Math.min(20, Math.max(1, parseInt(m[1] || '1', 10)));
  const sides = Math.min(100, Math.max(2, parseInt(m[2], 10)));
  const mod = parseInt(m[3] || '0', 10);
  return { n, sides, mod };
}

export function rollDice({ n, sides, mod }) {
  const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
  const sum = rolls.reduce((a, b) => a + b, 0) + mod;
  return { rolls, sum, total: sum };
}

function run(text, api) {
  const { showPage, esc } = api;
  const q = diceOf(text);
  if (!q) return 'none';
  const r = rollDice(q);
  showPage((el) => {
    el.innerHTML = '<h2>Dice roll</h2><div class="sub">' + esc(q.n + 'd' + q.sides + (q.mod ? '+' + q.mod : '')) + '</div>'
      + '<div style="font-size:32px">' + r.rolls.join(' + ') + (q.mod ? ' + ' + q.mod : '') + ' = <b>' + r.sum + '</b></div>'
      + '<div class="src">Rolled in this browser · nothing sent</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll 2d6', 'roll a d20', '3d8+2'],
  nearMisses: ['dice game', 'what is a die', 'roll credits'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const q = diceOf('2d6');
    const r = rollDice({ n: 1, sides: 6, mod: 0 });
    return { ok: q && q.n === 2 && q.sides === 6 && r.rolls.length === 1 && r.sum >= 1 && r.sum <= 6 && diceOf('hello') === null };
  },
};
