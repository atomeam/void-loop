/**
 * quote skill — a short inspirational quote (local list, no key)
 * "inspire me", "give me a quote", "quote of the day".
 */
const QUOTES = [
  ['The only way to do great work is to love what you do.', 'Steve Jobs'],
  ['In the middle of difficulty lies opportunity.', 'Albert Einstein'],
  ['What you do speaks so loudly that I cannot hear what you say.', 'Ralph Waldo Emerson'],
  ['The best time to plant a tree was 20 years ago. The second best time is now.', 'Chinese proverb'],
  ['You miss 100% of the shots you don\'t take.', 'Wayne Gretzky'],
  ['It always seems impossible until it\'s done.', 'Nelson Mandela'],
  ['The future belongs to those who believe in the beauty of their dreams.', 'Eleanor Roosevelt']
];
function isQuote(text) {
  return /^(?:inspire\s+me|give\s+me\s+a\s+quote|quote(?:\s+of\s+the\s+day)?|say\s+something\s+inspiring)$/i.test(String(text || '').trim().replace(/[?!.]+$/, ''));
}
async function run(text, api) {
  const { showPage, esc } = api;
  const [q, a] = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  showPage((p) => {
    p.innerHTML = '<h2>A quote</h2><p style="font-size:22px;line-height:1.5;font-style:italic">' + esc(q) + '</p><div class="sub">— ' + esc(a) + '</div>';
  });
  return 'quote';
}
function suite() {
  const ok = isQuote('inspire me') && isQuote('give me a quote') && !isQuote('what is a quote');
  return { ok, got: ok ? 'ok' : 'fail' };
}
export default {
  name: 'quote',
  examples: ['inspire me', 'give me a quote', 'quote of the day'],
  nearMisses: ['what is a quote', 'stock quote', 'quote this'],
  match(lower, text) { return isQuote(text); },
  run,
  suite
};
