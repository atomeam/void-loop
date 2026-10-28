/**
 * dice skill — roll dice, any number of any sides
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a d20", "roll 2d6", "roll dice".
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:d\d+|\d+d\d+|dice|die)|roll\s+dice|dice\s+roll)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function parseDice(text) {
  const m = String(text).toLowerCase().match(/(\d+)?d(\d+)/);
  if (m) return { n: parseInt(m[1] || '1', 10), sides: parseInt(m[2], 10) };
  return { n: 1, sides: 6 };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const { n, sides } = parseDice(text);
  const rolls = Array.from({ length: Math.min(n, 20) }, () => 1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  const el = showPage((p) => { p.innerHTML = '<h2>Dice</h2><div class="sub">…</div>'; });
  el.innerHTML = '<h2>Dice</h2><p style="font-size:28px;font-weight:300">' + esc(rolls.join(' + ')) + (rolls.length > 1 ? ' = ' + total : '') + '</p><div class="sub">' + n + 'd' + sides + '</div>';
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'roll dice', 'roll a die'],
  nearMisses: ['what is a dice', 'dice game', 'roll the camera'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a d20') && isDice('roll 2d6') && !isDice('what is a dice');
    return { ok, got: 'match works' };
  }
};
