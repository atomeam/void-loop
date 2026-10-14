/**
 * dice skill — roll dice or flip a coin (pure random, no key, no network)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a d20", "roll 2d6", "flip a coin", "roll 3d8+2", "roll the dice".
 * Empty surface stays empty: only answers its own asks.
 */
export function diceOf(text) {
  const raw = String(text || '').trim().replace(/[?!.]+$/, '');
  const t = raw.toLowerCase().replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:flip|toss)(?:\s+a)?\s+coin$/.test(t)) return { kind: 'coin' };
  const m = t.match(/^(?:roll|throw)\s+(?:a\s+|an\s+|the\s+)?(\d*)d(\d+)(?:\s*\+\s*(\d+))?$/);
  if (m) {
    const n = Math.min(20, Math.max(1, +(m[1] || 1)));
    const sides = Math.min(1000, Math.max(2, +m[2]));
    const mod = Math.min(1000, Math.max(0, +(m[3] || 0)));
    return { kind: 'dice', n, sides, mod };
  }
  if (/^roll\s+(?:a\s+)?die$/.test(t) || /^roll\s+the\s+dice$/.test(t) || /^roll\s+dice$/.test(t)) return { kind: 'dice', n: 1, sides: 6, mod: 0 };
  return null;
}
function roll(n, sides) {
  const rolls = Array.from({ length: n }, () => 1 + Math.floor(Math.random() * sides));
  return { rolls, sum: rolls.reduce((a, b) => a + b, 0) };
}
async function run(text, api) {
  const { showPage, esc } = api;
  const q = diceOf(text);
  if (!q) return 'none';
  if (q.kind === 'coin') {
    const face = Math.random() < 0.5 ? 'Heads' : 'Tails';
    showPage((p) => { p.innerHTML = '<h2>Coin flip</h2><div style="font-size:64px;font-weight:300;line-height:1.1">' + esc(face) + '</div><p style="color:#8a8a8a">say “flip a coin” for another</p>'; });
    return 'dice';
  }
  const { rolls, sum } = roll(q.n, q.sides);
  const total = sum + q.mod;
  const detail = q.n > 1 || q.mod
    ? (q.n > 1 ? rolls.join(' + ') : String(sum)) + (q.mod ? ' + ' + q.mod : '') + ' = ' + total
    : String(total);
  const title = 'Roll ' + q.n + 'd' + q.sides + (q.mod ? '+' + q.mod : '');
  showPage((p) => { p.innerHTML = '<h2>' + esc(title) + '</h2><div style="font-size:64px;font-weight:300;line-height:1.1">' + esc(String(total)) + '</div><p style="color:#8a8a8a">' + esc(detail) + '</p><div class="sub">say “roll a d20” or “flip a coin” for another</div>'; });
  return 'dice';
}
export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'flip a coin', 'roll 3d8+2', 'roll the dice'],
  nearMisses: ['what is a d20', 'history of dice', 'coin collection', 'roll of thunder'],
  match(lower, text) { return !!diceOf(text); },
  run
};
