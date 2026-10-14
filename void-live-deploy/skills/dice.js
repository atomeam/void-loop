/**
 * dice skill — roll dice from the ask. "roll a die", "roll 2d6", "d20".
 * Empty surface stays empty; result is a card.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
export function diceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  const m = t.match(/^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:die|dice)|roll\s+)?(\d+)?d(\d+)$/);
  if (m) {
    const n = m[1] ? Math.min(20, Math.max(1, parseInt(m[1], 10))) : 1;
    const sides = Math.min(100, Math.max(2, parseInt(m[2], 10)));
    return { n, sides };
  }
  if (/^(?:please\s+)?roll\s+(?:a\s+)?(?:die|dice)$/.test(t)) return { n: 1, sides: 6 };
  return null;
}
export function roll(n, sides) {
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
  run,
  suite() {
    const a = diceOf('roll 2d6');
    const b = diceOf('d20');
    const c = diceOf('roll a die');
    const ok = a && a.n === 2 && a.sides === 6 && b && b.n === 1 && b.sides === 20 && c && c.n === 1 && c.sides === 6 && !diceOf('what is a die');
    return { ok, got: ok ? 'pass' : 'parser fail' };
  }
};
