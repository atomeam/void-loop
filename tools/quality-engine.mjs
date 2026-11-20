#!/usr/bin/env node
// Verse's always-on quality engine (owner, 2026-11-19: "verse has nothing better to do than make itself the best"; outdo GTA 6; beautiful AND
// correct; exponential). It picks the weakest thing people see, measures it for real (tools/quality-measure.mjs, scored by lib/quality.js),
// ships one fix from the shared parts (tools/quality-improve.mjs), re-scores the LIVE page, keeps the change only when the score went up and
// nothing else got worse, otherwise undoes it, and moves on, forever. It also makes new things (the creation lane), tracks its own rate of
// improvement, and when that flattens it upgrades itself. Its prompts start with the charter (tools/charter.mjs).
//   node tools/quality-engine.mjs lane [--limit 5] [--dry]   what the house loops run: settle the open change, survey a slice, start the next fix in the tree
//   node tools/quality-engine.mjs cycle --paths /a/ [--ship] one improve-and-verify cycle with real pull requests (on a box with git and gh)
//   node tools/quality-engine.mjs survey [--paths /a/,/b/]   measure and print, change nothing
//   node tools/quality-engine.mjs calibrate                   score the reference fails and fixes; the bar must keep them apart and below the pinnacle
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { calibration, CRITERIA, PINNACLE, scoreSurface, decide, pickWeakest, towerGaps, boardAdd, boardSummary, rateOf, dailySeries, flattening, rankImprovers, visionPrompt, readVision, splitTurns } from '../void-live-deploy/lib/quality.js';
import { launch, measure, SITE } from './quality-measure.mjs';
import { IMPROVERS, candidates, applyTo, undoOn, fileOf, HANDS_OFF } from './quality-improve.mjs';
import { charterPrompt, grow } from './charter.mjs';
import { models } from '../void-live-deploy/lib/models.js';
import { sitePages } from './design-loop.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const REC = path.join(root, 'void-live-deploy/quality/board.json');
const SHOTS = process.env.QUALITY_SHOTS || '';
export const CARDS = [
  { ask: 'what is 17 times 23', expect: /\b391\b/, domain: 'calculator' }, { ask: 'convert 100 fahrenheit to celsius', expect: /37\.[78]/, domain: 'units' },
  { ask: 'weather in paris', expect: /Paris[\s\S]*\d+\s*°/, domain: 'weather' }, { ask: 'how to make guacamole', expect: /avocado/i, domain: 'recipes' },
  { ask: 'what is the capital of france', expect: /Paris/, domain: 'definitions' }, { ask: 'pancake recipe', expect: /flour/i, domain: 'recipes' },
];
const read = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const arg = (k, d = '') => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(k);
const slug = (id) => String(id).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'home';

export function blankRec() {
  return { id: 'quality', about: 'The quality board: each surface\'s measured score over time, the cycles that changed it, the improvement rate and what each cost. Ids and numbers only.',
    board: { surfaces: [] }, crit: {}, cycles: [], pending: null, improvers: {}, creations: [], meta: [], todo: [], rate: null, series: [], summary: null };
}
export const load = () => ({ ...blankRec(), ...read(REC, {}) });
export function save(rec) { fs.mkdirSync(path.dirname(REC), { recursive: true }); fs.writeFileSync(REC, JSON.stringify(rec) + '\n'); }

