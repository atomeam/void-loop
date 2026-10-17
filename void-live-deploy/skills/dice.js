/**
 * dice skill — roll dice: "roll a d20", "roll 2d6", "roll 1d4 + 2".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Empty surface stays empty: only shows when matched.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:roll|throw)\s+(?:a\s+|an\s+)?(\d+)?d(\d+)(?:\s*\+\s*(\d+))?$/i)
    || t.match(/^(?:roll|throw)\s+(?:a\s+)?die(?:\s+of\s+(\d+))?$/i);
  if (!m) return null;
  const count = m[1] ? parseInt(m[1], 10) : 1;
  const sides = m[2] ? parseInt(m[2], 10) : (m[4] ? parseInt(m[4], 10) : 6);
  const mod = m[3] ? parseInt(m[3], 10) : 0;
  if (count < 1 || count > 20 || sides < 2 || sides > 100) return null;
  return { count, sides, mod };
}

function roll({ count, sides, mod }) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce((a, b) => a + b, 0) + mod;
  return { rolls, total, mod };
}

async function run(text, api) {
  const spec = diceOf(text);
  if (!spec) return 'none';
  const { showPage, esc } = api;
  const result = roll(spec);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><div class="sub">' + esc(`${spec.count}d${spec.sides}${spec.mod ? ' + ' + spec.mod : ''}`) + '</div>'
      + '<p style="font-size:24px;font-weight:600">' + esc(result.total.toString()) + '</p>'
      + '<p>Rolls: ' + esc(result.rolls.join(', ')) + (spec.mod ? ' + ' + spec.mod : '') + '</p>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'roll 1d4 + 2', 'roll a die'],
  nearMisses: ['what is a d20', 'dice games', 'roll of the dice'],
  match(lower, text) { return !!diceOf(text || lower); },
  run,
  suite() {
    return { ok: diceOf('roll a d20') && diceOf('roll 2d6').count === 2 && diceOf('hello') === null };
  },
};
