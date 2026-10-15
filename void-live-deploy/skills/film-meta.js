/**
 * film-meta skill — structured JSON film metadata (asked by Void, daily 2026-10-14 ask-20261014-1820-3).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "film metadata for the matrix", "discover film inception", "json for film arrival".
 * Returns a JSON object with title, year, genre, plot (placeholder or from known list; empty surface stays empty — shows the object as text).
 * One-off discovery; leaves general film talk to other skills.
 */
const KNOWN = {
  matrix: { title: 'The Matrix', year: 1999, genre: 'Sci-Fi', director: 'Lana Wachowski, Lilly Wachowski', plot: 'A computer hacker learns about the true nature of reality and his role in the war against its controllers.' },
  inception: { title: 'Inception', year: 2010, genre: 'Sci-Fi', director: 'Christopher Nolan', plot: 'A thief who steals corporate secrets through dream-sharing technology is given the inverse task of planting an idea.' },
  arrival: { title: 'Arrival', year: 2016, genre: 'Sci-Fi', director: 'Denis Villeneuve', plot: 'A linguist is recruited by the military to communicate with aliens after twelve mysterious spacecraft land around the world.' },
};

function titleOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  const m = t.match(/(?:film|movie)(?:\s+metadata|\s+discovery)?\s+(?:for|of|about)?\s+(.+)/) || t.match(/discover\s+(?:film|movie)\s+(.+)/) || t.match(/json\s+(?:for|of)\s+(?:film|movie)\s+(.+)/);
  return m ? m[1].trim() : null;
}

export function wantsFilmMeta(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '');
  return /^(?:film|movie)\s+(?:metadata|discovery|json)|discover\s+(?:film|movie)|json\s+(?:for|of)\s+(?:film|movie)/.test(t);
}

function run(text, api) {
  const { showPage, esc } = api;
  const titleKey = titleOf(text);
  const key = titleKey ? titleKey.replace(/\s+/g, '').toLowerCase().slice(0, 20) : null;
  const meta = (key && KNOWN[key]) || { title: titleKey || 'Unknown film', year: null, genre: 'Unknown', plot: 'Metadata not in the local list. Ask for a known title like The Matrix.' };
  const json = JSON.stringify(meta, null, 2);
  showPage((el) => {
    el.innerHTML = '<h2>Film metadata</h2><pre style="white-space:pre-wrap;font-size:14px;line-height:1.4;background:rgba(255,255,255,.04);padding:12px;border-radius:8px">' + esc(json) + '</pre><div class="src">Structured JSON · local list for now</div>';
  });
  return 'film-meta';
}

export default {
  name: 'film-meta',
  examples: [
    'film metadata for the matrix',
    'discover film inception',
    'json for film arrival',
  ],
  nearMisses: [
    'best films of 2025',
    'where to watch films',
    'film a timer',
  ],
  match(lower, text) { return wantsFilmMeta(text || lower); },
  run,
};
