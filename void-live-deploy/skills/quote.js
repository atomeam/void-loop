/**
 * quote skill — a random quote or quote of the day.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "quote of the day", "give me a quote", "random quote".
 * Uses a small local list (no external call). Empty surface stays empty.
 */
const QUOTES = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
  { text: 'Stay hungry, stay foolish.', author: 'Steve Jobs' },
  { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
  { text: 'It is during our darkest moments that we must focus to see the light.', author: 'Aristotle' },
  { text: 'Do not go where the path may lead, go instead where there is no path and leave a trail.', author: 'Ralph Waldo Emerson' },
  { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
  { text: 'You miss 100% of the shots you don\'t take.', author: 'Wayne Gretzky' },
];

export function quoteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:give|show|tell)\s+(?:me\s+)?)?(?:a\s+|the\s+)?(?:random\s+|daily\s+)?quote(?:\s+of\s+the\s+day)?$/.test(t);
}

function pick() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

async function run(text, api) {
  if (!quoteOf(text)) return 'none';
  const { showPage, esc } = api;
  const q = pick();
  showPage((p) => {
    p.innerHTML = '<h2>Quote</h2><blockquote style="font-size:18px;line-height:1.4;margin:12px 0">' + esc(q.text) + '</blockquote><div class="sub">— ' + esc(q.author) + '</div>';
  });
  return 'quote';
}

export default {
  name: 'quote',
  examples: ['quote of the day', 'give me a quote', 'random quote'],
  nearMisses: ['what is a quote', 'stock quote', 'quote this'],
  match(lower, text) { return quoteOf(text || lower); },
  run,
  suite() {
    return { ok: quoteOf('quote of the day') && quoteOf('give me a quote') && !quoteOf('hello') };
  },
};
