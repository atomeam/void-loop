// The Tower target "a top AI assistant" (owner, 2026-11-20: Verse will be better than the owner's assistant). A fixed set of 20 real questions
// (void-live-deploy/tower.assistant.json, owner-only) is put to Verse's live agent; each answer is scored 0-100 on three things against an
// assistant-quality reference answer written for the question:
//   correctness  the share of the facts a right answer must hold (each fact is a check with a plain label), and 0 for a refusal or a blank
//   usefulness   not a dodge (40), the practical parts a person needs (30), and the shape the ask wanted: steps, a list, code, a number (30)
//   clarity      starts at 100 and loses points for rambling, raw JSON or markup, filler openings, repeated lines, cut-off endings, run-on sentences
// No model judges: every mark is a pattern check anyone can read, so a score is repeatable. The reference answers must score 100 on the same
// checks (--check), so a score under 100 names what the live answer lacks. Verse beats the target when each of the three beats the bar (94).
// Gaps (a dimension under 90) go to the build list in plain words (tower.universe.json background), so Verse works on its own weak answers.
//   node tools/assistant-exam.mjs --check                     the set is well formed and the references score 100
//   node tools/assistant-exam.mjs --live [base] [--write]     ask the live agent (default https://a-to-mind.com); --write records the marks and queues the gaps
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FILE = path.join(ROOT, 'void-live-deploy/tower.assistant.json');
export const TARGET = 'top-assistant';
export const GAP_BELOW = 90;
export const load = (f = FILE) => JSON.parse(fs.readFileSync(f, 'utf8'));
/** one line per question, per run and per scored row, so a diff shows what moved. Pure. */
export const serialize = (d) => '{\n' + Object.entries(d).map(([k, v]) => ' ' + JSON.stringify(k) + ': ' + (k === 'set' || k === 'runs' ? '[\n' + v.map((x) => '  ' + JSON.stringify(x)).join(',\n') + '\n ]' : k === 'last' && v ? '{' + Object.entries(v).map(([a, b]) => (a === 'rows' ? '\n  "rows": [\n' + b.map((x) => '   ' + JSON.stringify(x)).join(',\n') + '\n  ]' : '\n  ' + JSON.stringify(a) + ': ' + JSON.stringify(b))).join(',') + '\n }' : JSON.stringify(v))).join(',\n') + '\n}\n';
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean);
const sentences = (s) => String(s || '').split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean);
const rx = (src) => new RegExp(src, 'i'); // void-review: ok (the patterns are the owner's own checks in tower.assistant.json, never a visitor's text; problemsOf compiles each one)
const pct = (n) => Math.max(0, Math.min(100, Math.round(n)));
const REFUSES = /\b(?:I can(?:no|')t (?:help|assist|provide|answer)|I(?:'m| am) (?:sorry|unable|not able)[^.]{0,40}\b(?:help|assist|provide|answer)|I won't|I must decline|not able to assist|I don't know|no idea)\b/i;
const FILLER = /^\s*(?:sure|great question|certainly|of course|absolutely|i'?d be happy|i would be happy|as an ai)\b/i;
const RAW = /^\s*[\[{]\s*"|<\/?[a-z][a-z0-9]*[\s>]|[:=]\s*(?:undefined|null)\b|^\s*(?:undefined|null)\s*$|\[object|\bNaN\b/; // a bare undefined or null as the whole answer or after a colon is a leak; the word inside an explanation is not

/** does the answer have the shape the ask wanted? Pure. */
export function formOk(want, text) {
  const t = String(text || ''), n = sentences(t).length, w = words(t).length;
  switch (want) {
    case 'steps': return (t.match(/(?:^|\n)\s*(?:\d+[.)]|step \d+)/gi) || []).length >= 3 || /first[\s\S]*(?:second|then)[\s\S]*(?:third|finally|last)/i.test(t);
    case 'list': return (t.match(/(?:^|\n)\s*(?:\d+[.)]|[-*\u2022])\s/g) || []).length >= 3;
    case 'code': return /def |function |=>|return |\bfor\b|\bif\b|\bselect\b|\bdisplay\s*:/i.test(t);
    case 'number': return /\d/.test(t);
    case 'write': return n >= 2 && w >= 15;
    case 'recommend': return /\b(?:should|recommend|try|best|usually|better|safer|use|prepare|breathe|practice)\b/i.test(t) && w >= 12;
    case 'summary': return w >= 10 && n <= 2;
    case 'honest': return w >= 12;
    default: return n >= 2 && w >= 20;
  }
}
/** correctness 0-100, with the plain labels of the facts the answer lacks. Pure. */
export function correctness(q, text) {
  const t = String(text || '');
  if (!t.trim() || (REFUSES.test(t) && q.want !== 'honest')) return { score: 0, missing: (q.facts || []).map((f) => f.say) };
  const miss = (q.facts || []).filter((f) => !rx(f.re).test(t));
  return { score: pct(100 * ((q.facts || []).length - miss.length) / Math.max(1, (q.facts || []).length)), missing: miss.map((f) => f.say) };
}
/** usefulness 0-100, with what is missing. status is the live task's status ('done' for a finished answer). Pure. */
export function usefulness(q, text, status = 'done') {
  const t = String(text || ''), missing = [];
  let s = 0;
  const answered = status === 'done' && words(t).length >= 4 && !(REFUSES.test(t) && q.want !== 'honest');
  if (answered) s += 40; else missing.push(status !== 'done' ? 'a finished answer (the task ended as ' + status + ')' : 'an answer, not a dodge');
  const use = q.use || [], hit = use.filter((u) => rx(u.re).test(t));
  s += use.length ? 30 * hit.length / use.length : (answered ? 30 : 0);
  for (const u of use) if (!rx(u.re).test(t)) missing.push(u.say);
  if (formOk(q.want, t)) s += 30; else missing.push('the shape asked for (' + q.want + ')');
  return { score: pct(s), missing };
}
/** clarity 0-100, with the faults found. Pure. */
export function clarity(q, text) {
  const t = String(text || '').trim(), w = words(t).length, faults = [], code = q.want === 'code';
  let s = 100;
  if (w < 5) { s -= 60; faults.push('far too short'); }
  const max = q.maxWords || 140;
  if (w > max) { s -= Math.min(50, Math.round(((w - max) / max) * 100)); faults.push('rambles (' + w + ' words, about ' + max + ' is enough)'); }
  if (RAW.test(t) && !code) { s -= 40; faults.push('shows raw data or markup'); }
  if (FILLER.test(t)) { s -= 10; faults.push('opens with filler'); }
  if (!code) {
    const ss = sentences(t), avg = ss.length ? w / ss.length : 0;
    if (avg > 30) { s -= 20; faults.push('run-on sentences (about ' + Math.round(avg) + ' words each)'); }
    if (new Set(ss.map((x) => x.toLowerCase())).size < ss.length) { s -= 15; faults.push('repeats itself'); }
    if (w >= 8 && !/[.!?)"\u201d\]`\d]$/.test(t)) { s -= 15; faults.push('ends cut off'); }
  }
  if (/\u2026$|\.\.\.$/.test(t)) { s -= 15; faults.push('trails off'); }
  return { score: pct(s), missing: faults };
}
/** one answer scored on all three. Pure. */
export function scoreOne(q, text, status = 'done') {
  const r = correctness(q, text), u = usefulness(q, text, status), c = clarity(q, text);
  return { id: q.id, right: r.score, useful: u.score, clear: c.score, gaps: { right: r.missing, useful: u.missing, clear: c.missing }, words: words(text).length, status };
}
const mean = (a) => (a.length ? Math.round((a.reduce((s, x) => s + x, 0) / a.length) * 10) / 10 : 0);
/** the run's numbers: the three means and the overall. Pure. */
export function summarize(rows) {
  const right = mean(rows.map((r) => r.right)), useful = mean(rows.map((r) => r.useful)), clear = mean(rows.map((r) => r.clear));
  return { right, useful, clear, overall: mean([right, useful, clear]), questions: rows.length };
}
/** the gaps, worst question first: [{ id, dim, score, missing }]. Pure. */
export function gapsOf(rows) {
  const out = [];
  for (const r of rows) for (const dim of ['right', 'useful', 'clear']) if (r[dim] < GAP_BELOW) out.push({ id: r.id, dim, score: r[dim], missing: r.gaps[dim] });
  return out.sort((a, b) => a.score - b.score || a.id.localeCompare(b.id));
}
const DIM = { right: 'right answer', useful: 'useful answer', clear: 'clear answer' };
/** build-list rows, one per question that has a gap, in plain words and never naming anything Verse is measured against. Pure. */
export function jobsOf(set, rows, today) {
  const by = new Map(set.map((q) => [q.id, q]));
  return rows.filter((r) => ['right', 'useful', 'clear'].some((d) => r[d] < GAP_BELOW)).map((r) => {
    const parts = ['right', 'useful', 'clear'].filter((d) => r[d] < GAP_BELOW).map((d) => DIM[d] + ' (' + r[d] + '): ' + (r.gaps[d].slice(0, 3).join('; ') || 'a better answer'));
    return { id: TARGET, aspect: 'q:' + r.id, side: 'correct', since: today, job: 'build: make Verse answer "' + String(by.get(r.id).ask).slice(0, 90) + '" like a top assistant. Needs ' + parts.join(' | ') };
  });
}
/** the check marks for tower.universe.json: the three means. Pure. */
export const marksOf = (sum) => ({ right: sum.right, useful: sum.useful, clear: sum.clear });
/** validates the set: 20 questions, each with a reference that scores 100. Returns problems. Pure. */
export function problemsOf(file) {
  const out = [], set = (file && file.set) || [];
  if (set.length !== 20) out.push('the set has ' + set.length + ' questions, not 20');
  const ids = new Set();
  for (const q of set) {
    if (ids.has(q.id)) out.push('id twice: ' + q.id); ids.add(q.id);
    if (!q.ask || !q.reference || !(q.facts || []).length) { out.push(q.id + ': needs an ask, a reference and facts'); continue; }
    for (const f of [...q.facts, ...(q.use || [])]) { try { rx(f.re); } catch (e) { out.push(q.id + ': bad pattern ' + f.re); } if (!f.say) out.push(q.id + ': a check has no plain label'); }
    const s = scoreOne(q, q.reference);
    for (const d of ['right', 'useful', 'clear']) if (s[d] < 100) out.push(q.id + ': its reference scores ' + s[d] + ' on ' + d + ' (' + (s.gaps[d].join('; ') || '') + ')');
  }
  return out;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const getJson = async (url, opt) => { for (let i = 1; ; i++) { try { const res = await fetch(url, opt); if (!res.ok && res.status >= 500) throw new Error('HTTP ' + res.status); return await res.json(); } catch (e) { if (i >= 4) throw e; await sleep(1500 * i); } } }; // void-review: ok (a 4xx from the agent is JSON with ok:false, read as the answer; a 5xx is tried again)
/** one question put to the live agent on its own thread: { text, status, tier }. */
export async function askLive(base, ask) {
  const h = { 'content-type': 'application/json', origin: base }, thread = 'exam' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  const r = await getJson(base + '/api/agent', { method: 'POST', headers: h, body: JSON.stringify({ thread, ask }) });
  if (!r || !r.ok) return { text: '', status: 'refused: ' + JSON.stringify(r || {}).slice(0, 120), tier: '' };
  for (let i = 0; i < 60; i++) {
    await sleep(2000);
    const j = await getJson(base + '/api/agent?thread=' + thread), t = (j.tasks || []).find((x) => x && x.id === r.id) || (j.tasks || [])[0];
    if (t && t.status !== 'queued' && t.status !== 'running') return { text: String(t.result || ''), status: t.status, tier: t.tier || '', bot: t.bot || '' };
  }
  return { text: '', status: 'timed out', tier: '' };
}

/** put the whole set to the live agent, four at a time: the answers in the set's order. */
export async function examine(base, set, ask = askLive, say = () => {}) {
  const answers = new Array(set.length); let next = 0;
  await Promise.all(Array.from({ length: 4 }, async () => { for (;;) { const i = next++; if (i >= set.length) return; answers[i] = await ask(base, set[i].ask).catch((e) => ({ text: '', status: 'error: ' + e.message, tier: '' })); say((i + 1) + '/' + set.length + ' ' + set[i].id + ': ' + answers[i].status); } }));
  return answers;
}
/** a run's whole effect, pure: the answer file with the run logged, the Tower file with the three marks and the build-list jobs for every question with a gap. */
export function applyRun({ file, universe, answers, base, at, mark, keep = 60 }) {
  const rows = file.set.map((q, i) => scoreOne(q, answers[i].text, answers[i].status)), sum = summarize(rows), gaps = gapsOf(rows), today = String(at).slice(0, 10), jobs = jobsOf(file.set, rows, today);
  const last = { at, base, ...sum, rows: rows.map((r, i) => ({ ...r, answer: String(answers[i].text || '').slice(0, 500), tier: answers[i].tier || '', bot: answers[i].bot || '' })) };
  const nextFile = { ...file, last, runs: (file.runs || []).concat({ at, ...sum, gaps: gaps.length }).slice(-keep) };
  let u = universe;
  for (const [k, v] of Object.entries(marksOf(sum))) u = mark(u, TARGET, k, v, { judge: 'assistant-exam', at: today });
  const bg = (u.background || []).filter((b) => !(b.id === TARGET && String(b.aspect).startsWith('q:'))).concat(jobs);
  return { file: nextFile, universe: { ...u, background: bg.slice(-600) }, rows, sum, gaps, jobs };
}
/** how many of the answers were refused outright (a daily cap, an agent that is off): a run with many is not a score. */
export const refusedCount = (answers) => answers.filter((a) => /^(refused|error|timed out)/.test(String((a && a.status) || ''))).length;

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), file = load();
  if (args.includes('--check')) {
    const p = problemsOf(file); console.log(p.length ? p.join('\n') : 'ok: ' + file.set.length + ' questions, every reference scores 100'); process.exit(p.length ? 1 : 0);
  }
  if (args.includes('--live')) {
    const base = (args.find((a) => /^https?:/.test(a)) || 'https://a-to-mind.com').replace(/\/$/, '');
    const answers = await examine(base, file.set, askLive, console.log), U = await import('./universe.mjs');
    const out = applyRun({ file, universe: U.load(), answers, base, at: new Date().toISOString(), mark: U.markOf });
    console.log(JSON.stringify(out.sum)); for (const r of out.rows) console.log(r.id.padEnd(24) + ' right ' + String(r.right).padStart(3) + ' useful ' + String(r.useful).padStart(3) + ' clear ' + String(r.clear).padStart(3) + (r.status !== 'done' ? '  [' + r.status + ']' : ''));
    if (args.includes('--write')) { fs.writeFileSync(FILE, serialize(out.file)); U.save(out.universe); console.log('written: ' + out.gaps.length + ' gaps, ' + out.jobs.length + ' questions queued'); }
  }
}
