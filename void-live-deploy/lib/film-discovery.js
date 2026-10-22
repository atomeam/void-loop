// Film discovery as data (asked by Void, frontier "Film discovery as a structured skill returning JSON film metadata"):
// "find me a sci-fi film from the 80s", "films by Kurosawa", "film metadata for Ikiru" -> a list of films as plain JSON.
// Only the iTunes Search API is read (the source lib/movies.js and skills/film-metadata.js already used). A field the source does not
// return is null, never a guess; nothing found is said plainly (count 0 and a note), never filled in from memory. Pure apart from the
// injected getJson, so tests replay recorded answers (tools/film-discovery.test.mjs, tools/fixtures/itunes-*.json).
import { cleanTitle, cleanYear, onHost } from './movies.js';

export const MAX_FILMS = 12, MAX_YEARS = 10, SOURCE = 'iTunes Search API';
const SEARCH = 'https://itunes.apple.com/search?media=movie&entity=movie&country=us';
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

// user words -> the iTunes genre they mean (matched against the genre the source gives each film)
export const GENRES = [
  [/^(?:sci-?\s?fi|sc-?i-?fi|science\s+fiction|scifi)$/, 'Sci-Fi & Fantasy', /sci-?i?-?fi/i], [/^fantasy$/, 'Sci-Fi & Fantasy', /fantasy/i],
  [/^horror$/, 'Horror', /horror/i], [/^(?:comedy|comedies)$/, 'Comedy', /comed/i], [/^dramas?$/, 'Drama', /drama/i],
  [/^thrillers?$/, 'Thriller', /thriller/i], [/^(?:action|adventure)$/, 'Action & Adventure', /action|adventure/i],
  [/^(?:romance|romantic)$/, 'Romance', /romance/i], [/^westerns?$/, 'Western', /western/i], [/^(?:documentary|documentaries)$/, 'Documentary', /documentar/i],
  [/^(?:animated|animation|anime)$/, 'Anime', /anim/i], [/^musicals?$/, 'Musicals', /music/i], [/^(?:classic|classics)$/, 'Classics', /classic/i],
];
const genreOf = (w) => GENRES.find((g) => g[0].test(String(w || '').toLowerCase().trim().replace(/\s+/g, ' '))) || null;
const WORDS = { twenties: 1920, thirties: 1930, forties: 1940, fifties: 1950, sixties: 1960, seventies: 1970, eighties: 1980, nineties: 1990 };
/** "80s", "1980s", "80's", "eighties", "1994" -> { from, to } | null. Pure. */
export function span(w) {
  const t = String(w || '').toLowerCase().replace(/[’']/g, '').replace(/^the\s+/, '').trim();
  let m = t.match(/^(\d{4})s$/); if (m && +m[1] % 10 === 0 && cleanYear(m[1])) return { from: +m[1], to: +m[1] + 9 };
  m = t.match(/^([2-9]0)s$/); if (m) return { from: 1900 + +m[1], to: 1909 + +m[1] };
  if (WORDS[t]) return { from: WORDS[t], to: WORDS[t] + 9 };
  m = t.match(/^(\d{4})$/); if (m && cleanYear(m[1])) return { from: +m[1], to: +m[1] };
  return null;
}
const DEC = '(?:the\\s+)?(?:\\d{4}s|[2-9]0[\'’]?s|twenties|thirties|forties|fifties|sixties|seventies|eighties|nineties|\\d{4})';
const GEN = '(?:sci-?\\s?fi|sc-?i-?fi|science\\s+fiction|scifi|fantasy|horror|comed(?:y|ies)|dramas?|thrillers?|action|adventure|romance|romantic|westerns?|documentar(?:y|ies)|animated|animation|anime|musicals?|classics?)';
const LEAD = '^(?:please\\s+)?(?:(?:find|show|discover|search\\s+for|get|give|list|recommend)\\s+(?:me\\s+|us\\s+)?)?(?:(?:a|an|some|the|any)\\s+)?';
const NAME = '([\\p{L}][\\p{L} .\'’-]{1,40}?)';
const re = (s) => new RegExp(s, 'iu'); // void-review: ok (only called with the constant pattern strings above, never with user text)
const BY = re(LEAD + '(?:(' + GEN + ')\\s+)?(?:films?|movies?)\\s+(?:by|directed\\s+by|from\\s+director)\\s+' + NAME + '(?:\\s+(?:from|of|in|made\\s+in|released\\s+in)\\s+(' + DEC + '))?$');
const KIND = re(LEAD + '(?:(' + DEC + ')\\s+)?(?:(' + GEN + ')\\s+)?(?:films?|movies?)(?:\\s+(?:from|of|in|made\\s+in|released\\s+in)\\s+(' + DEC + '))?$');
const KIND2 = re(LEAD + '(?:(' + DEC + ')\\s+)?(' + GEN + ')(?:\\s+(?:from|of|in|made\\s+in|released\\s+in)\\s+(' + DEC + '))?$');
const TITLE = [re('^(?:yo\\s+)?(?:film|movie)\\s+(?:discovery|metadata|info|search)\\s+(?:for|of|about)\\s+(.+)$'), re('^(?:yo\\s+)?(?:json\\s+)?(?:film|movie)\\s+metadata\\s+(?:for|of)\\s+(.+)$')];
const TOPIC = re('^(?:find|discover|search)(?:\\s+me)?\\s+(?:films?|movies?)\\s+(?:about|for)\\s+(.+)$');

/**
 * A discovery ask -> { kind: 'title'|'topic'|'discover', title?, topic?, director?, genre?, from?, to? } | null. Pure.
 * "find me a sci-fi film from the 80s", "films by Kurosawa", "80s horror movies", "film metadata for Ikiru", "find films about space".
 * A bare "find me a film" / "pick a movie" is null: that is the movie skill's pick, not a discovery.
 */
export function parseDiscoveryAsk(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t || t.length > 160) return null;
  let m;
  for (const r of TITLE) if ((m = t.match(r))) { const title = cleanTitle(m[1]); return title ? { kind: 'title', title } : null; }
  if ((m = t.match(TOPIC))) { const topic = cleanTitle(m[1]); return topic ? { kind: 'topic', topic } : null; }
  if ((m = t.match(BY))) {
    const director = cleanTitle(m[2]), sp = span(m[3]), g = genreOf(m[1]);
    if (norm(director).length < 3) return null;
    return { kind: 'discover', director, ...(g ? { genre: g[1] } : {}), ...(sp || {}) };
  }
  if ((m = t.match(KIND2))) { const g = genreOf(m[2]), sp = span(m[3]) || span(m[1]); if (g && sp) return { kind: 'discover', genre: g[1], ...sp }; }
  if ((m = t.match(KIND))) {
    const g = genreOf(m[2]), sp = span(m[3]) || span(m[1]);
    if (g || sp) return { kind: 'discover', ...(g ? { genre: g[1] } : {}), ...(sp || {}) };
  }
  return null;
}

/** the iTunes searches an ask needs (at most MAX_YEARS), as urls. Pure. */
export function searchUrls(q) {
  const u = (term, attr, limit) => SEARCH + '&limit=' + limit + (attr ? '&attribute=' + attr : '') + '&term=' + encodeURIComponent(term);
  if (q.kind === 'title') return [u(q.title, '', 15)];
  if (q.kind === 'topic') return [u(q.topic, '', 25)];
  if (q.director) return [u(q.director, 'directorTerm', 50)];
  if (q.from) { const out = []; for (let y = q.from; y <= Math.min(q.to || q.from, q.from + MAX_YEARS - 1); y++) out.push(u(String(y), 'releaseYearTerm', 50)); return out; }
  return q.genre ? [u(q.genre, 'genreIndex', 100)] : [];
}

const one = (s) => cleanTitle(s) || null;
/** one iTunes result -> the film as JSON; every field the source lacks is null. Pure. */
export function toFilm(r) {
  const year = cleanYear(String(r.releaseDate || '').slice(0, 4)), g = one(r.primaryGenreName);
  const plot = String(r.shortDescription || r.longDescription || '').replace(/\s+/g, ' ').trim();
  const head = plot.slice(0, 220), i = head.lastIndexOf('. ');
  const cut = plot; void head; void i; // the whole plot (owner, 2026-10-21: whole sentences)
  return {
    title: one(r.trackName), year, director: one(r.artistName), runtime_min: r.trackTimeMillis > 0 ? Math.round(r.trackTimeMillis / 60000) : null,
    genres: g ? [g] : [], plot: cut || null,
    source: { name: SOURCE, url: onHost(r.trackViewUrl, ['apple.com']) || null },
  };
}
const wantsDirector = (r, d) => { const have = ' ' + norm(r.artistName) + ' '; return norm(d).split(' ').every((w) => have.includes(' ' + w + ' ')); };
const wantsTerm = (r, term) => norm(r.trackName).includes(norm(term)) || norm(r.shortDescription || r.longDescription).includes(norm(term));

/** which of the source's results answer the ask (feature films only; director, genre and years checked on the data itself). Pure. */
export function selectFilms(results, q) {
  const g = q.genre && (GENRES.find((x) => x[1] === q.genre) || [])[2];
  const inYears = (r) => { const y = +String(r.releaseDate || '').slice(0, 4); return y >= q.from && y <= (q.to || q.from); };
  const keep = (r) => r && r.kind === 'feature-movie' && r.trackName
    && (!q.director || wantsDirector(r, q.director)) && (!g || g.test(r.primaryGenreName || ''))
    && (!q.from || inYears(r)) && (q.kind !== 'topic' || wantsTerm(r, q.topic));
  const seen = new Set(), out = [];
  for (const r of results || []) { if (!keep(r)) continue; const k = norm(r.trackName) + '|' + String(r.releaseDate || '').slice(0, 4); if (seen.has(k)) continue; seen.add(k); out.push(r); }
  if (q.kind === 'discover') out.sort((a, b) => String(a.releaseDate || '').localeCompare(String(b.releaseDate || '')) || String(a.trackName).localeCompare(String(b.trackName)));
  return out.slice(0, MAX_FILMS);
}

const sayAsk = (q) => (q.kind === 'title' ? q.title : q.kind === 'topic' ? 'films about ' + q.topic
  : [q.genre && q.genre.toLowerCase(), 'films', q.director && 'by ' + q.director, q.from && (q.to && q.to !== q.from ? 'from ' + q.from + ' to ' + q.to : 'from ' + q.from)].filter(Boolean).join(' '));
/**
 * Run an ask: { ask, count, films, sources, note }. getJson(url) -> parsed JSON (the route passes a fetch with a timeout; tests pass recordings).
 * A search that fails is skipped; when every search failed the note says the source did not answer (not "no such film"). Never invents.
 */
export async function discover(text, getJson) {
  const q = parseDiscoveryAsk(text) || (cleanTitle(text) ? { kind: 'title', title: cleanTitle(text) } : null);
  if (!q) return { ask: '', count: 0, films: [], sources: [], note: 'Ask for films by a director, a genre and a decade, or a title.' };
  const urls = searchUrls(q);
  if (!urls.length) return { ask: sayAsk(q), count: 0, films: [], sources: [], note: 'Say a genre, a director or a year as well, so there is something to look up.' };
  const answers = await Promise.all(urls.map((u) => Promise.resolve().then(() => getJson(u)).then((j) => (j && Array.isArray(j.results) ? j.results : null)).catch(() => null)));
  if (answers.every((a) => a === null)) return { ask: sayAsk(q), count: 0, films: [], sources: [], note: 'The film source did not answer just now, so nothing is listed. Ask again in a moment.' };
  const films = selectFilms(answers.flat().filter(Boolean), q).map(toFilm);
  return { ask: sayAsk(q), count: films.length, films, sources: films.length ? [SOURCE] : [],
    note: films.length ? '' : 'The film source I check has no film matching this, so I list none rather than guess.' };
}
