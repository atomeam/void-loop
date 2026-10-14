/**
 * coin skill — flip a coin, heads or tails
 * "flip a coin", "heads or tails", "coin flip".
 * Empty surface stays empty: no match returns none.
 */
export function isCoin(text) {
  return /^(?:please\s+)?(?:flip\s+(?:a\s+)?coin|(?:heads|tails)\s+or\s+(?:tails|heads)|coin\s+flip|toss\s+a\s+coin)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!isCoin(text)) return 'none';
  const side = Math.random() < 0.5 ? 'heads' : 'tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><p style="font-size:32px;font-weight:300;text-align:center">' + esc(side) + '</p><div class="sub">say “flip a coin” for another</div>';
  });
  return 'coin';
}

export default {
  name: 'coin',
  examples: ['flip a coin', 'heads or tails', 'coin flip', 'toss a coin'],
  nearMisses: ['what is a coin', 'bitcoin price', 'flip a switch', 'heads up'],
  match(lower, text) { return isCoin(text); },
  run
};
