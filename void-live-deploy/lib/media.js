// The shared media pick (owner, 2026-10-17: "the same must work for music, videos, shows and games ... Verse should pick on its own ... when the ask
// names no kind or title"). One flow for every kind: Verse proposes titles (a model writes them, so they are untrusted), each is looked up in a real
// keyless source, and only a FOUND one is shown as fact (a card with its own art); the rest is "not verified". Playback is legal only: 30 s official
// previews, free public-domain/CC films, official trailers; everything else links out, never a pirate or scraped stream. Movies live in
// lib/movies.js and keep working unchanged; this file adds kind detection, the Verse-picks-the-kind rule and the music adapter (iTunes Search).
// Pure. skills/media-pick.js is the page side, functions/api/media.js the server side.
import { cleanTitle, normTitle, cleanYear, onHost, parseSuggestions } from './movies.js';
export { cleanTitle, normTitle, cleanYear };

/** the kinds built so far, each with the verb that reaches it. Shows, video and games join this table as their adapters ship. */
export const KINDS = { movie: { verb: 'watch' }, music: { verb: 'listen' } };
const NOUN = { movie: /^(?:movies?|films?)$/, music: /^(?:songs?|music|tracks?|tunes?|albums?)$/, show: /^(?:shows?|series|tv|sitcoms?|dramas?)$/ };
// KINDS above is what Verse may choose for you by itself (the day's rotation); NOUN also names kinds you can ask for by name, like shows.
const VERB = { watch: 'movie', listen: 'music' };

/** which kind a pick ask is for: a named kind ("pick a song"), a verb ("something to listen to"), or none named, then Verse chooses by the day (`day` = days since 1970).
 *  Returns { kind, chosen } (chosen: Verse picked the kind) or null when this is not a pick ask for a built kind. Pure. */
export function pickKind(text, day = Math.floor(Date.now() / 864e5)) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  const tail = '(?:\\s+(?:with\\s+(?:me|us)|tonight|today|now|right\\s+now))?';
  let m = t.match(new RegExp('^(?:please\\s+)?(?:pick|choose|suggest|recommend|find)\\s+(?:me\\s+|us\\s+)?(?:a\\s+|an\\s+|some\\s+|the\\s+)?(?:good\\s+|great\\s+|nice\\s+)?(\\w+)(?:\\s+to\\s+(?:listen\\s+to|hear))?' + tail + '$'));
  if (m) for (const k of Object.keys(NOUN)) if (NOUN[k].test(m[1])) return { kind: k, chosen: false };
  if (!m) { const sm = t.match(new RegExp('^(?:please\\s+)?(?:pick|choose|suggest|recommend|find)\\s+(?:me\\s+|us\\s+)?(?:a\\s+|an\\s+|some\\s+|the\\s+)?(?:good\\s+|great\\s+|nice\\s+)?(?:tv\\s+)?(?:shows?|series)(?:\\s+to\\s+watch)?' + tail + '$')); if (sm) return { kind: 'show', chosen: false }; }
  m = t.match(new RegExp('^(?:please\\s+)?(?:(?:pick|choose|suggest|recommend|find|give)\\s+(?:me\\s+|us\\s+)?|what\\s+(?:should|shall)\\s+(?:i|we)\\s+(?:do\\s+)?)?(?:something|anything)?\\s*(?:to\\s+)?(watch|listen\\s+to|hear)' + tail + '$'));
  if (m && /^(?:pick|choose|suggest|recommend|find|give)|something|anything|^what/.test(t)) return { kind: VERB[m[1].replace(/\s+to$/, '').replace('hear', 'listen')] || null, chosen: false };
  const on = '(?:\\s+on\\s+(?:netflix|hulu|prime(?:\\s+video)?|disney\\+?|max|hbo(?:\\s+max)?|apple\\s+tv\\+?|peacock|paramount\\+?|youtube|spotify|tv))?';
  m = t.match(new RegExp('^(?:please\\s+)?what\\s+should\\s+(?:i|we)\\s+(watch|listen\\s+to)' + on + tail + '$'));
  if (m) return { kind: VERB[m[1].replace(/\s+to$/, '')], chosen: false };
  // "good movies to watch tonight", "some good songs to listen to": a pick asked by what it is, with no verb in front
  m = t.match(new RegExp('^(?:some\\s+|any\\s+)?(?:good|great|best|fun|new)\\s+(\\w+)\\s+to\\s+(?:watch|stream|listen\\s+to|hear)' + on + tail + '$'));
  if (m) for (const k of Object.keys(NOUN)) if (NOUN[k].test(m[1])) return { kind: k, chosen: false };
  if (new RegExp('^(?:please\\s+)?(?:(?:pick|choose|suggest|recommend|find|give)\\s+(?:me\\s+|us\\s+)?)?(?:something|anything)' + tail + '$').test(t) && /^(?:pick|choose|suggest|recommend|find|give)/.test(t)) {
    const ks = Object.keys(KINDS); return { kind: ks[((day % ks.length) + ks.length) % ks.length], chosen: true };
  }
  return null;
}

