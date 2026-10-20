/**
 * quote-of-day skill — a short inspirational quote (no key, pure local)
 * "quote of the day", "give me a quote", "inspirational quote", "motivate me".
 * A small set of classic quotes; empty stage stays empty until asked.
 */
const QUOTES = [
  { text: 'The only way to do great work is to love what you do.', by: 'Steve Jobs' },
  { text: 'In the middle of difficulty lies opportunity.', by: 'Albert Einstein' },
  { text: 'It always seems impossible until it is done.', by: 'Nelson Mandela' },
  { text: 'What you do today can improve all your tomorrows.', by: 'Ralph Marston' },
  { text: 'The future belongs to those who believe in the beauty of their dreams.', by: 'Eleanor Roosevelt' },
  { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', by: 'Winston Churchill' },
  { text: 'Believe you can and you\'re halfway there.', by: 'Theodore Roosevelt' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', by: 'Chinese proverb' },
];

export function isQuote(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:please\s+)?(?:(?:give|show|tell)\s+(?:me\s+)?(?:a|an|the|another)?\s*(?:inspirational\s+|motivational\s+|daily\s+)?quote(?:\s+of\s+the\s+day)?|quote\s+of\s+the\s+day|motivate\s+me|inspire\s+me|a\s+quote)$/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Quote of the day</h2><p style="font-size:22px;line-height:1.45;font-weight:300;font-style:italic">\u201c' + esc(q.text) + '\u201d</p><div class="sub">\u2014 ' + esc(q.by) + '</div><div class="src">Say \u201cquote of the day\u201d for another.</div>';
  });
  return 'quote-of-day';
}

export default {
  name: 'quote-of-day',
  examples: ['quote of the day', 'give me a quote', 'inspirational quote', 'motivate me'],
  nearMisses: ['what is a quote', 'stock quote', 'quote this text', 'history of quotes'],
  match(lower, text) { return isQuote(text); },
  run,
  suite() {
    return { ok: isQuote('quote of the day') && isQuote('give me a quote') && !isQuote('stock quote') && !isQuote('hello') };
  },
};