/** every surface people see: the pages in the repo, plus the cards an ask puts on the stage. */
export function surfaceList() {
  const pages = sitePages().filter((p) => !/tower\.shots|_/.test(p.url)).map((p) => ({ id: p.url, kind: /^\/(?:games|arcade)\//.test(p.url) ? 'game' : 'page', path: p.url }));
  const home = { id: '/', kind: 'page', path: '/' };
  const cards = CARDS.map((c) => ({ id: 'ask:' + c.ask, kind: 'card', ask: c.ask }));
  return [home, ...pages.filter((p) => p.id !== '/'), ...cards];
}

// ---- the vision judge: a model looks at the screenshot against the pinnacle bar ----
export async function visionJudge(png, surface, env = process.env, fetchFn = fetch, mime = 'image/png', { prompt: ask = null, read = readVision } = {}) {
  const prompt = ask || (charterPrompt() + visionPrompt(surface)), b64 = png.toString('base64');
  const cf = env.CLOUDFLARE_AI_TOKEN || env.CLOUDFLARE_API_TOKEN;
  try {
    if (cf && env.CLOUDFLARE_ACCOUNT_ID) {
      const r = await fetchFn('https://api.cloudflare.com/client/v4/accounts/' + encodeURIComponent(env.CLOUDFLARE_ACCOUNT_ID) + '/ai/run/' + models('vision'), { method: 'POST', headers: { authorization: 'Bearer ' + cf, 'content-type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: 'data:' + mime + ';base64,' + b64 } }] }], max_tokens: 400, temperature: 0 }), signal: AbortSignal.timeout(40000) });
      const j = await r.json().catch(() => ({})), text = (j.result && (j.result.response || j.result)) || (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      const v = read(typeof text === 'string' ? text : JSON.stringify(text)); if (v) return { ...v, by: 'workers-ai' };
    }
    if (env.GEMINI_API_KEY) {
      const r = await fetchFn('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', { method: 'POST', headers: { 'x-goog-api-key': env.GEMINI_API_KEY, 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mime, data: b64 } }] }], generationConfig: { temperature: 0 } }), signal: AbortSignal.timeout(40000) });
      const j = await r.json().catch(() => ({})), v = read(j.candidates && j.candidates[0] && j.candidates[0].content && j.candidates[0].content.parts && j.candidates[0].content.parts[0].text);
      if (v) return { ...v, by: 'gemini' };
    }
  } catch (_) { /* an unjudged run is capped, never passed */ }
  return null;
}

/** measure one surface and score it. Known-input probes and the exam's own score feed the logic criterion. */
export async function look(browser, s, { vision = true, exam = null } = {}) {
  const r = await measure(browser, s, { shots: true });
  if (r.fail || !r.metrics) return { id: s.id, kind: s.kind, fail: r.fail || 'no measurement' };
  const m = r.metrics, card = CARDS.find((c) => 'ask:' + c.ask === s.id);
  if (card) {
    m.logic = { ...m.logic, probes: 1, probesPassed: card.expect.test(m.details.text) ? 1 : 0 };
    const d = exam && exam.domains && exam.domains[card.domain]; if (d && Number.isFinite(+d.score)) m.logic.exam = +d.score;
  }
  const v = vision && r.shots.phone ? await visionJudge(r.shots.phone, s.id) : null;
  if (v && v.nonsense && v.nonsense.length) m.details.nonsense = v.nonsense;
  const score = scoreSurface(m, v);
  if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); for (const [k, b] of Object.entries(r.shots)) fs.writeFileSync(path.join(SHOTS, slug(s.id) + '.' + k + '.png'), b); }
  return { id: s.id, kind: s.kind, path: s.path, score, details: m.details, gfx: m.gfx, at: new Date().toISOString() };
}

/** the home keeps its starfield (a live WebGL canvas) and its heart: an improvement elsewhere must never change that. */
export async function homeIntact(browser) {
  // the home's own HTML carries the heart and both starfield canvases: read that first (cheap, and no timeout under load), then look in a browser
  const html = await fetch(SITE + '/', { headers: { 'user-agent': 'VerseQuality/1.0' } }).then((r) => (r.ok ? r.text() : '')).catch(() => '');
  if (/id="void-anchor"/.test(html) && /id="void-stars"/.test(html) && /id="void-stars-far"/.test(html)) return { heart: true, canvas: true, via: 'html' };
  let last = { heart: false, canvas: false };
  for (let i = 0; i < 2; i++) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }), p = await ctx.newPage();
    try {
      await p.goto(SITE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 }); await p.waitForTimeout(2500);
      last = await p.evaluate(() => ({ heart: !!document.getElementById('void-anchor'), canvas: [...document.querySelectorAll('canvas')].some((c) => c.width > 100) }));
      if (last.heart && last.canvas) return { ...last, via: 'browser' };
    } catch (e) { last = { heart: false, canvas: false, err: String(e.message || e).slice(0, 80) }; } finally { await ctx.close(); }
  }
  return last;
}