/** "music card for Bohemian Rhapsody by Queen" -> { kind:'music', title, artist } | null. The ask a row of the music pick runs. Pure. */
export function musicCardAsk(text) {
  const m = String(text || '').trim().replace(/[?!.]+$/, '').match(/^music\s+card\s+(?:for\s+)?(.+?)(?:\s+by\s+(.+))?$/i);
  if (!m) return null;
  const title = cleanTitle(m[1]); return title ? { kind: 'music', title, artist: cleanTitle(m[2] || '') } : null;
}
export const musicAskText = (title, artist) => 'music card for ' + cleanTitle(title) + (cleanTitle(artist) ? ' by ' + cleanTitle(artist) : '');

/** a model's list ("1. **Bohemian Rhapsody** - Queen", "2. Hey Jude by The Beatles") -> [{ title, artist }], at most 6, cleaned, no repeats. Pure. */
export function parseMusic(answer) {
  const out = [], seen = new Set();
  for (const line of String(answer || '').split(/\n/)) {
    const m = line.match(/^\s*(?:\d{1,2}[.)]|[-*•])\s*(.+)$/); if (!m) continue;
    const t = m[1].replace(/\*+|__|"/g, '').replace(/\s*\(\d{4}\)\s*/g, ' ').trim();
    const p = t.split(/\s+(?:by|[-–—])\s+/i); if (p.length < 2) continue;
    const title = cleanTitle(p[0]), artist = cleanTitle(p[1].split(/\s+[-–—:]\s+/)[0]), k = normTitle(title) + '|' + normTitle(artist);
    if (title && artist && !seen.has(k)) { seen.add(k); out.push({ title, artist }); }
    if (out.length >= 6) break;
  }
  return out;
}
/** classics the lookup can always find: the pick when the model is away. */
export const MUSIC_FALLBACK = [
  { title: 'Bohemian Rhapsody', artist: 'Queen' }, { title: 'Hey Jude', artist: 'The Beatles' }, { title: 'Billie Jean', artist: 'Michael Jackson' },
  { title: 'Smells Like Teen Spirit', artist: 'Nirvana' }, { title: 'Respect', artist: 'Aretha Franklin' }, { title: 'Take Five', artist: 'The Dave Brubeck Quartet' },
];

const APPLE = ['mzstatic.com', 'apple.com'];
/** the iTunes song that is this one: same normalised title, and the artist matches when one was asked for. Pure. */
export function pickSong(results, title, artist) {
  const want = normTitle(title), a = normTitle(artist);
  const r = (results || []).find((x) => x && x.kind === 'song' && normTitle(x.trackName) === want && (!a || normTitle(x.artistName).includes(a) || a.includes(normTitle(x.artistName))));
  if (!r) return null;
  return {
    title: cleanTitle(r.trackName), artist: cleanTitle(r.artistName), album: cleanTitle(r.collectionName), genre: cleanTitle(r.primaryGenreName), year: cleanYear(String(r.releaseDate || '').slice(0, 4)),
    poster: onHost(String(r.artworkUrl100 || '').replace(/\/\d+x\d+bb\./, '/400x400bb.'), APPLE), preview: onHost(r.previewUrl, APPLE), store: onHost(r.trackViewUrl, ['apple.com']),
    seconds: r.trackTimeMillis > 0 ? Math.round(r.trackTimeMillis / 1000) : null,
  };
}
const DEEZER = ['dzcdn.net', 'deezer.com'];
/** the Deezer track that is this one, the second source when iTunes is away or does not know it (keyless search API: track, artist, album, cover,
 *  the official 30 s preview). Same matching rule as pickSong; title_short drops "(Remastered 2009)" and the like. Pure. */
export function pickDeezerSong(data, title, artist) {
  const want = normTitle(title), a = normTitle(artist), who = (x) => normTitle(x && x.artist && x.artist.name);
  const r = (Array.isArray(data) ? data : []).find((x) => x && x.type === 'track' && normTitle(x.title_short || x.title) === want && (!a || who(x).includes(a) || a.includes(who(x))));
  if (!r) return null;
  return {
    title: cleanTitle(r.title_short || r.title), artist: cleanTitle(r.artist.name), album: cleanTitle(r.album && r.album.title), genre: '', year: cleanYear(''),
    poster: onHost(r.album && (r.album.cover_xl || r.album.cover_big), DEEZER), preview: onHost(r.preview, DEEZER), store: '',
    seconds: r.duration > 0 ? Math.round(r.duration) : null,
  };
}
/** where-to-listen links that are searches on legal services: never a stream. Pure. */
export function listenLinks(title, artist, store) {
  const q = encodeURIComponent(cleanTitle(title) + ' ' + cleanTitle(artist)), l = [];
  if (store) l.push({ label: 'Apple Music (full song)', url: store });
  l.push({ label: 'Spotify: search', url: 'https://open.spotify.com/search/' + q });
  l.push({ label: 'Bandcamp: search', url: 'https://bandcamp.com/search?q=' + q });
  return l;
}

