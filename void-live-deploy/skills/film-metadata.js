/**
 * film-metadata skill — film discovery returns JSON film metadata.
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "film discovery for inception", "movie metadata for matrix", "find films about space".
 * Uses the free iTunes Search API (no key). Returns JSON on the card. Empty surface stays empty.
 */
export function filmOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  const m = t.match(/^(?:film|movie)\s+(?:discovery|metadata|info|search)\s+(?:for|of|about)\s+(.+)$/i)
    || t.match(/^(?:find|discover|search)\s+(?:films?|movies?)\s+(?:about|for)\s+(.+)$/i)
    || t.match(/^(?:json\s+)?(?:film|movie)\s+metadata\s+(?:for|of)\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = filmOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>Film metadata</h2><div class="sub">looking up “' + esc(q) + '”…</div>'; });
  try {
    const r = await fetch('https://itunes.apple.com/search?term=' + encodeURIComponent(q) + '&entity=movie&limit=5&media=movie');
    if (!api._pageStill(el)) return 'film-metadata';
    const data = await r.json();
    const films = (data.results || []).map((f) => ({
      title: f.trackName, year: f.releaseDate && f.releaseDate.slice(0, 4), director: f.artistName,
      genre: f.primaryGenreName, runtime: f.trackTimeMillis && Math.round(f.trackTimeMillis / 60000) + ' min',
      description: f.longDescription || f.shortDescription || '',
    }));
    const json = JSON.stringify({ query: q, count: films.length, films }, null, 2);
    el.innerHTML = '<h2>Film metadata · ' + esc(q) + '</h2><pre style="white-space:pre-wrap;font-size:12px;background:rgba(0,0,0,.3);padding:12px;border-radius:8px;max-height:360px;overflow:auto">' + esc(json) + '</pre>'
      + '<div class="src">Source: <a href="https://affiliate.itunes.apple.com/resources/documentation/itunes-store-web-service-search-api/" target="_blank" rel="noopener">iTunes Search API</a> (no key)</div>';
    return 'film-metadata';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Film metadata</h2><p>The film service did not answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'film-metadata',
  examples: ['film discovery for inception', 'movie metadata for the matrix', 'find films about space'],
  nearMisses: ['films', 'voids fillms', 'best films of 2025', 'how do I film a video'],
  match(lower, text) { return !!filmOf(text); },
  run,
  suite() {
    return { ok: filmOf('film discovery for inception') === 'inception' && filmOf('hello') === null };
  },
};
