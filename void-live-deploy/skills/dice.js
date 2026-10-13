/**
 * dice skill — roll dice from the ask (no key; pure math)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a d20", "roll 2d6", "roll 3d10 + 4", "d6".
 * Shows each die and the total. Empty surface stays empty until asked.
 */
export function diceOf(text) {
  const t = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '');
  const m = t.match(/^(?:please\s+)?(?:roll\s+(?:a\s+|me\s+)?)?(?:(\d+)\s*)?d(\d+)(?:\s*([+-])\s*(\d+))?$/);
  if (!m) return null;
  const n = Math.max(1, Math.min(20, parseInt(m[1] || '1', 10)));
  const sides = parseInt(m[2], 10);
  if (sides < 2 || sides > 100) return null;
  const mod = m[3] && m[4] ? (m[3] === '-' ? -1 : 1) * parseInt(m[4], 10) : 0;
  return { n, sides, mod };
}
function roll(n, sides) {
  const dice = [];
  for (let i = 0; i < n; i++) dice.push(1 + Math.floor(Math.random() * sides));
  return dice;
}
function run(text, api) {
  const { showPage, esc } = api;
  const q = diceOf(text);
  if (!q) return 'none';
  const dice = roll(q.n, q.sides);
  const sum = dice.reduce((a, b) => a + b, 0) + q.mod;
  showPage((el) => {
    el.innerHTML = '<h2>Dice</h2><div class="sub">' + esc(q.n + 'd' + q.sides + (q.mod ? (q.mod > 0 ? '+' : '') + q.mod : '')) + '</div>'
      + '<div style="font-size:36px;font-weight:300;margin:8px 0">' + esc(dice.join(' + ')) + (q.mod ? ' ' + (q.mod > 0 ? '+' : '') + q.mod : '') + '</div>'
      + '<div style="font-size:48px;font-weight:200">' + esc(String(sum)) + '</div>'
      + '<div class="src">Rolled in the browser. Say “roll 2d6” for more.</div>';
  });
  return 'dice';
}
export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'roll 3d10', 'd6'],
  nearMisses: ['what is a die', 'history of dice', 'dice games'],
  match(lower, text) { return !!diceOf(text || lower); },
  run,
  suite() {
    const a = diceOf('roll a d20') && diceOf('roll a d20').n === 1 && diceOf('roll a d20').sides === 20;
    const b = diceOf('roll 2d6') && diceOf('roll 2d6').n === 2 && diceOf('roll 2d6').sides === 6;
    const c = !diceOf('what is a die');
    return { ok: !!(a && b && c), got: a && b && c ? 'pass' : 'fail' };
  }
};
