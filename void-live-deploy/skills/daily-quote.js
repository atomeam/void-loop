/**
 * daily-quote skill — a daily inspirational quote on a card.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "daily quote", "inspirational quote", "quote of the day".
 * Fixed short list, rotates by day. Empty surface stays empty.
 */
const QUOTES = [
  { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
  { text: 'Stay hungry, stay foolish.', author: 'Steve Jobs' },
  { text: 'What you do today can improve all your tomorrows.', author: 'Ralph Marston' },
  { text: 'The future depends on what you do today.', author: 'Mahatma Gandhi' },
  { text: 'Believe you can and you\'re halfway there.', author: 'Theodore Roosevelt' },
];

export function quoteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:(?:show|give me|get)\s+(?:a\s+)?)?(?:daily\s+|inspirational\s+|motivational\s+)?quote(?:\s+of\s+the\s+day)?$/i.test(t);
}

function todayQuote() {
  const day = Math.floor(Date.now() / 86400000);
  return QUOTES[day % QUOTES.length];
}

async function run(text, api) {
  const { showPage, esc } = api;
  if (!quoteOf(text)) return 'none';
  const q = todayQuote();
  showPage((p) => {
    p.innerHTML = '<h2>Daily quote</h2><blockquote style="font-size:1.2em;margin:16px 0;border-left:3px solid #88f;padding-left:12px">' + esc(q.text) + '</blockquote><div class="sub">— ' + esc(q.author) + '</div><div class="src">Rotates by day. Empty surface stays empty.</div>';
  });
  return 'daily-quote';
}

export default {
  name: 'daily-quote',
  examples: ['daily quote', 'inspirational quote', 'quote of the day', 'show me a quote'],
  nearMisses: ['what is a quote', 'quote from a movie', 'joke', 'news'],
  match(lower, text) { return quoteOf(text); },
  run,
  suite() {
    return { ok: quoteOf('daily quote') && quoteOf('quote of the day') && !quoteOf('joke') && !quoteOf('news') };
  },
};
