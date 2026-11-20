// The quality engine's pure part (owner, 2026-11-19: "verse has nothing better to do than make itself the best ... the pinnacle of quality";
// then: outdo GTA 6, not match it; full 3D; logic matters as much as visuals). The browser run lives in tools/quality-measure.mjs, the loop
// in tools/quality-engine.mjs. A surface's score is MEASURED: pixels, the DOM, real clicks, real requests, known-input probes, the outcome
// exam's own answers. Nothing here counts pull requests or skills. A surface passes only when BOTH halves reach the pinnacle: it is
// beautiful and it is correct. The numbers below are the reference bars: a criterion at 90 or more beats the reference for its kind.
import { charterBlock } from './charter.js';
export const SCALE = 1;
export const PINNACLE = 90;
/** a keep needs the score up by at least this many points, and no criterion down by more than DROP_OK */
export const MIN_GAIN = 1;
export const DROP_OK = 3;

/** the visual half and the correctness half each weigh 50. Correctness (errors + flows + logic = 50) outweighs graphics (20). */
export const CRITERIA = Object.freeze([
  { id: 'graphics', half: 'visual', weight: 20, ref: 'GTA 6-class real-time: a lit 3D scene that draws every frame (WebGPU with a WebGL2 fallback), rich in colour and depth, a light first load on a phone, 60 fps' },
  { id: 'layout', half: 'visual', weight: 8, ref: 'zero contrast failures, zero small tap targets, no sideways scroll, nothing clipped, nothing unstyled' },
  { id: 'typography', half: 'visual', weight: 5, ref: 'body text 16 px or more on a phone, at most 6 sizes, plain words an eighth grader reads easily' },
  { id: 'motion', half: 'visual', weight: 5, ref: 'responsive hover and press feedback, eased transitions, something alive on screen, reduced-motion respected' },
  { id: 'art', half: 'visual', weight: 7, ref: 'every picture loads sharp, fits the subject, is never a placeholder and is rich in detail' },
  { id: 'speed', half: 'visual', weight: 5, ref: 'phone first paint under 0.8 s, under 300 KB to start, no layout shift' },
  { id: 'errors', half: 'correct', weight: 14, ref: 'no console or page error, no failed request, no broken picture, no placeholder or error text, never a dead end' },
  { id: 'flows', half: 'correct', weight: 12, ref: 'every link opens a real page, every button visibly does what it says, data handed to the next page arrives whole' },
  { id: 'logic', half: 'correct', weight: 24, ref: 'known inputs give the known right output; answers are right and on topic; a game has working rules, no softlock and fair difficulty' },
]);
export const WEIGHTS = Object.freeze(Object.fromEntries(CRITERIA.map((c) => [c.id, c.weight])));
export const HALF_OF = Object.freeze(Object.fromEntries(CRITERIA.map((c) => [c.id, c.half])));
/** a criterion the vision judge also marks (0 to 10); the lower of the measured and the judged number counts */
export const VISION_OF = Object.freeze(['graphics', 'layout', 'typography', 'motion', 'art']);
/** with no vision judge on the run, a visual criterion that needs eyes is capped here, so nothing reaches the pinnacle unjudged */
export const UNJUDGED_CAP = 85;
/** with no known-input probes for a surface, the generic smoke pass is all that is measured, and it is capped here */
export const GENERIC_LOGIC_CAP = 60;

const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const ramp = (v, best, worst) => clamp((1 - (v - best) / (worst - best)) * 100);

