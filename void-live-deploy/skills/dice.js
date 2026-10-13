/**
 * dice skill — roll one or more dice
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite }
 * "roll a die", "roll the dice", "roll 2d6", "roll 3d20".
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:please\s+)?roll\s+(?:a\s+)?(\d+)d(\d+)(?:\s+(?:dice|die))?$/);
  if (m) return { n: Math.min(20, parseInt(m[1], 10) || 1), sides: Math.min(100, parseInt(m[2], 10) || 6) };
  m = t.match(/^(?:please\s+)?(?:roll\s+(?:the\s+)?dice|roll\s+(?:a\s+)?die|dice\s+roll|roll\s+dice)$/);
  if (m) return { n: 1, sides: 6 };
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const d = diceOf(text);
  if (!d) return 'none';
  const rolls = [];
  for (let i = 0; i < d.n; i++) rolls.push(1 + Math.floor(Math.random() * d.sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  const list = rolls.join(', ');
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:36px;font-weight:300;line-height:1.1">' + esc(list) + '</p>'
      + (d.n > 1 ? '<p>total ' + total + '</p>' : '')
      + '<div class="sub">' + d.n + 'd' + d.sides + ' · say “roll the dice” for another</div>';
  });
  return 'dice';
}

export function suite() {
  const one = diceOf('roll a die');
  const two = diceOf('roll 2d6');
  const three = diceOf('roll 3d20');
  return { ok: one && one.n === 1 && one.sides === 6 && two && two.n === 2 && two.sides === 6 && three && three.n === 3 && three.sides === 20 && !diceOf('what is a die') && !diceOf('roll over') };
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll the dice', 'roll 2d6'],
  nearMisses: ['what is a die', 'roll the window down', 'dice game'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite
};
