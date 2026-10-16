/**
 * dice skill — roll a die or dice
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "dice". Empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:roll\s+)?(?:a\s+|the\s+)?(?:die|dice)(?:\s+(?:please|now))?$|^roll\s+(\d+)?d(\d+)$|^(\d+)\s*d\s*(\d+)$/i);
  if (!m) return null;
  if (m[2]) return { n: +(m[1] || 1), sides: +m[2] };
  if (m[4]) return { n: +m[3], sides: +m[4] };
  return { n: 1, sides: 6 };
}

function roll(n, sides) {
  const rolls = [];
  for (let i = 0; i < Math.min(n, 20); i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return rolls;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const spec = diceOf(text);
  if (!spec) return 'none';
  const rolls = roll(spec.n, spec.sides);
  const total = rolls.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:28px;font-weight:600">' + esc(rolls.join(' + ')) + (spec.n > 1 ? ' = ' + total : '') + '</p>'
      + '<div class="sub">' + spec.n + 'd' + spec.sides + '</div>'
      + '<div class="src">Rolled in this browser. Nothing is sent. Say “roll 2d20” for another.</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll dice', 'roll 2d6', 'roll d20', '3d8'],
  nearMisses: ['what is a die', 'dice game rules', 'how do dice work', 'roll of the dice meaning'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const d = diceOf('roll a die');
    const nd = diceOf('roll 2d6');
    return { ok: !!d && d.sides === 6 && nd && nd.n === 2 && nd.sides === 6 && diceOf('hello world') === null };
  },
};
