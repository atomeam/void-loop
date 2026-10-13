/**
 * roll-dice skill — "roll a die", "roll dice", "roll a d6", "roll 2d6".
 * Empty surface stays empty: shows the rolls on a page.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export function diceOf(text) {
  const t = CLEAN(text);
  if (/^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:die|dice)|roll\s+a\s+d6|roll\s+dice)$/.test(t)) return { count: 1, sides: 6 };
  const m = t.match(/^(?:please\s+)?roll\s+(\d+)d(\d+)$/);
  if (m) {
    const count = Math.min(20, Math.max(1, parseInt(m[1], 10)));
    const sides = Math.min(100, Math.max(2, parseInt(m[2], 10)));
    return { count, sides };
  }
  return null;
}

function roll(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return rolls;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const spec = diceOf(text);
  if (!spec) return 'none';
  const rolls = roll(spec.count, spec.sides);
  const total = rolls.reduce((a, b) => a + b, 0);
  const line = rolls.join(', ');
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:28px;font-weight:300">' + esc(line) + '</p>'
      + (spec.count > 1 ? '<div class="sub">total ' + total + ' on ' + spec.count + 'd' + spec.sides + '</div>' : '<div class="sub">d' + spec.sides + '</div>')
      + '<div class="sub">say “roll a die” or “roll 2d6” for another</div>';
  });
  return 'roll-dice';
}

export default {
  name: 'roll-dice',
  examples: ['roll a die', 'roll dice', 'roll a d6', 'roll 2d6'],
  nearMisses: ['what is a die', 'dice game', 'roll the window', 'd6 battery'],
  match(lower, text) { return !!diceOf(text || lower); },
  run,
  suite() {
    const one = diceOf('roll a die');
    const multi = diceOf('roll 2d6');
    const miss = diceOf('what is a die');
    const ok = one && one.count === 1 && one.sides === 6 && multi && multi.count === 2 && multi.sides === 6 && !miss;
    return { ok, got: ok ? 'rolls' : 'miss' };
  }
};
