/**
 * dice-roller skill — tabletop dice rolls.
 * "roll 2d6", "dice roller", "roll a d20".
 * Shows the rolls and total. Empty surface stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:roll\s+)?(\d*)d(\d+)(?:\s+\+\s+(\d+))?$|^dice\s+roller$|^roll\s+a\s+d(\d+)$/);
  if (!m) return null;
  const count = m[1] ? +m[1] : (m[4] ? 1 : 1);
  const sides = m[2] ? +m[2] : +m[4];
  const plus = m[3] ? +m[3] : 0;
  return { count: Math.min(count || 1, 20), sides: Math.min(sides || 6, 100), plus };
}

function run(text, api) {
  const spec = diceOf(text);
  if (!spec) return 'none';
  const { showPage, esc } = api;
  const rolls = Array.from({ length: spec.count }, () => 1 + Math.floor(Math.random() * spec.sides));
  const sum = rolls.reduce((a, b) => a + b, 0) + spec.plus;
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><div class="sub">' + esc(spec.count + 'd' + spec.sides + (spec.plus ? ' + ' + spec.plus : '')) + '</div>'
      + '<div style="font-size:32px;margin:12px 0">' + esc(rolls.join(' + ')) + (spec.plus ? ' + ' + spec.plus : '') + ' = <b>' + sum + '</b></div>'
      + '<div class="src">rolled here · nothing saved</div>';
  });
  return 'dice-roller';
}

export default {
  name: 'dice-roller',
  examples: ['roll 2d6', 'dice roller', 'roll a d20'],
  nearMisses: ['what is a die', 'roll out the carpet', 'dice game'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const d = diceOf('roll 2d6');
    return { ok: d && d.count === 2 && d.sides === 6 && diceOf('hello') === null };
  },
};
