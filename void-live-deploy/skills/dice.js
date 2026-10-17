/**
 * dice skill — roll dice: "roll the dice", "roll 2d6", "roll a d20".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:roll\s+(?:the\s+)?dice)$/i);
  if (m) return { n: 1, d: 6 };
  m = t.match(/^roll\s+(\d*)d(\d+)$/i);
  if (m) return { n: parseInt(m[1] || '1', 10), d: parseInt(m[2], 10) };
  m = t.match(/^roll\s+a\s+d(\d+)$/i);
  if (m) return { n: 1, d: parseInt(m[1], 10) };
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const spec = diceOf(text);
  if (!spec) return 'none';
  const { n, d } = spec;
  if (n < 1 || n > 20 || d < 2 || d > 100) {
    showPage((p) => { p.innerHTML = '<h2>Dice</h2><p>Try between 1d2 and 20d100.</p>'; });
    return 'dice';
  }
  const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * d) + 1);
  const total = rolls.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Rolled ' + n + 'd' + d + '</h2><div class="sub">' + rolls.join(' + ') + ' = <b>' + total + '</b></div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll the dice', 'roll 2d6', 'roll a d20', 'roll 3d10'],
  nearMisses: ['dice game', 'play dice', 'what is a d20', 'roll over'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const s = diceOf('roll 2d6');
    return { ok: s && s.n === 2 && s.d === 6 && diceOf('roll the dice')?.d === 6 && diceOf('hello') === null };
  },
};
