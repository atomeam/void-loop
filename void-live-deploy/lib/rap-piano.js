// Verse's grand piano (owner, 2026-10-30: "needs real beats and music ... not just rap all music"): a real Steinway B, recorded with the sustain
// pedal down, every 4 semitones from C2 to C6 in a soft and a hard layer (sounds/piano/, built by tools/piano.py from the free VCSL recordings,
// CREDITS.md). A note plays the nearest recording, sped up or slowed down by at most 2 semitones, so the timbre stays the piano's own.
// takeOf() and chordOf() are pure (which file, how fast, how loud, when; tested in tools/rap-piano.test.mjs); loadPiano() fetches and decodes
// the piano once per page.

/** each recorded note (MIDI) and the peak of its soft and hard take against the louder of the two (tools/piano.py prints them). */
export const NOTES = Object.freeze({
  36: { soft: 0.888, hard: 1 }, 40: { soft: 0.782, hard: 1 }, 44: { soft: 0.928, hard: 1 }, 48: { soft: 0.826, hard: 1 },
  52: { soft: 0.727, hard: 1 }, 56: { soft: 0.892, hard: 1 }, 60: { soft: 0.944, hard: 1 }, 64: { soft: 1, hard: 0.932 },
  68: { soft: 0.741, hard: 1 }, 72: { soft: 0.739, hard: 1 }, 76: { soft: 0.82, hard: 1 }, 80: { soft: 0.82, hard: 1 }, 84: { soft: 0.9, hard: 1 },
});
export const ROOTS = Object.freeze(Object.keys(NOTES).map(Number).sort((a, b) => a - b));
export const BASE = '/sounds/piano/';
/** how long each recording lasts before its fade ends, in seconds */
export const SECONDS = 3;
/** a hit at this velocity or louder plays the hard take */
export const HARD = 0.8;
export const pathOf = (root, layer) => BASE + root + '-' + layer + '.wav';

/** the recording that plays `midi` at `vel`: { path, root, layer, rate, gain }. The nearest root (the lower on a tie), its playback rate,
 *  and the gain that brings the take to the velocity, never more than 1.6 times. */
export function takeOf(midi, vel = 0.8) {
  let root = ROOTS[0];
  for (const r of ROOTS) if (Math.abs(midi - r) < Math.abs(midi - root)) root = r;
  const layer = vel >= HARD ? 'hard' : 'soft';
  return { path: pathOf(root, layer), root, layer, rate: 2 ** ((midi - root) / 12), gain: Math.min(1.6, vel / NOTES[root][layer]) };
}

const jitter = (a, b) => { const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return x - Math.floor(x) - 0.5; };
/** a keys event { t, vel, notes, dur } played by hand: the notes low to high, each one 6 to 10 ms after the one below (a slight roll), the top
 *  note a little louder (it carries the tune), every velocity and time nudged by a seeded few percent so no two chords are the same.
 *  Returns [{ midi, t, vel, dur }]; the same event always gives the same notes. */
export function chordOf(e) {
  const notes = [...(e.notes || [])].sort((a, b) => a - b), top = notes.length - 1;
  return notes.map((midi, i) => {
    const t = e.t + i * (0.008 + 0.002 * jitter(e.t, i)) + 0.003 * jitter(i, e.t), vel = Math.max(0.05, Math.min(1, (e.vel ?? 0.8) * (i === top ? 1.08 : 0.92) * (1 + 0.06 * jitter(e.t + i, 3))));
    return { midi, t: Math.max(0, t), vel, dur: Math.max(0.05, (e.dur ?? 1) - (t - e.t)) };
  });
}

/** the takes that playing `notes` (MIDI numbers) can call for: both layers of each note's nearest recording, so a page fetches only what its
 *  music plays (all 26 when `notes` is not given). Pure. */
export function takesFor(notes) {
  const roots = notes ? [...new Set([...notes].map((m) => takeOf(m).root))].sort((a, b) => a - b) : ROOTS;
  return roots.flatMap((r) => ['soft', 'hard'].map((l) => pathOf(r, l)));
}

const cache = new Map();
/** fetch and decode the takes `notes` call for (takesFor): { buffers: Map(path -> AudioBuffer) }. Each take is decoded once per page: an
 *  AudioBuffer plays in any context. `decode` turns bytes into an AudioBuffer (a context's decodeAudioData). Rejects if a take cannot be
 *  fetched or decoded. */
export function loadPiano({ fetchFn = (u) => globalThis.fetch(u), decode, notes = null } = {}) {
  return Promise.all(takesFor(notes).map((p) => {
    if (!cache.has(p)) cache.set(p, Promise.resolve(fetchFn(p)).then((r) => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.arrayBuffer(); }).then(decode).catch((e) => { cache.delete(p); throw e; }));
    return cache.get(p).then((b) => [p, b]);
  })).then((pairs) => ({ buffers: new Map(pairs) }));
}
