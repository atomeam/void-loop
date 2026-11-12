#!/usr/bin/env node
// Each film grades itself (frontier #26 step 2; lists runs 24 and 25, 2026-11-12). After a take, measure what a viewer would sit
// through: the seconds where nothing on screen moves (ffmpeg's freezedetect), the longest still stretch, how many taps the film
// showed, and whether the hook and ending cards rendered (tools/record.mjs checks each card on screen and writes taps and cards into
// the film's .json). The scorecard goes into the film's .json as `grade` and into the job summary. A film under the bar is re-shot
// once with another path through the page (tapOrder) and the better take is kept (keepBetter).
//   node tools/film-grade.mjs <film.webm> [--meta film.json]    prints the scorecard; with --meta, writes it into that file
// Needs ffmpeg on PATH (or FFMPEG=/path/to/ffmpeg). The pure parts are exported for tools/film-grade.test.mjs.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const BAR = { maxStillShare: 0.25, maxLongestStill: 3, minTaps: 1 }; // a quarter of the film still, or one still stretch over 3 s, is dead air
export const FREEZE = { noise: '-60dB', minSeconds: 0.5 }; // a stretch shorter than half a second is a beat, not dead air

/** the still stretches in ffmpeg's freezedetect log: [{ start, end }] (a stretch still running at the end closes at `total`). Pure. */
export function stillsOf(log, total = 0) {
  const out = []; let open = null;
  for (const m of String(log || '').matchAll(/lavfi\.freezedetect\.freeze_(start|end):\s*([\d.]+)/g)) {
    const t = Number(m[2]);
    if (m[1] === 'start') open = t; else if (open != null) { out.push({ start: open, end: t }); open = null; }
  }
  if (open != null && total > open) out.push({ start: open, end: total });
  return out;
}
/** the film's length in seconds from ffmpeg's log ("Duration: 00:00:21.48"), or 0. Pure. */
export function durationOf(log) {
  const m = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(String(log || ''));
  return m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : 0;
}
/** the scorecard: seconds, still seconds and share, the longest still, taps, and whether the film clears the bar (with the reasons). Pure. */
export function scorecard({ seconds, stills, taps = null, cards = null }, bar = BAR) {
  const still = stills.reduce((s, x) => s + Math.max(0, x.end - x.start), 0), longest = stills.reduce((m, x) => Math.max(m, x.end - x.start), 0);
  const share = seconds > 0 ? still / seconds : 0, why = [];
  if (share > bar.maxStillShare) why.push(Math.round(share * 100) + '% of the film is still');
  if (longest > bar.maxLongestStill) why.push('one still stretch of ' + longest.toFixed(1) + ' s');
  if (taps != null && taps < bar.minTaps) why.push('no tap shown');
  if (cards && cards.hook === false) why.push('the hook card did not render');
  if (cards && cards.ending === false) why.push('the ending card did not render');
  const r = (n) => Math.round(n * 10) / 10;
  return { seconds: r(seconds), stillSeconds: r(still), stillShare: Math.round(share * 100) / 100, longestStill: r(longest), taps, ...(cards ? { cards: { hook: cards.hook !== false, ending: cards.ending !== false } } : {}), pass: !why.length, why };
}
/** the job-summary line for one film. Pure. */
export const summaryLine = (id, g) => '- ' + id + ': ' + (g.pass ? 'clears the bar' : 'under the bar (' + g.why.join('; ') + ')') + ' · ' + g.seconds + ' s, ' + g.stillSeconds + ' s still, longest ' + g.longestStill + ' s' + (g.taps != null ? ', ' + g.taps + (g.taps === 1 ? ' tap' : ' taps') : '');

/** grade a film file: { video log -> scorecard }, reading taps from its .json when given. */
export function gradeFilm(video, metaFile) {
  const meta = metaFile && fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, 'utf8')) : {};
  const log = gradeLog(video);
  const seconds = durationOf(log) || Number(meta.tookMs) / 1000 || 0;
  return scorecard({ seconds, stills: stillsOf(log, seconds), taps: Number.isFinite(meta.taps) ? meta.taps : null, cards: meta.cards && typeof meta.cards === 'object' ? meta.cards : null });
}
/** the order the buttons are pressed in: the start-like ones first, then the rest; the re-shoot (alt) takes another path, the rest
 *  first from the bottom of the page up and the start-like ones last, so a page that stalled on its first button gets a different film. Pure. */
export function tapOrder(starts, rest, alt = false) {
  return alt ? [...rest].reverse().concat(starts) : [...starts, ...rest];
}
/** which take to keep: 'first' or 'second'. A take that clears the bar wins; otherwise fewer reasons under the bar, then less still
 *  share, then more taps; a tie or a missing grade keeps the first take. Pure. */
export function keepBetter(a, b) {
  if (!b) return 'first'; if (!a) return 'second';
  if (a.pass !== b.pass) return b.pass ? 'second' : 'first';
  if (a.why.length !== b.why.length) return b.why.length < a.why.length ? 'second' : 'first';
  if (a.stillShare !== b.stillShare) return b.stillShare < a.stillShare ? 'second' : 'first';
  return (b.taps || 0) > (a.taps || 0) ? 'second' : 'first';
}
// ffmpeg prints the duration and the freezedetect marks to stderr, whether or not it exits 0
function gradeLog(video, ffmpeg = process.env.FFMPEG || 'ffmpeg') {
  const r = spawnSync(ffmpeg, ['-hide_banner', '-nostats', '-i', video, '-vf', 'freezedetect=n=' + FREEZE.noise + ':d=' + FREEZE.minSeconds + ',metadata=mode=print', '-an', '-f', 'null', '-'], { encoding: 'utf8', timeout: 120000, maxBuffer: 64 << 20 });
  const log = String(r.stderr || '') + String(r.stdout || '');
  if (r.error || !/Duration:/.test(log)) throw r.error || new Error('ffmpeg could not read ' + video);
  return log;
}
/** grade, write the scorecard into the film's .json and append the summary line; never throws (a film is kept even when grading fails). */
export function gradeAndKeep(id, video, metaFile) {
  try {
    const g = gradeFilm(video, metaFile);
    if (metaFile && fs.existsSync(metaFile)) { const m = JSON.parse(fs.readFileSync(metaFile, 'utf8')); fs.writeFileSync(metaFile, JSON.stringify({ ...m, grade: g }, null, 2) + '\n'); }
    if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summaryLine(id, g) + '\n');
    return g;
  } catch (e) { console.log('film grade skipped for ' + id + ': ' + String(e.message || e).split('\n')[0]); return null; }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const video = process.argv[2], i = process.argv.indexOf('--meta'), metaFile = i > 0 ? process.argv[i + 1] : '';
  if (!video) { console.log('usage: node tools/film-grade.mjs <film.webm> [--meta film.json]'); process.exit(2); }
  const g = metaFile ? gradeAndKeep(path.basename(video).replace(/\.\w+$/, ''), video, metaFile) : gradeFilm(video);
  console.log(JSON.stringify(g, null, 2));
}
