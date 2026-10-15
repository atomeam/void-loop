/**
 * film-discovery skill - structured film metadata as JSON (asked by Void, daily 2026-10-14 ask-20261014-1820-3:
 * "Convert the 'film discovery' logic into a structured skill that outputs a JSON object containing film metadata").
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "discover films", "film metadata", "films about space", "metadata for Inception".
 * Shows a card with JSON for Void's own films and sample public ones; empty surface stays empty.
 * Pure JSON output on the stage so other tools can read it.
 */
const FILMS = [
  { title: "V01D Daily Experiment", year: 2026, director: "V01D", genre: "experimental", runtime: "short", note: "Shot in a real browser, built by itself", source: "a-to-mind.com/films/" },
  { title: "The Void Stage", year: 2026, director: "V01D", genre: "interactive", runtime: "live", note: "A blank stage that learns from every ask", source: "a-to-mind.com" },
  { title: "Inception", year: 2010, director: "Christopher Nolan", genre: "sci-fi", runtime: 148, note: "Dreams within dreams", source: "public domain metadata" },
  { title: "Arrival", year: 2016, director: "Denis Villeneuve", genre: "sci-fi", runtime: 116, note: "Language as time", source: "public domain metadata" }
];

export function metadataFor(query) {
  const q = String(query || '').toLowerCase();
  if (!q || /discover|metadata|films?|movies?/.test(q)) return FILMS;
  return FILMS.filter(f => f.title.toLowerCase().includes(q) || f.genre.includes(q) || (f.note && f.note.toLowerCase().includes(q)));
}

function run(text, api) {
  const { showPage, esc } = api;
  const meta = metadataFor(text);
  const json = JSON.stringify(meta, null, 2);
  showPage((el) => {
    el.innerHTML = '<h2>Film metadata</h2><div class="sub">structured JSON for discovery</div><pre style="background:rgba(255,255,255,.06);padding:12px;border-radius:8px;overflow:auto;font-size:13px">' + esc(json) + '</pre><div class="src">Void\'s films + public samples · nothing uploaded</div>';
  });
  api.say('Film metadata as JSON is on the stage · ' + meta.length + ' entries');
  return 'film-discovery';
}

export default {
  name: 'film-discovery',
  examples: [
    'discover films',
    'film metadata',
    'films about space',
    'metadata for Inception',
    'discover movies'
  ],
  nearMisses: [
    'films',
    'voids films',
    'best films of 2025',
    'how do I film a video'
  ],
  match(lower, text) { return /^(?:discover|find|show|get|give me)\s+(?:film|movie)\s+(?:metadata|discovery|info)|film\s+metadata|discover\s+films?|films?\s+about\s+\w+/.test(String(text || lower || '').trim().toLowerCase()); },
  run,
};
