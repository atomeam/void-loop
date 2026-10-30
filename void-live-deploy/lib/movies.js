// Real movies (owner, 2026-10-17: Verse answered "pick a movie to watch with me" with 'Talk to Me (2022)' written from memory;
// "lets have it find the actual movies it suggests ... and play right in v01d"). Pure helpers for skills/movie.js and functions/api/movies.js.
// A suggested title is untrusted text (a model wrote it, a person may have typed it): cleanTitle() runs before any request or render.
// A movie is shown as fact only when a real source returned it (iTunes Search: poster, overview, official trailer, store link; the Internet
// Archive: public-domain or Creative Commons films, incl. Blender's open movies). Playback is legal only: an archive film in a <video>, an
// official trailer from Apple's own CDN. Never a pirate or scraped stream; an in-copyright film gets its trailer and where-to-watch links.
export const MAX_TITLE = 80;
/** a title safe to send and to show: printable letters, digits and ordinary punctuation, one line, no markup. Pure. */
export function cleanTitle(t) {
  return String(t == null ? '' : t).normalize('NFKC').replace(/[\p{C}\p{Z}]/gu, ' ')
    .replace(/[^\p{L}\p{N} .,:;'’&!?\-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, MAX_TITLE).trim();
}
export const cleanYear = (y) => { const n = Number(String(y == null ? '' : y).match(/^\d{4}$/) ? y : NaN); return n >= 1888 && n <= 2100 ? n : null; };
/** a title for comparing: lower case, no accents, no leading article, only letters and digits. Pure. */
export const normTitle = (t) => cleanTitle(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/^(the|a|an)\s+/, '').replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '');

/** "pick a movie to watch with me", "movie night", "what should we watch tonight" -> true. Pure. */
export function pickAsk(text) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  return /^(?:please\s+)?(?:(?:pick|choose|suggest|recommend|find|give)\s+(?:me\s+|us\s+)?(?:a\s+|an\s+|some\s+|the\s+)?(?:good\s+|great\s+|nice\s+)?(?:movies?|films?)(?:\s+(?:to|for)\s+(?:watch|see)(?:\s+(?:with\s+(?:me|us)|tonight|today|now))?|\s+tonight)?|movie\s+night|what\s+(?:movie\s+)?should\s+(?:i|we)\s+watch(?:\s+tonight)?|what\s+(?:movie|film)\s+should\s+(?:i|we)\s+(?:watch|see))$/.test(t)
    || /^(?:pick|choose|suggest|recommend)\s+(?:me\s+|us\s+)?(?:a\s+|an\s+|some\s+)?(?:movies?|films?)\s+to\s+watch\s+with\s+(?:me|us)$/.test(t);
}
/** "movie card for Talk to Me (2022)" -> { title, year } | null. This is the ask a row of the pick page runs. Pure. */
export function cardAsk(text) {
  const m = String(text || '').trim().replace(/[?!.]+$/, '').match(/^movie\s+card\s+(?:for\s+)?(.+?)(?:\s*\((\d{4})\))?$/i);
  if (!m) return null;
  const title = cleanTitle(m[1]); return title.length >= 1 ? { title, year: cleanYear(m[2]) } : null;
}
export const cardAskText = (title, year) => 'movie card for ' + cleanTitle(title) + (cleanYear(year) ? ' (' + cleanYear(year) + ')' : '');

