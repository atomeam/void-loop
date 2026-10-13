/**
 * dice skill — roll dice, flip coins, pick random numbers
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a d20", "flip a coin", "random number between 1 and 100", "roll 2d6".
 */
export function diceOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
  if (/^(?:flip|toss)\s+(?:a\s+)?coin$/.test(t)) return { kind: 'coin' };
  let m = t.match(/^(?:roll|throw)\s+(?:a\s+)?(?:d|die\s+|dice\s+)?(\d{1,3})$/);
  if (m) return { kind: 'die', sides: Math.max(2, Math.min(1000, +m[1])) };
  m = t.match(/^(?:roll|throw)\s+(\d{1,2})d(\d{1,3})$/);
  if (m) return { kind: 'dice', n: Math.max(1, Math.min(20, +m[1])), sides: Math.max(2, Math.min(1000, +m[2])) };
  m = t.match(/^(?:random|pick\s+a\s+random|give\s+me\s+a\s+random)\s+number(?:\s+(?:between|from)\s+(\d+)\s+(?:and|to)\s+(\d+))?$/);
  if (m) return { kind: 'num', min: +(m[1] || 1), max: +(m[2] || 100) };
  if (/^(?:roll\s+)?(?:a\s+)?dice$|roll\s+the\s+dice$/.test(t)) return { kind: 'die', sides: 6 };
  return null;
}

function run(text, api) {
  const { showPage, esc } = api;
  const q = diceOf(text);
  if (!q) return 'none';
  const rand = (min, max) => min + Math.floor(Math.random() * (max - min + 1));
  let title = 'Chance', body = '';
  if (q.kind === 'coin') {
    const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
    title = 'Coin flip';
    body = side;
  } else if (q.kind === 'die') {
    const roll = rand(1, q.sides);
    title = 'd' + q.sides;
    body = String(roll);
  } else if (q.kind === 'dice') {
    const rolls = Array.from({ length: q.n }, () => rand(1, q.sides));
    title = q.n + 'd' + q.sides;
    body = rolls.join(' + ') + ' = ' + rolls.reduce((a, b) => a + b, 0);
  } else if (q.kind === 'num') {
    const n = rand(q.min, q.max);
    title = 'Random number';
    body = String(n) + (q.min !== 1 || q.max !== 100 ? ' (from ' + q.min + ' to ' + q.max + ')' : '');
  }
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(title) + '</h2><div style="font-size:48px;font-weight:300;margin:12px 0">' + esc(body) + '</div><div class="sub">ask again for another</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: [
    'roll a d20',
    'flip a coin',
    'random number between 1 and 100',
    'roll 2d6'
  ],
  nearMisses: [
    'what is a die',
    'dice game rules'
  ],
  match(lower, text) { return !!diceOf(text); },
  run,
  suite() {
    const ok = diceOf('roll a d20') && diceOf('flip a coin') && diceOf('random number between 1 and 100') && !diceOf('what is a die');
    return { ok: !!ok, got: ok ? 'matched examples' : 'missed' };
  }
};
