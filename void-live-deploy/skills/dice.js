/**
 * dice skill: roll dice on the stage.
 * "roll a d6", "roll 2d20", "dice", "roll dice".
 * Empty surface stays empty.
 */
function parseDice(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:roll\s+)?(\d+)?d(\d+)$/) || t.match(/^roll\s+(?:a\s+)?(?:d)?(\d+)$/) || t.match(/^dice(?:\s+roll)?$/);
  if (m) {
    if (m[0].startsWith('dice')) return { n: 1, sides: 6 };
    const n = m[1] ? parseInt(m[1], 10) : 1;
    const sides = parseInt(m[2] || m[1], 10);
    return { n: Math.min(n || 1, 10), sides: Math.min(sides || 6, 100) };
  }
  return null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const d = parseDice(text);
  if (!d) return 'none';
  const rolls = Array.from({ length: d.n }, () => Math.floor(Math.random() * d.sides) + 1);
  const sum = rolls.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><div class="sub">' + esc(d.n + 'd' + d.sides) + '</div><p style="font-size:24px">' + esc(rolls.join(', ')) + (d.n > 1 ? ' = ' + sum : '') + '</p>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d6', 'roll 2d20', 'dice'],
  nearMisses: ['what is a dice', 'dice game'],
  match(lower, text) { return !!parseDice(text); },
  run,
  suite() {
    const a = parseDice('roll 2d6');
    return { ok: a && a.n === 2 && a.sides === 6 && !!parseDice('dice') && !parseDice('hello') };
  },
};
