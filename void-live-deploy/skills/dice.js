/**
 * dice skill — roll dice or flip a coin, no network, no key
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a die", "roll a d6", "roll 2d6", "flip a coin", "heads or tails".
 * Empty surface stays empty: only a temporary page, no stage card.
 */
function clean(text) {
  return String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
}

export function parseDice(text) {
  const t = clean(text).toLowerCase();
  if (/^(?:please\s+)?(?:flip\s+(?:a\s+)?coin|heads?\s+or\s+tails?|toss\s+(?:a\s+)?coin)$/.test(t)) return { type: 'coin' };
  const m = t.match(/^(?:please\s+)?(?:roll\s+(?:a\s+|the\s+)?(?:die|dice)|roll\s+(\d+)d(\d+)|d(\d+))$/);
  if (m) {
    if (m[1] && m[2]) {
      const n = Math.min(20, Math.max(1, parseInt(m[1], 10)));
      const sides = Math.min(100, Math.max(2, parseInt(m[2], 10)));
      return { type: 'dice', n, sides };
    }
    if (m[3]) return { type: 'dice', n: 1, sides: Math.min(100, Math.max(2, parseInt(m[3], 10))) };
    return { type: 'dice', n: 1, sides: 6 };
  }
  return null;
}

function roll(n, sides) {
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return rolls;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const p = parseDice(text);
  if (!p) return 'none';
  let html = '';
  if (p.type === 'coin') {
    const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
    html = '<h2>Coin flip</h2><p style="font-size:28px;font-weight:300">' + esc(side) + '</p><div class="sub">say “flip a coin” for another</div>';
  } else {
    const rolls = roll(p.n, p.sides);
    const sum = rolls.reduce((a, b) => a + b, 0);
    const label = p.n === 1 ? `d${p.sides}` : `${p.n}d${p.sides}`;
    html = '<h2>Dice roll</h2><p style="font-size:24px;font-weight:300">' + esc(rolls.join(', ')) + (p.n > 1 ? ' <span style="color:#8a8a8a">(sum ' + sum + ')</span>' : '') + '</p><div class="sub">' + esc(label) + ' · say “roll a die” for another</div>';
  }
  showPage((el) => { el.innerHTML = html; });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a die', 'roll a d6', 'roll 2d6', 'flip a coin', 'heads or tails'],
  nearMisses: ['what is a die', 'dice game', 'coin collection', 'roll the ball'],
  match(lower, text) { return !!parseDice(text); },
  run
};