function remember(rec, row) {
  if (!row || !row.score) return;
  rec.board = boardAdd(rec.board, row, row.at, 10);
  rec.crit[row.id] = { c: row.score.criteria, w: row.score.weakest.slice(0, 3).map((x) => x.id), at: row.at };
}
const rowsOf = (rec) => (rec.board.surfaces || []).filter((s) => rec.crit[s.id]).map((s) => {
  const h = s.history[s.history.length - 1], c = rec.crit[s.id];
  const weakest = CRITERIA.map((k) => ({ id: k.id, score: c.c[k.id], loss: (PINNACLE - c.c[k.id]) * k.weight })).filter((x) => x.loss > 0).sort((a, b) => b.loss - a.loss);
  return { id: s.id, kind: s.kind, path: s.id.startsWith('/') ? s.id : null, score: { total: h.total, visual: h.visual, correct: h.correct, criteria: c.c, weakest }, triedAt: (rec.tried || {})[s.id] || 0 };
});
const gapsNow = () => { const g = {}; for (const f of ['tower.frontier.json', 'tower.rank.json']) Object.assign(g, towerGaps(read(path.join(root, 'void-live-deploy', f), null))); return g; };

/** which pages to measure now: the least recently measured first, with the home first of all on a new board */
export function slice(list, rec, n) {
  const seen = (id) => { const s = rec.board.surfaces.find((x) => x.id === id); return s && s.history.length ? Date.parse(s.history[s.history.length - 1].at) : 0; };
  return [...list].filter((s) => s.kind !== 'game' || true).sort((a, b) => seen(a.id) - seen(b.id)).slice(0, n);
}

/** settle the open change: has it gone live, and did the score go up? Keeps or undoes it in the tree. */
export async function settle(browser, rec, { env = process.env, undo = true } = {}) {
  const pend = rec.pending; if (!pend) return null;
  const liveUrl = new URL(pend.targets[0].id, SITE + '/'); liveUrl.searchParams.set('q', String(Date.now()));
  const live = await fetch(liveUrl, { headers: { 'user-agent': 'VerseQuality/1.0' } }).then((r) => (r.ok ? r.text() : '')).catch(() => '');
  if (!live.includes(pend.signature)) {
    if (Date.now() - Date.parse(pend.at) > 8 * 3600e3) { rec.cycles.push({ at: new Date().toISOString(), id: pend.targets[0].id, improver: pend.improver, kept: false, gain: 0, cents: 0, why: 'the change never went live; dropped' }); rec.pending = null; return { state: 'dropped' }; }
    return { state: 'waiting' };
  }
  const exam = read(path.join(root, 'void-live-deploy/exam/latest.json'), null), done = [];
  const home = await homeIntact(browser);
  for (const t of pend.targets) {
    const after = await look(browser, { id: t.id, kind: 'page', path: t.id }, { exam, vision: !!(env.CLOUDFLARE_API_TOKEN || env.GEMINI_API_KEY) });
    if (after.fail) { done.push({ id: t.id, kept: false, why: 'could not measure after: ' + after.fail }); continue; }
    const d = decide(t.before, after.score);
    const keep = d.keep && home.heart && home.canvas;
    done.push({ id: t.id, kept: keep, before: t.before.total, after: after.score.total, bv: t.before.visual, av: after.score.visual, bc: t.before.correct, ac: after.score.correct, why: keep ? d.why : (d.keep ? 'the home lost its starfield or heart' : d.why) });
    remember(rec, after);
    if (!keep && undo) undoOn(root, t.id, pend.improver);
  }
  const gain = done.filter((x) => x.kept).reduce((n, x) => n + (x.after - x.before), 0);
  const cycle = { at: new Date().toISOString(), id: done[0].id, family: done.map((x) => x.id), improver: pend.improver, pr: pend.pr || null, kept: gain > 0, gain, results: done.map(({ id, kept, before, after, bv, av, bc, ac, why }) => ({ id, kept, before, after, bv, av, bc, ac, why })), cents: pend.cents || 0, minutes: pend.minutes || 0 };
  rec.cycles.push(cycle); rec.cycles = rec.cycles.slice(-120);
  const st = rec.improvers[pend.improver] || { n: 0, gain: 0 }; if (cycle.kept) { st.n++; st.gain += gain / Math.max(1, done.filter((x) => x.kept).length); } rec.improvers[pend.improver] = st;
  rec.tried = { ...(rec.tried || {}), ...Object.fromEntries(pend.targets.map((t) => [t.id, Date.now()])) };
  rec.pending = null;
  return { state: 'settled', cycle };
}

