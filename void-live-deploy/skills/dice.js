/**
 * dice skill — roll dice: 1d6, 2d6, etc.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "dice roll", "roll the dice".
 * Empty stage stays empty; the card shows the rolls and total.
 */
export function parseDice(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  const m = t.match(/^(?:please\s+)?(?:roll\s+)?(\d+)?d(\d+)$/) || t.match(/^(?:please\s+)?roll\s+(?:a\s+|the\s+)?(?:dice|die)$/);
  if (m && m[1] !== undefined) return { count: parseInt(m[1] || '1', 10), sides: parseInt(m[2], 10) };
  if (/^(?:please\s+)?(?:roll\s+)?(?:a\s+|the\s+)?(?:dice|die|d6)$/.test(t)) return { count: 1, sides: 6 };
  return null;
}

export function suite() {
  const d = parseDice('roll 2d6');
  const ok = d && d.count === 2 && d.sides === 6 && parseDice('roll a die') && !parseDice('what is a die');
  if (!ok) throw new Error('dice parse failed');
  return true;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const spec = parseDice(text);
  if (!spec || spec.count < 1 || spec.count > 20 || spec.sides < 2 || spec.sides > 100) return 'none';
  const rolls = Array.from({ length: spec.count }, () => Math.floor(Math.random() * spec.sides) + 1);
  const total = rolls.reduce((a, b) => a + b, 0);
  const rollsStr = rolls.join(', ');
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><p style="font-size:22px">' + esc(spec.count) + 'd' + esc(spec.sides) + ': ' + esc(rollsStr) + '</p><p style="font-size:32px;font-weight:600">Total: ' + total + '</p><div class="sub">say “roll 2d6” or “roll a die” for another</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'dice roll', 'roll the dice'],
  nearMisses: ['what is a die', 'dice game', 'roll out the red carpet'],
  match(lower, text) { return !!parseDice(text); },
  run,
  suite,
};
