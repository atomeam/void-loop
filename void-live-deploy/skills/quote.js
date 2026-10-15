/**
 * quote skill — a short quote: "give me a quote", "random quote", "inspire me".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * A few classic lines, no network. Empty surface stays empty.
 */
const QUOTES = [
  ['The only way to do great work is to love what you do.', 'Steve Jobs'],
  ['Be the change that you wish to see in the world.', 'Mahatma Gandhi'],
  ['In the middle of difficulty lies opportunity.', 'Albert Einstein'],
  ['It is never too late to be what you might have been.', 'George Eliot'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese proverb'],
  ['What you do speaks so loudly that I cannot hear what you say.', 'Ralph Waldo Emerson'],
];
export function isQuote(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:please\s+)?(?:give|tell|show)\s+(?:me\s+)?(?:a\s+)?(?:random\s+)?quote|random\s+quote|inspire\s+me|give\s+me\s+inspiration)$/.test(t);
}
async function run(text, api) {
  const { showPage, esc } = api;
  if (!isQuote(text)) return 'none';
  const [q, by] = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  showPage((p) => {
    p.innerHTML = '<h2>A quote</h2><p style="font-size:20px;line-height:1.5;font-weight:300">“' + esc(q) + '”</p><div class="sub">— ' + esc(by) + '</div>';
  });
  return 'quote';
}
export default {
  name: 'quote',
  examples: ['give me a quote', 'random quote', 'inspire me', 'tell me a quote'],
  nearMisses: ['stock quote', 'quote of the day website', 'what is a quotation'],
  match(lower, text) { return isQuote(text); },
  run,
  suite() {
    return { ok: isQuote('give me a quote') && !isQuote('hello') };
  },
};