/** the next fix, applied in the tree: the weakest surface, the fixes that apply, the pages like it that take the same fix */
export function startNext(rec, details, { max = 3, tries = 8, dir = root } = {}) {
  const html = (r) => { const f = fileOf(dir, r.path); return f ? fs.readFileSync(f, 'utf8') : ''; };
  const rows = rowsOf(rec).filter((r) => r.path && !HANDS_OFF.test(r.id));
  const tried = rec.tried || {}, skipped = [];
  // a surface with no file in this tree (a dead route, or a page the server builds) cannot be fixed here: it is skipped, not stopped on
  let pool = rows.filter((r) => (!tried[r.id] || Date.now() - tried[r.id] > 6 * 3600e3) && fileOf(dir, r.path));
  for (let n = 0; n < tries; n++) {
    const weakest = pickWeakest(pool.map((r) => ({ ...r, triedAt: 0 })), { gaps: gapsNow() });
    if (!weakest) break;
    const cand = candidates(weakest, html(weakest), weakest.path, details[weakest.id], rec.improvers, rankImprovers);
    const pass = () => { rec.tried = { ...(rec.tried || {}), [weakest.id]: Date.now() }; pool = pool.filter((r) => r.id !== weakest.id); skipped.push(weakest.id); };
    if (!cand.length) { pass(); continue; }
    const id = cand[0], I = IMPROVERS[id], targets = [];
    const family = [weakest, ...pool.filter((r) => r.id !== weakest.id && r.score.criteria[I.criterion] < PINNACLE && I.applies(r, html(r), r.path, details[r.id])).sort((x, y) => x.score.total - y.score.total)];
    for (const r of family) {
      if (targets.length >= max) break;
      const d = details[r.id] || (r.id === weakest.id ? details[weakest.id] : null);
      if (I.criterion === 'layout' && r !== weakest) continue; // the design fix is measured per page
      const hit = applyTo(dir, r.path, id, d); if (hit) targets.push({ id: r.id, file: hit.file, before: r.score });
    }
    if (!targets.length) { pass(); continue; }
    return { id, what: I.what, signature: I.signature, targets };
  }
  return skipped.length ? { skipped: skipped[0], skippedAll: skipped } : null;
}

