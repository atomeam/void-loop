/**
 * coinflip skill — "flip a coin", "heads or tails", "coin flip".
 * Pure random. Nothing is sent.
 */
export function flip() {
  return Math.random() < 0.5 ? 'heads' : 'tails';
}

export function isCoinFlip(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:flip|toss)\s+(?:a\s+)?coin|(?:heads\s+or\s+tails|coin\s+flip|flip\s+heads\s+or\s+tails))$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  const result = flip();
  const el = showPage();
  if (!api._pageStill(el)) return 'none';
  el.innerHTML = '<h2>Coin flip</h2><p class="big">' + esc(result) + '</p><div class="sub">flip again for another</div>';
  return 'coinflip';
}

export default {
  name: 'coinflip',
  examples: ['flip a coin', 'heads or tails', 'coin flip'],
  nearMisses: ['what is a coin', 'flip the table', 'heads up'],
  match(lower, text) { return isCoinFlip(text); },
  run
};
