/**
 * dice skill — roll a die or several, with totals. No network.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "roll three dice", "d20".
 */
export function isDice(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:roll\s+(?:a\s+)?(?:die|dice)|roll\s+\d{1,2}d\d{1,3}|\d{1,2}d\d{1,3}|roll\s+(?:one|two|three|four|five|six|\d{1,2})\s+(?:die|dice)|d\d{1,3})$/.test(t);
}

function roll(sides = 6) {
  const a = new Uint32Array(1);
  crypto.getRandomValues(a);
  return 1 + (a[0] % sides);
}

function parse(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  const nd = t.match(/(\d{1,2})d(\d{1,3})/);
  if (nd) return { n: Math.min(20, +nd[1] || 1), sides: Math.min(100, +nd[2] || 6) };
  const word = t.match(/roll\s+(one|two|three|four|five|six|\d{1,2})\s+(?:die|dice)/);
  if (word) {
    const N = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
    return { n: Math.min(20, N[word[1]] || +word[1] || 1), sides: 6 };
  }
  if (/d\d/.test(t)) {
    const s = +t.match(/d(\d+)/)[1];
    return { n: 1, sides: Math.min(100, s || 6) };
  }
  return { n: 1, sides: 6 };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const { n, sides } = parse(text);
  const rolls = Array.from({ length: n }, () => roll(sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  const el = showPage((p) => {
    p.innerHTML = '<h2>Dice</h2><div class="sub">rolling…</div>';
  });
  if (!api._pageStill(el)) return 'dice';
  el.innerHTML = '<h2>Dice</h2>'
    + '<p style="font-size:28px;font-weight:300;letter-spacing:0.05em">' + rolls.map(esc).join(' + ') + (n > 1 ? ' = ' + total : '') + '</p>'
    + '<div class="sub">' + n + 'd' + sides + (n > 1 ? ' · total ' + total : '') + '</div>'
    + '<div class="src">Fair rolls from this device’s secure random numbers.</div>';
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'roll three dice', 'd20', 'roll a d12'],
  nearMisses: ['what is a die', 'dice games', 'roll the film'],
  match(lower, text) { return isDice(text); },
  run,
  suite() {
    const ok = isDice('roll a die') && isDice('roll 2d6') && isDice('d20') && !isDice('what is a die');
    return { ok, got: 'match works' };
  }
};
