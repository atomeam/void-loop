/**
 * dice skill — roll one or more dice (no key; pure random)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite }
 * "roll a die", "roll 2d6", "roll dice", "roll three dice".
 * Empty stage stays empty: only shows a page on a matching ask.
 */
export function diceOf(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const t = raw.toLowerCase();
  if (!/\b(?:roll|throw)\s+(?:a\s+|the\s+)?(?:die|dice|d\d+)/.test(t) && !/^\d+d\d+$/i.test(t)) return null;
  let count = 1, sides = 6;
  let m = t.match(/(\d+)\s*d\s*(\d+)/);
  if (m) { count = +m[1]; sides = +m[2]; }
  else if (/\bdice\b/.test(t)) {
    m = t.match(/(\d+)\s+dice/);
    if (m) count = +m[1];
    else count = 2; // "roll dice" means a pair
  } else if (/\bdie\b/.test(t)) {
    count = 1; sides = 6;
  }
  if (count < 1 || count > 20 || sides < 2 || sides > 100 || !Number.isInteger(count) || !Number.isInteger(sides)) return null;
  return { count, sides, raw };
}

function roll(count, sides) {
  const rolls = [];
  for (let i = 0; i < count; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

async function run(text, api) {
  const q = diceOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  const r = roll(q.count, q.sides);
  const label = q.count === 1 ? 'd' + q.sides : q.count + 'd' + q.sides;
  showPage((p) => {
    p.innerHTML = '<h2>Dice</h2>'
      + '<div class="sub">' + esc(label) + '</div>'
      + '<div style="font-size:36px;font-weight:300;line-height:1.2;margin:8px 0">' + esc(r.rolls.join(' + ')) + ' = ' + esc(String(r.total)) + '</div>'
      + '<div class="sub">say “roll dice” again for another</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'roll dice', 'roll three dice'],
  nearMisses: ['what is a die', 'dice history', 'roll the dice in monopoly'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const ok = !!diceOf('roll 2d6') && !diceOf('what is a die');
    return { ok, got: ok ? undefined : 'matcher failed' };
  }
};
