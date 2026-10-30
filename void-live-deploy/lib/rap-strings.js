// Verse's recorded bass and electric guitar (owner, 2026-10-30: real beats and music in every genre, "reverse engineer and assimilate" the
// tech of the AI music apps, whose band parts are recordings or models trained on them, never bare oscillators). Both are real instruments
// recorded clean, by Karoryfer Lecolds under CC0 1.0 (sounds/bass/CREDITS.md, sounds/guitar/CREDITS.md), rebuilt by tools/instruments.py:
//   bass:   a bass guitar on flatwounds, recorded direct, every 3 semitones from MIDI 24 to 45, a soft and a hard take
//   guitar: a Gretsch Anniversary, recorded clean, every 3 semitones; a held note from MIDI 40 to 73 and two short muted takes (palm mutes,
//           so a fast chug alternates between them) from 40 to 64
// A note plays the nearest take, sped up or slowed down by at most 1.5 semitones, so the timbre stays the instrument's own. The amp is not a
// recording: lib/arrange.js drives the clean guitar into its own waveshaper and cabinet filter, the way an amp simulator does.
// bassTake(), guitarTake() and stringsTakesFor() are pure (tested in tools/rap-strings.test.mjs); loadStrings() fetches and decodes once per page.

/** each recorded bass note (MIDI) and the peak of its soft and hard take against the louder of the two (tools/instruments.py prints them). */
export const BASS = Object.freeze({
  24: { soft: 0.432, hard: 1 }, 27: { soft: 0.312, hard: 1 }, 30: { soft: 0.249, hard: 1 }, 33: { soft: 0.305, hard: 1 },
  36: { soft: 0.515, hard: 1 }, 39: { soft: 0.311, hard: 1 }, 42: { soft: 0.335, hard: 1 }, 45: { soft: 0.488, hard: 1 },
});
/** each guitar note's held take (always 1: one take a note) and its two muted takes against the louder of the two. */
export const HELD = Object.freeze([40, 43, 46, 49, 52, 55, 58, 61, 64, 67, 70, 73]);
export const MUTE = Object.freeze({
  40: [0.939, 1], 43: [1, 0.997], 46: [0.856, 1], 49: [1, 0.956], 52: [0.762, 1], 55: [0.873, 1], 58: [0.82, 1], 61: [1, 0.903], 64: [0.974, 1],
});
export const BASS_ROOTS = Object.freeze(Object.keys(BASS).map(Number).sort((a, b) => a - b));
export const MUTE_ROOTS = Object.freeze(Object.keys(MUTE).map(Number).sort((a, b) => a - b));
/** how long the held takes last before their fade ends, and the muted ones, in seconds */
export const HELD_SECONDS = 2.5, MUTE_SECONDS = 0.5;
/** a bass note at this velocity or louder plays the hard take */
export const HARD = 0.7;
export const bassPath = (root, layer) => '/sounds/bass/' + root + '-' + layer + '.wav';
export const guitarPath = (root, kind) => '/sounds/guitar/' + root + '-' + kind + '.wav';

const nearest = (roots, midi) => { let r = roots[0]; for (const x of roots) if (Math.abs(midi - x) < Math.abs(midi - r)) r = x; return r; };

/** the bass take that plays `midi` at `vel`: { path, root, layer, rate, gain }. The gain brings the take to the velocity, at most 2.5 times. Pure. */
export function bassTake(midi, vel = 0.9) {
  const root = nearest(BASS_ROOTS, midi), layer = vel >= HARD ? 'hard' : 'soft';
  return { path: bassPath(root, layer), root, layer, rate: 2 ** ((midi - root) / 12), gain: Math.min(2.5, vel / BASS[root][layer]) };
}

/** the guitar take that plays `midi`: { path, root, kind, rate, gain }. `muted` asks for a palm mute; the `n`th muted note in a row alternates
 *  between the two takes. A muted note above the muted range is played held. The gain evens out the two muted takes. Pure. */
export function guitarTake(midi, { muted = false, n = 0 } = {}) {
  if (muted && midi <= MUTE_ROOTS[MUTE_ROOTS.length - 1] + 1) {
    const root = nearest(MUTE_ROOTS, midi), i = ((n % 2) + 2) % 2;
    return { path: guitarPath(root, 'mute' + (i + 1)), root, kind: 'mute' + (i + 1), rate: 2 ** ((midi - root) / 12), gain: 1 / MUTE[root][i] };
  }
  const root = nearest(HELD, midi);
  return { path: guitarPath(root, 'held'), root, kind: 'held', rate: 2 ** ((midi - root) / 12), gain: 1 };
}

/** whether a guitar note of a heavy song is palm muted: every short chug is, the held (open) hits ring. Pure. */
export const mutedOf = (n) => !n.open;

/** the takes a heavy song (lib/arrange.js) plays: its bass notes in both layers, each guitar note and the fifth over its open hits, and
 *  the lead's notes on the held guitar. So a page fetches only what its song plays. Pure. */
export function stringsTakesFor(p) {
  const out = new Set();
  for (const n of p.bass || []) for (const vel of [0.9, 0.45]) out.add(bassTake(n.midi, vel).path);
  for (const n of p.guitar || []) {
    if (mutedOf(n)) for (const k of [0, 1]) out.add(guitarTake(n.midi, { muted: true, n: k }).path);
    else for (const m of [n.midi, n.midi + 7, n.midi + 12]) out.add(guitarTake(m).path);
  }
  for (const n of p.melody || []) out.add(guitarTake(n.midi).path);
  return [...out].sort();
}

const cache = new Map();
/** fetch and decode `paths` (stringsTakesFor): { buffers: Map(path -> AudioBuffer) }. Each take is decoded once per page. `decode` turns bytes
 *  into an AudioBuffer (a context's decodeAudioData). Rejects if a take cannot be fetched or decoded. */
export function loadStrings(paths, { fetchFn = (u) => globalThis.fetch(u), decode } = {}) {
  return Promise.all(paths.map((p) => {
    if (!cache.has(p)) cache.set(p, Promise.resolve(fetchFn(p)).then((r) => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.arrayBuffer(); }).then(decode).catch((e) => { cache.delete(p); throw e; }));
    return cache.get(p).then((b) => [p, b]);
  })).then((pairs) => ({ buffers: new Map(pairs) }));
}
