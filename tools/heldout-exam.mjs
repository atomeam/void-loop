// The held-out set behind the Tower target "a top AI assistant" (owner, 2026-11-20: "20 fixed questions with pattern checks can be overfit").
// void-live-deploy/tower.heldout.json (owner-only) is a pool of 100+ real questions across health, money, writing, coding, how-to, local and
// current events, each with a reference answer and the same pattern checks as tools/assistant-exam.mjs. Every run samples 20 the agent has been
// asked least, spread over all seven areas, so the questions change from run to run. A question that has a gap is never queued by its words: the
// build list gets the area and what the answers lacked, so Verse is improved in general and not for one question (nothing to tune to).
//   node tools/heldout-exam.mjs --check                    the pool is well formed, big enough, spread over the areas; each reference scores 100
//   node tools/heldout-exam.mjs --sample [n]               print the sample a run would take
//   node tools/heldout-exam.mjs --live [base] [--write]    ask the live agent a sample and score it by the pattern checks
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { scoreOne, summarize, GAP_BELOW, examine, askLive } from './assistant-exam.mjs';
import { judge, compare } from './answer-judge.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FILE = path.join(ROOT, 'void-live-deploy/tower.heldout.json');
export const TARGET_ID = 'top-assistant';
export const SIZE = 20, POOL_MIN = 100, PER_AREA_MIN = 10, BAR = 94, MIN_JUDGED = 15, STREAK = 3;
export const AREAS = ['health', 'money', 'writing', 'coding', 'how-to', 'local', 'current events'];
export const load = (f = FILE) => JSON.parse(fs.readFileSync(f, 'utf8'));
/** one line per question, per run and per row. Pure. */
export const serialize = (d) => '{\n' + Object.entries(d).map(([k, v]) => ' ' + JSON.stringify(k) + ': ' + (Array.isArray(v) ? '[\n' + v.map((x) => '  ' + JSON.stringify(x)).join(',\n') + '\n ]' : k === 'last' && v ? '{' + Object.entries(v).map(([a, b]) => (a === 'rows' ? '\n  "rows": [\n' + b.map((x) => '   ' + JSON.stringify(x)).join(',\n') + '\n  ]' : '"' + a + '": ' + JSON.stringify(b))).join(', ') + '}' : JSON.stringify(v))).join(',\n') + '\n}\n';
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** `n` questions the agent has been asked least, spread over the areas (round robin, a random order inside a tie). `rnd` is injectable. Pure. */
export function sample(pool, seen = {}, n = SIZE, rnd = Math.random) {
  const by = new Map();
  for (const q of pool) { if (!by.has(q.area)) by.set(q.area, []); by.get(q.area).push(q); }
  for (const [a, qs] of by) by.set(a, qs.map((q) => ({ q, k: (seen[q.id] || 0) + rnd() * 0.99 })).sort((x, y) => x.k - y.k).map((x) => x.q));
  const areas = [...by.keys()].map((a) => ({ a, k: rnd() })).sort((x, y) => x.k - y.k).map((x) => x.a), out = [];
  for (let i = 0; out.length < n && out.length < pool.length; i++) { const a = areas[i % areas.length], qs = by.get(a); if (qs.length) out.push(qs.shift()); }
  return out;
}
/** problems with the pool: size, spread over the areas, unique ids and asks, an ask the fixed set already holds, a reference under 100. Pure. */
export function problemsOf(file, fixed = []) {
  const out = [], pool = (file && file.set) || [], ids = new Set(), asks = new Set(fixed.map((q) => norm(q.ask)));
  if (pool.length < POOL_MIN) out.push('the pool has ' + pool.length + ' questions, under ' + POOL_MIN);
  for (const a of AREAS) if (pool.filter((q) => q.area === a).length < PER_AREA_MIN) out.push('area "' + a + '" has fewer than ' + PER_AREA_MIN + ' questions');
  for (const q of pool) {
    if (ids.has(q.id)) out.push('id twice: ' + q.id); ids.add(q.id);
    if (!AREAS.includes(q.area)) out.push(q.id + ': unknown area ' + q.area);
    if (asks.has(norm(q.ask))) out.push(q.id + ': this ask is already in the fixed set or twice here'); asks.add(norm(q.ask));
    if (!q.ask || !q.reference || !(q.facts || []).length) { out.push(q.id + ': needs an ask, a reference and facts'); continue; }
    for (const f of [...q.facts, ...(q.use || [])]) { try { new RegExp(f.re, 'i'); } catch (e) { out.push(q.id + ': bad pattern ' + f.re); } if (!f.say) out.push(q.id + ': a check has no plain label'); } // void-review: ok (the owner's own patterns in the pool file, never a visitor's text)
    const s = scoreOne(q, q.reference);
    for (const d of ['right', 'useful', 'clear']) if (s[d] < 100) out.push(q.id + ': its reference scores ' + s[d] + ' on ' + d + ' (' + (s.gaps[d].join('; ') || '') + ')');
  }
  return out;
}
/** build-list rows by area, never by question: what the answers in that area lacked, in the plain labels. Pure. */
export function jobsOf(set, rows, today, target = TARGET_ID) {
  const area = new Map(set.map((q) => [q.id, q.area])), by = new Map();
  const add = (r, m) => { const a = area.get(r.id); if (!by.has(a)) by.set(a, new Map()); by.get(a).set(m, (by.get(a).get(m) || 0) + 1); };
  for (const r of rows) {
    for (const d of ['right', 'useful', 'clear']) if (r[d] < GAP_BELOW) for (const m of r.gaps[d]) add(r, m);
    if (r.jr) for (const d of ['right', 'useful', 'clear']) if (r.jr.answer[d] <= r.jr.reference[d] - 10) add(r, 'the judge found it weaker than a top answer on being ' + d);
  }
  return [...by].map(([a, ms]) => ({ id: target, aspect: 'heldout:' + a, side: 'correct', since: today, job: 'build: Verse answers in "' + a + '" fell short on unseen questions. Improve how it answers this kind of question in general. Lacked: ' + [...ms].sort((x, y) => y[1] - x[1]).slice(0, 3).map(([m]) => m).join('; ') }));
}
/** the judge on every answer, four at a time: one { answer, reference, by } or null per question. `judgeFn` is injectable. */
export async function judgeAll(picked, answers, env = process.env, judgeFn = judge) {
  const out = new Array(picked.length); let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { for (;;) { const i = next++; if (i >= picked.length) return; const t = String((answers[i] && answers[i].text) || ''); out[i] = t ? await judgeFn(picked[i].ask, t, picked[i].reference, env).catch(() => null) : null; } }));
  return out;
}
/** a run's whole effect, pure: the asked counts, the run with the judge's verdict, the streak of runs that beat the reference, and the last rows.
 *  A run beats the reference when the pattern marks are each above the bar and the blind judge rates Verse at least equal (compare()); a run with fewer than
 *  15 answers judged (no key, no reply) is neither a win nor a loss: the streak stays where it was. */