/** Flesch-Kincaid grade of plain text; 0 when there is too little to read. Pure. */
export function readability(text) {
  const t = String(text || '').replace(/\s+/g, ' ').trim();
  const words = t.match(/[A-Za-z][A-Za-z'-]*/g) || [];
  if (words.length < 25) return { grade: 0, words: words.length, sentenceWords: 0, acronyms: 0 };
  const sentences = Math.max(1, (t.match(/[.!?](\s|$)/g) || []).length);
  const syl = (w) => Math.max(1, (w.toLowerCase().replace(/e$/, '').match(/[aeiouy]+/g) || []).length);
  const syllables = words.reduce((n, w) => n + syl(w), 0);
  const grade = 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
  const acronyms = words.filter((w) => w.length >= 3 && w === w.toUpperCase()).length / words.length;
  return { grade: +grade.toFixed(1), words: words.length, sentenceWords: +(words.length / sentences).toFixed(1), acronyms: +acronyms.toFixed(3) };
}

/** Shannon entropy in bits of a screenshot's colour (5 bits a channel), the measure of how much a picture holds. Pure; data is RGBA. */
export function colourEntropy(data, w, h, step = 2) {
  const counts = new Map(); let n = 0;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const i = (y * w + x) * 4, k = (data[i] >> 3) << 10 | (data[i + 1] >> 3) << 5 | (data[i + 2] >> 3);
    counts.set(k, (counts.get(k) || 0) + 1); n++;
  }
  let H = 0; for (const c of counts.values()) { const p = c / n; H -= p * Math.log2(p); }
  return +H.toFixed(2);
}

// ---- the nine criteria, each 0..100, from one surface's measured numbers ----
export function scoreGraphics(m) {
  const g = m.gfx || {}, richness = clamp(((num(g.entropy) - 4) / 4), 0, 1);
  const live = (g.webgl || g.webgpu) && g.animated ? 1 : 0;
  const tier = num(m.speedPhone && m.speedPhone.bytes, 1e9) <= 600e3 && num(m.speedPhone && m.speedPhone.dcl, 1e9) <= 1500 ? 1 : 0;
  return Math.round(55 * live + 30 * richness + 7 * tier + 8 * (g.gpuPath ? 1 : 0));
}
export function scoreLayout(m) {
  const l = m.layout || {};
  return Math.round(clamp(100 - Math.min(40, 6 * num(l.contrast)) - Math.min(30, 5 * num(l.targets)) - (num(l.scrollX) > 4 ? 35 : 0) - Math.min(24, 8 * num(l.clipped)) - Math.min(12, 4 * num(l.bare))));
}
export function scoreTypography(m) {
  const t = m.type || {}, r = t.read || {};
  let s = 100;
  if (num(t.bodyMin, 16) < 16) s -= 20;
  s -= Math.max(0, num(t.sizes) - 6) * 5;
  if (r.grade) s -= Math.min(50, Math.max(0, r.grade - 8) * 6);
  if (num(r.sentenceWords) > 22) s -= 10;
  if (num(r.acronyms) > 0.08) s -= 15;
  if (!r.grade && num(r.words) < 25) s = Math.min(s, 80);
  return Math.round(clamp(s));
}
export function scoreMotion(m) {
  const a = m.motion || {};
  return Math.round(clamp((num(a.transitions) >= 3 ? 40 : num(a.transitions) * 13) + (a.feedback ? 20 : 0) + (a.reduced ? 20 : 0) + (a.alive ? 20 : 0)));
}
export function scoreArt(m) {
  const a = m.art || {};
  if (!num(a.images)) return Math.min(40, Math.round(num(m.gfx && m.gfx.entropy) * 5));
  const richness = clamp((num(a.entropy) - 4) / 4, 0, 1);
  return Math.round(clamp(60 + 40 * richness - 40 * num(a.broken) - 40 * num(a.placeholders) - 10 * num(a.soft)));
}
export function scoreSpeed(m) {
  const s = m.speedPhone || {};
  return Math.round(0.5 * ramp(num(s.dcl, 9e9), 800, 4000) + 0.3 * ramp(num(s.bytes, 9e9), 300e3, 3e6) + 0.2 * ramp(num(s.cls), 0.02, 0.25));
}
export function scoreErrors(m) {
  const e = m.errs || {};
  return Math.round(clamp(100 - Math.min(75, 25 * num(e.errors)) - Math.min(45, 15 * num(e.failedRequests)) - 25 * num(e.brokenImages) - (e.deadEnd ? 40 : 0) - Math.min(60, 30 * num(e.placeholderText))));
}
export function scoreFlows(m) {
  const f = m.flows || {};
  const linkPart = num(f.links) ? (num(f.links) - num(f.brokenLinks)) / num(f.links) : 1;
  const ctlPart = num(f.controls) ? num(f.controlsWithEffect) / num(f.controls) : 1;
  return Math.round(clamp(60 * linkPart + 40 * ctlPart - 15 * num(f.handoffBroken)));
}
/** logic: known-input probes first (a share of passes), then the exam's own score for the domain, then a game's rules, then only the generic smoke pass, capped */
export function scoreLogic(m) {
  const l = m.logic || {};
  if (l.game) {
    const g = l.game, ok = [g.starts, g.reactsToInput, !g.softlock, g.restarts, g.collisions, g.fair].filter((v) => v === true).length;
    return Math.round(clamp((ok / 6) * 100 - 10 * num(g.errors)));
  }
  const parts = [];
  if (num(l.probes) > 0) parts.push(100 * num(l.probesPassed) / num(l.probes));
  if (l.exam != null) parts.push(clamp(num(l.exam)));
  if (parts.length) return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
  return Math.round(GENERIC_LOGIC_CAP * (l.smokeOk === false ? 0 : 1));
}
const SCORERS = { graphics: scoreGraphics, layout: scoreLayout, typography: scoreTypography, motion: scoreMotion, art: scoreArt, speed: scoreSpeed, errors: scoreErrors, flows: scoreFlows, logic: scoreLogic };

/** one surface: criteria, the two halves, the total, and whether it passes. `vision` is { graphics, layout, ... } out of 10, or null when no judge answered. Pure. */
export function scoreSurface(m, vision = null) {
  const crit = {};
  for (const c of CRITERIA) crit[c.id] = SCORERS[c.id](m);
  for (const id of VISION_OF) {
    if (vision && Number.isFinite(+vision[id])) crit[id] = Math.min(crit[id], Math.round(clamp(+vision[id] * 10)));
    else crit[id] = Math.min(crit[id], UNJUDGED_CAP);
  }
  const half = (h) => { const cs = CRITERIA.filter((c) => c.half === h), w = cs.reduce((n, c) => n + c.weight, 0); return Math.round(cs.reduce((n, c) => n + crit[c.id] * c.weight, 0) / w); };
  const visual = half('visual'), correct = half('correct');
  const total = Math.round(CRITERIA.reduce((n, c) => n + crit[c.id] * c.weight, 0) / 100);
  const weakest = CRITERIA.map((c) => ({ id: c.id, score: crit[c.id], loss: (PINNACLE - crit[c.id]) * c.weight })).filter((x) => x.loss > 0).sort((a, b) => b.loss - a.loss);
  return { scale: SCALE, criteria: crit, visual, correct, total, judged: !!vision, pass: visual >= PINNACLE && correct >= PINNACLE && Object.values(crit).every((v) => v >= PINNACLE - 10), weakest };
}

/** keep an improvement only when the score went up and nothing else broke. Pure. before and after are scoreSurface results. */
export function decide(before, after, { neighbours = [] } = {}) {
  if (!before || !after) return { keep: false, why: 'no score to compare' };
  if (after.total < before.total + MIN_GAIN) return { keep: false, why: 'the score did not go up (' + before.total + ' to ' + after.total + ')' };
  if (after.correct < before.correct) return { keep: false, why: 'correctness went down (' + before.correct + ' to ' + after.correct + ')' };
  for (const id of Object.keys(before.criteria)) {
    if (num(after.criteria[id]) < num(before.criteria[id]) - DROP_OK) return { keep: false, why: id + ' went down (' + before.criteria[id] + ' to ' + after.criteria[id] + ')' };
  }
  for (const n of neighbours) if (n && n.before && n.after && n.after.total < n.before.total - DROP_OK) return { keep: false, why: 'a neighbour fell (' + n.id + ': ' + n.before.total + ' to ' + n.after.total + ')' };
  return { keep: true, why: 'the score went up (' + before.total + ' to ' + after.total + ') and nothing else got worse' };
}

/** the Tower's gaps, read tolerantly: { gaps|targets|rows: [{ surface|path|id, score|progress|gap }] }. A surface the Tower is furthest behind on weighs more. Public-safe: only ids and numbers come out. Pure. */
export function towerGaps(raw) {
  const list = Array.isArray(raw) ? raw : (raw && (raw.gaps || raw.targets || raw.rows || raw.floors)) || [];
  const out = {};
  for (const r of Array.isArray(list) ? list : []) {
    const id = String(r && (r.surface || r.path || r.verse || r.id) || '');
    if (!/^\/[\w\-./]*$/.test(id)) continue;
    const gap = r.gap != null ? num(r.gap) : r.progress != null ? 100 - num(r.progress) : r.score != null ? 100 - num(r.score) : 0;
    out[id] = Math.max(out[id] || 0, clamp(gap));
  }
  return out;
}

/** the next surface to work on: the biggest weighted loss to the pinnacle, plus the Tower's gap, skipping what was tried lately without a gain. Pure. */
export function pickWeakest(rows, { gaps = {}, now = Date.now(), cooldownMs = 6 * 3600e3 } = {}) {
  const live = (rows || []).filter((r) => r && r.score && !(r.triedAt && now - r.triedAt < cooldownMs && !r.lastKept));
  live.sort((a, b) => priority(b, gaps) - priority(a, gaps));
  return live[0] || null;
}
export function priority(r, gaps = {}) {
  const loss = r.score.weakest.reduce((n, w) => n + w.loss, 0) / 100;
  return loss + 0.15 * num(gaps[r.path || r.id]);
}

/** the public quality board: per surface the score over time. Only ids, kinds and numbers, so nothing can name a rival. Pure. */
export function boardAdd(board, row, at = new Date().toISOString(), keep = 40) {
  const b = board && Array.isArray(board.surfaces) ? board : { surfaces: [] };
  let s = b.surfaces.find((x) => x.id === row.id);
  if (!s) { s = { id: row.id, kind: row.kind, history: [] }; b.surfaces.push(s); }
  const last = s.history[s.history.length - 1];
  if (!last || last.total !== row.score.total || last.visual !== row.score.visual || last.correct !== row.score.correct) s.history.push({ at, total: row.score.total, visual: row.score.visual, correct: row.score.correct, judged: row.score.judged });
  if (s.history.length > keep) s.history = s.history.slice(-keep);
  return b;
}
export function boardSummary(board) {
  const rows = (board && board.surfaces || []).map((s) => ({ id: s.id, kind: s.kind, now: (s.history[s.history.length - 1] || {}).total, first: (s.history[0] || {}).total })).filter((r) => r.now != null);
  const avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.now, 0) / rows.length) : null;
  return { surfaces: rows.length, average: avg, passing: rows.filter((r) => r.now >= PINNACLE).length };
}

