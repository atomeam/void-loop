/**
 * flip-coin skill — "flip a coin", "heads or tails", "coin flip".
 * Empty surface stays empty: a page with the result, nothing summoned.
 */
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

export function coinOf(text) {
  const t = CLEAN(text);
  return /^(?:please\s+)?(?:flip\s+(?:a\s+)?coin|heads\s+or\s+tails|coin\s+flip)$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!coinOf(text)) return 'none';
  const result = Math.random() < 0.5 ? 'heads' : 'tails';
  showPage((p) => {
    p.innerHTML = '<h2>Coin flip</h2><p style="font-size:32px;font-weight:300">' + esc(result) + '</p><div class="sub">say “flip a coin” for another</div>';
  });
  return 'flip-coin';
}

export default {
  name: 'flip-coin',
  examples: ['flip a coin', 'heads or tails', 'coin flip'],
  nearMisses: ['what is a coin', 'flip the page', 'tails of a comet', 'coin collection'],
  match(lower, text) { return coinOf(text || lower); },
  run,
  suite() {
    const hit = coinOf('flip a coin');
    const miss = coinOf('what is a coin');
    const ok = !!hit && !miss;
    return { ok, got: ok ? 'flips' : 'miss' };
  }
};
