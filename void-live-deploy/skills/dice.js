/**
 * dice skill — roll dice (pure, client-side)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a d6", "roll 2d6", "roll a die".
 * Empty surface stays empty.
 */
export function parseDice(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:please\s+)?(?:roll\s+)?(?:a\s+)?(\d+)?d(\d+)$/i)
    || t.match(/^(?:please\s+)?roll\s+(?:a\s+)?(?:die|dice)$/i);
  if (m) {
    if (m[1] === undefined && m[2] === undefined) return { n: 1, sides: 6 };
    const n = m[1] ? parseInt(m[1], 10) : 1;
    const sides = parseInt(m[2], 10);
    if (n > 0 && n <= 20 && sides >= 2 && sides <= 100) return { n, sides };
  }
  return null;
}

export function rollDice(q) {
  if (!q) return null;
  const rolls = [];
  for (let i = 0; i < q.n; i++) rolls.push(1 + Math.floor(Math.random() * q.sides));
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

async function run(text, api) {
  const q = parseDice(text);
  if (!q) return 'none';
  const r = rollDice(q);
  if (!r) return 'none';
  const { showPage, esc } = api;
  const title = q.n > 1 ? q.n + 'd' + q.sides : 'd' + q.sides;
  showPage((p) => {
    p.innerHTML = '<h2>Roll ' + esc(title) + '</h2>'
      + '<div style="font-size:48px;font-weight:300;line-height:1.15;margin:6px 0 4px">' + esc(String(r.total)) + '</div>'
      + (q.n > 1 ? '<div class="sub">' + esc(r.rolls.join(' + ')) + '</div>' : '')
      + '<div class="sub">say “roll” again for another</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d6', 'roll 2d6', 'roll a die'],
  nearMisses: ['what is a die', 'dice game', 'how many sides on a cube', 'roll of the dice meaning'],
  match(lower, text) { return !!parseDice(text); },
  run,
  suite() {
    const q = parseDice('roll 2d6');
    const r = rollDice(q);
    const ok = !!q && q.n === 2 && q.sides === 6 && r && r.rolls.length === 2 && r.total === r.rolls[0] + r.rolls[1]
      && parseDice('what is a die') === null && parseDice('roll a d6') != null;
    return { ok, got: r && r.total };
  }
};