// blub, the blobfish mascot, is a first-class surface: judged against the best real-time characters and mascots, and against a real blobfish
export const MASCOT_BAR = 'This is blub, the blobfish mascot. Judge it against the best real-time characters and mascots made, and against a real blobfish: a huge soft nose sagging over a downturned mouth, small sunken eyes, pale pink gelatinous skin. It must be lovably ugly and accurate, with wet translucent skin, light glowing through it, caustics and expressive animation. A cute generic fish, a cartoon dolphin or flat shading is 4 at most.';

/** the prompt a vision judge gets. The anchors are the reference fails and fixes: they are what keeps the bar strict. */
export function visionPrompt(surface) {
  return [
    charterBlock(),
    'You are the strictest design and engineering judge alive. Mark one screenshot of "' + String(surface).slice(0, 80) + '" out of 10 on each line. 10 means it beats the best real-time 3D game graphics and the best product design in the world (GTA 6-class). 7 is a good, polished commercial product. 5 is competent but generic. 3 is generic, flat, placeholder or confusing. Good is not enough: only mark 9 or 10 when it would stand beside the best in its category and win.',
    'Calibration. A weather card for Paris whose picture is a generic glowing sci-fi cube unrelated to Paris: art 2. The same card with a real overcast Eiffel Tower street: art 6, graphics 4. A card that is a wall of stat tiles and jargon with a broken-looking layout: typography 3, layout 3. The same card rebuilt as a plain heading, one sentence, a progress bar and short lists, with a fitting picture: typography 7, layout 7, graphics 4. A flat page with no 3D: graphics 3 at most.',
    ...(/blub|mascot/i.test(String(surface)) ? [MASCOT_BAR] : []),
    'Care counts: anything unkind, disrespectful or careless toward people, animals or plants, and any page that looks made without love or attention to detail, goes into "nonsense" and lowers the marks.',
    'Reply with only JSON: {"graphics":n,"layout":n,"typography":n,"motion":n,"art":n,"fits":n,"nonsense":["anything that does not make sense, is wrong, is placeholder or looks broken"]}. "fits" is how well the picture and the words match the subject.',
  ].join('\n');
}
export function readVision(text) {
  const m = /\{[\s\S]*\}/.exec(String(text || ''));
  if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch { return null; }
  const out = {};
  for (const id of [...VISION_OF, 'fits']) { const v = +j[id]; if (!Number.isFinite(v) || v < 0 || v > 10) return null; out[id] = v; }
  out.nonsense = Array.isArray(j.nonsense) ? j.nonsense.map((s) => String(s).slice(0, 160)).slice(0, 6) : [];
  return out;
}

