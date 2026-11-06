#!/usr/bin/env node
// The quality gate every Short passes before anyone sees it (owner, 2026-11-03: "verses videos are bad, its not framed properly the
// music is bad and they are meaningless to most people even me"). Objective checks only, each measured on the rendered file or on the
// words that made it; a film that fails any one is never uploaded (tools/youtube.mjs gatePassed) and stays unlisted on /films/
// (functions/api/films.js lists only words with gate 'pass').
//   node tools/video-gate.mjs <film.mp4> <film.json>     writes meta.gate = { pass, score, checks } into film.json; exit 1 on a fail
// The checks:
//   frame     1080x1920, 6-20 s
//   no-bars   ffmpeg cropdetect over the whole film finds no black border (letterbox or pillarbox) wider than 8 px
//   captions  every caption at least 64 px, inside the Shorts safe zone, on a backing box, short enough to fit its line
//   footage   real a-to-mind.com footage (the page's answer seen in the browser), or a studio film with its source page; it moves
//   audio     a voice at about -14 LUFS (-15.5..-12.5) with any bed ducked under it, or no voice: silence or a quiet bed at -25..-19 LUFS
//   hook      the first line scores 60+ on hookScore (a relatable, concrete question in a few plain words)
//   topic     the film's words are not a small everyday sum (bills, tips, percents) or adult content (tools/topic-gate.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { filmWordsCheck } from './topic-gate.mjs';

export const W = 1080, H = 1920;
// the part of a Short no YouTube, TikTok or Reels button covers: below the top bar, above the title and buttons, left of the action rail
export const SAFE = { x0: 60, x1: W - 140, y0: Math.round(H * 0.1), y1: Math.round(H * 0.72) };
export const CAPTION_MIN = 64, BAR_PX = 8, LUFS = { voice: -14, tol: 1.5, bedMin: -25, bedMax: -19 }, HOOK_MIN = 60;

const RELATABLE = /\b(you|your|you're|dinner|bill|tip|rent|split|song|stuck|money|pay|paycheck|late|sleep|kids?|groceries|gas|coffee|tonight|weekend|friends?|date|boss|work|recipe|cook|minutes?|hours?|cost|price|cheaper|save|owe|everyone|everybody|everywhere|talking|searching|trending|internet|feed|phone|group chat|pov|movie|trailer|documentary|worth it|today|why now)\b/i;
const JARGON = /\b(ai|llm|model|experiment|verse|lab|agent|built this itself|skill|api|ledger|hypothesis)\b/i;
/** how much an ordinary person would care about a hook, 0-100. Pure.
 *  +35 relatable (an everyday situation or "you"), +20 a question, +15 a concrete number or amount, +20 at most 8 words,
 *  +10 no jargon; any jargon caps it at 40 (nobody scrolling cares that an AI made it). */
export function hookScore(hook) {
  const h = String(hook || '').trim(), words = h.split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  let s = 0;
  if (RELATABLE.test(h)) s += 35;
  if (/\?\s*$/.test(h)) s += 20;
  if (/[$£€]\s?\d|\d/.test(h)) s += 15;
  if (words.length <= 8) s += 20; else if (words.length <= 11) s += 10;
  if (!JARGON.test(h)) s += 10; else s = Math.min(s, 40);
  return Math.min(100, s);
}

/** the caption check from the render's own caption list [{ text, size, x, y, box }] (x, y the top-left in px). Pure. */
export function captionCheck(captions) {
  const bad = [];
  for (const c of captions || []) {
    // a caption the render measured on its own page carries its drawn box (rect: w and h in px); otherwise its size is estimated
    const lines = String(c.text).split('\n'), wide = c.rect ? c.w : Math.max(...lines.map((l) => l.length)) * c.size * 0.62, tall = c.rect ? c.h : lines.length * c.size * 1.25;
    if (c.size < CAPTION_MIN) bad.push(c.text + ': ' + c.size + ' px < ' + CAPTION_MIN);
    if (!c.box) bad.push(c.text + ': no backing box');
    if (c.x < SAFE.x0 || c.x + wide > SAFE.x1 || c.y < SAFE.y0 || c.y + tall > SAFE.y1) bad.push(c.text.replace(/\n/g, ' ') + ': outside the safe zone');
  }
  return { ok: !!(captions && captions.length) && !bad.length, detail: bad.length ? bad.join('; ') : (captions || []).length + ' captions, all legible and in the safe zone' };
}

/** the black borders cropdetect saw, from its log lines ("crop=W:H:X:Y"): the smallest crop seen over the film. Pure. */
export function barsOf(log, w = W, h = H) {
  const crops = [...String(log).matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)].map((m) => m.slice(1, 5).map(Number));
  if (!crops.length) return { ok: false, detail: 'cropdetect saw no frames' };
  // the border is what every frame agrees is black: the largest crop seen (a dark frame can look cropped; a real bar never goes away)
  const cw = Math.max(...crops.map((c) => c[0])), ch = Math.max(...crops.map((c) => c[1]));
  const side = w - cw, topBottom = h - ch;
  return { ok: side <= BAR_PX && topBottom <= BAR_PX, detail: side > BAR_PX ? 'pillarbox bars: ' + side + ' px of black at the sides' : topBottom > BAR_PX ? 'letterbox bars: ' + topBottom + ' px of black top and bottom' : 'full bleed, no black border' };
}

