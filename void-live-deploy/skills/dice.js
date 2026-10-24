/**
 * dice skill — roll dice (no external service)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll dice", "roll 2d6", "roll a d20".
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+)?(?:die|dice|d\d+|\d+d\d+)|dice\s+roll|roll\s+dice)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseDice(text) {
  const m = String(text || '').toLowerCase().match(/(\d+)d(\d+)/);
  if (m) return { n: Math.min(20, parseInt(m[1], 10) || 1), sides: Math.min(100, parseInt(m[2], 10) || 6) };
  const d = String(text || '').toLowerCase().match(/d(\d+)/);
  if (d) return { n: 1, sides: Math.min(100, parseInt(d[1], 10) || 6) };
  return { n: 1, sides: 6 };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const { n, sides } = parseDice(text);
  const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
  const total = rolls.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:28px;font-weight:300">' + esc(rolls.join(' + ')) + (n > 1 ? ' = ' + total : '') + '</p><div class="sub">' + n + 'd' + sides + ' · say “roll again” or “roll 2d6”</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll dice', 'roll 2d6', 'roll a d20', 'roll again'],
  nearMisses: ['what is a die', 'dice games', 'buy dice'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a die') && isDice('roll 2d6') && !isDice('what is a die');
    return { ok, got: 'match works' };
  }
};