// ---- compounding: the engine measures its own rate of improvement, and upgrades itself when the rate flattens ----
/** the improvement rate from the kept cycles: score points gained per day, per dollar and cycles a day. cycles: [{ at, kept, gain, cents }]. Pure. */
export function rateOf(cycles, now = Date.now(), days = 7) {
  const from = now - days * 864e5, inWin = (cycles || []).filter((c) => c && Date.parse(c.at) >= from);
  const kept = inWin.filter((c) => c.kept), gained = kept.reduce((n, c) => n + num(c.gain), 0), cents = inWin.reduce((n, c) => n + num(c.cents), 0);
  const span = Math.max(1, Math.min(days, inWin.length ? (now - Math.min(...inWin.map((c) => Date.parse(c.at)))) / 864e5 : 1));
  return { cycles: inWin.length, kept: kept.length, gained: +gained.toFixed(1), perDay: +(gained / span).toFixed(2), cyclesPerDay: +(inWin.length / span).toFixed(2), perDollar: cents > 0 ? +(gained / (cents / 100)).toFixed(1) : null, cents };
}
/** a day-by-day series of the points gained, for the chart. Pure. */
export function dailySeries(cycles, days = 14, now = Date.now()) {
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 864e5).toISOString().slice(0, 10), day = (cycles || []).filter((c) => c && c.at && c.at.slice(0, 10) === d);
    out.push({ day: d, gained: +day.filter((c) => c.kept).reduce((n, c) => n + num(c.gain), 0).toFixed(1), cycles: day.length, cents: day.reduce((n, c) => n + num(c.cents), 0) });
  }
  return out;
}
/** the rate has flattened when the last `n` cycles gained less than `floor` points each on average, or none was kept. Pure. */
export function flattening(cycles, n = 6, floor = 1) {
  const last = (cycles || []).filter(Boolean).slice(-n);
  if (last.length < n) return { flat: false, why: 'fewer than ' + n + ' cycles so far' };
  const kept = last.filter((c) => c.kept), avg = kept.reduce((s, c) => s + num(c.gain), 0) / n;
  if (!kept.length) return { flat: true, why: 'none of the last ' + n + ' cycles was kept' };
  return avg < floor ? { flat: true, why: 'the last ' + n + ' cycles gained ' + avg.toFixed(2) + ' points each' } : { flat: false, why: 'still gaining ' + avg.toFixed(2) + ' points a cycle' };
}
/** which fix to reach for: the one with the best average gain so far, an untried one first. stats: { improver: { n, gain } }. Pure. */
export function rankImprovers(ids, stats = {}) {
  return [...ids].sort((a, b) => { const A = stats[a] || { n: 0, gain: 0 }, B = stats[b] || { n: 0, gain: 0 }; if (!A.n !== !B.n) return A.n ? 1 : -1; return (B.gain / Math.max(1, B.n)) - (A.gain / Math.max(1, A.n)); });
}

