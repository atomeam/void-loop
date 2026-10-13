/**
 * coin skill — flip a coin locally
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "flip a coin", "heads or tails", "coin toss"
 */
export function isCoin(text) {
  return /^(?:(?:flip|toss)\s+(?:a\s+)?coin|heads?\s+or\s+tails?|coin\s+(?:flip|toss)|flip\s+it)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
async function run(text, api) {
  const { showPage, esc } = api;
  if (!isCoin(text)) return 'none';
  const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2>'
      + '<div style="font-size:64px;font-weight:300;margin:12px 0">' + esc(side) + '</div>'
      + '<div class="sub">say “flip a coin” again</div>';
  });
  return 'coin';
}
export default {
  name: 'coin',
  examples: ['flip a coin', 'heads or tails', 'coin toss', 'toss a coin'],
  nearMisses: ['what is a coin', 'bitcoin price', 'currency'],
  match(lower, text) { return isCoin(text); },
  run
};
