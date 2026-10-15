/**
 * coin skill: flip a coin.
 * "flip a coin", "coin flip", "heads or tails".
 * Empty surface stays empty.
 */
function isCoin(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:flip\s+(?:a\s+)?coin|coin\s+flip|heads\s+or\s+tails|toss\s+a\s+coin)$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!isCoin(text)) return 'none';
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><p style="font-size:32px;text-align:center">' + esc(result) + '</p>';
  });
  return 'coin';
}

export default {
  name: 'coin',
  examples: ['flip a coin', 'coin flip', 'heads or tails'],
  nearMisses: ['what is a coin', 'coin value'],
  match(lower, text) { return isCoin(text); },
  run,
  suite() {
    return { ok: isCoin('flip a coin') && !isCoin('hello') };
  },
};
