// A recording a person asked to hear (owner, 2026-11-03: Verse should get better at songs for real, not by pretending).
// "play bohemian rhapsody by queen" is a published track, looked up on Apple's free iTunes Search (no key) and played from the
// 30-second preview Apple serves. The card shows the track and artist iTunes returned, so a check can hold them against that
// same lookup. Composing a new piece stays with skills/music.js ("make me a song"); a video stays with skills/video.js.
// Pure aside from findTrack, which takes a fetch so a test never calls the network.

const FILL = /^(?:please\s+|can you\s+|could you\s+|will you\s+)?(?:play|put\s+on|listen\s+to|hear|spin)\s+(?:me\s+)?/i;
const NOT_SONG = /\b(?:podcasts?|episodes?|videos?|vids?|movies?|films?|trailers?|documentar(?:y|ies)|clips?|games?|chess|checkers|recipes?|weather|news|scores?|vat|calculator|tutorial)\b/i;

/** lower case, accents folded, punctuation as spaces. Pure. */
export function norm(s) {
  return String(s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

/** every word of `needle` (length > 1) is in `hay`. An empty needle matches. Pure. */
export function covers(hay, needle) {
  const h = ' ' + norm(hay) + ' ', words = norm(needle).split(' ').filter((w) => w.length > 1);
  return words.every((w) => h.includes(' ' + w + ' ') || h.includes(w));
}

/**
 * "play <title> by <artist>" (and "play the song <title> by <artist>"), or null.
 * A bare "play despacito" stays a video search: this only takes a title named with an artist, which is what the exam can check.
 * Pure.
 */
export function songAskOf(text) {
  let t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!FILL.test(t) || NOT_SONG.test(t)) return null;
  t = t.replace(FILL, '').replace(/^(?:the\s+)?song\s+/i, '').trim();
  const m = t.match(/^(.{1,80}?)\s+by\s+([a-z0-9][\w .'-]{0,60})$/i);
  if (!m) return null;
  const title = m[1].replace(/^(?:the\s+)?song\s+/i, '').trim(), artist = m[2].trim();
  if (title.length < 2 || artist.length < 2) return null;
  if (/^(?:a|an|the|some|me|it|this|that)$/i.test(title)) return null;
  return { title, artist };
}

/** the iTunes hit whose preview is a real Apple preview URL and whose title and artist cover the ask, or null. Pure. */
export function pickTrack(results, title, artist) {
  const list = Array.isArray(results) ? results : [];
  for (const t of list) {
    if (!t || !t.trackName || !t.artistName) continue;
    const src = String(t.previewUrl || '');
    if (!/^https:\/\/audio-ssl\.itunes\.apple\.com\/.+\.(?:m4a|aac)(?:\?|$)/i.test(src)) continue;
    if (covers(t.trackName, title) && covers(t.artistName, artist)) return { title: String(t.trackName).slice(0, 160), artist: String(t.artistName).slice(0, 160), preview: src, collection: String(t.collectionName || '').slice(0, 160) };
  }
  return null;
}

/** iTunes Search for one song. `fetchFn` defaults to the global fetch. Returns the picked track or null. */
export async function findTrack(title, artist, fetchFn = fetch) {
  const term = encodeURIComponent(String(title || '') + ' ' + String(artist || ''));
  const res = await fetchFn('https://itunes.apple.com/search?entity=song&limit=8&term=' + term, { headers: { accept: 'application/json', 'user-agent': 'Verse/1.0 (+https://a-to-mind.com)' } });
  if (!res.ok) return null;
  const j = await res.json();
  return pickTrack(j && j.results, title, artist);
}
