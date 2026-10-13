/**
 * dice skill — roll dice locally, no network
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "roll dice", "d20"
 */
function parseDice(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  let m = t.match(/^(?:roll\s+)?(\d+)?d(\d+)(?:\s*(?:dice|die))?$/);
  if (m) return { n: Math.min(20, +(m[1] || 1)), sides: Math.min(100, +m[2]) };
  m = t.match(/^(?:roll\s+(?:a\s+)?(?:die|dice)|throw\s+(?:a\s+)?(?:die|dice)|dice\s+roll)$/);
  if (m) return { n: 1, sides: 6 };
  m = t.match(/^(?:roll\s+)?(\d+)\s*(?:sided\s+)?(?:die|dice)$/);
  if (m) return { n: 1, sides: Math.min(100, +m[1]) };
  return null;
}
export function isDice(text) { return !!parseDice(text); }
function roll(n, sides) {
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseDice(text);
  if (!q) return 'none';
  const { rolls, total } = roll(q.n, q.sides);
  const title = q.n > 1 ? `Rolled ${q.n}d${q.sides}` : `Rolled a d${q.sides}`;
  showPage((p) => {
    p.innerHTML = '<h2>' + esc(title) + '</h2>'
      + '<div style="font-size:48px;font-weight:300;margin:8px 0">' + esc(rolls.join(' + ')) + (q.n > 1 ? ' = ' + total : '') + '</div>'
      + '<div class="sub">say “roll again” or “roll 2d6” for another</div>';
  });
  return 'dice';
}
export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'roll dice', 'd20', 'roll a 20 sided die'],
  nearMisses: ['what is a die', 'dice games', 'how to play craps'],
  match(lower, text) { return isDice(text); },
  run
};