const tally = (rec) => Object.entries(rec.improvers).map(([improver, s]) => ({ improver: IMPROVERS[improver] ? IMPROVERS[improver].what.split(' (')[0] : improver, gain: s.n ? s.gain / s.n : 0, n: s.n }));
/** the engine improves itself: when the rate flattens it grows the charter from what scored well, re-ranks its fixes, and lists what no fix covers yet */
export function meta(rec) {
  const f = flattening(rec.cycles);
  rec.rate = rateOf(rec.cycles); rec.series = dailySeries(rec.cycles);
  rec.summary = boardSummary(rec.board);
  if (!f.flat) return null;
  const did = [];
  if (grow(tally(rec))) did.push('added a line to its own charter from what scored well');
  const uncovered = {}; for (const [id, c] of Object.entries(rec.crit)) for (const k of c.w) if (!Object.values(IMPROVERS).some((I) => I.criterion === k)) uncovered[k] = (uncovered[k] || 0) + 1;
  rec.todo = Object.entries(uncovered).sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ criterion: k, surfaces: n, task: charterPrompt() + 'Write a shared fix that lifts "' + k + '" on every page that loses on it; the quality engine will keep it only if the measured score rises.' })).slice(0, 4);
  did.push('re-ranked its fixes by average gain and listed ' + rec.todo.length + ' criteria no fix covers yet');
  rec.meta = [...rec.meta, { at: new Date().toISOString(), why: f.why, did }].slice(-20);
  return { why: f.why, did };
}

/** one run of the lane: what the house loops call. Settles the open change, surveys a slice, starts the next fix in the tree. */
export async function lane({ limit = 5, dry = false, env = process.env } = {}) {
  const t0 = Date.now(), rec = load(), browser = await launch();
  try {
    const out = { settled: null, surveyed: 0, started: null };
    out.settled = await settle(browser, rec, { env });
    const exam = read(path.join(root, 'void-live-deploy/exam/latest.json'), null), details = {}, list = slice(surfaceList(), rec, limit);
    for (const s of list) { const row = await look(browser, s, { exam, vision: !!(env.CLOUDFLARE_API_TOKEN || env.GEMINI_API_KEY) }); if (row.fail) continue; remember(rec, row); details[row.id] = row.details; out.surveyed++; }
    if (!rec.pending && (!out.settled || out.settled.state !== 'waiting')) {
      const next = startNext(rec, details);
      if (next && next.targets) { rec.pending = { improver: next.id, signature: next.signature, targets: next.targets, at: new Date().toISOString(), minutes: 0, cents: 0 }; out.started = next; }
    }
    const m = meta(rec);
    const minutes = Math.max(1, Math.round((Date.now() - t0) / 60000));
    const s = rec.summary;
    rec.last = (out.settled && out.settled.cycle ? 'Settled ' + out.settled.cycle.id + ': ' + (out.settled.cycle.kept ? 'kept, +' + out.settled.cycle.gain : 'undone') + '. ' : '') + 'Measured ' + out.surveyed + ' surfaces; the board holds ' + s.surfaces + ' with an average of ' + s.average + ' of 100 and ' + s.passing + ' at the pinnacle.' + (out.started ? ' Started ' + out.started.what + ' on ' + out.started.targets.map((t) => t.id).join(', ') + '.' : '') + (m ? ' Upgraded itself: ' + m.did.join('; ') + '.' : '');
    if (!dry) save(rec);
    return { ...out, last: rec.last, ok: true, minutes, note: 'GitHub Actions on a public repo, so standard runner minutes are not billed. The free models come first; nothing was paid from the treasury.' };
  } finally { await browser.close(); }
}

