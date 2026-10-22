/**
 * quote skill — a short inspirational quote from a local list (no network)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "show me a quote", "inspirational quote", "give me a quote".
 * Empty surface stays empty: nothing is drawn until asked.
 */
const QUOTES = [
  ['The only way to do great work is to love what you do.', 'Steve Jobs'],
  ['In the middle of difficulty lies opportunity.', 'Albert Einstein'],
  ['It does not matter how slowly you go as long as you do not stop.', 'Confucius'],
  ['Everything you can imagine is real.', 'Pablo Picasso'],
  ['The future belongs to those who believe in the beauty of their dreams.', 'Eleanor Roosevelt'],
  ['What you get by achieving your goals is not as important as what you become by achieving your goals.', 'Zig Ziglar'],
  ['Believe you can and you\'re halfway there.', 'Theodore Roosevelt'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese Proverb'],
];
export function isQuote(text) {
  return /^(?:please\s+)?(?:(?:show|give|tell)\s+(?:me\s+)?(?:an?\s+|another\s+)?(?:inspirational\s+|motivational\s+)?quotes?|quotes?(?:\s+please)?|another\s+quote)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
function run(text, api) {
  const { showPage, esc } = api;
  const [q, a] = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  showPage((p) => {
    p.innerHTML = '<h2>A quote</h2><p style="font-size:22px;line-height:1.45;font-weight:300">' + esc(q) + '</p><div class="sub">— ' + esc(a) + '</div><div class="sub">say “another quote” for one more</div>';
  });
  return 'quote';
}
export default {
  name: 'quote',
  examples: ['show me a quote', 'inspirational quote', 'give me a quote', 'another quote'],
  nearMisses: ['what is a quote', 'stock quote', 'price quote'],
  match(lower, text) { return isQuote(text || lower); },
  run,
};