// ---- shows (TVMaze, keyless): poster, summary, seasons and episodes, official site. No streaming: a show links out. ----
/** "show card for Severance (2022)" -> { kind:'show', title, year } | null. The ask a row of the show pick runs. Pure. */
export function showCardAsk(text) {
  const m = String(text || '').trim().replace(/[?!.]+$/, '').match(/^show\s+card\s+(?:for\s+)?(.+?)(?:\s*\((\d{4})\))?$/i);
  if (!m) return null;
  const title = cleanTitle(m[1]); return title ? { kind: 'show', title, year: cleanYear(m[2]) } : null;
}
export const showAskText = (title, year) => 'show card for ' + cleanTitle(title) + (cleanYear(year) ? ' (' + cleanYear(year) + ')' : '');
export const parseShows = parseSuggestions; // "1. Title (Year)"
export const SHOW_FALLBACK = [{ title: 'Severance', year: 2022 }, { title: 'The Wire', year: 2002 }, { title: 'Fawlty Towers', year: 1975 }, { title: 'Planet Earth', year: 2006 }, { title: 'Chernobyl', year: 2019 }];
const strip = (h) => String(h || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#?\w+;/g, ' ').replace(/\s+/g, ' ').trim();
const cc = (c) => (/^[A-Za-z]{2}$/.test(String(c || '')) ? String(c).toUpperCase() : '');
/** "source says no" is an answer: is this found show offered to this viewer? -> { state: 'ok' | 'region' | 'unavailable', why }. `viewer` is a 2-letter country or ''.
 *  Only what TVMaze says: a show with no network, web channel or site, or still in development, is unavailable; a show that aired only on a network of another country,
 *  with no worldwide web channel, is not listed for a viewer elsewhere. Unknown viewer country = ok (nothing to contradict). Pure. */
export function showAvailability(s, viewer) {
  if (!s) return { state: 'unavailable', why: 'not verified' };
  if (/^(?:in development|to be determined)$/i.test(s.status || '')) return { state: 'unavailable', why: 'It is not released yet (' + s.status + ').' };
  if (!s.hasNet && !s.site) return { state: 'unavailable', why: 'The source lists no network, channel or site that offers it.' };
  const v = cc(viewer);
  if (v && s.country && !s.global && s.country !== v) return { state: 'region', why: 'The source lists it on a ' + s.country + ' network only, not for ' + v + '.' };
  return { state: 'ok', why: '' };
}
/** the TVMaze show that is this one (same normalised title, premiere year within one when both known) -> the card's facts, only what TVMaze returned. Pure. */
export function pickShow(j, title, year) {
  if (!j || typeof j !== 'object' || normTitle(j.name) !== normTitle(title)) return null;
  const y = cleanYear(year), py = cleanYear(String(j.premiered || '').slice(0, 4)); if (y && py && Math.abs(py - y) > 1) return null;
  const seasons = (j._embedded && Array.isArray(j._embedded.seasons) ? j._embedded.seasons : []).filter((x) => x && x.number > 0), eps = seasons.reduce((n, x) => n + (+x.episodeOrder > 0 ? +x.episodeOrder : 0), 0);
  const sum = strip(j.summary), cut = sum, net = (j.network && j.network.name) || (j.webChannel && j.webChannel.name) || '';
  return {
    title: cleanTitle(j.name), year: py, genres: (Array.isArray(j.genres) ? j.genres : []).map(cleanTitle).filter(Boolean).slice(0, 4), genre: cleanTitle((j.genres || [])[0] || ''), status: cleanTitle(j.status), network: cleanTitle(net),
    ended: cleanYear(String(j.ended || '').slice(0, 4)), overview: cut, seasons: seasons.length || null, episodes: eps || null, rating: j.rating && +j.rating.average > 0 ? Math.round(j.rating.average * 10) / 10 : null,
    country: cc(j.network && j.network.country && j.network.country.code), global: !!(j.webChannel && !j.webChannel.country), hasNet: !!net,
    poster: onHost(j.image && (j.image.original || j.image.medium), ['tvmaze.com']), site: /^https:\/\/[^\s"'<>]{4,300}$/.test(String(j.officialSite || '')) ? String(j.officialSite) : '', page: onHost(j.url, ['tvmaze.com']),
  };
}
/** where-to-watch links that are searches or the show's own pages: never a stream. `official` (the source says it is not offered here): the show's own site and TVMaze page only, no search. Pure. */
export function showLinks(title, year, site, page, official = false) {
  if (official) { const o = []; if (site) o.push({ label: 'Official site', url: site }); if (page) o.push({ label: 'TVMaze page', url: page }); return o; }
  const q = encodeURIComponent(cleanTitle(title) + (cleanYear(year) ? ' ' + cleanYear(year) : '')), l = [];
  if (site) l.push({ label: 'Official site', url: site });
  l.push({ label: 'JustWatch: where it streams', url: 'https://www.justwatch.com/us/search?q=' + q });
  if (page) l.push({ label: 'TVMaze: episodes and cast', url: page });
  return l;
}
