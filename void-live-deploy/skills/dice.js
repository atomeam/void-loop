/**
 * dice skill — roll dice
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll dice", "roll 2d6".
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:die|dice)|roll\s+\d+d\d+)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function roll(sides = 6, count = 1) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
  return rolls;
}

async function run(text, api) {
  const { showPage } = api;
  const t = String(text || '').trim().toLowerCase();
  let sides = 6, count = 1;
  const m = t.match(/roll\s+(\d+)d(\d+)/);
  if (m) { count = Math.min(parseInt(m[1], 10) || 1, 20); sides = Math.min(parseInt(m[2], 10) || 6, 100); }
  const rolls = roll(sides, count);
  const total = rolls.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Dice</h2><p style="font-size:28px">' + rolls.join(' + ') + ' = <b>' + total + '</b></p><div class="sub">say “roll dice” again for another</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll dice', 'roll 2d6', 'roll 1d20'],
  nearMisses: ['what is a die', 'dice game rules'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a die') && isDice('roll 2d6') && !isDice('what is dice');
    return { ok, got: 'match works' };
  }
};
