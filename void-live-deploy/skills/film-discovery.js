/**
 * film-discovery skill — structured JSON film metadata (asked by Void, daily 2026-10-14 ask-20261014-1820-3).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "film discovery", "discover films", "film metadata for Inception", "find films about space".
 * Returns a JSON object of film metadata on the stage. Empty surface stays empty.
 */
const FILMS = [
  { title: 'Inception', year: 2010, director: 'Christopher Nolan', genre: 'sci-fi', runtime: 148, rating: 8.8 },
  { title: 'The Matrix', year: 1999, director: 'Lana & Lilly Wachowski', genre: 'sci-fi', runtime: 136, rating: 8.7 },
  { title: 'Spirited Away', year: 2001, director: 'Hayao Miyazaki', genre: 'animation', runtime: 125, rating: 8.6 },
  { title: 'Parasite', year: 2019, director: 'Bong Joon-ho', genre: 'thriller', runtime: 132, rating: 8.5 },
  { title: 'Arrival', year: 2016, director: 'Denis Villeneuve', genre: 'sci-fi', runtime: 116, rating: 7.9 },
];

export function metadataFor(q) {
  const t = String(q || '').toLowerCase();
  const hit = FILMS.find((f) => t.includes(f.title.toLowerCase()) || t.includes(f.genre) || t.includes(String(f.year)));
  return hit || FILMS[0];
}

export function wantsDiscovery(lower) {
  const t = String(lower || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  return /\b(?:film\s+discovery|discover\s+films?|film\s+metadata|find\s+films?\s+about)\b/.test(t);
}

function run(text, api) {
  if (!wantsDiscovery(text)) return 'none';
  const meta = metadataFor(text);
  const json = JSON.stringify(meta, null, 2);
  api.showPage((el) => {
    el.innerHTML = '<h2>Film metadata</h2><pre class="src" style="white-space:pre-wrap;font-size:13px">' + api.esc(json) + '</pre>';
  });
  api.say('Film metadata as JSON');
  return 'film-discovery';
}

export default {
  name: 'film-discovery',
  examples: [
    'film discovery',
    'discover films',
    'film metadata for Inception',
    'find films about space',
  ],
  nearMisses: [
    'films',
    'best films of 2025',
    'void films',
    'watch a film',
  ],
  match(lower, text) { return wantsDiscovery(text || lower); },
  run,
};