// ---- the box cycle: the same steps with real pull requests, waiting for the merge and the deploy ----
const sh = (cmd, args, opts = {}) => { const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 64 << 20, ...opts }); return { ok: r.status === 0, out: (r.stdout || '') + (r.stderr || '') }; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function pr(rec, branch, title, body, files) {
  sh('git', ['add', ...files], { cwd: root });
  if (!sh('git', ['commit', '-q', '-m', title], { cwd: root }).ok) return null;
  if (!sh('git', ['push', '-q', '-u', 'origin', branch], { cwd: root }).ok) return null;
  const r = sh('gh', ['pr', 'create', '--repo', 'atomeam/void-loop', '--base', 'main', '--head', branch, '--label', 'automerge', '--title', title, '--body', body], { cwd: root });
  const m = /pull\/(\d+)/.exec(r.out); return m ? { n: +m[1], url: m[0] } : null;
}
async function merged(n, maxMs = 40 * 60e3) {
  const end = Date.now() + maxMs;
  while (Date.now() < end) { const r = sh('gh', ['pr', 'view', String(n), '--repo', 'atomeam/void-loop', '--json', 'state']); if (/"MERGED"/.test(r.out)) return true; if (/"CLOSED"/.test(r.out)) return false; await sleep(30000); }
  return false;
}
export async function cycle({ paths = [] } = {}) {
  const t0 = Date.now(), browser = await launch(), rec = load();
  try {
    const exam = read(path.join(root, 'void-live-deploy/exam/latest.json'), null), details = {}, list = paths.length ? paths.map((p) => ({ id: p, kind: 'page', path: p })) : slice(surfaceList(), rec, 4);
    for (const s of list) { const row = await look(browser, s, { exam, vision: false }); if (row.fail) continue; remember(rec, row); details[row.id] = row.details; console.log('measured', s.id, JSON.stringify(row.score.criteria), 'visual', row.score.visual, 'correct', row.score.correct, 'total', row.score.total); }
    const next = startNext(rec, details);
    if (!next || !next.targets) { console.log('nothing to fix', JSON.stringify(next)); return null; }
    const branch = 'helper/quality-' + slug(next.targets[0].id) + '-' + next.id + '-' + Date.now().toString(36);
    sh('git', ['checkout', '-q', '-b', branch], { cwd: root });
    const files = next.targets.map((t) => t.file);
    const body = ['For people using the site: the quality engine measured these pages, found the weakest thing on them (' + CRITERIA.find((c) => c.id === IMPROVERS[next.id].criterion).id + ') and ships ' + next.what + '.', '', 'Pages: ' + next.targets.map((t) => t.id + ' (score ' + t.before.total + ')').join(', ') + '.', '', 'It re-scores the live pages after the deploy and undoes this change if the score did not go up or anything else got worse.'].join('\n');
    const p = await pr(rec, branch, 'Quality engine: ' + next.what.split(' (')[0] + ' on ' + next.targets.map((t) => t.id).join(' '), body, files);
    if (!p) { console.log('could not open the pull request'); return null; }
    console.log('PR', p.url);
    rec.pending = { improver: next.id, signature: next.signature, targets: next.targets, at: new Date().toISOString(), pr: p.n, minutes: 0, cents: 0 };
    if (!(await merged(p.n))) { console.log('the pull request did not merge'); rec.pending = null; return { pr: p }; }
    let res = null; for (let i = 0; i < 40 && (!res || res.state === 'waiting'); i++) { res = await settle(browser, rec, { undo: false }); if (res.state === 'waiting') await sleep(30000); }
    console.log('settled', JSON.stringify(res && res.cycle));
    const bad = res && res.cycle ? res.cycle.results.filter((x) => !x.kept && !/could not measure|never went live/.test(x.why || '')) : [];
    if (bad.length && flag('--ship')) {   // a change that did not hold is undone in the same run, as its own pull request
      const ub = 'helper/quality-undo-' + Date.now().toString(36); sh('git', ['checkout', '-q', '-B', ub, 'origin/main'], { cwd: root });
      const files = bad.map((x) => undoOn(root, x.id, res.cycle.improver)).filter(Boolean).map((x) => x.file);
      if (files.length) { const up = await pr(rec, ub, 'Quality engine: undo ' + res.cycle.improver + ' on ' + bad.map((x) => x.id).join(' '), 'For people using the site: the quality engine undoes the change it shipped on ' + bad.map((x) => x.id + ' (' + x.why + ')').join(', ') + ', because it did not hold up when re-scored live.', files); console.log('undo PR', up && up.url); res.cycle.undoPr = up ? up.n : null; }
    }
    if (res && res.cycle) { res.cycle.minutes = Math.round((Date.now() - t0) / 60000); }
    meta(rec);
    return { pr: p, res, rec };
  } finally { await browser.close(); }
}

