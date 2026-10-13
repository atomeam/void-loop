/**
 * dice skill — roll dice: "roll a die", "roll 2d6", "d20", "roll three dice".
 * Shows the faces and the total. Empty stage stays empty.
 */

export function diceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  if (!/\b(roll|dice?|d\d+)\b/.test(t)) return null;
  if (/\b(what is|history of|game of|dice game|craps)\b/.test(t)) return null;
  let count = 1, sides = 6;
  let m = t.match(/(\d+)\s*d\s*(\d+)/);
  if (m) { count = parseInt(m[1], 10); sides = parseInt(m[2], 10); }
  else {
    m = t.match(/d(\d+)/);
    if (m) sides = parseInt(m[1], 10);
    m = t.match(/(\d+)\s+(?:dice|die)/);
    if (m) count = parseInt(m[1], 10);
  }
  if (count < 1 || count > 20 || sides < 2 || sides > 100 || !Number.isInteger(count) || !Number.isInteger(sides)) return null;
  return { count, sides };
}

function roll(count, sides) {
  const faces = [];
  for (let i = 0; i < count; i++) faces.push(1 + Math.floor(Math.random() * sides));
  return { faces, total: faces.reduce((a, b) => a + b, 0) };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const spec = diceOf(text);
  if (!spec) return 'none';
  const { faces, total } = roll(spec.count, spec.sides);
  showPage((p) => {
    p.innerHTML = '<h2>Dice</h2><p style="font-size:36px;font-weight:300;letter-spacing:2px">' + faces.map(f => esc(String(f))).join(' + ') + ' = <b>' + total + '</b></p><div class="sub">' + spec.count + 'd' + spec.sides + '</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll 2d6', 'd20'],
  nearMisses: ['what is a die', 'dice game rules', 'how to play craps'],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const s = diceOf('roll 2d6');
    const ok = !!s && s.count === 2 && s.sides === 6 && !!diceOf('roll a die') && !!diceOf('d20') && diceOf('what is a die') === null && diceOf('how to play craps') === null;
    return { ok, got: JSON.stringify(s) };
  }
};
