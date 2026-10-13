/**
 * coin skill — flip a coin. "flip a coin", "heads or tails".
 * Empty surface stays empty; the result is a page card.
 * No network. Nothing is published.
 */
export function coinOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (/^(?:please\s+)?(?:flip\s+(?:a\s+|the\s+)?coin|coin\s+flip|heads\s+or\s+tails|toss\s+(?:a\s+|the\s+)?coin)$/i.test(t)) return true;
  return false;
}
export function flipCoin() {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}
async function run(text, api) {
  const { showPage, esc } = api;
  if (!coinOf(text)) return 'none';
  const side = flipCoin();
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2>'
      + '<p style="font-size:36px;font-weight:600;line-height:1.1">' + esc(side) + '</p>'
      + '<div class="sub">say “flip a coin” for another</div>'
      + '<div class="src">Nothing is published from this card.</div>';
  });
  return 'coin';
}
export default {
  name: 'coin',
  examples: ['flip a coin', 'coin flip', 'heads or tails', 'toss a coin', 'flip the coin'],
  nearMisses: ['what is a coin', 'bitcoin price', 'heads of state', 'weather in Kyoto'],
  coinOf,
  flipCoin,
  match(lower, text) { return coinOf(text); },
  run
};
