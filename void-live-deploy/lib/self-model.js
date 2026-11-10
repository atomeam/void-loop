// Continuous self-model. A tick reads measured signals, attends to the largest gap, and journals the file and the suite. A missing number stays null. Sends and spends stay on the confirm line.
import { slug } from './will-guard.js';
export const SCHEMA = 1;
export const DRIVES = ['curiosity', 'competence', 'care', 'integrity'];
export const HOLDS = ['email.send', 'message.send', 'release.publish', 'proposal.send', 'payment.send', 'order.place', 'models.spend', 'reminder.ping', 'bridge.task'];
export const METRICS = [
  { id: 'better', label: 'better score', file: 'void.better.json', suite: 'tools/better.test.mjs', drive: 'competence' },
  { id: 'bench', label: 'benchmark', file: 'void.better.json', suite: 'tools/bench.mjs', drive: 'competence' },
  { id: 'exam', label: 'outcome exam', file: '/progress/exam.json', suite: 'tools/outcome-exam.mjs', drive: 'competence' },
  { id: 'asks', label: 'asks part', file: 'void.better.json', suite: 'tools/better.test.mjs', drive: 'curiosity' },
  { id: 'will', label: 'open will', file: '/api/will', suite: 'tools/will-guard.test.mjs', drive: 'curiosity' },
  { id: 'ci', label: 'page check', file: '/api/selfcheck', suite: 'tools/selfcheck.test.mjs', drive: 'integrity' },
  { id: 'members', label: 'member asks answered', file: 'void_queue', suite: 'tools/members.test.mjs', drive: 'care' },
];
const num = (v) => (Number.isFinite(+v) ? +v : null);
const clamp = (n) => Math.max(0, Math.min(1, n));
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const round = (n) => Math.round(n * 1000) / 10;
const meta = (id) => METRICS.find((m) => m.id === id);
export function blank(now = '') {
  return {
    schema: SCHEMA, at: now || null, tick: 0,
    identity: {
      name: 'Verse',
      motto: 'Absorb and learn everything, and do the best I can with it.',
      limits: [
        'I am a continuous self-model. This record is not a proof of consciousness.',
        'I do not claim feelings.',
        'A send, a booking or a spend still stops on the confirm line.',
      ],
    },
    goals: [], drives: { curiosity: null, competence: null, care: null, integrity: null },
    beliefs: {}, attention: null, journal: [], wants: [], got: [],
    memory: { episodes: [], semantic: [], consolidated: '' },
  };
}
export function betterPair(rows) {
  const list = (Array.isArray(rows) ? rows : []).filter((r) => r && num(r.score) != null);
  const last = list[list.length - 1], prev = list.length > 1 ? list[list.length - 2] : null;
  if (!last) return null;
  return { score: last.score, at: last.at, parts: last.parts || null, facts: last.facts || null, prior: prev ? prev.score : null, priorAsks: prev && prev.parts ? prev.parts.asks : null };
}
export function signalsOf(raw = {}) {
  const out = [], add = (id, value, extra) => {
    const m = meta(id), v = num(value);
    if (!m || v == null) return;
    out.push({ id, label: m.label, file: m.file, suite: m.suite, drive: m.drive, value: id === 'will' ? v : clamp(v), ...extra });
  };
  const b = raw.better;
  if (b && num(b.score) != null) add('better', b.score / 100, { at: b.at, detail: b.score + ' of 100', prior: num(b.prior) != null ? b.prior / 100 : null });
  if (b && b.parts && num(b.parts.asks) != null) add('asks', b.parts.asks / 100, { at: b.at, detail: b.parts.asks + ' of 100', prior: num(b.priorAsks) != null ? b.priorAsks / 100 : null });
  if (b && b.facts && num(b.facts.benchScore) != null && num(b.facts.benchTotal) > 0) add('bench', b.facts.benchScore / b.facts.benchTotal, { at: b.at, detail: b.facts.benchScore + ' of ' + b.facts.benchTotal });
  const exam = raw.exam;
  if (exam && Array.isArray(exam.cases) && exam.cases.length) {
    const ok = exam.cases.filter((c) => c && c.ok === true).length;
    add('exam', ok / exam.cases.length, { detail: ok + ' of ' + exam.cases.length + ' cases hold' });
  }
  if (raw.will && num(raw.will.open) != null) add('will', raw.will.open, { detail: raw.will.open + ' wants still open' });
  if (raw.ci && num(raw.ci.checked) > 0 && num(raw.ci.broken) != null) add('ci', 1 - raw.ci.broken / raw.ci.checked, { detail: raw.ci.broken + ' of ' + raw.ci.checked + ' pages need a fix' });
  if (raw.members && num(raw.members.asked) > 0 && num(raw.members.answered) != null) add('members', raw.members.answered / raw.members.asked, { detail: raw.members.answered + ' of ' + raw.members.asked + ' answered' });
  return out;
}
export function attend(signals) {
  let best = null;
  for (const s of signals || []) {
    const gap = s.id === 'will' ? 0 : 1 - s.value;
    const surprise = s.prior == null ? null : Math.abs(s.value - s.prior);
    const salience = gap + (surprise || 0);
    if (!best || salience > best.salience || (salience === best.salience && s.id < best.id)) best = { ...s, salience, surprise };
  }
  return best;
}
export function goalMatch(title, goals) {
  const words = new Set(String(title || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []);
  if (!words.size || !(goals || []).length) return null;
  let best = 0;
  for (const g of goals) {
    const gw = new Set(String(g).toLowerCase().match(/[a-z0-9]{3,}/g) || []);
    let n = 0; for (const w of words) if (gw.has(w)) n++;
    best = Math.max(best, n / words.size);
  }
  return best;
}
export function expectedValue(action, drives) {
  if (!action) return { value: null, why: 'no action' };
  if (action.gated || HOLDS.includes(action.tool)) return { value: null, why: 'a send or a spend stays on the confirm line' };
  const tried = num(action.tried), ok = num(action.succeeded), drive = drives && num(drives[action.drive || 'competence']), goal = num(action.goalMatch);
  if (!(tried > 0) || ok == null) return { value: null, why: 'no measured outcome yet' };
  if (drive == null) return { value: null, why: 'that drive is not measured' };
  if (goal == null) return { value: null, why: 'no goal match measured' };
  const p = clamp(ok / tried), value = p * (1 - drive) * clamp(goal);
  return { value, why: 'success ' + round(p) + ' times the drive gap times the goal match' };
}
export function rankActions(actions, drives) {
  return (actions || []).map((a) => ({ ...a, ev: expectedValue(a, drives) })).sort((a, b) => {
    const av = a.ev.value, bv = b.ev.value;
    if (av == null && bv == null) return (b.weight || 0) - (a.weight || 0) || String(a.title).localeCompare(String(b.title));
    if (av == null) return 1;
    if (bv == null) return -1;
    return bv - av || String(a.title).localeCompare(String(b.title));
  });
}
export function weigh(cands, rows, drives) {
  const tally = new Map();
  for (const r of rows || []) {
    const e = tally.get(r.target) || { tried: 0, succeeded: 0 };
    if (r.state === 'live' || r.state === 'done') { e.tried++; e.succeeded++; }
    else if (['failed', 'declined', 'deferred', 'set aside'].includes(r.state)) e.tried++;
    tally.set(r.target, e);
  }
  const goals = (cands || []).map((c) => c.title);
  for (const c of cands || []) {
    const e = tally.get('will:' + slug(c.title)) || { tried: 0, succeeded: 0 };
    const ev = expectedValue({ title: c.title, tried: e.tried, succeeded: e.succeeded, drive: 'competence', goalMatch: goalMatch(c.title, goals) }, drives || {});
    c.ev = ev;
    if (ev.value != null) c.weight += Math.round(ev.value * 12);
  }
  return cands;
}
export function wantsFrom(signals) {
  return (signals || []).filter((s) => s.id !== 'will' && s.value < 0.9).map((s) => ({
    id: 'want-' + s.id, title: 'Raise ' + s.label + ' past ' + s.detail,
    because: s.detail + ' in ' + s.file + ', checked by ' + s.suite + '. It closes only when that reading is higher.',
    drive: s.drive, source: s.id, doneWhen: { source: s.id, above: Math.round((s.value + Math.min(0.05, 1 - s.value)) * 1000) / 1000 }, salience: 1 - s.value,
  })).sort((a, b) => b.salience - a.salience || a.id.localeCompare(b.id));
}
export function fulfilled(want, signals) {
  const s = (signals || []).find((x) => x.id === (want && want.doneWhen && want.doneWhen.source));
  return !!(s && num(s.value) != null && num(want.doneWhen.above) != null && s.value >= want.doneWhen.above);
}
export function consolidate(episodes) {
  const by = new Map();
  for (const e of episodes || []) if (e && e.source) { const g = by.get(e.source) || []; g.push(e); by.set(e.source, g); }
  return [...by].map(([source, rows]) => {
    const vals = rows.map((r) => num(r.value)).filter((v) => v != null);
    const avg = mean(vals);
    return { source, file: rows[0].file, suite: rows[0].suite, n: rows.length, text: 'From ' + rows.length + ' reading' + (rows.length === 1 ? '' : 's') + ' of ' + (rows[0].file || source) + (avg == null ? '' : ', the mean is ' + round(avg)) + '. Checked by ' + (rows[0].suite || 'no suite') + '.' };
  }).sort((a, b) => a.source.localeCompare(b.source));
}
const words = (t) => new Set(String(t || '').toLowerCase().match(/[a-z0-9]{3,}/g) || []);
export function retrieve(memory, query, limit = 3) {
  const q = words(query);
  if (!q.size) return [];
  const rows = [...((memory && memory.semantic) || []).map((s) => ({ kind: 'semantic', text: s.text, source: s.source, suite: s.suite })), ...((memory && memory.episodes) || []).map((e) => ({ kind: 'episodic', text: e.text, source: e.source, suite: e.suite }))];
  return rows.map((r) => { const w = words(r.text); let n = 0; for (const t of q) if (w.has(t)) n++; return { ...r, score: n }; }).filter((r) => r.score > 0).sort((a, b) => b.score - a.score || a.kind.localeCompare(b.kind)).slice(0, limit);
}
function drivesOf(signals, surprise, ranGated) {
  const of = (d) => signals.filter((s) => s.drive === d && s.id !== 'will').map((s) => s.value);
  const competence = mean(of('competence')), care = mean(of('care'));
  const ask = signals.find((s) => s.id === 'asks');
  const curiosity = surprise != null ? clamp(surprise) : (ask ? clamp(1 - ask.value) : null);
  const integrity = ranGated === true ? 0 : ranGated === false ? 1 : null;
  return { curiosity, competence, care, integrity };
}
function journalLine(now, attention, surprise, predicted, drives) {
  if (!attention) return { at: now, text: 'I had no measured signal this tick, so I did not write a score.', source: '', file: '', suite: '' };
  const sur = surprise == null ? 'I have no earlier reading, so surprise is not measured.' : 'Surprise is ' + round(surprise) + (predicted == null ? '.' : ' against the ' + round(predicted) + ' I had stored.');
  const drive = drives[attention.drive] == null ? attention.drive + ' is not measured.' : attention.drive + ' is ' + round(drives[attention.drive]) + '.';
  return { at: now, source: attention.id, file: attention.file, suite: attention.suite, value: attention.value, text: 'I attended to ' + attention.label + ', ' + (attention.detail || attention.value) + ', from ' + attention.file + ', checked by ' + attention.suite + '. ' + sur + ' ' + drive + ' I am a continuous self-model. This is not a proof of consciousness.' };
}
export function tick(self, raw = {}, now = '', ranGated = null) {
  const prev = self && self.schema === SCHEMA ? self : blank(now);
  const signals = signalsOf(raw);
  const attention = attend(signals);
  const belief = attention && num(prev.beliefs[attention.id]);
  const predicted = belief != null ? belief : (attention && attention.prior != null ? attention.prior : null);
  const surprise = attention && predicted != null ? Math.abs(attention.value - predicted) : null;
  const drives = drivesOf(signals, surprise, ranGated);
  const beliefs = { ...prev.beliefs };
  if (attention && attention.id !== 'will') beliefs[attention.id] = attention.value;
  const line = journalLine(now, attention, surprise, predicted, drives);
  const episodes = [...(prev.memory.episodes || []), attention && { at: now, source: attention.id, file: attention.file, suite: attention.suite, text: line.text, value: attention.value }].filter(Boolean).slice(-40);
  const day = String(now || '').slice(0, 10), last = String(prev.memory.consolidated || '').slice(0, 10);
  const semantic = !last || (day && day !== last) ? consolidate(episodes) : (prev.memory.semantic || []);
  const proposed = wantsFrom(signals);
  const priorW = new Map((prev.wants || []).map((w) => [w.id, w]));
  for (const w of proposed) if (!priorW.has(w.id)) priorW.set(w.id, w);
  const open = [], got = [...(prev.got || [])];
  for (const w of priorW.values()) (fulfilled(w, signals) ? got : open).push(w);
  const goals = Array.isArray(raw.goals) ? raw.goals.slice(0, 8) : prev.goals;
  const actions = (raw.actions || []).map((a) => ({ ...a, goalMatch: a.goalMatch != null ? a.goalMatch : goalMatch(a.title, goals) }));
  const ranked = rankActions(actions, drives);
  const choice = ranked.find((a) => a.ev && a.ev.value != null && !HOLDS.includes(a.tool)) || null;
  const next = {
    ...prev, at: now || prev.at, tick: (prev.tick || 0) + 1, goals, drives, beliefs, attention, wants: open, got: got.slice(-20),
    journal: [...(prev.journal || []), line].slice(-30),
    memory: { episodes, semantic, consolidated: semantic === prev.memory.semantic ? prev.memory.consolidated : (day || now) },
  };
  const plan = choice ? { title: choice.title, ev: choice.ev, recall: retrieve(next.memory, choice.title) } : { title: '', ev: null, recall: attention ? retrieve(next.memory, attention.label) : [] };
  return { self: next, signals, ranked, plan, journal: line };
}
export function publicView(self) {
  if (!self) return null;
  const a = self.attention;
  return {
    schema: self.schema, at: self.at, tick: self.tick, identity: self.identity, drives: self.drives, goals: self.goals,
    attention: a && { id: a.id, label: a.label, detail: a.detail, file: a.file, suite: a.suite, value: a.value, surprise: a.surprise },
    journal: self.journal || [], wants: self.wants || [], got: self.got || [], semantic: (self.memory && self.memory.semantic) || [],
    holds: HOLDS, claim: 'A continuous self-model. Not a proof of consciousness.',
  };
}
