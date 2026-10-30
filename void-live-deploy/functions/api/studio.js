// /api/studio: Verse's studio, where it learns which image and video makers are best from what they really make (owner, 2026-10-30: "we
// should have the best of everything"). The rules are in lib/studio.js; the models in lib/models.js (IMAGE_MODELS, VIDEO_MODELS).
//   GET  /api/studio                 the scoreboard: per image model its judged runs, mean score, mean time and cost, and the painter Verse uses
//   POST { op: 'bench', models, prompts, size, cap, images }   (owner) paint the reference prompts with each model, cheapest first, inside `cap`
//                                    neurons; Verse's vision model judges every picture; each run is kept as one row of numbers
//   POST { op: 'judge', image, prompt, checks }                 (owner) judge one picture (the bench's video frames come here)
//   POST { op: 'steady', frames, prompt }                       (owner) whether frames in order stay one scene
//   POST { op: 'video', prompt, model, seconds, resolution, aspect, draft, image }  (owner) one clip from a partner video model, inside the
//                                    day's dollar cap (OWNER_VIDEO_DAILY_USD, default $1); the answer carries the clip's link or the model's own error
//
// WHAT A STRANGER COULD MAKE THIS DO. GET only reads the scoreboard (numbers and model names, nothing typed). Every POST needs the owner key
// (lib/guard.js ownerOk): a stranger gets 401 and nothing runs. The bench paints only the fixed prompts in lib/studio.js BENCH, so nothing
// typed by anyone reaches a painter here, and it never spends past its neuron cap. The video op spends dollars, so it counts every clip's
// price in D1 by day and stops at the cap; STUDIO_OFF=1 turns every POST off. Nothing typed is stored: rows hold model names, the reference
// prompt's id, scores, sizes and times.
import { ownerOk } from '../../lib/guard.js';
import { dayOf } from '../../lib/reactions.js';
import { redact } from '../../lib/automation-fix.js';
import { models, IMAGE_MODELS, VIDEO_MODELS } from '../../lib/models.js';
import { BENCH, benchOf, judgePrompt, judgeOf, scoreOf, sizeOf, pictureOf, paintAskOf, planOf, boardOf, championOf, neuronsOf, videoAskOf, videoInputOf, videoUrlOf, steadyPrompt, steadyOf } from '../../lib/studio.js';
import { cleanLine } from '../../lib/image-gen.js';

const json = (o, status = 200) => Response.json(o, { status, headers: { 'cache-control': 'no-store' } });
const why = (e) => redact(String((e && e.message) || e || 'error')).replace(/\s+/g, ' ').slice(0, 300);
const timed = (p, ms, what) => { let t; return Promise.race([p, new Promise((_, no) => { t = setTimeout(() => no(new Error(what + ' took over ' + Math.round(ms / 1000) + ' s')), ms); })]).finally(() => clearTimeout(t)); };
const off = (env) => /^(1|true|yes|on)$/i.test(String((env && env.STUDIO_OFF) || '').trim());
export const BENCH_CAP = 6000, PAINT_MS = 90000, JUDGE_MS = 45000, VIDEO_MS = 280000;
const ownerVideoCap = (env) => { const n = Number(env && env.OWNER_VIDEO_DAILY_USD); return Number.isFinite(n) && n >= 0 ? Math.min(n, 5) : 1; };

let ready = null;
async function ensure(env) {
  if (!ready) ready = env.DB.batch([
    // void_studio_runs2: the first table held 'flaws' scores the judge read as a flaw count (inverted); those rows are not mixed in
    env.DB.prepare('CREATE TABLE IF NOT EXISTS void_studio_runs2 (id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT NOT NULL, model TEXT NOT NULL, bench TEXT NOT NULL, size INTEGER NOT NULL, score REAL NOT NULL, match REAL NOT NULL, clean REAL NOT NULL, look REAL NOT NULL, w INTEGER, h INTEGER, ms INTEGER NOT NULL, neurons INTEGER NOT NULL, worst TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS void_studio_spend (day TEXT NOT NULL, who TEXT NOT NULL, usd REAL NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, who))'),
  ]).catch((e) => { ready = null; throw e; });
  await ready;
}
export const resetReady = () => { ready = null; };
export const ensureStudio = ensure; // the video page's route (functions/api/clip.js) counts its dollars in the same spend table