/** a border of any flat colour (cropdetect sees only black; Playwright's recordVideo pads with grey): from signalstats over a 24 px
 *  strip at each edge, sampled through the film, an edge whose strip never varies by more than 3 levels in any frame is padding.
 *  ranges: { left: [YMAX-YMIN per frame], right, top, bottom }. Pure. */
export function flatEdges(ranges) {
  const flat = Object.entries(ranges || {}).filter(([, r]) => r.length && r.every((x) => x <= 3)).map(([k]) => k);
  return { ok: !flat.length, flatSides: ['left', 'right'].some((k) => (ranges[k] || []).length && ranges[k].every((x) => x <= 3)), flatEnds: ['top', 'bottom'].some((k) => (ranges[k] || []).length && ranges[k].every((x) => x <= 3)), detail: flat.length ? 'flat padding at the ' + flat.join(', ') + ' edge' : 'every edge carries picture' };
}

/** the no-bars verdict: a dark page can look like a black border to cropdetect at its edges (space, a night theme), so a border
 *  counts only when that edge is also flat; flat padding of any colour always counts. Pure. */
export function noBars(bars, edges) {
  const real = !bars.ok && /pillarbox/.test(bars.detail) ? edges.flatSides : !bars.ok && /letterbox/.test(bars.detail) ? edges.flatEnds : !bars.ok;
  return { ok: edges.ok && !real, detail: (real ? bars.detail : bars.ok ? bars.detail : 'dark edges, not bars (they carry picture)') + '; ' + edges.detail };
}

/** the audio check from ebur128's integrated loudness (null: no audio stream). A voice: about -14 LUFS (the bed ducked under it). No
 *  voice: silence, or a quiet music bed between -25 and -19 LUFS (owner, 2026-11-03: "music is fine"); anything louder is a track
 *  shouting over nothing, the old Shorts' fault. Pure. */
export function audioCheck(lufs, voice) {
  if (voice) return { ok: lufs != null && Math.abs(lufs - LUFS.voice) <= LUFS.tol, detail: 'voice at ' + (lufs == null ? 'no audio' : lufs.toFixed(1) + ' LUFS') + ' (want ' + LUFS.voice + ' ±' + LUFS.tol + ')' };
  if (lufs == null || !isFinite(lufs) || lufs < -60) return { ok: true, detail: 'silent' };
  const ok = lufs >= LUFS.bedMin && lufs <= LUFS.bedMax;
  return { ok, detail: (ok ? 'a quiet music bed at ' : 'music at ') + lufs.toFixed(1) + ' LUFS (a bed wants ' + LUFS.bedMin + ' to ' + LUFS.bedMax + ')' };
}

const ff = (args) => spawnSync('ffmpeg', ['-hide_banner', '-nostats', ...args], { encoding: 'utf8', maxBuffer: 64 << 20 });
function probe(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_type,width,height:format=duration', '-of', 'json', file], { encoding: 'utf8' });
  const j = JSON.parse(r.stdout || '{}'), v = (j.streams || []).find((s) => s.codec_type === 'video') || {};
  return { w: v.width, h: v.height, dur: Number((j.format || {}).duration) || 0, audio: (j.streams || []).some((s) => s.codec_type === 'audio') };
}

