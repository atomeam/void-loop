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

// beat-locked cuts (owner, 2026-10-24: music and film that hit together; frontier #26): the film's score has a tempo (scoreOf), and the cut plays 15% faster than the take
// (.github/workflows/record.yml: setpts=PTS/1.15), so a beat of the finished film is 15% longer in the take. The recorder waits for the next beat before each change of scene
// (a tap, a card, the ending), so what changes on the screen changes on the beat the score is pulsing.
export const SPEEDUP = 1.15;
/** one beat of the score, in the take's own milliseconds. Pure. */
export const takeBeatMs = (score, speedup = SPEEDUP) => +((60000 / score.bpm) * speedup).toFixed(2);
/** how long to wait, from `elapsedMs` into the take, to land on a beat at least `minMs` away; `every` 2 or 4 lands on every second or fourth beat (half a bar, a bar). Pure. */
export function toBeat(elapsedMs, beatMs, minMs = 0, every = 1) {
  const p = beatMs * Math.max(1, every), k = Math.ceil((elapsedMs + Math.max(0, minMs)) / p - 1e-9);
  return Math.max(0, Math.round(k * p - elapsedMs));
}

/** how many seconds of the score to skip so its beats meet the scene changes in the finished film. The take's clock (when the recorder's page was made) runs ahead of the video's
 *  own clock (its first frame comes later, by a different amount each time: 0.3 s and 0.9 s were measured). The recorder flashes one pure magenta frame pair at a known take time
 *  (`syncAt`, ms) and findSync() finds that frame in the video (`videoSec`); the difference is the lag. A scene change the take put on beat k lands `lag / SPEEDUP` early in the
 *  finished film (sped up by SPEEDUP), so the score starts that much into itself. Clamped to 0 to 1.5 s: a larger gap means something else is wrong, and a wrong guess is
 *  worse than none. Pure. */
export function skewSeconds(syncAt, videoSec, speedup = SPEEDUP) {
  const lag = Number(syncAt) - Number(videoSec) * 1000; if (!Number.isFinite(lag)) return 0;
  return +Math.max(0, Math.min(1500, lag) / 1000 / speedup).toFixed(3);
}
/** the video time (seconds) of the sync mark, from ffmpeg's `signalstats,metadata=print` text: the first frame that is magenta (U and V averages both high; white and every dark or pastel
 *  frame of a film are not), or null. Pure. */
export function findSync(text) {
  const frames = []; let cur = null;
  for (const line of String(text).split('\n')) {
    const f = /pts_time:([\d.]+)/.exec(line); if (f) { cur = { t: Number(f[1]) }; frames.push(cur); continue; }
    const m = /lavfi\.signalstats\.(UAVG|VAVG|YAVG)=([\d.]+)/.exec(line); if (m && cur) cur[m[1]] = Number(m[2]);
  }
  const hit = frames.find((x) => x.UAVG > 185 && x.VAVG > 205 && x.YAVG > 80 && x.YAVG < 140); return hit ? hit.t : null;
}

/** the ffmpeg arguments that write the score for a film of `seconds` to `out` (AAC in an .m4a). Pure. */
export function ffmpegArgs(out, seconds, seed) {
  const s = Math.max(1, Math.min(180, Number(seconds) || 20)), sc = scoreOf(seed);
  const src = `aevalsrc=exprs='${channel(sc)}|${channel(sc, 0.003)}':s=44100:d=${s.toFixed(2)}`;
  const shape = `lowpass=f=2600,afade=t=in:d=0.8,afade=t=out:st=${Math.max(0, s - 1.6).toFixed(2)}:d=1.6,volume=0.9,alimiter=limit=0.8`;
  return ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', src, '-af', shape, '-c:a', 'aac', '-b:a', '160k', out];
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href && process.argv[2] === '--skew') {
  // node tools/film-sound.mjs --skew <film.json> <take.webm>: the seconds of the score to skip (record.yml); 0 when the take has no sync mark or it cannot be found
  const fs = await import('node:fs'); let sync = 0; try { sync = JSON.parse(fs.readFileSync(process.argv[3], 'utf8')).syncAt; } catch (_) { /* an older film has none */ }
  let out = 0;
  if (sync) {
    const r = spawnSync(process.env.FFMPEG || 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-t', '8', '-i', process.argv[4], '-vf', 'scale=96:170,signalstats,metadata=print:file=-', '-an', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    const at = findSync((r.stdout || '') + '\n' + (r.stderr || '')); if (at !== null) out = skewSeconds(sync, at);
  }
  console.log(String(out)); process.exit(0);
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
