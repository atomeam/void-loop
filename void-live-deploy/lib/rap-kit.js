// Verse's drums are real recordings (owner, 2026-10-30: "needs real beats and music drums needs to sound like perfect studio quality"): two kits
// in /sounds/drums/, each hit recorded from a real instrument, cut so it starts on its first sample, and faded at its tail. Credits and licenses
// are in /sounds/drums/CREDITS.md; tools/drum-kits.py rebuilds the files from the original recordings.
//   - '808': a real Roland TR-808 (Michael Fischer's sample set, free with no restrictions), with its tuned bass drum played as the 808 bass
//   - 'kit': an acoustic drum kit and hand percussion from the Versilian Community Sample Library (CC0): kick, snare in 3 velocity layers, hi-hat
//     in 3 layers, open hat, cymbals, toms, real hand claps, tambourine and shaker. Every voice has round robins (two takes of the same hit), so a
//     repeated hat is never the same sample twice in a row, the way a drummer never hits twice the same.
// hitsOf() is pure (which file, how loud, how fast, tested in tools/rap-kit.test.mjs); loadKit() fetches and decodes a kit once per page.

/** each voice: how many velocity layers its takes are split into (loudest first), and its takes as [file, peak level within the voice] */
export const KITS = Object.freeze({
  '808': {
    kick: { layers: 1, files: [['kick-1', 1], ['kick-2', 0.884]] },
    bass: { layers: 1, files: [['bass-1', 1], ['bass-2', 0.978]] },
    snare: { layers: 1, files: [['snare-1', 0.684], ['snare-2', 1]] },
    clap: { layers: 1, files: [['clap-1', 1]] },
    clap2: { layers: 1, files: [['../kit/clap-1', 0.861], ['../kit/clap-2', 0.939], ['../kit/clap-3', 0.895], ['../kit/clap-4', 1]] },
    hat: { layers: 1, files: [['hat-1', 1]] },
    ohat: { layers: 1, files: [['ohat-1', 1], ['ohat-2', 0.877]] },
    crash: { layers: 1, files: [['crash-1', 1]] },
    rim: { layers: 1, files: [['rim-1', 1]] },
    cowbell: { layers: 1, files: [['cowbell-1', 1]] },
  },
  kit: {
    kick: { layers: 2, files: [['kick-1', 0.957], ['kick-2', 1], ['kick-3', 0.503], ['kick-4', 0.466]] },
    snare: { layers: 3, files: [['snare-1', 1], ['snare-2', 0.888], ['snare-3', 0.545], ['snare-4', 0.427], ['snare-5', 0.105], ['snare-6', 0.088]] },
    rim: { layers: 1, files: [['rim-1', 0.808], ['rim-2', 1]] },
    hat: { layers: 3, files: [['hat-1', 1], ['hat-2', 0.954], ['hat-3', 0.47], ['hat-4', 0.364], ['hat-5', 0.175], ['hat-6', 0.13]] },
    ohat: { layers: 1, files: [['ohat-1', 0.843], ['ohat-2', 1]] },
    pedal: { layers: 1, files: [['pedal-1', 1], ['pedal-2', 0.742]] },
    crash: { layers: 1, files: [['crash-1', 1]] },
    ride: { layers: 1, files: [['ride-1', 1]] },
    clap: { layers: 1, files: [['clap-1', 0.861], ['clap-2', 0.939], ['clap-3', 0.895], ['clap-4', 1]] },
    tomhi: { layers: 1, files: [['tomhi-1', 1], ['tomhi-2', 0.965]] },
    tomlo: { layers: 1, files: [['tomlo-1', 1], ['tomlo-2', 0.884]] },
    tamb: { layers: 1, files: [['tamb-1', 1]] },
    shaker: { layers: 1, files: [['shaker-1', 0.797], ['shaker-2', 1]] },
  },
});