export function applyRun({ file, picked, answers, judged = [], base, at, keep = 60 }) {
  const rows = picked.map((q, i) => ({ ...scoreOne(q, answers[i].text, answers[i].status), area: q.area, ...(judged[i] ? { jr: { answer: judged[i].answer, reference: judged[i].reference } } : {}) })), sum = summarize(rows);
  const seen = { ...(file.seen || {}) }; for (const q of picked) seen[q.id] = (seen[q.id] || 0) + 1;
  const cmp = compare(judged), pattern = sum.right > BAR && sum.useful > BAR && sum.clear > BAR;
  const beat = cmp && cmp.judged >= MIN_JUDGED ? pattern && cmp.beats : null, streak = beat === true ? (file.streak || 0) + 1 : beat === false ? 0 : (file.streak || 0);
  const verdict = cmp ? { judged: cmp.judged, by: cmp.by, verse: cmp.answer.overall, reference: cmp.reference.overall } : null;
  const last = { at, base, ...sum, judge: verdict, beat, streak, rows: rows.map((r, i) => ({ ...r, answer: String(answers[i].text || '').slice(0, 400), bot: answers[i].bot || '' })) };
  return { file: { ...file, seen, streak, last, runs: (file.runs || []).concat({ at, ...sum, judge: verdict, beat, streak }).slice(-keep) }, rows, sum, beat, streak, verdict };
}
/** the Tower mark: 100 once the streak is 3, else the pattern overall held under the bar so the target is not beaten early. Pure. */
export const markOf = (sum, streak) => (streak >= STREAK ? 100 : Math.min(BAR - 1, sum.overall));

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), file = load();
  if (args.includes('--check')) {
    const fixed = JSON.parse(fs.readFileSync(path.join(ROOT, 'void-live-deploy/tower.assistant.json'), 'utf8')).set, p = problemsOf(file, fixed);
    console.log(p.length ? p.join('\n') : 'ok: ' + file.set.length + ' questions over ' + AREAS.length + ' areas, every reference scores 100'); process.exit(p.length ? 1 : 0);
  }
  const picked = sample(file.set, file.seen, Number(args.find((a) => /^\d+$/.test(a))) || SIZE);
  if (args.includes('--sample')) for (const q of picked) console.log(q.area.padEnd(15) + q.ask);
  if (args.includes('--live')) {
    const base = (args.find((a) => /^https?:/.test(a)) || 'https://a-to-mind.com').replace(/\/$/, ''), answers = await examine(base, picked, askLive, console.log);
    const judged = await judgeAll(picked, answers), out = applyRun({ file, picked, answers, judged, base, at: new Date().toISOString() });
    console.log(JSON.stringify({ ...out.sum, judge: out.verdict, beat: out.beat, streak: out.streak })); for (const r of out.rows) console.log(r.area.padEnd(15) + r.id.padEnd(16) + ' right ' + String(r.right).padStart(3) + ' useful ' + String(r.useful).padStart(3) + ' clear ' + String(r.clear).padStart(3));
    if (args.includes('--write')) { fs.writeFileSync(FILE, serialize(out.file)); console.log('written'); }
  }
}
