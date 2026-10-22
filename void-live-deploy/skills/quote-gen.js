/**
 * quote-gen skill — a short inspirational quote (built-in, no external call)
 * "tell me a quote", "inspire me", "quote of the day"
 */
const QUOTES = [
  ['The only way to do great work is to love what you do.', 'Steve Jobs'],
  ['Life is what happens when you\'re busy making other plans.', 'John Lennon'],
  ['The future belongs to those who believe in the beauty of their dreams.', 'Eleanor Roosevelt'],
  ['It is during our darkest moments that we must focus to see the light.', 'Aristotle'],
  ['Success is not final, failure is not fatal: It is the courage to continue that counts.', 'Winston Churchill'],
  ['The only impossible journey is the one you never begin.', 'Tony Robbins'],
  ['Believe you can and you\'re halfway there.', 'Theodore Roosevelt'],
  ['Do what you can, with what you have, where you are.', 'Theodore Roosevelt'],
];

export function wantsQuote(lower) {
  return /^(?:please\s+)?(?:tell\s+me\s+(?:a\s+)?quote|inspire\s+me|quote\s+of\s+the\s+day|give\s+me\s+(?:a\s+)?quote|a\s+quote)$/i.test(String(lower || '').trim().replace(/[?!.]+$/, ''));
}

export function pickQuote() {
  return QUOTES[Math.floor(Math.random() * QUOTES.length)];
}

async function run(text, api) {
  const { showPage, esc } = api;
  const [q, a] = pickQuote();
  showPage((p) => {
    p.innerHTML = '<h2>A quote</h2><p style="font-size:20px;line-height:1.45;font-style:italic">' + esc(q) + '</p><div class="sub">— ' + esc(a) + '</div>';
  });
  return 'quote-gen';
}

export default {
  name: 'quote-gen',
  examples: ['tell me a quote', 'inspire me', 'quote of the day', 'give me a quote'],
  nearMisses: ['what is a quote', 'quote this text', 'stock quote'],
  match(lower) { return wantsQuote(lower); },
  run,
  suite() {
    const ok = wantsQuote('tell me a quote') && !wantsQuote('what is a quote') && pickQuote().length === 2;
    return { ok };
  },
};