// ---- creating: new things go through the same bar, and a page that already does the job gets the work instead ----
const STOP = new Set('the a an of and for to in on with is it my me what how verse page world game tool'.split(' '));
const words = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
/** the existing page that already does an idea's job (the super-page rule), by shared words in its address, title and description. pages: [{ path, title, about }]. Pure. */
export function dupeOf(idea, pages) {
  const want = new Set(words(idea));
  if (!want.size) return null;
  let best = null;
  for (const p of pages || []) {
    const have = new Set(words((p.path || '').replace(/[/-]+/g, ' ') + ' ' + (p.title || '') + ' ' + (p.about || '')));
    let hit = 0; for (const w of want) if (have.has(w)) hit++;
    const score = hit / want.size;
    if (score >= 0.6 && (!best || score > best.score)) best = { path: p.path, score: +score.toFixed(2) };
  }
  return best;
}
/** a new thing joins the site when both halves clear the median of what is already scored (it must not pull the board down); it then climbs to the pinnacle in the rotation. Pure. */
export function createGate(score, board) {
  const now = (board && board.surfaces || []).map((s) => (s.history[s.history.length - 1] || {})).filter((h) => h.total != null);
  const med = now.length ? now.map((h) => h.total).sort((a, b) => a - b)[Math.floor(now.length / 2)] : 0;
  const bar = Math.max(50, med);
  return { ship: !!score && score.visual >= bar && score.correct >= bar && score.criteria.errors >= 90, bar, why: score ? 'visual ' + score.visual + ' and correct ' + score.correct + ' against the board median ' + med : 'no score' };
}
/** how many of the next turns go to creating, from evidence: creating gets more when improving has flattened, and improving more when creations keep scoring high. No cap. Pure. */
export function splitTurns(cycles, creations, turns = 10) {
  const flat = flattening(cycles).flat, made = (creations || []).slice(-5), good = made.filter((c) => c.shipped).length;
  let create = 2 + (flat ? 3 : 0) + (made.length >= 3 && good / made.length >= 0.6 ? 2 : 0) - (made.length >= 3 && good === 0 ? 1 : 0);
  create = Math.max(1, Math.min(turns - 1, create));
  return { create, improve: turns - create, why: (flat ? 'improving flattened; ' : 'improving still gains; ') + (made.length ? good + ' of the last ' + made.length + ' creations shipped' : 'nothing created yet') };
}

