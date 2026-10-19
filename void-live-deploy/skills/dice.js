/**
 * dice skill — roll dice. "roll a d20", "roll 2d6", "dice".
 * Pure client-side; nothing leaves the browser. Empty stage stays empty.
 */
export function parseDice(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (t === 'dice' || t === 'roll dice' || t === 'roll the dice') return { n: 1, sides: 6 };
  const m = t.match(/^(?:roll\s+)?(?:a\s+)?(\d+)?d(\d+)$/);
  if (m && m[2]) {
    const n = m[1] ? Math.max(1, Math.min(20, +m[1])) : 1;
    const sides = Math.max(2, Math.min(100, +m[2]));
    return { n, sides };
  }
  return null;
}

function roll({ n, sides }) {
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  const total = rolls.reduce((a, b) => a + b, 0);
  return { rolls, total };
}

async function run(text, api) {
  const ask = parseDice(text);
  if (!ask) return 'none';
  const { showPage, esc } = api;
  const { rolls, total } = roll(ask);
  const line = ask.n === 1 ? `d${ask.sides}: ${rolls[0]}` : `${ask.n}d${ask.sides}: ${rolls.join(' + ')} = ${total}`;
  showPage((p) => {
    p.innerHTML = '<h2>Dice</h2><p style="font-size:28px;line-height:1.4;font-weight:300">' + esc(line) + '</p><div class="sub">say “roll again” or another roll</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'dice', 'roll dice', 'roll 3d8'],
  nearMisses: ['what is a dice', 'dice games', 'how to play dungeons and dragons'],
  match(lower, text) { return !!parseDice(text); },
  run,
  suite() {
    const a = parseDice('roll a d20');
    const b = parseDice('2d6');
    const c = parseDice('dice');
    const ok = a && a.n === 1 && a.sides === 20 && b && b.n === 2 && b.sides === 6 && c && c.n === 1 && c.sides === 6 && !parseDice('what is a dice');
    return { ok, got: JSON.stringify({ a, b, c }) };
  },
};
