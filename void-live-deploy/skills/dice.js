/**
 * dice skill — roll dice or flip a coin. No network.
 * "roll a d20", "roll 2d6", "flip a coin", "roll the dice".
 * Empty surface stays empty; the result is a card.
 */
export function diceOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:flip|toss)\s+(?:a\s+)?coin$|^coin\s+flip$|^heads\s+or\s+tails$/.test(t)) return { kind: 'coin' };
  const m = t.match(/^(?:roll|throw)\s+(?:a\s+|the\s+)?(?:dice|die)?\s*(\d+)?\s*d(\d+)(?:\s+\+\s*(\d+))?$/);
  if (m) return { kind: 'dice', n: +(m[1] || 1), sides: +m[2], mod: +(m[3] || 0) };
  if (/^(?:roll|throw)\s+(?:a\s+|the\s+)?(?:dice|die)$/.test(t)) return { kind: 'dice', n: 1, sides: 6, mod: 0 };
  if (/^d(\d+)$/.test(t)) { const s = +t.slice(1); return s >= 2 && s <= 100 ? { kind: 'dice', n: 1, sides: s, mod: 0 } : null; }
  return null;
}
function roll(n, sides) {
  const rolls = []; for (let i = 0; i < n; i++) rolls.push(1 + Math.floor(Math.random() * sides));
  return rolls;
}
export function suite() {
  const c = diceOf('flip a coin'); if (!c || c.kind !== 'coin') return { ok: false, got: 'coin' };
  const d = diceOf('roll 2d6 +1'); if (!d || d.n !== 2 || d.sides !== 6 || d.mod !== 1) return { ok: false, got: '2d6' };
  const one = diceOf('roll a d20'); if (!one || one.sides !== 20) return { ok: false, got: 'd20' };
  if (diceOf('what is a die')) return { ok: false, got: 'near' };
  return { ok: true };
}
async function run(text, api) {
  const hit = diceOf(text);
  if (!hit) return 'none';
  const { showPage, esc } = api;
  if (hit.kind === 'coin') {
    const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
    showPage((p) => { p.innerHTML = '<h2>Coin flip</h2><div style="font-size:48px;font-weight:300;text-align:center;margin:12px 0">' + esc(side) + '</div><div class="sub">say “flip a coin” again</div>'; });
    return 'dice';
  }
  const rolls = roll(hit.n, hit.sides);
  const sum = rolls.reduce((a, b) => a + b, 0) + hit.mod;
  const label = hit.n + 'd' + hit.sides + (hit.mod ? (hit.mod > 0 ? ' +' : ' ') + hit.mod : '');
  showPage((p) => {
    p.innerHTML = '<h2>Roll ' + esc(label) + '</h2><div style="font-size:42px;font-weight:300;text-align:center;margin:8px 0">' + sum + '</div>'
      + '<div class="sub">' + esc(rolls.join(' + ')) + (hit.mod ? ' ' + (hit.mod > 0 ? '+' : '') + hit.mod : '') + '</div>';
  });
  return 'dice';
}
export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'flip a coin', 'roll the dice', 'd6'],
  nearMisses: ['what is a die', 'dice game', 'play yahtzee', 'how many sides'],
  match(lower, text) { return !!diceOf(text); },
  suite,
  run,
};
