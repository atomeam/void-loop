/**
 * dice skill — roll dice. "roll a die", "roll 2d6", "dice".
 * Empty surface stays empty; the result is a page card that stays until closed.
 * No network. Nothing is published.
 */
export function diceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:roll\s+)?(?:a\s+|the\s+|some\s+)?dice?$/i.test(t)) return { n: 1, sides: 6 };
  if (/^(?:please\s+)?roll\s+(?:the\s+)?die$/i.test(t)) return { n: 1, sides: 6 };
  const m = t.match(/^(?:please\s+)?roll\s+(\d+)d(\d+)$/i);
  if (m) {
    const n = Math.min(20, Math.max(1, +m[1]));
    const sides = Math.min(100, Math.max(2, +m[2]));
    return { n, sides };
  }
  if (/^(?:please\s+)?roll\s+(?:the\s+)?d(\d+)$/i.test(t)) {
    const sides = Math.min(100, Math.max(2, +RegExp.$1));
    return { n: 1, sides };
  }
  return null;
}
export function rollDice(n, sides) {
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  const sum = rolls.reduce((a, b) => a + b, 0);
  return { rolls, sum, n, sides };
}
async function run(text, api) {
  const { showPage, esc } = api;
  const hit = diceOf(text);
  if (!hit) return 'none';
  const { rolls, sum, n, sides } = rollDice(hit.n, hit.sides);
  const face = n === 1 ? String(rolls[0]) : rolls.join(' + ') + ' = ' + sum;
  const title = n === 1 ? 'Die' : n + 'd' + sides;
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(title) + '</h2>'
      + '<p style="font-size:32px;font-weight:600;line-height:1.1">' + esc(face) + '</p>'
      + '<div class="sub">say “roll a die” or “roll 2d6” for another</div>'
      + '<div class="src">Nothing is published from this card.</div>';
  });
  return 'dice';
}
export default {
  name: 'dice',
  examples: ['roll a die', 'roll the dice', 'dice', 'roll 2d6', 'roll d20'],
  nearMisses: ['what is a die', 'dice game', 'roll the dice in monopoly', 'weather in Kyoto'],
  diceOf,
  rollDice,
  match(lower, text) { return !!diceOf(text); },
  run
};