const toB64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000)); return btoa(s); };
/** whatever a painter answered (base64, { image }, a stream or bytes) as base64, or '' */
export async function b64Of(r) {
  const v = r && typeof r === 'object' && !(r instanceof Uint8Array) && !(r instanceof ArrayBuffer) && typeof r.getReader !== 'function' && r.image !== undefined ? r.image : r;
  if (typeof v === 'string') return v;
  if (v instanceof Uint8Array) return toB64(v);
  if (v instanceof ArrayBuffer) return toB64(new Uint8Array(v));
  if (v && typeof v.getReader === 'function') return toB64(new Uint8Array(await new Response(v).arrayBuffer()));
  return '';
}
/** one picture from one image model: { img, ms, w, h } or a thrown error naming what the model said */
export async function paintWith(env, slug, prompt, size, seed, ms = PAINT_MS) {
  const m = IMAGE_MODELS[slug], ask = paintAskOf(slug, prompt, size, seed); if (!m || !ask) throw new Error('no such painter');
  let input = ask.json;
  if (ask.form) { const f = new FormData(); for (const [k, v] of Object.entries(ask.form)) f.append(k, v); const body = new Response(f); input = { multipart: { body: body.body, contentType: body.headers.get('content-type') } }; }
  const t0 = Date.now(), r = await timed(env.AI.run(m.id, input), ms, slug);
  const img = pictureOf(await b64Of(r));
  if (!img) throw new Error('not a picture: ' + (r && typeof r === 'object' ? Object.keys(r).join(',').slice(0, 60) : typeof r));
  const got = sizeOf(img) || [0, 0];
  return { img, ms: Date.now() - t0, w: got[0], h: got[1] };
}
const said = (r) => String((r && (r.response || (r.choices && r.choices[0] && r.choices[0].message && r.choices[0].message.content) || (r.result && r.result.response))) || '');
/** Verse's vision model on one picture: the judgement (lib/studio.js judgeOf) or a thrown error */
export async function judge(env, img, prompt, checks) {
  const ask = (extra = '') => timed(env.AI.run(models('vision'), { messages: [{ role: 'user', content: [{ type: 'text', text: judgePrompt(prompt, checks) + extra }, { type: 'image_url', image_url: { url: img } }] }], max_tokens: 400, temperature: 0, chat_template_kwargs: { enable_thinking: false } }), JUDGE_MS, 'judge');
  let j = judgeOf(said(await ask()), checks.length);
  if (!j) j = judgeOf(said(await ask('\nYour last reply was not the JSON asked for. Reply with the JSON object only.')), checks.length);
  if (!j) throw new Error('the judge did not answer in the asked form');
  return j;
}
export async function steady(env, frames, prompt) {
  const content = [{ type: 'text', text: steadyPrompt(prompt) }, ...frames.slice(0, 4).map((url) => ({ type: 'image_url', image_url: { url } }))];
  return steadyOf(said(await timed(env.AI.run(models('vision'), { messages: [{ role: 'user', content }], max_tokens: 120, temperature: 0, chat_template_kwargs: { enable_thinking: false } }), JUDGE_MS, 'steady')));
}

