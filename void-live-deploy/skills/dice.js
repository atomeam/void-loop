/**
 * dice skill — roll dice: "roll a die", "roll 2d6", "roll 3 dice"
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * Empty surface stays empty until asked.
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+)?(?:die|dice)|roll\s+\d+d\d+|roll\s+\d+\s+dice)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseDice(text) {
  const t = String(text || '').toLowerCase().trim();
  const md = /(\d+)d(\d+)/.exec(t);
  if (md) return { n: Math.min(20, +md[1]), sides: Math.min(100, +md[2]) };
  const mn = /roll\s+(\d+)\s+dice/.exec(t);
  if (mn) return { n: Math.min(20, +mn[1]), sides: 6 };
  return { n: 1, sides: 6 };
}

function roll(n, sides) {
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const { n, sides } = parseDice(text);
  const { rolls, total } = roll(n, sides);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:28px;font-weight:600;letter-spacing:0.05em">' + esc(rolls.join(' + ')) + (n > 1 ? ' = ' + total : '') + '</p><div class="sub">' + n + 'd' + sides + ' · say “roll again” for another</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'roll 3 dice', 'roll a dice'],
  nearMisses: ['what is a die', 'dice game rules', 'how to play yahtzee'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a die') && isDice('roll 2d6') && !isDice('what is a die');
    return { ok, got: 'match works' };
  }
};
