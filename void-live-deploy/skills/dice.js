/**
 * dice skill — roll a die or dice
 * "roll a die", "roll a d6", "roll 2d6", "random number 1 to 6".
 * Empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:die|dice)|roll\s+(\d+)?d(\d+)|random\s+number\s+(?:from\s+|between\s+)?(\d+)\s+(?:to|and)\s+(\d+))$/i);
  if (!m) return null;
  if (m[3] && m[4]) return { count: 1, sides: Math.max(1, Math.min(100, parseInt(m[4], 10))), min: parseInt(m[3], 10) };
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = m[2] ? parseInt(m[2], 10) : 6;
  if (count < 1 || count > 10 || sides < 2 || sides > 100) return null;
  return { count, sides };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const d = diceOf(text);
  if (!d) return 'none';
  const rolls = [];
  for (let i = 0; i < d.count; i++) rolls.push(1 + Math.floor(Math.random() * d.sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  const label = d.count === 1 ? 'd' + d.sides : d.count + 'd' + d.sides;
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:28px;font-weight:300;text-align:center">' + esc(rolls.join(' + ')) + (d.count > 1 ? ' = ' + total : '') + '</p><div class="sub">' + esc(label) + '</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll a d6', 'roll 2d6', 'random number 1 to 20'],
  nearMisses: ['what is a die', 'dice game', 'random fact', 'number of days'],
  match(lower, text) { return !!diceOf(text); },
  run
};
