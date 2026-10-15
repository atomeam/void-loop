/**
 * quote skill: random inspirational quotes.
 * "give me a quote", "inspirational quote", "random quote".
 * Empty surface stays empty. Quotes are static, no external call.
 */
const QUOTES = [
  'The only way to do great work is to love what you do. — Steve Jobs',
  'In the middle of difficulty lies opportunity. — Albert Einstein',
  'Be the change that you wish to see in the world. — Mahatma Gandhi',
  'The future belongs to those who believe in the beauty of their dreams. — Eleanor Roosevelt',
  'Success is not final, failure is not fatal: it is the courage to continue that counts. — Winston Churchill',
];

function isQuote(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:give\s+me\s+(?:a\s+)?|random\s+|inspirational\s+)?quote$/.test(t);
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!isQuote(text)) return 'none';
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Quote</h2><p style="font-style:italic;font-size:18px">' + esc(q) + '</p>';
  });
  return 'quote';
}

export default {
  name: 'quote',
  examples: ['give me a quote', 'inspirational quote', 'random quote'],
  nearMisses: ['quote the bible', 'what is a quote'],
  match(lower, text) { return isQuote(text); },
  run,
  suite() {
    return { ok: isQuote('give me a quote') && !isQuote('hello') };
  },
};
