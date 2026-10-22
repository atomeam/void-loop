/**
 * dice skill — "roll a d6", "roll 2d20", "dice", "roll the dice".
 * Pure parser + local RNG; nothing leaves the browser. Empty stage stays empty.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:roll\s+)?(?:(\d+)d(\d+)|a\s+d(\d+)|the\s+dice|dice)$/);
  if (!m) return null;
  if (m[1] && m[2]) return { n: Math.min(100, +m[1] || 1), sides: Math.min(100, +m[2] || 6) };
  if (m[3]) return { n: 1, sides: Math.min(100, +m[3] || 6) };
  return { n: 1, sides: 6 };
}

export function roll(spec) {
  if (!spec) return null;
  const rolls = [];
  for (let i = 0; i < spec.n; i++) rolls.push(1 + Math.floor(Math.random() * spec.sides));
  return { ...spec, rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

function run(text, api) {
  const { showPage, esc } = api;
  const spec = diceOf(text);
  if (!spec) return 'none';
  const r = roll(spec);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Dice</h2><div class="sub">' + esc(spec.n + 'd' + spec.sides) + '</div>'
      + '<div style="font-size:28px;margin:12px 0">' + r.rolls.map(esc).join(' + ') + ' = <b>' + r.total + '</b></div>'
      + '<button type="button" class="g-btn">Roll again</button>';
  });
  const btn = el && el.querySelector('button');
  if (btn) btn.addEventListener('click', () => run(text, api));
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d6', 'roll 2d20', 'dice', 'roll the dice'],
  nearMisses: ['what is a dice', 'dice games', 'how do I roll dice'],
  match(lower, text) { return !!diceOf(text || lower); },
  run,
  suite() {
    const a = diceOf('roll 2d6');
    const b = diceOf('roll a d20');
    const c = diceOf('hello');
    const r = roll({ n: 1, sides: 6 });
    return { ok: a && a.n === 2 && a.sides === 6 && b && b.n === 1 && b.sides === 20 && c === null && r && r.rolls.length === 1 && r.total >= 1 && r.total <= 6 };
  },
};
