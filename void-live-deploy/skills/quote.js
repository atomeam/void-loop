/**
 * quote skill — "give me a quote", "daily quote", "inspire me".
 * Shows a short random quote on the card. Nothing is sent or stored. Empty surface stays empty.
 */
const QUOTES = [
  { text: "The only way to do great work is to love what you do.", by: "Steve Jobs" },
  { text: "In the middle of difficulty lies opportunity.", by: "Albert Einstein" },
  { text: "It always seems impossible until it is done.", by: "Nelson Mandela" },
  { text: "What you do today can improve all your tomorrows.", by: "Ralph Marston" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", by: "Chinese proverb" },
  { text: "You miss 100% of the shots you don't take.", by: "Wayne Gretzky" },
  { text: "Believe you can and you're halfway there.", by: "Theodore Roosevelt" },
  { text: "The future belongs to those who believe in the beauty of their dreams.", by: "Eleanor Roosevelt" },
];

export function quoteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:give me|show me|get|tell me)?\s*(?:a\s+)?(?:daily\s+|random\s+|inspirational\s+)?quote$|^inspire me$|^quote of the day$|^a quote$/.test(t);
}

function run(text, api) {
  if (!quoteOf(text)) return 'none';
  const { showPage, esc } = api;
  const q = QUOTES[Math.floor(Math.random() * QUOTES.length)];
  showPage((p) => {
    p.innerHTML = '<h2>Quote</h2><blockquote style="font-size:1.15em;line-height:1.4;margin:12px 0;padding-left:12px;border-left:3px solid #5b8def">' + esc(q.text) + '</blockquote><div class="sub">— ' + esc(q.by) + '</div><div class="src">Local quotes only. Nothing is sent.</div>';
  });
  return 'quote';
}

export default {
  name: 'quote',
  examples: ['give me a quote', 'daily quote', 'inspire me', 'quote of the day'],
  nearMisses: ['what is a quote', 'stock quote for AAPL', 'quote me on that', 'how to quote'],
  match(lower, text) { return quoteOf(text); },
  run,
  suite() {
    return { ok: quoteOf('give me a quote') === true && quoteOf('hello world') === false };
  },
};
