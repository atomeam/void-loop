/**
 * dice skill — roll dice or flip a coin, all in the browser (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a dice", "roll 2d6", "flip a coin", "roll a d20"
 */
export function parseDice(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (/^(?:please\s+)?(?:flip|toss)\s+(?:a\s+)?coin(?:\s+please)?$/.test(t) || t === 'coin flip' || t === 'heads or tails') {
    return { kind: 'coin' };
  }
  let m = t.match(/^(?:please\s+)?(?:roll|throw)\s+(?:me\s+)?(?:a\s+|the\s+)?(?:dice|die)(?:\s+please)?$/);
  if (m) return { kind: 'dice', n: 1, sides: 6 };
  m = t.match(/^(?:please\s+)?(?:roll|throw)\s+(\d{1,2})d(\d{1,3})(?:\s+please)?$/);
  if (m) {
    const n = Math.min(20, Math.max(1, +m[1])), sides = Math.min(100, Math.max(2, +m[2]));
    return { kind: 'dice', n, sides };
  }
  m = t.match(/^(?:please\s+)?(?:roll|throw)\s+(?:a\s+|an\s+)?d(\d{1,3})(?:\s+please)?$/);
  if (m) return { kind: 'dice', n: 1, sides: Math.min(100, Math.max(2, +m[1])) };
  return null;
}

function roll(n, sides) {
  const rolls = Array.from({ length: n }, () => Math.floor(Math.random() * sides) + 1);
  return { rolls, total: rolls.reduce((a, b) => a + b, 0) };
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = parseDice(text);
  if (!q) return 'none';
  if (q.kind === 'coin') {
    const face = Math.random() < 0.5 ? 'Heads' : 'Tails';
    showPage((p) => {
      p.innerHTML = '<h2>Coin flip</h2><p style="font-size:48px;line-height:1.2;font-weight:300;margin:12px 0">' + esc(face) + '</p><div class="sub">say “flip a coin” for another</div>';
    });
    return 'dice';
  }
  const { rolls, total } = roll(q.n, q.sides);
  const label = q.n === 1 ? 'd' + q.sides : q.n + 'd' + q.sides;
  const list = rolls.length === 1 ? String(rolls[0]) : rolls.join(' + ') + ' = ' + total;
  showPage((p) => {
    p.innerHTML = '<h2>Roll ' + esc(label) + '</h2><p style="font-size:36px;line-height:1.3;font-weight:300;margin:12px 0">' + esc(list) + '</p><div class="sub">say “roll ' + esc(label) + '” for another</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a dice', 'flip a coin', 'roll 2d6', 'roll a d20'],
  nearMisses: ['what is a dice', 'dice games', 'how to roll a dice', 'coin collection'],
  match(lower, text) { return !!parseDice(text); },
  run
};
