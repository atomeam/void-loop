/**
 * coin-flip skill — flip a fair coin
 * "flip a coin", "heads or tails", "coin flip", "toss a coin"
 */
export function isCoin(text) {
  return /^(?:please\s+)?(?:flip\s+(?:a\s+)?coin|coin\s+flip|heads\s+or\s+tails|toss\s+a\s+coin)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
async function run(text, api) {
  const { showPage, esc } = api;
  const side = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><p style="font-size:48px;text-align:center;margin:24px 0;font-weight:300">' + esc(side) + '</p><div class="sub">say “flip a coin” for another</div>';
  });
  return 'coin-flip';
}
export default {
  name: 'coin-flip',
  examples: ['flip a coin', 'heads or tails', 'coin flip', 'toss a coin'],
  nearMisses: ['what is a coin', 'flip the page', 'coin collection'],
  match(lower, text) { return isCoin(text); },
  run,
  suite() {
    const ok = isCoin('flip a coin') && isCoin('heads or tails') && !isCoin('what is a coin');
    return { ok, got: ok ? 'pass' : 'match failed' };
  }
};
