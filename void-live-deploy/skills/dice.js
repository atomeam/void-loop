/**
 * dice skill — roll dice. "roll a d20", "roll 2d6", "roll dice".
 * Empty surface stays empty. Pure match; run shows the roll on a card.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:roll|throw)\s+(?:a\s+|an\s+)?(\d+)?d(\d+)$/) || t.match(/^(?:roll|throw)\s+dice$/);
  if (m) return { n: m[1] ? +m[1] : 1, sides: m[2] ? +m[2] : 6 };
  if (/^roll\s+dice$/.test(t)) return { n: 1, sides: 6 };
  return null;
}

function roll(n, sides) {
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const d = diceOf(text);
  if (!d) return 'none';
  const { rolls, total } = roll(d.n, d.sides);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Dice</h2><div class="sub">' + esc(d.n) + 'd' + esc(d.sides) + '</div><p style="font-size:24px">' + rolls.map(esc).join(' + ') + ' = <b>' + esc(total) + '</b></p>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'roll dice'],
  nearMisses: ['dice', 'what is a d20', 'roll a ball'],
  match(lower, text) { return !!diceOf(text || lower); },
  run,
  suite() {
    return { ok: diceOf('roll a d20').sides === 20 && diceOf('hello') === null };
  },
};
