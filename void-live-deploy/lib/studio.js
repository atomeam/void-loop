// The studio's rules (owner, 2026-10-30: "lots of music making apps exist that make good music with ai why dont we just reverse engineer and
// assimilate their tech into verse so we do it for real , same with image and video and verse should learn it all , we should have the best of
// everything"). Pure: tests in tools/studio.test.mjs. The route is functions/api/studio.js.
//
// How Verse learns which painter is best, from real pictures and not from claims:
//   1. the bench paints the same reference prompts (BENCH) with every image model it can reach (lib/models.js IMAGE_MODELS);
//   2. its vision model judges each picture against that prompt's checklist (judgePrompt, judgeOf): what is visibly there, how flawed it is
//      (hands, faces, text, smears, duplicates), and how good it looks; the picture's real size is read from its bytes (sizeOf);
//   3. each run is one row (score 0 to 100, scoreOf) and championOf picks the painter with the best mean score that the day's neurons can pay for.
// Video is judged the same way, frame by frame, plus how much the frames move and whether they stay the same scene (videoScoreOf).

import { IMAGE_MODELS, VIDEO_MODELS } from './models.js';

// Workers AI's own prices in neurons (developers.cloudflare.com, workers-ai/platform/pricing, read 2026-10-30), for one picture of w x h:
// tiles are 512 x 512, steps where the model is priced by the step. The bench spends cheapest first and never past its cap.
const tiles = (w, h) => Math.max(1, Math.ceil(w / 512) * Math.ceil(h / 512));
export const NEURONS = Object.freeze({
  'klein-4b': (w, h) => tiles(w, h) * 26.05 + 5.37,
  'klein-9b': (w, h) => 1363.64 + Math.max(0, Math.ceil((w * h) / 1048576) - 1) * 181.82,
  'flux-2-dev': (w, h, steps) => tiles(w, h) * 37.5 * steps,
  schnell: (w, h, steps) => 4.8 + 9.6 * steps,
  'lucid-origin': (w, h, steps) => tiles(w, h) * 636 + 12 * steps,
  'phoenix-1': (w, h, steps) => tiles(w, h) * 530 + 10 * steps,
  'sdxl-lightning': () => 0, // Cloudflare lists it as free (beta) on the pricing page
});
export const neuronsOf = (slug, [w, h], steps = (IMAGE_MODELS[slug] || {}).steps || 0) => Math.round((NEURONS[slug] || (() => 1e9))(w, h, steps));