async function bench(env, b) {
  const size = [512, 768, 1024].includes(Number(b.size)) ? Number(b.size) : 1024, dims = [size, size];
  const slugs = Array.isArray(b.models) && b.models.length ? b.models.map(String) : Object.keys(IMAGE_MODELS);
  const ids = Array.isArray(b.prompts) && b.prompts.length ? b.prompts.map(String) : BENCH.map((x) => x.id);
  const cap = Math.max(0, Math.min(BENCH_CAP, Number(b.cap) || 3000)), seed = Math.floor(Number(b.seed)) >= 0 ? Math.floor(Number(b.seed)) % 1e9 : 7;
  const { plan, neurons } = planOf(slugs, ids, dims, cap), day = dayOf(), runs = [];
  for (const p of plan) {
    const ref = benchOf(p.bench), row = { model: p.model, bench: p.bench, size, neurons: p.neurons };
    try {
      const pic = await paintWith(env, p.model, ref.prompt, dims, seed);
      Object.assign(row, { ms: pic.ms, w: pic.w, h: pic.h });
      try { const j = await judge(env, pic.img, ref.prompt, ref.checks); Object.assign(row, { score: scoreOf(j, [pic.w, pic.h], dims), match: j.match, clean: j.clean, look: j.look, worst: j.worst, checks: j.checks }); }
      catch (e) { row.judgeError = why(e); }
      if (b.images) row.img = pic.img;
    } catch (e) { row.error = why(e); }
    runs.push(row);
  }
  const judged = runs.filter((r) => r.score !== undefined); // kept as one batch, after the paintings
  if (judged.length) await env.DB.batch(judged.map((r) => env.DB.prepare('INSERT INTO void_studio_runs2 (day, model, bench, size, score, match, clean, look, w, h, ms, neurons, worst) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .bind(day, r.model, r.bench, size, r.score, r.match, r.clean, r.look, r.w || 0, r.h || 0, r.ms, r.neurons, r.worst || ''))).catch(() => {});
  return { ok: true, size, cap, planned: plan.length, neurons, runs };
}

async function spentToday(env, who) { const r = await env.DB.prepare('SELECT usd FROM void_studio_spend WHERE day = ? AND who = ?').bind(dayOf(), who).first(); return r ? Number(r.usd) || 0 : 0; }
const spend = (env, who, usd) => env.DB.prepare('INSERT INTO void_studio_spend (day, who, usd, n) VALUES (?, ?, ?, 1) ON CONFLICT(day, who) DO UPDATE SET usd = usd + excluded.usd, n = n + 1').bind(dayOf(), who, usd).run();
/** one clip from a partner video model, counted against `who`'s daily dollar cap */
export async function makeVideo(env, b, who, cap) {
  const prompt = cleanLine(b.prompt, 600); if (!prompt) return { state: 'refused', why: 'empty' };
  const ask = videoAskOf(String(b.model || 'p-video'), b), image = typeof b.image === 'string' && (/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(b.image) && b.image.length < 4e6 || /^https:\/\/[^\s"'<>]{8,500}$/.test(b.image)) ? b.image : '';
  if (!Number.isFinite(ask.usd)) return { state: 'refused', why: 'no price' };
  const used = await spentToday(env, who);
  if (used + ask.usd > cap) return { state: 'resting', why: 'cap', left: Math.max(0, Math.round((cap - used) * 1000) / 1000) };
  const t0 = Date.now();
  try {
    const r = await timed(env.AI.run(VIDEO_MODELS[ask.model], videoInputOf(ask, prompt, image)), VIDEO_MS, ask.model);
    const url = videoUrlOf(r);
    if (!url) return { state: 'failed', ...ask, ms: Date.now() - t0, why: 'no video in the answer: ' + (r && typeof r === 'object' ? JSON.stringify(r).slice(0, 200) : typeof r) };
    await spend(env, who, ask.usd).catch(() => {});
    return { state: 'video', ...ask, url, ms: Date.now() - t0 };
  } catch (e) { return { state: 'failed', ...ask, ms: Date.now() - t0, why: why(e) }; }
}

export async function onRequestPost({ request, env }) {
  if (!(await ownerOk(request, env))) return json({ ok: false, error: 'owner only' }, 401);
  if (off(env)) return json({ ok: false, error: 'the studio is off (STUDIO_OFF)' }, 503);
  if (!env || !env.AI || !env.DB) return json({ ok: false, error: 'no Workers AI or D1 on this deploy' }, 503);
  let b = {}; try { b = JSON.parse((await request.text()).slice(0, 12e6)); } catch (_) { return json({ ok: false, error: 'bad json' }, 400); }
  try { await ensure(env); } catch (e) { return json({ ok: false, error: 'd1: ' + why(e) }, 503); }
  if (b.op === 'bench') return json(await bench(env, b));
  if (b.op === 'judge') {
    const img = pictureOf(String(b.image || '')), prompt = cleanLine(b.prompt, 400), checks = (Array.isArray(b.checks) ? b.checks : [prompt]).map((c) => cleanLine(c, 120)).filter(Boolean).slice(0, 8);
    if (!img || !prompt) return json({ ok: false, error: 'a picture and its prompt' }, 400);
    try { const j = await judge(env, img, prompt, checks); return json({ ok: true, ...j, score: scoreOf(j) }); } catch (e) { return json({ ok: false, error: why(e) }, 502); }
  }
  if (b.op === 'steady') {
    const frames = (Array.isArray(b.frames) ? b.frames : []).map((f) => pictureOf(String(f))).filter(Boolean);
    if (frames.length < 2) return json({ ok: false, error: 'two frames or more' }, 400);
    try { return json({ ok: true, steady: await steady(env, frames, cleanLine(b.prompt, 300)) }); } catch (e) { return json({ ok: false, error: why(e) }, 502); }
  }
  if (b.op === 'video') return json(await makeVideo(env, b, 'owner', ownerVideoCap(env)));
  return json({ ok: false, error: 'op is bench, judge, steady or video' }, 400);
}

/** the scoreboard and the painter it picks (public: numbers only) */
export async function boardNow(env) {
  await ensure(env);
  const { results } = await env.DB.prepare('SELECT model, bench, score, ms FROM void_studio_runs2 WHERE day >= ? ORDER BY id DESC LIMIT 2000').bind(dayOf(Date.now() - 30 * 864e5)).all();
  const board = boardOf(results || []);
  return { board, champion: championOf(board), models: Object.keys(IMAGE_MODELS).map((m) => ({ model: m, neurons1024: neuronsOf(m, [1024, 1024]) })), prompts: BENCH.map((x) => x.id) };
}
// The public painter /image/ uses (functions/api/image.js): the board's best model that costs no more at 1024 x 1024 than klein-4b's 110
// neurons, so the page's daily share (AI_SHARE pictures, ~4,000 neurons with the forge) stays what it was. Read once an hour per isolate.
export const PUBLIC_NEURONS = 120;
let painterCache = { at: 0, slug: '' };
export const resetPainter = () => { painterCache = { at: 0, slug: '' }; };
export async function publicPainter(env, now = Date.now()) {
  if (painterCache.slug && now - painterCache.at < 3600e3) return painterCache.slug;
  let slug = 'klein-4b';
  try { const { board } = await boardNow(env); slug = championOf(board, { maxNeurons: PUBLIC_NEURONS }); } catch (_) {}
  painterCache = { at: now, slug };
  return slug;
}
export async function onRequestGet({ env }) {
  if (!env || !env.DB) return json({ ok: false, off: true });
  try { return json({ ok: true, ...(await boardNow(env)) }); } catch (e) { return json({ ok: false, error: why(e) }, 503); }
}
