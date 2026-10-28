/**
 * dice skill — roll one or more dice (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "roll a d20".
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:die|dice)|roll\s+\d*d\d+|roll\s+a\s+d\d+)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseDice(text) {
  const m = String(text).toLowerCase().match(/(\d*)d(\d+)/);
  if (m) return { n: Math.max(1, parseInt(m[1] || '1', 10)), sides: parseInt(m[2], 10) };
  if (/d20/i.test(text)) return { n: 1, sides: 20 };
  if (/die/i.test(text)) return { n: 1, sides: 6 };
  return { n: 1, sides: 6 };
}

function roll({ n, sides }) {
  const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const spec = parseDice(text);
  const { rolls, total } = roll(spec);
  const label = spec.n > 1 ? spec.n + 'd' + spec.sides : 'd' + spec.sides;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Dice · ' + esc(label) + '</h2><p style="font-size:42px;font-weight:300;letter-spacing:2px">' + esc(rolls.join(' + ')) + (spec.n > 1 ? ' = ' + total : '') + '</p><div class="sub">say “roll again” or another dice ask</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'roll a d20', 'roll dice'],
  nearMisses: ['what is a die', 'dice game rules', 'roll of the dice meaning'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a die') && isDice('roll 2d6') && !isDice('what is a die');
    return { ok, got: 'match works' };
  }
};
