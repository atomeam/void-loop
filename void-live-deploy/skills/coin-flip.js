/**
 * coin-flip skill - flip a fair coin
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const WHEN = /^(?:please\s+)?(?:flip\s+(?:a\s+)?coin|heads\s+or\s+tails|toss\s+(?:a\s+)?coin|coin\s+flip)$/i;

function run(text, api) {
  const { showPage, esc } = api;
  const result = Math.random() < 0.5 ? 'Heads' : 'Tails';
  showPage((el) => {
    el.innerHTML = '<h2>Coin flip</h2><p style="font-size:64px;text-align:center">' + esc(result) + '</p><div class="src">Fair 50/50 coin \u00b7 as of ' + new Date().toISOString().slice(0, 7) + '</div>';
  });
  return 'coin-flip';
}

export default {
  name: 'coin-flip',
  examples: ['flip a coin', 'heads or tails'],
  nearMisses: ['what is a coin', 'coin collection'],
  match(lower) { return WHEN.test(String(lower || '').trim()); },
  run,
  suite() {
    const ok = WHEN.test('flip a coin') && WHEN.test('heads or tails') && !WHEN.test('what is a coin');
    return { ok, got: ok ? undefined : 'match failed' };
  }
};
