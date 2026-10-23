/**
 * dice skill — roll one or more dice locally (no key, empty surface stays empty)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "roll dice".
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+)?(?:die|dice)|roll\s+\d+d\d+|roll\s+dice)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseDice(text) {
  const m = String(text).match(/(\d+)d(\d+)/i);
  if (m) return { count: Math.min(20, parseInt(m[1], 10)), sides: Math.min(100, parseInt(m[2], 10)) };
  return { count: 1, sides: 6 };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const { count, sides } = parseDice(text);
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:28px;font-weight:300">' + esc(rolls.join(' + ')) + ' = <strong>' + total + '</strong></p><div class="sub">' + count + 'd' + sides + ' · say “roll 2d6” for more</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll dice', 'roll 2d6', 'roll 1d20'],
  nearMisses: ['what is a die', 'dice game', 'board game'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a die') && isDice('roll 2d6') && !isDice('dice game');
    return { ok, got: 'match works' };
  }
};
