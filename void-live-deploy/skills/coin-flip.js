/**
 * coin-flip skill — flip a coin for a random heads or tails
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "flip a coin", "heads or tails", "coin flip", "toss a coin".
 * Empty stage stays empty; the card shows the result.
 */
export function isCoin(text) {
  return /^(?:please\s+)?(?:(?:flip|toss|throw)\s+(?:a\s+)?coin|(?:heads?\s+or\s+tails?|coin\s+flip|flip\s+it))$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

export function suite() {
  const ok = isCoin('flip a coin') && isCoin('heads or tails') && !isCoin('what is a coin');
  if (!ok) throw new Error('coin match failed');
  return true;
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!isCoin(text)) return 'none';
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><p style="font-size:48px;text-align:center;font-weight:600;margin:20px 0">' + esc(result) + '</p><div class="sub">say “flip a coin” again for another</div>';
  });
  return 'coin-flip';
}

export default {
  name: 'coin-flip',
  examples: ['flip a coin', 'heads or tails', 'coin flip', 'toss a coin'],
  nearMisses: ['what is a coin', 'coin collector', 'heads or tails of the market'],
  match(lower, text) { return isCoin(text); },
  run,
  suite,
};
