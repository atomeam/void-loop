/**
 * dice skill — roll dice or flip a coin (no key; pure random)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll 2d6", "flip a coin", "roll a d20".
 */
function parseRoll(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (!/^(?:roll|throw|flip|toss|spin)\b/.test(t) && !/\bd\d+\b/.test(t) && !/\bdie\b|\bdice\b|\bcoin\b/.test(t)) return null;
  if (/\b(coin|heads|tails)\b/.test(t) || /\bflip\b/.test(t)) return { kind: 'coin' };
  const m = t.match(/(?:roll\s+)?(\d+)?d(\d+)/) || t.match(/(\d+)\s*(?:sided\s+)?die|dice/) || t.match(/die|dice/);
  if (m) {
    const n = m[1] ? parseInt(m[1], 10) : 1;
    const sides = m[2] ? parseInt(m[2], 10) : (m[1] && !m[2] ? parseInt(m[1], 10) : 6);
    if (n >= 1 && n <= 20 && sides >= 2 && sides <= 100) return { kind: 'dice', n, sides };
  }
  if (/\b(die|dice)\b/.test(t)) return { kind: 'dice', n: 1, sides: 6 };
  return null;
}

function roll(n, sides) {
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return rolls;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseRoll(text);
  if (!q) return 'none';
  if (q.kind === 'coin') {
    const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
    showPage((p) => {
      p.innerHTML = '<h2>Coin flip</h2><div style="font-size:48px;font-weight:300;margin:8px 0">' + esc(side) + '</div><div class="sub">say “flip a coin” for another</div>';
    });
    return 'dice';
  }
  const rolls = roll(q.n, q.sides);
  const total = rolls.reduce((a, b) => a + b, 0);
  showPage((p) => {
    p.innerHTML = '<h2>Dice roll</h2><div class="sub">' + q.n + 'd' + q.sides + '</div>'
      + '<div style="font-size:36px;font-weight:300;margin:8px 0">' + esc(rolls.join(' + ')) + (q.n > 1 ? ' = ' + total : '') + '</div>'
      + '<div class="sub">say “roll ' + q.n + 'd' + q.sides + '” for another</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'flip a coin', 'roll 2d6', 'roll a d20'],
  nearMisses: ['what is a die', 'dice in cooking', 'coin collection'],
  match(lower, text) { return !!parseRoll(text); },
  run
};
