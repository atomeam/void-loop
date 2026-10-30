/**
 * coinflip skill — flip a coin and show heads or tails
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "flip a coin", "coin flip", "heads or tails".
 */
export function isCoinFlip(text) {
  return /^(?:please\s+)?(?:(?:flip|toss)\s+(?:a\s+)?coin|coin\s+flip|heads\s+or\s+tails)(?:\s+please)?$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function run(text, api) {
  const { showPage, esc } = api;
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((p) => { p.innerHTML = '<h2>Coin Flip</h2><p style="font-size:48px;text-align:center">' + esc(result) + '</p><div class="sub">say “flip a coin” again</div>'; });
  return 'coinflip';
}

export default {
  name: 'coinflip',
  examples: ['flip a coin', 'coin flip', 'heads or tails', 'toss a coin'],
  nearMisses: ['what is a coin flip', 'coin', 'flip'],
  match(lower, text) { return isCoinFlip(text); },
  run,
  suite() {
    const ok = isCoinFlip('flip a coin') && isCoinFlip('heads or tails') && !isCoinFlip('what is a coin flip');
    return { ok, got: 'match works' };
  }
};
