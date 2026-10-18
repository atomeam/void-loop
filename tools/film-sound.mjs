#!/usr/bin/env node
// Verse's films get a sound (owner, 2026-10-17: "v01ds videos are not good enough to share yet . how can we make it drastically better at
// them?"; frontier #26 step 5). Every film used to be encoded silent (-an). This writes a short score for one film with ffmpeg's own
// synthesizer: no music files, no licence, no model, no spend. The film's id picks the key, the chord progression and the tempo, so two
// films never sound the same and the same film always sounds the same. A minor-key pad, a sub bass on the root and a soft pulse on the
// beat, through a low-pass, faded in and out to the film's length.
//   node tools/film-sound.mjs <out.m4a> --seconds <n> --seed <film id>     (needs ffmpeg on PATH, or FFMPEG=/path/to/ffmpeg)
import { spawnSync } from 'node:child_process';

const ROOTS = { A: 110, C: 130.81, D: 146.83, E: 82.41, F: 87.31, G: 98 }; // the root an octave low; the pad sits two octaves up
// progressions in semitones from the root, minor triads unless marked: the eerie and the hopeful that suit "an AI built this itself"
export const PROGRESSIONS = [
  [[0, 3, 7], [8, 12, 15], [3, 7, 10], [10, 14, 17]], // i  VI  III VII
  [[0, 3, 7], [5, 8, 12], [8, 12, 15], [7, 11, 14]], // i  iv  VI  V
  [[0, 3, 7], [10, 14, 17], [8, 12, 15], [10, 14, 17]], // i  VII VI  VII
  [[0, 3, 7], [3, 7, 10], [5, 8, 12], [8, 12, 15]], // i  III iv  VI
];

/** a small stable hash of a string. Pure. */
export const hash = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619) >>> 0; } return h >>> 0; };

/** the film's score from its id: { key, root, chords: [[hz...] x4], bpm, bar }. Pure. */
export function scoreOf(seed) {
  const h = hash(seed), keys = Object.keys(ROOTS), key = keys[h % keys.length], root = ROOTS[key];
  const prog = PROGRESSIONS[(h >>> 8) % PROGRESSIONS.length], bpm = 76 + ((h >>> 16) % 25); // 76 to 100
  const hz = (st) => +(root * 4 * 2 ** (st / 12)).toFixed(2);
  return { key, root, chords: prog.map((c) => c.map(hz)), bpm, bar: +((60 / bpm) * 4).toFixed(4) };
}

/** the aevalsrc expression for one channel: the chord of the current bar as a swelling pad, the root below, a pulse on each beat. The
 *  right channel is detuned a little for width. Pure. */
export function channel(score, detune = 0) {
  const { chords, root, bar } = score, beat = +(bar / 4).toFixed(4), loop = +(bar * chords.length).toFixed(4);
  const edge = `(1-exp(-mod(t,${bar})*40))*(1-exp(-(${bar}-mod(t,${bar}))*40))`; // a few ms of fade at each bar's ends: no click where the chord changes
  const env = `(1-exp(-mod(t,${bar})*3))*(0.55+0.45*exp(-mod(t,${bar})*0.9))*${edge}`; // a soft attack and a slow fall within each bar
  const pad = chords.map((c, k) => `between(mod(t,${loop}),${+(k * bar).toFixed(4)},${+((k + 1) * bar).toFixed(4)})*(` + c.map((f) => `sin(2*PI*${+(f * (1 + detune)).toFixed(3)}*t)`).join('+') + ')').join('+');
  const bass = chords.map((c, k) => `between(mod(t,${loop}),${+(k * bar).toFixed(4)},${+((k + 1) * bar).toFixed(4)})*sin(2*PI*${+(c[0] / 4).toFixed(3)}*t)`).join('+');
  const pulse = `sin(2*PI*${+(root / 2).toFixed(2)}*t)*exp(-mod(t,${beat})*16)`;
  return `0.07*${env}*(${pad})+0.16*${edge}*(${bass})+0.22*${pulse}`;
}

/** the ffmpeg arguments that write the score for a film of `seconds` to `out` (AAC in an .m4a). Pure. */
export function ffmpegArgs(out, seconds, seed) {
  const s = Math.max(1, Math.min(180, Number(seconds) || 20)), sc = scoreOf(seed);
  const src = `aevalsrc=exprs='${channel(sc)}|${channel(sc, 0.003)}':s=44100:d=${s.toFixed(2)}`;
  const shape = `lowpass=f=2600,afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, s - 1.6).toFixed(2)}:d=1.6,volume=0.9,alimiter=limit=0.8`;
  return ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', src, '-af', shape, '-c:a', 'aac', '-b:a', '160k', out];
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const a = process.argv.slice(2), opt = (k) => { const i = a.indexOf(k); return i >= 0 ? a[i + 1] : undefined; };
  const out = a[0];
  if (!out || out.startsWith('--')) { console.error('usage: node tools/film-sound.mjs <out.m4a> --seconds <n> --seed <film id>'); process.exit(2); }
  const r = spawnSync(process.env.FFMPEG || 'ffmpeg', ffmpegArgs(out, opt('--seconds'), opt('--seed') || out), { stdio: 'inherit' });
  if (r.status !== 0) { console.error('film-sound: ffmpeg failed'); process.exit(1); }
  const sc = scoreOf(opt('--seed') || out);
  console.log(`film-sound: ${out} · ${sc.key} minor · ${sc.bpm} bpm`);
}
