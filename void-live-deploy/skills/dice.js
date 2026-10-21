/**
 * dice skill — roll dice: "roll a d20", "roll 2d6", "roll dice", "d6".
 * Pure random rolls, no network. Shows the results on a card.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export function parseDice(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!/\b(roll|dice|d\d+)\b/.test(t)) return null;
  let m = t.match(/(?:roll\s+)?(\d+)\s*d\s*(\d+)/);
  if (m) return { count: Math.min(20, parseInt(m[1], 10) || 1), sides: Math.min(100, parseInt(m[2], 10) || 6) };
  m = t.match(/(?:roll\s+)?(?:a\s+|the\s+)?d(\d+)/);
  if (m) return { count: 1, sides: Math.min(100, parseInt(m[1], 10) || 6) };
  if (/\b(roll\s+(?:a\s+)?(?:die|dice)|dice)\b/.test(t)) return { count: 1, sides: 6 };
  return null;
}

function roll(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return rolls;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const spec = parseDice(text);
  if (!spec) return 'none';
  const rolls = roll(spec.count, spec.sides);
  const total = rolls.reduce((a, b) => a + b, 0);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:28px;font-weight:300;letter-spacing:2px">' +
      esc(rolls.join(' + ')) + (rolls.length > 1 ? ' = <b>' + total + '</b>' : '') +
      '</p><div class="sub">' + spec.count + 'd' + spec.sides + ' · say “roll again” or “2d6” for another</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'roll dice', 'd6', 'roll a die'],
  nearMisses: ['what is a die', 'dice game', 'how many sides'],
  match(lower, text) { return !!parseDice(text); },
  run,
};