/** the kit each style plays: the acoustic kit for the sampled styles, the 808 for the half-time ones */
export const KIT_OF = Object.freeze({ 'boom bap': 'kit', conscious: 'kit', trap: '808', drill: '808', melodic: '808' });
export const kitFor = (beat) => KIT_OF[(beat && beat.rapStyle) || 'boom bap'] || 'kit';
/** the 808 bass recording is tuned to G1 (midi 31) */
export const BASS_ROOT = 31;
export const BASE = '/sounds/drums/';

/** the path of a take: a file of the kit, or one another kit lends it ('../kit/clap-1' from the 808 kit) */
export const pathOf = (kit, file) => BASE + (file.startsWith('../') ? file.slice(3) : kit + '/' + file) + '.wav';

/** the take of `voice` a hit plays: the velocity layer for `vel` (1 is the loudest layer, each layer below covers the next half of the range
 *  down), then the round robin `n` within it, and the gain that brings the take to `vel` (a soft layer is a softer hit, not a quieter one). Pure. */
export function takeOf(kit, voice, vel = 1, n = 0) {
  const v = KITS[kit] && KITS[kit][voice]; if (!v) return null;
  const per = v.files.length / v.layers, layer = Math.max(0, Math.min(v.layers - 1, Math.floor(((1 - vel) / 0.5) * (v.layers - 1) + 1e-9)));
  const [file, level] = v.files[layer * per + (n % per)];
  return { file, path: pathOf(kit, file), gain: Math.min(4, (v.layers > 1 ? vel : vel * level) / level) };
}

// how each beat event is played on a kit: [voice, gain, a second voice layered under it, its gain]
const VOICE = { kick: ['kick', 1], snare: ['snare', 0.9], clap: ['clap', 0.85, 'clap2', 0.5], hat: ['hat', 0.55], ohat: ['ohat', 0.5], crash: ['crash', 0.45] };

/** every sample the drum and 808 events of a beat play on `kit`: { t, voice, file, path, gain, rate, pan, dur?, from? } in event order. The 808
 *  bass plays its recording at the rate that tunes G1 to the note (and from the previous note, for a drill slide). Pure. */
export function hitsOf(events, kit) {
  const rr = {}, out = [];
  const take = (e, voice, gain, extra = {}) => { const n = rr[voice] = (rr[voice] ?? -1) + 1, t = takeOf(kit, voice, e.vel, n); if (t) out.push({ t: e.t, voice, file: t.file, path: t.path, gain: t.gain * gain, rate: 1, pan: e.pan || 0, ...extra }); };
  for (const e of events) {
    if (e.kind === '808' && KITS[kit].bass) take(e, 'bass', 1, { rate: 2 ** ((e.midi - BASS_ROOT) / 12), from: e.from != null ? 2 ** ((e.from - BASS_ROOT) / 12) : null, dur: e.dur });
    const v = VOICE[e.kind]; if (!v) continue;
    take(e, v[0], v[1]);
    if (v[2] && KITS[kit][v[2]]) take(e, v[2], v[3]);
  }
  return out;
}

const cache = new Map();
/** fetch and decode every take of a kit: { name, buffers: Map(path -> AudioBuffer) }. Decoded once per page: an AudioBuffer plays in any
 *  context. `decode` turns bytes into an AudioBuffer (a context's decodeAudioData). Rejects if a take cannot be fetched or decoded. */
export function loadKit(name, { fetchFn = (u) => globalThis.fetch(u), decode } = {}) {
  const paths = [...new Set(Object.values(KITS[name] || {}).flatMap((v) => v.files.map(([f]) => pathOf(name, f))))];
  return Promise.all(paths.map((p) => {
    if (!cache.has(p)) cache.set(p, Promise.resolve(fetchFn(p)).then((r) => { if (!r.ok) throw new Error(p + ' ' + r.status); return r.arrayBuffer(); }).then(decode).catch((e) => { cache.delete(p); throw e; }));
    return cache.get(p).then((b) => [p, b]);
  })).then((pairs) => ({ name, buffers: new Map(pairs) }));
}