/** run every check on a rendered film and its meta; returns { pass, score, checks: [{ name, ok, detail }] } */
export function gate(file, meta) {
  const p = probe(file), checks = [];
  checks.push({ name: 'frame', ok: p.w === W && p.h === H && p.dur >= 6 && p.dur <= 20, detail: p.w + 'x' + p.h + ', ' + p.dur.toFixed(1) + ' s (want 1080x1920, 6-20 s)' });
  // cropdetect: limit 24 of 255 counts near-black as black, round 2 keeps every pixel, reset 0 keeps the widest crop seen
  const bars = barsOf(ff(['-i', file, '-vf', 'fps=4,cropdetect=limit=24:round=2:reset=0', '-f', 'null', '-']).stderr, p.w, p.h);
  const strip = { left: 'crop=24:ih:0:0', right: 'crop=24:ih:iw-24:0', top: 'crop=iw:24:0:0', bottom: 'crop=iw:24:0:ih-24' }, ranges = {};
  for (const [k, c] of Object.entries(strip)) {
    const log = ff(['-i', file, '-vf', 'fps=2,' + c + ',signalstats,metadata=print', '-an', '-f', 'null', '-']).stderr;
    const mx = [...log.matchAll(/YMAX=(\d+)/g)].map((m) => +m[1]), mn = [...log.matchAll(/YMIN=(\d+)/g)].map((m) => +m[1]);
    ranges[k] = mx.map((x, i) => x - mn[i]);
  }
  checks.push({ name: 'no-bars', ...noBars(bars, flatEdges(ranges)) });
  checks.push({ name: 'captions', ...captionCheck(meta.captions) });
  const scenes = (ff(['-i', file, '-vf', "select='gt(scene,0.003)',metadata=print", '-an', '-f', 'null', '-']).stderr.match(/lavfi\.scene_score/g) || []).length;
  // footage: the live site filmed answering (tools/shorts.mjs), or a studio film (tools/film-studio.mjs) drawn frame by frame about a trend
  // with the page its facts came from; either way the picture has to move
  const f = meta.footage || {}, site = /^https:\/\/a-to-mind\.com\//.test(f.url || '') && f.answerSeen === true, studio = f.kind === 'studio' && /^https:\/\//.test(f.source || '');
  checks.push({ name: 'footage', ok: (site || studio) && scenes >= 5, detail: (site ? 'a-to-mind.com answered "' + f.answer + '" on camera' : studio ? 'a studio film about a trend, facts from ' + f.source : 'no real footage: no a-to-mind.com answer, no studio source') + ', ' + scenes + ' moving frames (want 5+)' });
  let lufs = null;
  if (p.audio) { const m = ff(['-i', file, '-af', 'ebur128', '-f', 'null', '-']).stderr.match(/Integrated loudness:\s*I:\s*(-?[\d.]+|-inf)/); lufs = m ? (m[1] === '-inf' ? -Infinity : Number(m[1])) : null; }
  checks.push({ name: 'audio', ...audioCheck(lufs, !!meta.voice) });
  const hs = hookScore(meta.hook);
  checks.push({ name: 'hook', ok: hs >= HOOK_MIN, detail: '"' + meta.hook + '" scores ' + hs + ' (want ' + HOOK_MIN + '+)' });
  // topic: no small everyday sum (nobody shared those), nothing adult (tools/topic-gate.mjs, on the film's own words)
  const tw = filmWordsCheck(meta);
  checks.push({ name: 'topic', ok: tw.ok, detail: tw.ok ? 'a topic people share' : 'refused topic: ' + tw.kinds.join(', ') + ' (a small everyday sum or adult content)' });
  const pass = checks.every((c) => c.ok);
  return { pass, score: Math.round((100 * checks.filter((c) => c.ok).length) / checks.length), hookScore: hs, lufs: lufs == null || !isFinite(lufs) ? null : lufs, checks, at: new Date().toISOString() };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [file, metaPath] = process.argv.slice(2);
  if (!file || !fs.existsSync(file)) { console.error('usage: node tools/video-gate.mjs <film.mp4> [film.json]'); process.exit(2); }
  const meta = metaPath && fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, 'utf8')) : {};
  const g = gate(file, meta);
  for (const c of g.checks) console.log((c.ok ? 'pass ' : 'FAIL ') + c.name.padEnd(9) + c.detail);
  console.log(g.pass ? 'GATE PASS: ' + path.basename(file) : 'GATE FAIL: ' + path.basename(file) + ' is never uploaded');
  if (metaPath) fs.writeFileSync(metaPath, JSON.stringify({ ...meta, gate: g }, null, 2) + '\n');
  process.exit(g.pass ? 0 : 1);
}
