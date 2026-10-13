/**
 * dice skill - roll dice or flip a coin (pure, no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "roll a d20", "roll 2d6", "roll 3d8+2", "flip a coin", "heads or tails".
 */
export function diceOf(text) {
  const t = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:flip|toss)\s+(?:a\s+)?coin(?:\s+please)?$/.test(t) || /^heads\s+or\s+tails$/.test(t)) return { kind: 'coin' };
  const m = t.match(/^(?:please\s+)?(?:roll|throw)\s+(?:a\s+|an\s+|me\s+)?(\d+)?d(\d+)(?:\s*\+\s*(\d+))?$/);
  if (m) {
    const n = Math.min(20, Math.max(1, +(m[1] || 1)));
    const sides = Math.min(1000, Math.max(2, +m[2]));
    const mod = +(m[3] || 0);
    if (sides >= 2 && n >= 1) return { kind: 'dice', n, sides, mod };
  }
  return null;
}

function roll(sides) { return 1 + Math.floor(Math.random() * sides); }

function run(text, api) {
  const { showPage, esc } = api;
  const q = diceOf(text);
  if (!q) return 'none';
  if (q.kind === 'coin') {
    const face = Math.random() < 0.5 ? 'Heads' : 'Tails';
    showPage((el) => { el.innerHTML = '<h2>Coin flip</h2><div style="font-size:64px;font-weight:200;margin:12px 0">' + esc(face) + '</div><div class="sub">fair coin · say “flip a coin” again</div>'; });
    return 'dice';
  }
  const rolls = Array.from({ length: q.n }, () => roll(q.sides));
  const sum = rolls.reduce((a, b) => a + b, 0) + q.mod;
  const title = q.n + 'd' + q.sides + (q.mod ? '+' + q.mod : '');
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(title) + '</h2><div style="font-size:48px;font-weight:200;margin:8px 0">' + esc(String(sum)) + '</div>'
      + (q.n > 1 || q.mod ? '<div class="sub">' + esc(rolls.join(' + ') + (q.mod ? ' + ' + q.mod : '')) + '</div>' : '')
      + '<div class="src">Random roll · as of Oct 2026</div>';
  });
  return 'dice';
}

export default {
  name: 'dice',
  examples: ['roll a d20', 'roll 2d6', 'roll 3d8+2', 'flip a coin'],
  nearMisses: ['dice history', 'what is a d20', 'coin collection'],
  match(lower, text) { return !!diceOf(text || lower); },
  run,
  suite() {
    const a = diceOf('roll a d20'), b = diceOf('roll 2d6'), c = diceOf('flip a coin'), d = diceOf('what is a die');
    const ok = a && a.sides === 20 && a.n === 1 && b && b.n === 2 && b.sides === 6 && c && c.kind === 'coin' && !d;
    return { ok, got: ok ? 'pass' : JSON.stringify({ a, b, c, d }) };
  }
};
