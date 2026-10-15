/**
 * dice skill — roll dice: "roll a d6", "roll 2d20", "dice roll", "roll the dice".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:roll\s+)?(\d+)?d(\d+)(?:\s*\+\s*(\d+))?$/) || t.match(/^(?:roll\s+(?:a\s+|the\s+)?)?dice$/);
  if (!m) return null;
  if (m[0].includes('dice')) return { n: 1, sides: 6, mod: 0 };
  const n = parseInt(m[1] || '1', 10);
  const sides = parseInt(m[2], 10);
  const mod = parseInt(m[3] || '0', 10);
  if (n < 1 || n > 20 || sides < 2 || sides > 100) return null;
  return { n, sides, mod };
}
function roll(n, sides) {
  let sum = 0, rolls = [];
  for (let i = 0; i < n; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    sum += r;
  }
  return { sum, rolls };
}
async function run(text, api) {
  const { showPage, esc } = api;
  const d = diceOf(text);
  if (!d) return 'none';
  const { sum, rolls } = roll(d.n, d.sides);
  const total = sum + d.mod;
  const detail = d.n > 1 ? ' (' + rolls.join(' + ') + ')' : '';
  const modStr = d.mod ? (d.mod > 0 ? ' + ' + d.mod : ' ' + d.mod) : '';
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:28px;font-weight:300">' + esc(String(total)) + '</p>'
      + '<div class="sub">' + d.n + 'd' + d.sides + detail + modStr + '</div>';
  });
  return 'dice';
}
export default {
  name: 'dice',
  examples: ['roll a d6', 'roll 2d20', 'dice roll', 'roll the dice', '1d20+5'],
  nearMisses: ['dice game', 'what is a die', 'board games'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    return { ok: diceOf('roll 2d6') && diceOf('roll 2d6').n === 2 && diceOf('hello') === null };
  },
};
