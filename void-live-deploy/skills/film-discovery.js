/**
 * film-discovery skill - structured film metadata as JSON (asked by Void, daily 2026-10-14 ask-20261014-1820-3:
 * "Convert the 'film discovery' logic into a structured skill that outputs a JSON object containing film metadata").
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "film discovery", "discover films about space", "film metadata for Inception".
 * Returns a JSON object with title, year, director, genre, rating, plot on the card (static curated sample; no external API).
 * One-off film lists stay with other skills; this is the structured metadata card.
 */
const SAMPLE = {
  query: 'space',
  results: [
    { title: 'Interstellar', year: 2014, director: 'Christopher Nolan', genre: ['sci-fi', 'drama'], rating: 8.7, plot: 'A team of explorers travel through a wormhole in space in an attempt to ensure humanity\'s survival.' },
    { title: '2001: A Space Odyssey', year: 1968, director: 'Stanley Kubrick', genre: ['sci-fi'], rating: 8.3, plot: 'Humanity finds a mysterious artifact on the Moon and a mission to Jupiter follows.' },
    { title: 'Arrival', year: 2016, director: 'Denis Villeneuve', genre: ['sci-fi', 'drama'], rating: 7.9, plot: 'A linguist works with the military to communicate with alien visitors.' }
  ]
};

/** { query, results: [{ title, year, director, genre, rating, plot }] } for a discovery ask, or null. Pure. */
export function metadataOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!/\b(?:film|movie)\s+(?:discovery|metadata|info|details)\b|\bdiscover\s+(?:films|movies)\b/.test(t)) return null;
  const q = t.match(/(?:about|for|on)\s+(.+)$/);
  const query = q ? q[1].replace(/^(?:the\s+)?/, '') : 'space';
  return { ...SAMPLE, query };
}

function run(text, api) {
  const meta = metadataOf(text);
  if (!meta) return 'none';
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>' + esc('Film discovery') + '</h2>'
      + '<p>' + esc('Structured metadata for “' + meta.query + '”') + '</p>'
      + '<pre style="white-space:pre-wrap;font-size:13px;background:rgba(255,255,255,.06);padding:10px;border-radius:8px">' + esc(JSON.stringify(meta, null, 2)) + '</pre>'
      + '<div class="src">' + esc('Curated sample · as of 2026-10 · no external lookup') + '</div>';
  });
  return 'film-discovery';
}

export default {
  name: 'film-discovery',
  examples: [
    'film discovery',
    'discover films',
    'discover films about space',
    'film metadata for Inception'
  ],
  nearMisses: [
    'films',
    'void films',
    'best films of 2025',
    'film a timer'
  ],
  match(lower, text) { return !!metadataOf(text || lower); },
  run
};
