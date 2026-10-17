// The shared media pick (owner, 2026-10-17: "the same must work for music, videos, shows and games ... V01D should pick on its own ... when the ask
// names no kind or title"). One flow for every kind: V01D proposes titles (a model writes them, so they are untrusted), each is looked up in a real
// keyless source, and only a FOUND one is shown as fact (a card with its own art); the rest is "not verified". Playback is legal only: 30 s official
// previews, free public-domain/CC films, official trailers; everything else links out, never a pirate or scraped stream. Movies live in
// lib/movies.js and keep working unchanged; this file adds kind detection, the V01D-picks-the-kind rule and the music adapter (iTunes Search).
// Pure. skills/media-pick.js is the page side, functions/api/media.js the server side.
import { cleanTitle, normTitle, cleanYear, onHost } from './movies.js';
export { cleanTitle, normTitle, cleanYear };

/** the kinds built so far, each with the verb that reaches it. Shows, video and games join this table as their adapters ship. */
export const KINDS = { movie: { verb: 'watch' }, music: { verb: 'listen' } };
const NOUN = { movie: /^(?:movies?|films?)$/, music: /^(?:songs?|music|tracks?|tunes?|albums?)$/ };
const VERB = { watch: 'movie', listen: 'music' };

/** which kind a pick ask is for: a named kind ("pick a song"), a verb ("something to listen to"), or none named, then V01D chooses by the day (`day` = days since 1970).
 *  Returns { kind, chosen } (chosen: V01D picked the kind) or null when this is not a pick ask for a built kind. Pure. */
export function pickKind(text, day = Math.floor(Date.now() / 864e5)) {
  const t = String(text || '').toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').trim();
  const tail = '(?:\\s+(?:with\\s+(?:me|us)|tonight|today|now|right\\s+now))?';
  let m = t.match(new RegExp('^(?:please\\s+)?(?:pick|choose|suggest|recommend|find)\\s+(?:me\\s+|us\\s+)?(?:a\\s+|an\\s+|some\\s+|the\\s+)?(?:good\\s+|great\\s+|nice\\s+)?(\\w+)(?:\\s+to\\s+(?:listen\\s+to|hear))?' + tail + '$'));
  if (m) for (const k of Object.keys(NOUN)) if (NOUN[k].test(m[1])) return { kind: k, chosen: false };
  m = t.match(new RegExp('^(?:please\\s+)?(?:(?:pick|choose|suggest|recommend|find|give)\\s+(?:me\\s+|us\\s+)?|what\\s+(?:should|shall)\\s+(?:i|we)\\s+(?:do\\s+)?)?(?:something|anything)?\\s*(?:to\\s+)?(watch|listen\\s+to|hear)' + tail + '$'));
  if (m && /^(?:pick|choose|suggest|recommend|find|give)|something|anything|^what/.test(t)) return { kind: VERB[m[1].replace(/\s+to$/, '').replace('hear', 'listen')] || null, chosen: false };
  m = t.match(new RegExp('^(?:please\\s+)?what\\s+should\\s+(?:i|we)\\s+(watch|listen\\s+to)' + tail + '$'));
  if (m) return { kind: VERB[m[1].replace(/\s+to$/, '')], chosen: false };
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
/** where-to-listen links that are searches on legal services: never a stream. Pure. */
export function listenLinks(title, artist, store) {
  const q = encodeURIComponent(cleanTitle(title) + ' ' + cleanTitle(artist)), l = [];
  if (store) l.push({ label: 'Apple Music (full song)', url: store });
  l.push({ label: 'Spotify: search', url: 'https://open.spotify.com/search/' + q });
  l.push({ label: 'Bandcamp: search', url: 'https://bandcamp.com/search?q=' + q });
  return l;
}
