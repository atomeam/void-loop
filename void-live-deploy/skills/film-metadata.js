/**
 * film-metadata skill — film discovery returns structured JSON film metadata (asked by Void, frontier: "Film discovery as a structured skill
 * returning JSON film metadata"). "find me a sci-fi film from the 80s", "films by Kurosawa", "film metadata for Ikiru", "find films about space".
 * The ask goes to GET /api/filmfind (lib/film-discovery.js, the iTunes Search API only); the card shows each film's title, year, director,
 * runtime, genres, one-line plot and its source, and a "Copy as JSON" chip puts the same list on the clipboard. A field the source does not
 * give is left out of the card and null in the JSON; when nothing is found the card says so and lists no film.
 */
import { parseDiscoveryAsk } from '../lib/film-discovery.js';

/** the title/topic of the older "film metadata for X" asks (kept: skills/movie.js links to them); null for any other ask. Pure. */
export function filmOf(text) {
  const q = parseDiscoveryAsk(text);
  return q ? (q.title || q.topic || q.director || q.genre || null) : null;
}

const facts = (f) => [['Year', f.year], ['Director', f.director], ['Runtime', f.runtime_min ? f.runtime_min + ' min' : ''], ['Genres', (f.genres || []).join(', ')]].filter((x) => x[1]);
/** the card for a discovery result. Pure given the result and esc. */
export function filmCard(res, esc) {
  const head = '<h2>Film metadata · ' + esc(res.ask || 'films') + '</h2>';
  if (!res.count) return head + '<p>' + esc(res.note || 'No film found.') + '</p>';
  const row = (f) => '<div class="fm-film" style="margin:10px 0"><b>' + esc(f.title) + (f.year ? ' (' + f.year + ')' : '') + '</b>'
    + '<dl style="display:grid;grid-template-columns:auto 1fr;gap:2px 12px;margin:4px 0">' + facts(f).map((x) => '<dt style="color:var(--muted,#9a9aa2)">' + x[0] + '</dt><dd style="margin:0">' + esc(x[1]) + '</dd>').join('') + '</dl>'
    + (f.plot ? '<div>' + esc(f.plot) + '</div>' : '')
    + '<div class="sub">from ' + (f.source && /^https:\/\//.test(f.source.url || '') ? '<a href="' + esc(f.source.url) + '" target="_blank" rel="noopener">' + esc(f.source.name) + '</a>' : esc((f.source && f.source.name) || 'the source')) + '</div></div>';
  return head + '<div class="sub">' + res.count + ' found; every field below came from the source, none is guessed</div>'
    + '<button class="g-btn fm-copy" type="button">Copy as JSON</button>'
    + res.films.map(row).join('')
    + '<details><summary>JSON</summary><pre class="fm-json" style="white-space:pre-wrap;font-size:12px;background:rgba(0,0,0,.3);padding:12px;border-radius:8px;max-height:360px;overflow:auto">' + esc(JSON.stringify(res, null, 2)) + '</pre></details>'
    + '<div class="src">Source: ' + esc((res.sources || []).join(' · ')) + '</div>';
}

async function run(text, api) {
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Film metadata</h2><div class="sub">looking it up…</div>'; });
  try {
    const r = await fetch('/api/filmfind?q=' + encodeURIComponent(String(text).slice(0, 160)));
    if (!r.ok) throw new Error('http ' + r.status);
    const res = await r.json();
    if (!api._pageStill(el)) return 'film-metadata';
    el.innerHTML = filmCard(res, esc);
    const b = el.querySelector('.fm-copy');
    if (b) b.addEventListener('click', async () => {
      const json = JSON.stringify(res, null, 2);
      try { await navigator.clipboard.writeText(json); b.textContent = 'Copied'; }
      catch (_) { const pre = el.querySelector('.fm-json'); if (pre) { pre.closest('details').open = true; const s = getSelection(), g = document.createRange(); g.selectNodeContents(pre); s.removeAllRanges(); s.addRange(g); } b.textContent = 'Select and copy below'; }
    });
    return 'film-metadata';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>Film metadata</h2><p>The film service did not answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}

export default {
  name: 'film-metadata',
  examples: ['find me a sci-fi film from the 80s', 'films by Kurosawa', 'film metadata for Ikiru', 'find films about space'],
  nearMisses: ['films', 'voids fillms', 'best films of 2025', 'how do I film a video', 'find me a film', 'pick a movie to watch with me', 'film me a video'],
  match(lower, text) { return !!parseDiscoveryAsk(text); },
  run,
  suite() {
    const q = parseDiscoveryAsk('find me a sci-fi film from the 80s');
    return { ok: filmOf('film discovery for inception') === 'inception' && filmOf('hello') === null && q && q.genre === 'Sci-Fi & Fantasy' && q.from === 1980 && q.to === 1989 };
  },
};
