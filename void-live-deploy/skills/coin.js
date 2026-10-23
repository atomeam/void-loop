/**
 * coin skill — flip a coin locally (no key, empty surface stays empty)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "flip a coin", "coin flip", "heads or tails".
 */
export function isCoin(text) {
  return /^(?:please\s+)?(?:flip\s+(?:a\s+)?coin|coin\s+flip|heads\s+or\s+tails|toss\s+a\s+coin)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}

async function run(text, api) {
  const { showPage } = api;
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><p style="font-size:36px;font-weight:300">' + result + '</p><div class="sub">say “flip a coin” again</div>';
  });
  return 'coin';
}

export default {
  name: 'coin',
  examples: ['flip a coin', 'coin flip', 'heads or tails'],
  nearMisses: ['what is a coin', 'crypto coin', 'coin collection'],
  match(lower, text) { return isCoin(text); },
  run,
  suite() {
    const ok = isCoin('flip a coin') && isCoin('heads or tails') && !isCoin('crypto coin');
    return { ok, got: 'match works' };
  }
};
