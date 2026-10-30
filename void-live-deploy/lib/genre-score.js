// How close a song of Verse's sounds to real songs of its kind (owner, 2026-10-30: "teach it to listen to other rap and compare for itself", music
// in every genre). tools/genre-refs.mjs measured real Creative Commons tracks from the Internet Archive's netlabels with Verse's ears
// (lib/rap-ears.js listen()) and wrote their profiles and averages to /data/genre-refs.json. Here a song card renders its own song the same way
// (44.1 kHz stereo, offline), measures it with the same listen(), and holds it against the average for its kind with the same compare(): a score
// out of 100 and the measures furthest off. No reference for a kind means no score, never a made-up one.
// refKey(), scoreOf() and scoreLine() are pure (tested in tools/genre-score.test.mjs); loadRefs() fetches once; measureSong() needs an
// OfflineAudioContext.
import { listen, compare, windowOf } from './rap-ears.js';

export const REFS_URL = '/data/genre-refs.json';
export const RATE = 44100;

/** which reference a song is held against: 'heavy' for a song with sections (lib/arrange.js), else its mood (lib/compose.js). Pure. */
export const refKey = (p) => (p && (p.sections || p.style === 'heavy') ? 'heavy' : (p && p.mood) || null);

const fmt = (v, unit) => (v == null ? 'unread' : (Math.round(v * 10) / 10) + (unit ? ' ' + unit : ''));

/** the song's profile against the reference for `key`: { key, label, tracks, score, rows, gaps } or null with no reference. `gaps` are the
 *  measures furthest off (closeness under 0.5), worst first, at most 3. Pure. */
export function scoreOf(own, refs, key) {
  const g = refs && refs.genres && refs.genres[key];
  if (!own || !g || !g.average || !Array.isArray(g.tracks) || !g.tracks.length) return null;
  const c = compare(own, g.average), gaps = c.rows.filter((r) => r.closeness != null && r.closeness < 0.5).sort((a, b) => a.closeness - b.closeness).slice(0, 3);
  return { key, label: g.label, tracks: g.tracks.length, score: c.score, rows: c.rows, gaps };
}

/** one plain sentence for the card. Pure. */
export function scoreLine(s) {
  if (!s) return 'Verse has no real recordings of this kind of song measured yet, so it gives no score.';
  const head = 'Against ' + s.tracks + ' real ' + s.label + ' track' + (s.tracks === 1 ? '' : 's') + ' (Creative Commons, from the Internet Archive): ' + s.score + ' of 100 close.';
  if (!s.gaps.length) return head + ' No measure is far off.';
  return head + ' Furthest off: ' + s.gaps.map((r) => r.label.toLowerCase() + ' (' + fmt(r.own, r.unit) + ' here, ' + fmt(r.ref, r.unit) + ' in theirs)').join('; ') + '.';
}

let cached = null;
/** the references, fetched once per page: the parsed file, or null when it is missing. */
export function loadRefs(fetchFn = (u) => globalThis.fetch(u)) {
  if (!cached) cached = Promise.resolve(fetchFn(REFS_URL)).then((r) => (r && r.ok ? r.json() : null)).catch(() => null).then((v) => { if (!v) cached = null; return v; });
  return cached;
}

/** render the song offline at 44.1 kHz stereo with `schedule(ctx, p, 0, instruments)` and measure it: the listen() profile, or null. */
export async function measureSong(p, OAC, schedule, instruments = {}) {
  if (!OAC) return null;
  const sec = p.steps * (60 / p.bpm / 4) + 2.6, ctx = new OAC(2, Math.ceil(sec * RATE), RATE); schedule(ctx, p, 0, instruments);
  const buf = await ctx.startRendering(), L = buf.getChannelData(0), R = buf.numberOfChannels > 1 ? buf.getChannelData(1) : L;
  return listen(L, R, RATE, windowOf(L.length / RATE));
}
