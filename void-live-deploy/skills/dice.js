/**
 * dice skill — roll dice from the ask. "roll a die", "roll 2d6", "d20".
 * Empty surface stays empty; result is a card.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
function diceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (/^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:die|dice)|roll\s+\d+d\d+|d\d+|roll\s+a\s+d\d+)$/.test(t)) {
    const m = t.match(/(\d+)?d(\d+)/) || t.match(/d(\d+)/);
    if (m) {
      const n = m[1] ? parseInt(m[1], 10) : 1;
      const sides = parseInt(m[2] || m[1], 10);
      if (n > 0 && n <= 20 && sides >= 2 && sides <= 100) return { n, sides };
    }
    return { n: 1, sides: 6 }; // default die
  }
  return null;
}
function roll(n, sides) {
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return rolls;
}
async function run(text, api) {
  const hit = diceOf(text);
  if (!hit) return 'none';
  const { showPage, esc } = api;
  const rolls = roll(hit.n, hit.sides);
  const total = rolls.reduce((a, b) => a + b, 0);
  showPage((el) => {
    el.innerHTML = '<h2>Dice</h2><p style="font-size:28px;font-weight:300">' + esc(rolls.join(', ')) + '</p>'
      + (hit.n > 1 ? '<div class="sub">total ' + total + '</div>' : '')
      + '<div class="sub">' + hit.n + 'd' + hit.sides + '</div>';
  });
  return 'dice';
}
export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'd20', 'roll a d20'],
  nearMisses: ['what is a die', 'dice game', 'play dice'],
  match(lower, text) { return !!diceOf(text); },
  run
};