// ---- calibration: the judge must keep reference fails and fixes apart, and nothing here reaches the pinnacle ----
export const FIXTURES = [
  { id: 'paris-before', kind: 'fail', why: 'a weather card whose picture is a generic glowing cube' },
  { id: 'paris-after', kind: 'fix', pair: 'paris-before', why: 'the same card with an overcast Eiffel Tower street' },
  { id: 'versus-before', kind: 'fail', why: 'a wall of stat tiles and jargon' },
  { id: 'versus-after', kind: 'fix', pair: 'versus-before', why: 'a plain heading, one sentence, a progress bar and short lists' },
];

/** score the reference fails and fixes with the vision judge. `judge` is injectable for tests. */
export async function calibrate({ judge = visionJudge, dir = path.join(root, 'tools/fixtures/quality') } = {}) {
  const results = {};
  for (const f of FIXTURES) results[f.id] = { kind: f.kind, pair: f.pair, vision: await judge(fs.readFileSync(path.join(dir, f.id + '.jpg')), 'reference ' + f.kind + ': ' + f.why, process.env, fetch, 'image/jpeg') };
  return calibration(results);
}

async function main() {
  const cmd = process.argv[2];
  if (cmd === 'lane') { const r = await lane({ limit: +arg('--limit', 5), dry: flag('--dry') }); console.log(r.last); return; }
  if (cmd === 'seed') {
    const browser = await launch(), rec = load(), exam = read(path.join(root, 'void-live-deploy/exam/latest.json'), null), only = arg('--paths') ? arg('--paths').split(',') : null;
    for (const s of surfaceList().filter((x) => !only || only.includes(x.id))) { const r = await look(browser, s, { exam }); if (r.fail) { console.log(s.id, 'FAIL', r.fail); continue; } remember(rec, r); console.log(s.id, r.score.visual, r.score.correct, r.score.total); }
    meta(rec); save(rec); await browser.close(); return;
  }
  if (cmd === 'calibrate') { const c = await calibrate(); console.log(JSON.stringify(c)); process.exit(c.ok ? 0 : 1); }
  if (cmd === 'survey') {
    const browser = await launch(), paths = arg('--paths') ? arg('--paths').split(',') : [];
    const list = paths.length ? surfaceList().filter((s) => paths.includes(s.id)) : slice(surfaceList(), load(), 5);
    for (const s of list) { const r = await look(browser, s, { exam: read(path.join(root, 'void-live-deploy/exam/latest.json'), null) }); console.log(s.id, r.fail ? 'FAIL ' + r.fail : JSON.stringify(r.score.criteria) + ' visual ' + r.score.visual + ' correct ' + r.score.correct + ' total ' + r.score.total + (r.score.pass ? ' PASS' : '')); }
    await browser.close(); return;
  }
  if (cmd === 'cycle') {
    const r = await cycle({ paths: arg('--paths') ? arg('--paths').split(',') : [] });
    if (r && r.rec && flag('--ship')) {
      fs.writeFileSync(REC, JSON.stringify(r.rec) + '\n');
      const slugn = 'helper/quality-log-' + Date.now().toString(36);
      sh('git', ['checkout', '-q', '-B', slugn, 'origin/main'], { cwd: root });
      fs.writeFileSync(REC, JSON.stringify(r.rec) + '\n');
      const p = await pr(r.rec, slugn, 'Quality board: one improve-and-verify cycle, ' + (r.res && r.res.cycle ? (r.res.cycle.kept ? 'kept' : 'undone') : 'recorded'), 'For people using the site: records the measured scores before and after the change, what the change cost, and the improvement rate on the quality board (/scoreboard/).', [path.relative(root, REC)]);
      console.log('board PR', p && p.url);
    }
    return;
  }
  console.error('usage: node tools/quality-engine.mjs lane | cycle | survey | calibrate');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then(() => process.exit(0)).catch((e) => { console.error(String(e && e.stack || e)); process.exit(1); });
