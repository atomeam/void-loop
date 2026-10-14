/**
 * coin skill — flip a coin. "flip a coin", "heads or tails", "toss a coin".
 * Empty surface stays empty; the result is a page that stays until closed or thrown.
 */
export function isCoin(text) {
  return /^(?:please\s+)?(?:flip\s+(?:a\s+)?coin|toss\s+(?:a\s+)?coin|heads?\s+or\s+tails?|coin\s+flip|flip\s+it)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
async function run(text, api) {
  const { showPage, esc } = api;
  if (!isCoin(text)) return 'none';
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
  const el = showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><p style="font-size:48px;line-height:1.2;font-weight:600;margin:20px 0">' + esc(result) + '</p><div class="sub">say “flip a coin” for another</div>';
  });
  return 'coin';
}
export default {
  name: 'coin',
  examples: ['flip a coin', 'heads or tails', 'toss a coin', 'coin flip'],
  nearMisses: ['what is a coin', 'how many coins', 'coin collection'],
  match(lower, text) { return isCoin(text); },
  run,
};
