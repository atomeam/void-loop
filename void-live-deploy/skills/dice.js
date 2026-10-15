/**
 * dice skill — roll dice for tabletop. "roll a d20", "roll 2d6", "dice roll", "throw the dice".
 * Shows the rolls and total on a card. Empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:roll|throw|dice)\s+(?:a\s+)?(\d+)?d(\d+)$/);
  if (m) return { count: +(m[1] || 1), sides: +m[2] };
  m = t.match(/^(?:roll|throw)\s+(?:a\s+)?(\d+)\s*sided(?:\s+dice)?$/);
  if (m) return { count: 1, sides: +m[1] };
  if (/^(?:roll|throw)\s+(?:the\s+)?dice$/.test(t)) return { count: 1, sides: 6 };
  return null;
}

function run(text, api) {
  const d = diceOf(text);
  if (!d || d.sides < 2 || d.count < 1 || d.count > 20) return 'none';
  const { showPage, esc } = api;
  const rolls = Array.from({ length: d.count }, () => 1 + Math.floor(Math.random() * d.sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><div class="sub">' + esc(d.count + 'd' + d.sides) + '</div><p style="font-size:42px;text-align:center;margin:12px 0">' + esc(rolls.join(' · ')) + '</p><div class="sub">Total: ' + total + '</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'dice roll', 'throw the dice'],
  nearMisses: ['what is a dice', 'roll the figure', 'spin the figure'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const hit = diceOf('roll a d20');
    const two = diceOf('roll 2d6');
    return { ok: !!hit && hit.sides === 20 && hit.count === 1 && !!two && two.count === 2 && diceOf('hello') === null };
  },
};
