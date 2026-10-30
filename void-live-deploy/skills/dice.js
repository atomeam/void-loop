/**
 * dice skill — roll one or more dice
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "dice".
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:(?:roll|throw)\s+(?:a\s+)?(?:die|dice)|(?:roll\s+)?\d+d\d+|dice)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function roll(sides = 6, count = 1) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(Math.floor(Math.random() * sides) + 1);
  return rolls;
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  let count = 1, sides = 6;
  const m = /(\d+)d(\d+)/i.exec(t);
  if (m) { count = Math.min(20, parseInt(m[1], 10)); sides = Math.min(100, parseInt(m[2], 10)); }
  else if (/2/.test(t)) count = 2;
  const results = roll(sides, count);
  const total = results.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Dice</h2><p style="font-size:32px;text-align:center;font-family:monospace">' + esc(results.join(' + ')) + (count > 1 ? ' = ' + total : '') + '</p><div class="sub">rolled ' + count + 'd' + sides + '</div><div class="sub">say “roll 2d6” or “dice”</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'dice', 'throw dice'],
  nearMisses: ['what are dice', 'buy dice', 'dice game'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a die') && isDice('roll 2d6') && !isDice('what are dice');
    return { ok, got: 'match works' };
  }
};
