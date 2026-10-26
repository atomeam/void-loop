/**
 * dice skill — roll one or more dice (local, no network)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll dice", "roll 2d6".
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+)?(?:die|dice)(?:\s+please)?|roll\s+\d+d\d+|dice(?:\s+roll)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseDice(text) {
  const m = String(text || '').match(/(\d+)d(\d+)/i);
  if (m) return { n: Math.min(12, parseInt(m[1], 10) || 1), s: Math.min(100, parseInt(m[2], 10) || 6) };
  return { n: 1, s: 6 };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const { n, s } = parseDice(text);
  const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * s));
  const total = rolls.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Dice</h2><p style="font-size:28px;font-weight:300;letter-spacing:1px">' + esc(rolls.join(' + ')) + ' = <strong>' + total + '</strong></p><div class="sub">' + n + 'd' + s + ' · say “roll again” or “roll 2d6”</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll dice', 'roll 2d6', 'dice roll'],
  nearMisses: ['what is a die', 'dice game rules', 'how to roll'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a die') && isDice('roll 2d6') && isDice('dice') && !isDice('what is a die');
    return { ok, got: 'match works' };
  }
};
