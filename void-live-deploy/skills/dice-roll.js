/**
 * dice-roll skill - roll dice
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const WHEN = /^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:die|dice)|roll\s+d\d+|roll\s+\d+d\d+)$/i;

function parseDice(text) {
  const m = String(text || '').toLowerCase().match(/(\d*)d(\d+)/);
  if (m) return { n: m[1] ? +m[1] : 1, sides: +m[2] };
  if (/die|dice/.test(text)) return { n: 1, sides: 6 };
  return null;
}

function run(text, api) {
  const { showPage, esc } = api;
  const d = parseDice(text) || { n: 1, sides: 6 };
  const rolls = [];
  let total = 0;
  for (let i = 0; i < d.n; i++) {
    const r = 1 + Math.floor(Math.random() * d.sides);
    rolls.push(r);
    total += r;
  }
  const result = d.n === 1 ? String(rolls[0]) : rolls.join(' + ') + ' = ' + total;
  showPage((el) => {
    el.innerHTML = '<h2>Dice roll</h2><p style="font-size:48px;text-align:center">' + esc(result) + '</p><div class="src">' + d.n + 'd' + d.sides + ' \u00b7 as of ' + new Date().toISOString().slice(0, 7) + '</div>';
  });
  return 'dice-roll';
}

export default {
  name: 'dice-roll',
  examples: ['roll a die', 'roll 2d6'],
  nearMisses: ['what is a die', 'dice game'],
  match(lower) { return WHEN.test(String(lower || '').trim()); },
  run,
  suite() {
    const ok = WHEN.test('roll a die') && WHEN.test('roll 2d6') && !WHEN.test('what is a die');
    return { ok, got: ok ? undefined : 'match failed' };
  }
};
