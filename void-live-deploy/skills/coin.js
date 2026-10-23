/**
 * coin skill — flip a coin, heads or tails
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "flip a coin", "coin flip", "heads or tails".
 */
export function isCoin(text) {
  return /^(?:please\s+)?(?:flip\s+(?:a\s+)?coin|coin\s+flip|heads\s+or\s+tails|toss\s+(?:a\s+)?coin)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

function flip() {
  return Math.random() < 0.5 ? 'Heads' : 'Tails';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const result = flip();
  const el = showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><p style="font-size:28px;font-weight:500">' + esc(result) + '</p><div class="sub">say “flip a coin” again for another</div>';
  });
  return 'coin';
}

export default {
  name: 'coin',
  examples: ['flip a coin', 'coin flip', 'heads or tails', 'toss a coin'],
  nearMisses: ['what is a coin', 'crypto coin', 'flip the script'],
  match(lower, text) { return isCoin(text); },
  run,
  suite() {
    const ok = isCoin('flip a coin') && isCoin('heads or tails') && !isCoin('crypto coin');
    return { ok, got: 'match works' };
  }
};
