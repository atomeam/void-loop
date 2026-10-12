/**
 * dice skill - roll dice
 * "roll a die", "roll a d6", "roll 2d6"
 */
function isDice(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  return /^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:die|dice)|roll\s+(?:a\s+)?d\d+|roll\s+\d+d\d+)$/.test(t);
}

function roll(sides = 6, count = 1) {
  let total = 0, rolls = [];
  for (let i = 0; i < count; i++) {
    const r = Math.floor(Math.random() * sides) + 1;
    rolls.push(r);
    total += r;
  }
  return { rolls, total };
}

function run(text, api) {
  const { showPage, esc } = api;
  const t = String(text || '').toLowerCase();
  let sides = 6, count = 1;
  const m = t.match(/(\d+)d(\d+)/);
  if (m) { count = Math.min(10, parseInt(m[1], 10)); sides = Math.min(100, parseInt(m[2], 10)); }
  else if (/d(\d+)/.test(t)) sides = Math.min(100, parseInt(t.match(/d(\d+)/)[1], 10));
  const { rolls, total } = roll(sides, count);
  showPage((el) => {
    el.innerHTML = '<h2>Dice roll</h2><p style="font-size:36px;font-weight:300">' + esc(rolls.join(', ')) + '</p>'
      + (count > 1 ? '<p>Total: ' + total + '</p>' : '')
      + '<div class="sub">say “roll a d20” for another</div><div class="src">Source: fair random · as of 2026-10</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll a d6', 'roll 2d6'],
  nearMisses: ['what is a die', 'dice game', 'how dice work'],
  match(lower, text) { return isDice(text); },
  run,
  suite() { return { ok: isDice('roll a d6') && !isDice('dice game') }; }
};
