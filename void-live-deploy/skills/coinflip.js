/**
 * coinflip skill — flip a coin or best of three
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "flip a coin", "heads or tails", "best of three coin flips".
 * Empty surface stays empty: the card appears only when summoned.
 */
export function isCoinFlip(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '');
  return /^(?:please\s+)?(?:(?:flip\s+(?:a\s+)?coin|heads\s+or\s+tails|coin\s+flip|best\s+of\s+(?:three|3)\s+coin\s+flips))$/i.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  const best = /best\s+of/i.test(text);
  const flips = best ? 3 : 1;
  const results = Array.from({ length: flips }, () => Math.random() < 0.5 ? 'heads' : 'tails');
  const counts = { heads: 0, tails: 0 };
  results.forEach(r => counts[r]++);
  const winner = counts.heads > counts.tails ? 'heads' : counts.tails > counts.heads ? 'tails' : 'tie';
  showPage((p) => {
    p.innerHTML = '<h2>Coin Flip</h2><p style="font-size:28px;text-align:center">' + esc(results.join(', ')) + '</p>'
      + (best ? '<p style="font-size:20px;text-align:center">Best of three: ' + esc(winner) + '</p>' : '')
      + '<div class="sub">say “flip a coin” again</div>';
  });
  return 'coinflip';
}

export default {
  name: 'coinflip',
  examples: ['flip a coin', 'heads or tails', 'best of three coin flips'],
  nearMisses: ['what is a coin', 'flip the card', 'random'],
  match(lower, text) { return isCoinFlip(text); },
  run,
  suite() {
    const ok = isCoinFlip('flip a coin') && isCoinFlip('heads or tails') && !isCoinFlip('what is a coin');
    return { ok, got: 'match works' };
  }
};
