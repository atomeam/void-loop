/**
 * daily-quote skill - structured quote metadata as JSON.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "daily quote", "quote of the day", "give me a quote".
 * Returns a JSON object with text, author, source on the card (static curated sample).
 */
const SAMPLE = {
  text: 'The only way to do great work is to love what you do.',
  author: 'Steve Jobs',
  source: 'Stanford commencement address, 2005',
  date: '2026-10-14'
};

/** { text, author, source, date } for a quote ask, or null. Pure. */
export function quoteOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!/\b(?:daily\s+quote|quote\s+of\s+the\s+day|give\s+me\s+a\s+quote|random\s+quote)\b/.test(t)) return null;
  return SAMPLE;
}

function run(text, api) {
  const q = quoteOf(text);
  if (!q) return 'none';
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>' + esc('Daily quote') + '</h2>'
      + '<blockquote style="font-size:18px;margin:12px 0">' + esc(q.text) + '</blockquote>'
      + '<p>' + esc('— ' + q.author) + '</p>'
      + '<pre style="white-space:pre-wrap;font-size:13px;background:rgba(255,255,255,.06);padding:10px;border-radius:8px">' + esc(JSON.stringify(q, null, 2)) + '</pre>'
      + '<div class="src">' + esc('Curated sample · as of 2026-10') + '</div>';
  });
  return 'daily-quote';
}

export default {
  name: 'daily-quote',
  examples: [
    'daily quote',
    'quote of the day',
    'give me a quote'
  ],
  nearMisses: [
    'films',
    'convert',
    'joke'
  ],
  match(lower, text) { return !!quoteOf(text || lower); },
  run
};