/** a model's list ("1. **Talk to Me** (2022) - ...") -> [{ title, year }], at most 6, cleaned, no repeats. Pure. */
export function parseSuggestions(answer) {
  const out = [], seen = new Set();
  for (const line of String(answer || '').split(/\n/)) {
    const m = line.match(/^\s*(?:\d{1,2}[.)]|[-*•])\s*(?:\*\*|__|")?\s*(.+?)\s*(?:\*\*|__|")?\s*\((\d{4})\)/);
    if (!m) continue;
    const title = cleanTitle(m[1].replace(/\*+/g, '')), year = cleanYear(m[2]), k = normTitle(title);
    if (title && k && !seen.has(k)) { seen.add(k); out.push({ title, year }); }
    if (out.length >= 6) break;
  }
  return out;
}
/** free, legal films that always play (public domain or Creative Commons): the pick when the model is away, and one added to every pick. */
export const FREE_PICKS = [
  { title: 'Night of the Living Dead', year: 1968 }, { title: 'Nosferatu', year: 1922 }, { title: 'Big Buck Bunny', year: 2008 },
  { title: 'Sintel', year: 2010 }, { title: 'Tears of Steel', year: 2012 }, { title: 'His Girl Friday', year: 1940 }, { title: 'Charade', year: 1963 },
];

const hostOf = (u) => { try { const x = new URL(u); return x.protocol === 'https:' ? x.hostname : ''; } catch (_) { return ''; } };
/** an https url on one of the hosts, else '' (artwork and trailers come only from the sources' own CDNs). Pure. */
export const onHost = (u, hosts) => { const h = hostOf(u); return h && hosts.some((x) => h === x || h.endsWith('.' + x)) ? String(u) : ''; };
const APPLE_MEDIA = ['mzstatic.com'], APPLE_PAGES = ['apple.com'];
const firstSentences = (s) => String(s || '').replace(/\s+/g, ' ').trim(); // the whole text (owner, 2026-10-21)