// Dollars a second of video (the partner models' own pages on developers.cloudflare.com, 2026-10-30).
export const VIDEO_PRICES = Object.freeze({
  'p-video': { '720p': 0.02, '1080p': 0.04, '720p-draft': 0.005, '1080p-draft': 0.01 },
  'ltx-fast': { '720p': 0.09, '1080p': 0.15 },
});
export const VIDEO_RES = Object.freeze({ 'p-video': ['720p', '1080p'], 'ltx-fast': ['720p', '1080p'] });
export const VIDEO_SECONDS = Object.freeze({ 'p-video': [1, 10], 'ltx-fast': [6, 10] });
export const VIDEO_ASPECTS = Object.freeze(['16:9', '9:16', '1:1']);
/** what one clip costs in dollars, or Infinity for a model or setting that has no price. Pure. */
export function videoCostOf(model, seconds, res = '720p', draft = false) {
  const p = VIDEO_PRICES[model]; if (!p) return Infinity;
  const each = p[res + (draft ? '-draft' : '')] ?? p[res];
  return Number.isFinite(each) ? Math.round(each * seconds * 10000) / 10000 : Infinity;
}
/** the clip a model is asked for: seconds clamped to what it takes, a resolution it has, an aspect from the list. Pure. */
export function videoAskOf(model, b = {}) {
  const m = Object.hasOwn(VIDEO_MODELS, model) ? model : 'p-video', [lo, hi] = VIDEO_SECONDS[m];
  const seconds = Math.min(hi, Math.max(lo, Math.round(Number(b.seconds) || 5)));
  const res = VIDEO_RES[m].includes(b.resolution) ? b.resolution : '720p';
  const aspect = VIDEO_ASPECTS.includes(b.aspect) ? b.aspect : '16:9';
  const draft = m === 'p-video' && b.draft !== false && b.draft !== 'false';
  return { model: m, seconds, res, aspect, draft, usd: videoCostOf(m, seconds, res, draft) };
}
/** the input the partner model takes for that clip (its own field names), with an optional first frame (a data URL or an https link). Pure. */
export function videoInputOf(ask, prompt, image = '') {
  if (ask.model === 'ltx-fast') {
    const size = { '16:9': { '720p': '1280x720', '1080p': '1920x1080' }, '9:16': { '720p': '720x1280', '1080p': '1080x1920' }, '1:1': { '720p': '1280x720', '1080p': '1920x1080' } }[ask.aspect][ask.res];
    const o = { prompt, duration: ask.seconds, resolution: size, fps: 24, generate_audio: false };
    if (/^https:\/\//.test(image)) o.image_uri = image;
    return o;
  }
  const o = { prompt, duration: ask.seconds, resolution: ask.res, aspect_ratio: ask.aspect, fps: 24, draft: ask.draft, save_audio: false, prompt_upsampling: true, disable_safety_filter: false };
  if (image) o.image = image;
  return o;
}
/** the video link a partner model answered with ({ state, result: { video } }, or a bare { video }), or ''. Only https. Pure. */
export function videoUrlOf(r) {
  const u = r && ((r.result && (r.result.video || r.result.url)) || r.video || r.url);
  return typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/.test(u) ? u : '';
}

// The reference prompts: one hard thing each (photo realism, hands, written words, animals, a drawn style, light, a product, a crowded scene),
// and the checks a careful person would make looking at the picture. A model is good when it is good at all of them.
export const BENCH = Object.freeze([
  { id: 'fox', prompt: 'a red fox sitting in fresh snow at golden hour, pine forest behind it, photograph', checks: ['a red fox', 'the fox is sitting', 'snow on the ground', 'pine trees in the background', 'warm low golden light'] },
  { id: 'hands', prompt: 'close-up of two hands holding a steaming ceramic mug of coffee, cozy sweater sleeves, soft window light', checks: ['two human hands', 'each hand has five normal fingers', 'a ceramic mug', 'steam rising from the mug', 'knitted sweater sleeves'] },
  { id: 'sign', prompt: 'a wooden shop sign that says OPEN in big white letters, hanging on a brick wall, daylight', checks: ['a wooden sign', 'the word OPEN spelled correctly', 'white letters', 'a brick wall', 'the sign is hanging'] },
  { id: 'astronaut', prompt: 'an astronaut riding a horse across a desert under a purple sky with two moons, cinematic', checks: ['an astronaut in a space suit', 'a horse', 'the astronaut is riding the horse', 'a desert', 'two moons in a purple sky'] },
  { id: 'anime', prompt: 'anime illustration of a girl with short blue hair reading a book on a rooftop at sunset, city behind her', checks: ['anime drawing style', 'a girl with short blue hair', 'she is reading a book', 'a rooftop', 'a city skyline at sunset'] },
  { id: 'still', prompt: 'a glass bowl of lemons and limes on a marble kitchen counter, studio product photo, soft shadows', checks: ['a clear glass bowl', 'yellow lemons', 'green limes', 'a marble counter', 'soft shadows'] },
  { id: 'market', prompt: 'a busy night market street with paper lanterns, food stalls and people walking, rain on the ground reflecting the lights', checks: ['paper lanterns', 'food stalls', 'several people walking', 'wet ground with reflections', 'night time'] },
  { id: 'robot', prompt: 'a small friendly robot watering a potted plant on a windowsill, 3D render, soft light', checks: ['a robot', 'a watering can or water pouring', 'a plant in a pot', 'a windowsill or window', 'a 3D rendered look'] },
].map((b) => Object.freeze({ ...b, checks: Object.freeze(b.checks) })));
export const benchOf = (id) => BENCH.find((b) => b.id === id) || null;

/** the judge's instructions for one picture (Verse's vision model, lib/models.js 'vision'). Pure. */
export function judgePrompt(prompt, checks) {
  const list = checks.map((c, i) => (i + 1) + '. ' + c).join('\n');
  return 'You are a strict art director checking a picture an AI made. It was asked for: "' + String(prompt).slice(0, 400) + '".\n'
    + 'Answer each check yes or no, judging only what is clearly visible in this picture:\n' + list + '\n'
    + 'Then rate CLEAN from 0 to 10: 10 means the picture has no visible flaw at all, 0 means it is badly broken. Each of these takes points off: extra, missing or melted fingers or limbs, '
    + 'warped faces or eyes, garbled or misspelled text, smeared or noisy patches, duplicated or merged objects, broken perspective. '
    + 'Then rate LOOK from 0 to 10: composition, lighting, detail and whether a professional would publish it. Most AI pictures are 4 to 7; give 9 or 10 only to excellent work.\n'
    + 'Reply with JSON only, no other words: {"checks":["yes","no",...],"clean":0-10,"look":0-10,"worst":"the single worst problem, a few words"}';
}
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? Math.max(0, Math.min(10, n)) : null; };
/** the judge's answer as { match (0 to 1), clean (0 to 10, 10 = no visible flaw), look (0 to 10), worst, checks: [true|false] }, or null when it is not one. Pure. */
export function judgeOf(text, nChecks) {
  const s = String(text || ''), m = s.match(/\{[\s\S]*\}/); if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch (_) { try { j = JSON.parse(m[0].replace(/,\s*([}\]])/g, '$1').replace(/'/g, '"')); } catch (__) { return null; } }
  const raw = Array.isArray(j.checks) ? j.checks : [], checks = [];
  for (let i = 0; i < nChecks; i++) { const v = raw[i]; checks.push(v === true || /^\s*(?:yes|y|true|1)\b/i.test(String(v == null ? '' : v))); }
  const clean = num(j.clean), look = num(j.look); // 'clean', not 'flaws': asked for 'flaws', the judge gave a flaw count (0 for its best picture, live 2026-10-30)
  if (raw.length === 0 || clean === null || look === null) return null;
  return { match: checks.filter(Boolean).length / Math.max(1, nChecks), clean, look, worst: String(j.worst || '').replace(/\s+/g, ' ').trim().slice(0, 80), checks };
}
/** one picture's score from 0 to 100: what was asked is there (55), it is not broken (25), it looks good (20), times how much of the asked
 *  size it really has (a picture smaller than asked is worth less). Pure. */
export function scoreOf(j, got = null, want = null) {
  if (!j) return 0;
  let s = 100 * (0.55 * j.match + 0.25 * (j.clean / 10) + 0.2 * (j.look / 10));
  if (got && want && got[0] > 0 && got[1] > 0) s *= Math.min(1, (got[0] * got[1]) / (want[0] * want[1]));
  return Math.round(s * 10) / 10;
}

/** the width and height a PNG, JPEG or WebP really has, read from its first bytes (base64 or a data URL), or null. Pure. */
export function sizeOf(b64) {
  const s = String(b64 || '').replace(/^data:image\/[a-z]+;base64,/, ''); let bin;
  try { bin = atob(s.slice(0, 200000)); } catch (_) { return null; }
  const at = (i) => bin.charCodeAt(i) & 255, u16 = (i) => (at(i) << 8) | at(i + 1), u32 = (i) => ((at(i) << 24) | (at(i + 1) << 16) | (at(i + 2) << 8) | at(i + 3)) >>> 0;
  if (bin.startsWith('\x89PNG')) return [u32(16), u32(20)];
  if (bin.startsWith('RIFF') && bin.slice(8, 12) === 'WEBP') {
    const kind = bin.slice(12, 16), le = (i, n) => { let v = 0; for (let k = n - 1; k >= 0; k--) v = v * 256 + at(i + k); return v; };
    if (kind === 'VP8X') return [le(24, 3) + 1, le(27, 3) + 1];
    if (kind === 'VP8 ') return [le(26, 2) & 0x3fff, le(28, 2) & 0x3fff];
    if (kind === 'VP8L') { const b = le(21, 4); return [(b & 0x3fff) + 1, ((b >> 14) & 0x3fff) + 1]; }
    return null;
  }
  if (at(0) === 0xff && at(1) === 0xd8) {
    for (let i = 2; i < bin.length - 9;) {
      if (at(i) !== 0xff) { i++; continue; }
      const marker = at(i + 1);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return [u16(i + 7), u16(i + 5)];
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) { i += 2; continue; }
      i += 2 + u16(i + 2);
    }
  }
  return null;
}
/** a picture a painter answered with, as a data URL (PNG, JPEG or WebP, at most 4 MB of base64), or ''. Pure. */
export function pictureOf(b64) {
  const s = typeof b64 === 'string' ? b64.replace(/^data:image\/[a-z]+;base64,/, '') : '';
  if (s.length < 2000 || s.length > 4e6 || !/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return '';
  if (s.startsWith('/9j/')) return 'data:image/jpeg;base64,' + s;
  if (s.startsWith('iVBORw0KGgo')) return 'data:image/png;base64,' + s;
  if (s.startsWith('UklGR')) return 'data:image/webp;base64,' + s;
  return '';
}

/** the painter's request for one model: { form } (fields for multipart) or { json }. Pure. */
export function paintAskOf(slug, prompt, [w, h], seed) {
  const m = IMAGE_MODELS[slug]; if (!m) return null;
  if (m.ask === 'multipart') { const form = { prompt, width: String(w), height: String(h), seed: String(seed) }; if (m.steps) form.steps = String(m.steps); return { form }; }
  const json = { prompt }; if (slug !== 'schnell') json.seed = seed; // schnell refuses a seed field (live 2026-10-30: 5006 '/seed' not allowed)
  if (!m.square) { json.width = w; json.height = h; }
  if (m.steps) { json.num_steps = m.steps; if (slug === 'schnell') { delete json.num_steps; json.steps = Math.min(8, m.steps); } }
  if (m.guidance) json.guidance = m.guidance;
  return { json };
}

/** the bench's plan: every (model, prompt) pair, cheapest model first, that fits under `cap` neurons. Pure. */
export function planOf(slugs, ids, size, cap) {
  const ms = slugs.filter((s) => Object.hasOwn(IMAGE_MODELS, s)).sort((a, b) => neuronsOf(a, size) - neuronsOf(b, size));
  const bs = ids.map(benchOf).filter(Boolean), plan = []; let spent = 0;
  for (const b of bs) for (const m of ms) { const n = neuronsOf(m, size); if (spent + n > cap) continue; plan.push({ model: m, bench: b.id, neurons: n }); spent += n; }
  return { plan, neurons: Math.round(spent) };
}

/** the scoreboard from the bench's rows ({ model, bench, score, ms }): per model the runs, the mean score, the mean time, the prompts it has
 *  been judged on, best first. Pure. */
export function boardOf(rows) {
  const by = new Map();
  for (const r of rows || []) {
    if (!r || !Object.hasOwn(IMAGE_MODELS, r.model)) continue;
    const e = by.get(r.model) || { model: r.model, n: 0, sum: 0, ms: 0, benches: new Set() };
    e.n++; e.sum += Number(r.score) || 0; e.ms += Number(r.ms) || 0; e.benches.add(r.bench); by.set(r.model, e);
  }
  return [...by.values()].map((e) => ({ model: e.model, runs: e.n, score: Math.round((e.sum / e.n) * 10) / 10, ms: Math.round(e.ms / e.n), prompts: e.benches.size, neurons1024: neuronsOf(e.model, [1024, 1024]) }))
    .sort((a, b) => b.score - a.score || a.neurons1024 - b.neurons1024);
}
/** the painter Verse uses: the best-scoring model that has been judged on at least `minPrompts` reference prompts and costs at most `maxNeurons`
 *  a 1024 picture; a model within `tie` points of the best and cheaper wins (the same picture for fewer neurons). `fallback` when none
 *  qualifies. Pure. */
export function championOf(board, { maxNeurons = 400, minPrompts = 4, tie = 1.5, fallback = 'klein-4b' } = {}) {
  const ok = (board || []).filter((e) => e.prompts >= minPrompts && e.neurons1024 <= maxNeurons);
  if (!ok.length) return fallback;
  const best = ok.reduce((a, b) => (b.score > a.score ? b : a));
  return ok.filter((e) => e.score >= best.score - tie).sort((a, b) => a.neurons1024 - b.neurons1024)[0].model;
}

// Video, judged from frames the browser or the bench took out of the clip: each frame by the same judge (does it show what was asked, is it
// broken), and the clip as a whole by how much it moves (motion, 0 to 1, the mean change between frames) and whether it stays one scene
// (steady: the judge's yes to "these frames are the same scene and subject").
/** a clip's score from 0 to 100. A clip that does not move is a still picture and loses its motion share. Pure. */
export function videoScoreOf(frames, motion, steady) {
  const js = (frames || []).filter(Boolean); if (!js.length) return 0;
  const avg = (k) => js.reduce((a, j) => a + j[k], 0) / js.length;
  const moves = Math.max(0, Math.min(1, Number(motion) || 0)), moving = moves < 0.01 ? 0 : moves > 0.6 ? 0.6 : 1; // too still or so much change it is a cut
  const s = 100 * (0.4 * avg('match') + 0.2 * (avg('clean') / 10) + 0.15 * (avg('look') / 10) + 0.15 * moving + 0.1 * (steady ? 1 : 0));
  return Math.round(s * 10) / 10;
}
/** the judge's instructions for "is this the same scene" across frames shown in order. Pure. */
export const steadyPrompt = (prompt) => 'These pictures are frames from one short AI video, in order. It was asked for: "' + String(prompt).slice(0, 300)
  + '". Do they show the same scene and the same subject moving naturally, without the subject changing into something else, melting, or jumping? Reply with JSON only: {"steady":"yes"|"no","why":"a few words"}';
export const steadyOf = (text) => { const m = String(text || '').match(/"steady"\s*:\s*"?(yes|no)/i); return m ? m[1].toLowerCase() === 'yes' : null; };
