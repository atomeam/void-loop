/**
 * coin skill — flip a coin: "flip a coin", "heads or tails", "coin flip".
 * Shows Heads or Tails. Empty stage stays empty.
 */

export function coinOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').toLowerCase();
  if (/\b(what is|history of|collecting|bitcoin|crypto)\b/.test(t)) return false;
  return /\b(flip|toss)\b.*\bcoin\b|\bcoin\s+(flip|toss)\b|\bheads?\s+or\s+tails?\b/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!coinOf(text)) return 'none';
  const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><p style="font-size:48px;font-weight:300">' + esc(side) + '</p>';
  });
  return 'coin';
}

export default {
  name: 'coin',
  examples: ['flip a coin', 'heads or tails', 'coin flip'],
  nearMisses: ['what is a coin', 'coin collecting', 'bitcoin price'],
  match(lower, text) { return coinOf(text); },
  run,
  suite() {
    const ok = coinOf('flip a coin') && coinOf('heads or tails') && coinOf('coin flip') && !coinOf('what is a coin') && !coinOf('bitcoin price');
    return { ok, got: 'ok' };
  }
};
