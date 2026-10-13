/**
 * coin skill — flip a fair coin, heads or tails
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api), suite }
 * "flip a coin", "heads or tails", "toss a coin".
 */
export function isCoin(text) {
  return /^(?:please\s+)?(?:flip\s+(?:a\s+|the\s+)?coin|heads\s+or\s+tails|toss\s+(?:a\s+|the\s+)?coin|coin\s+flip|flip\s+it)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((p) => { p.innerHTML = '<h2>Coin flip</h2><p style="font-size:48px;font-weight:300;line-height:1.1">' + esc(side) + '</p><div class="sub">a fair coin · say “flip a coin” for another</div>'; });
  return 'coin';
}

export function suite() {
  return { ok: isCoin('flip a coin') && isCoin('heads or tails') && isCoin('toss a coin') && !isCoin('what is a coin') && !isCoin('flip the switch') && !isCoin('coin collection') };
}

export default {
  name: 'coin',
  examples: ['flip a coin', 'heads or tails', 'toss a coin'],
  nearMisses: ['what is a coin', 'flip the page', 'coin collection', 'heads up'],
  match(lower, text) { return isCoin(text); },
  run,
  suite
};
