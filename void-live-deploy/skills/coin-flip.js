/**
 * coin-flip skill — flip a coin.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "flip a coin", "heads or tails", "coin flip".
 * Shows the result. Empty surface stays empty.
 */
export function coinOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:flip\s+(?:a\s+|the\s+)?)?coin(?:\s+flip)?$|^(?:heads\s+or\s+tails|tails\s+or\s+heads)$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!coinOf(text)) return 'none';
  const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><p style="font-size:36px;font-weight:300;text-align:center">' + esc(side) + '</p>'
      + '<div class="sub">say "flip a coin" again for another</div>';
  });
  return 'coin-flip';
}

export default {
  name: 'coin-flip',
  examples: ['flip a coin', 'heads or tails', 'coin flip'],
  nearMisses: ['what is a coin', 'coin value', 'flip the table'],
  match(lower, text) { return coinOf(text); },
  run,
  suite() {
    return { ok: coinOf('flip a coin') && !coinOf('hello') };
  },
};
