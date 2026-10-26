/**
 * dice skill — roll some dice
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "dice".
 */
export function isDice(text) {
  return /^(?:please\s+)?(?:roll\s+(?:a\s+|some\s+|the\s+)?(?:dice|die|d\d+)|(?:\d+)?d\d+(?:\s*\+\s*\d+)?|dice(?:\s+please)?)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function roll(sides, count = 1) {
  let sum = 0, rolls = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    sum += r;
  }
  return { rolls, sum };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').toLowerCase();
  let sides = 6, count = 1;
  const m = t.match(/(\d+)d(\d+)/);
  if (m) { count = Math.min(100, parseInt(m[1], 10) || 1); sides = parseInt(m[2], 10) || 6; }
  else if (/d\d+/.test(t)) { sides = parseInt(t.match(/d(\d+)/)[1], 10); }
  const { rolls, sum } = roll(sides, count);
  showPage((p) => {
    p.innerHTML = '<h2>Dice</h2><p style="font-size:28px;font-weight:300">' + esc(rolls.join(' + ') + ' = ' + sum) + '</p><div class="sub">' + count + 'd' + sides + ' · say another roll for more</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'dice', 'd20'],
  nearMisses: ['what is a die', 'dice game', 'roll the ball'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a die') && isDice('2d6') && !isDice('what is a die');
    return { ok, got: 'match works' };
  }
};