/** the judge is calibrated when every reference fix beats its fail, the fails mark low, and no fix reaches the pinnacle (good is not enough). results: { id: { kind, pair, vision } }. Pure. */
export function calibration(results) {
  const mean = (v) => (v ? VISION_OF.reduce((n, k) => n + num(v[k]), 0) / VISION_OF.length : null);
  const problems = [], marks = {};
  for (const [id, r] of Object.entries(results || {})) marks[id] = mean(r.vision);
  for (const [id, r] of Object.entries(results || {})) {
    const m = marks[id];
    if (m == null) { problems.push(id + ': the judge did not answer'); continue; }
    if (r.kind === 'fail' && m > 4.5) problems.push(id + ': a reference fail marked ' + m.toFixed(1) + ', it should be 4.5 or less');
    if (r.kind === 'fix' && m >= 9) problems.push(id + ': a reference fix marked ' + m.toFixed(1) + ', nothing here beats the best yet');
    if (r.kind === 'fix' && r.pair && marks[r.pair] != null && m <= marks[r.pair]) problems.push(id + ': does not beat the fail it fixes (' + m.toFixed(1) + ' against ' + marks[r.pair].toFixed(1) + ')');
  }
  return { ok: problems.length === 0 && Object.keys(marks).length > 0, problems, marks };
}

// ---- clips and post pictures: graphics, animation, writing and humor, one number each out of 10 ----
export const CLIP_LINES = Object.freeze(['graphics', 'animation', 'writing', 'humor']);
export const CLIP_MIN = 70;
export function clipPrompt(caption) {
  return [charterBlock(), 'You are the strictest judge of short social clips and post pictures alive. Mark this picture and its words out of 10 on graphics, animation (does the pose or frame suggest lively, expressive motion), writing (plain, clear, specific, no jargon) and humor (a real smile, never forced). 10 beats the best studio mascots and posts anywhere; 7 is good; 5 is generic; a stock look or a template is 4 at most.', 'The words: "' + String(caption).slice(0, 300) + '"', 'Reply with only JSON: {"graphics":n,"animation":n,"writing":n,"humor":n}'].join('\n');
}
export function readClip(text) {
  const m = /\{[\s\S]*\}/.exec(String(text || '')); if (!m) return null;
  let j; try { j = JSON.parse(m[0]); } catch { return null; }
  const out = {}; for (const id of CLIP_LINES) { const v = +j[id]; if (!Number.isFinite(v) || v < 0 || v > 10) return null; out[id] = v; }
  return out;
}
/** out of 100: the average of the four lines. A clip nobody judged scores null and does not post. Pure. */
export const scoreClip = (v) => (v ? Math.round(CLIP_LINES.reduce((n, id) => n + v[id], 0) / CLIP_LINES.length * 10) : null);