/** the iTunes result that is this movie: same normalised title, and the year within one when both are known. Pure. */
export function pickItunes(results, title, year) {
  const want = normTitle(title), y = cleanYear(year);
  const ok = (r) => r && r.kind === 'feature-movie' && normTitle(r.trackName) === want && (!y || !r.releaseDate || Math.abs(+String(r.releaseDate).slice(0, 4) - y) <= 1);
  const r = (results || []).find(ok); if (!r) return null;
  return {
    title: cleanTitle(r.trackName), year: cleanYear(String(r.releaseDate || '').slice(0, 4)), genre: cleanTitle(r.primaryGenreName), rating: cleanTitle(r.contentAdvisoryRating),
    overview: firstSentences(r.shortDescription || r.longDescription), director: cleanTitle(r.artistName), runtime: r.trackTimeMillis > 0 ? Math.round(r.trackTimeMillis / 60000) : null,
    poster: onHost(String(r.artworkUrl100 || '').replace(/\/\d+x\d+bb\./, '/400x600bb.'), APPLE_MEDIA),
    trailer: onHost(r.previewUrl, [...APPLE_MEDIA, ...APPLE_PAGES]), store: onHost(r.trackViewUrl, APPLE_PAGES),
    price: r.trackPrice > 0 ? Number(r.trackPrice) : null, rentPrice: r.trackRentalPrice > 0 ? Number(r.trackRentalPrice) : null, currency: /^[A-Z]{3}$/.test(r.currency || '') ? r.currency : '',
  };
}
/** is this Internet Archive item a film Verse may play: the title is this one, and it is public domain / Creative Commons / a Blender open movie. Pure. */
export function legalArchive(doc, title, year) {
  if (!doc || !/^[A-Za-z0-9._-]{1,100}$/.test(String(doc.identifier || ''))) return false;
  const one = (v) => (Array.isArray(v) ? v[0] : v), lic = String(one(doc.licenseurl) || ''), cols = [].concat(doc.collection || []).map(String), by = String(one(doc.creator) || '');
  const free = /creativecommons\.org\/(?:publicdomain|licenses\/by(?:-sa)?\/)|publicdomain/i.test(lic) || cols.includes('feature_films') || /blender (?:foundation|institute)/i.test(by);
  if (!free || normTitle(one(doc.title)) !== normTitle(title)) return false;
  const y = cleanYear(year), dy = cleanYear(String(one(doc.year) || '').slice(0, 4));
  return !y || !dy || Math.abs(dy - y) <= 1;
}
/** the file to play from an archive item's metadata: an mp4 it made or holds, smallest first under 2 GB; or '' (then the archive's own embed plays). Pure. */
export function pickFile(files) {
  const mp4 = (files || []).filter((f) => f && /\.mp4$/i.test(f.name || '') && !/\.(?:ia)\.mp4$/i.test(f.name) && /h\.?264|mpeg4/i.test(f.format || '') && +f.size > 0 && +f.size < 2e9 && !/\//.test(f.name));
  mp4.sort((a, b) => +a.size - +b.size); const pick = mp4.find((f) => +f.size > 8e6) || mp4[mp4.length - 1];
  return pick ? pick.name : '';
}
export const archiveFileUrl = (id, name) => 'https://archive.org/download/' + encodeURIComponent(id) + '/' + encodeURIComponent(name);
/** where-to-watch links that are searches on legal services: never a stream. Pure. */
// Wikidata, the second source (2026-10-30: iTunes refuses shared cloud addresses, and every well-known pick, "The Grand Budapest Hotel (2014)",
// "Parasite (2019)", came back "not verified" on a-to-mind.com). Keyless SPARQL: a film is an item labelled with this exact English title that is
// an instance of film (Q11424) or of a kind of film, with a publication date. It gives the year, the director and the runtime, never a poster.
export const WIKIDATA = 'https://query.wikidata.org/sparql?format=json&query=';
/** the SPARQL that finds the films with this English label. The title goes through cleanTitle (no quote or backslash can reach the literal). Pure. */
export function wikidataQuery(title) {
  const t = cleanTitle(title).replace(/["\\]/g, '');
  return 'SELECT ?f (MIN(?d) AS ?date) (SAMPLE(?dl) AS ?dir) (SAMPLE(?dur) AS ?mins) WHERE { VALUES ?l { "' + t + '"@en } ?f rdfs:label ?l; wdt:P31/wdt:P279* wd:Q11424; wdt:P577 ?d.'
    + ' OPTIONAL { ?f wdt:P57 ?di. ?di rdfs:label ?dl. FILTER(LANG(?dl) = "en") } OPTIONAL { ?f wdt:P2047 ?dur } } GROUP BY ?f LIMIT 10';
}
/** the Wikidata row that is this movie: the year within one when it is known, else the most recent film of that name; or null. Pure. */
export function pickWikidata(json, title, year) {
  const v = (b, k) => (b && b[k] && typeof b[k].value === 'string' ? b[k].value : '');
  const rows = ((json && json.results && json.results.bindings) || []).map((b) => ({
    id: (v(b, 'f').match(/\/entity\/(Q\d{1,12})$/) || [])[1] || '', year: cleanYear(v(b, 'date').slice(0, 4)), director: cleanTitle(v(b, 'dir')), mins: Math.round(Number(v(b, 'mins'))),
  })).filter((r) => r.id && r.year);
  const y = cleanYear(year);
  const r = y ? rows.find((x) => Math.abs(x.year - y) <= 1) : rows.sort((a, b) => b.year - a.year)[0];
  if (!r) return null;
  return { title: cleanTitle(title), year: r.year, director: r.director, runtime: r.mins > 0 && r.mins < 1000 ? r.mins : null, page: 'https://www.wikidata.org/wiki/' + r.id };
}

export function watchLinks(title, year, store) {
  const q = encodeURIComponent(cleanTitle(title) + (cleanYear(year) ? ' ' + cleanYear(year) : ''));
  const l = [];
  if (store) l.push({ label: 'Apple TV (buy or rent)', url: store });
  l.push({ label: 'JustWatch: where it streams', url: 'https://www.justwatch.com/us/search?q=' + q });
  l.push({ label: 'Internet Archive: free films', url: 'https://archive.org/search?query=' + q + '&and[]=mediatype%3A%22movies%22' });
  return l;
}
