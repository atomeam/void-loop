/**
 * today-quote skill — a daily motivational quote card.
 * "today's quote", "quote of the day", "give me a quote".
 * Empty surface stays empty.
 */
const QUOTES = [
  { text: "The only way to do great work is to love what you do.", by: "Steve Jobs" },
  { text: "Build something that matters.", by: "V01D" },
  { text: "Every experiment is a film waiting to be made.", by: "V01D FILMS" },
  { text: "Ship it, then make it better.", by: "the loop" },
];

export function quoteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /^(?:today'?s?\s+)?quote(?:\s+of\s+the\s+day)?$|^give\s+me\s+a\s+quote$|^motivational\s+quote$/.test(t) ? true : null;
}

function run(text, api) {
  const { showPage, esc } = api;
  if (!quoteOf(text)) return 'none';
  const q = QUOTES[new Date().getDate() % QUOTES.length];
  showPage((p) => {
    p.innerHTML = '<h2>Today\'s quote</h2><blockquote style="font-size:18px;margin:16px 0;padding:12px 16px;border-left:4px solid #7a5cff">' + esc(q.text) + '</blockquote><div class="sub">— ' + esc(q.by) + '</div>';
  });
  return 'today-quote';
}

export default {
  name: 'today-quote',
  examples: ["today's quote", 'quote of the day', 'give me a quote'],
  nearMisses: ['what is a quote', 'stock quote', 'quote this card'],
  match(lower, text) { return !!quoteOf(text); },
  run,
  suite() {
    return { ok: quoteOf("today's quote") === true && quoteOf('hello') === null };
  },
};
