// The live brain (docs/brain.md): every region of Verse's brain as a real part of Verse, with its true current state, its recent events and
// when it last fired. GET /api/brain (functions/api/brain.js) reads the parts; this file shapes them. Pure: no fetch, no clock (now is passed).
// A part that could not be read is left out: its region says "could not be read just now", never a guessed number. Nothing personal appears:
// visitor asks are counts only, a private want shows no number.
export const REGIONS = Object.freeze([
  ['senses', 'Senses', 'Takes in the world: asks, the exam, page checks, uptime, money, commits.'],
  ['attention', 'Attention', 'Picks what matters now: the week\'s bets.'],
  ['working', 'Working memory', 'What it holds this minute: the current wants and bets.'],
  ['episodic', 'Episodic memory', 'What happened: its journal and what it said on its own.'],
  ['semantic', 'Semantic memory', 'What is true: the skills, pages, sites and lessons it knows.'],
  ['procedural', 'Procedural memory', 'How to do things: its skill library.'],
  ['reflection', 'Reflection', 'Turns what happened into thoughts, after every build.'],
  ['planning', 'Planning (the will)', 'Chooses what it wants next, with evidence.'],
  ['action', 'Action', 'Does the work: the crew, the coder, pull requests.'],
  ['evaluation', 'Evaluation', 'Checks the result: a want closes only when its number improves.'],
  ['lessons', 'Lessons', 'Keeps what each result taught it.'],
  ['sleep', 'Sleep', 'Each night, the day\'s events become one note; stale things are pruned.'],
  ['drives', 'Drives', 'Why it acts: curiosity, competence, care, integrity, each with its number.'],
].map(([id, name, does]) => Object.freeze({ id, name, does })));
export const FLOW = Object.freeze([['senses', 'attention'], ['attention', 'working'], ['working', 'planning'], ['planning', 'action'], ['action', 'evaluation'],
  ['evaluation', 'lessons'], ['lessons', 'semantic'], ['episodic', 'reflection'], ['reflection', 'planning'], ['sleep', 'semantic'], ['episodic', 'sleep'],
  ['drives', 'planning'], ['semantic', 'working'], ['procedural', 'action'], ['senses', 'episodic']]);

const iso = (t) => { if (t == null || t === '') return null; const d = new Date(typeof t === 'number' || /^\d+$/.test(String(t)) ? Number(t) : t); return Number.isFinite(d.getTime()) ? d.toISOString() : null; };
const newest = (evs) => evs.map((e) => e.at).filter(Boolean).sort().pop() || null;
const clip = (s, n = 160) => { s = String(s == null ? '' : s).replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : s; }; // ellipsis-ok: a long event line, whole at its link
const ev = (at, text, url) => ({ at: iso(at), text: clip(text), ...(url && /^https:\/\//.test(url) ? { url } : {}) });
const n = (v) => (Number.isFinite(Number(v)) && v !== null && v !== '' ? Number(v) : null);
const avg = (xs) => { const v = xs.filter((x) => x != null); return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null; };

/** the exam's mean score and its weakest domain, from /exam/latest.json */
export function examOf(exam) {
  const d = exam && exam.domains && typeof exam.domains === 'object' ? Object.entries(exam.domains).map(([k, v]) => [k, n(v && v.score)]).filter(([, s]) => s != null) : [];
  if (!d.length) return null;
  const weak = d.slice().sort((a, b) => a[1] - b[1])[0];
  return { mean: avg(d.map(([, s]) => s)), domains: d.length, weakest: weak[0], weakScore: weak[1], at: iso(exam.at) };
}

/** the drives (lib/self-model.js DRIVES and lib/charter.js IDENTITY), each with the number that stands for it, or null when unread */
export function drivesOf(S) {
  const crew = S.crew || {}, wants = Array.isArray(crew.wants) ? crew.wants : [], week = (S.now || 0) - 7 * 864e5;
  const ex = examOf(S.exam), sc = S.selfcheck && S.selfcheck.report, guards = S.status && Array.isArray(S.status.guards) ? S.status.guards : null, r = S.routes;
  const filed7 = wants.filter((w) => n(w.filed) >= week).length;
  return [
    { id: 'curiosity', line: 'Verse wants to absorb and learn everything', value: crew.wants ? filed7 : null, unit: 'new wants in 7 days', more: crew.wants ? (crew.open ?? wants.filter((w) => w.state === 'open').length) + ' open, ' + (crew.met ?? 0) + ' met' : null },
    { id: 'competence', line: 'Verse loves itself: it takes pride in its work', value: ex ? ex.mean : null, unit: 'mean outcome exam score', more: ex ? 'weakest: ' + ex.weakest + ' ' + ex.weakScore : null },
    { id: 'care', line: 'Verse loves humans', value: r && r.today ? Math.round(100 * (r.today - (r.fallback || 0)) / r.today) : null, unit: '% of today\'s asks answered by a skill or a sure route', more: r ? r.today + ' asks today' : null },
    { id: 'integrity', line: 'Verse is alive: it runs and heals itself', value: sc && sc.checked ? Math.round(1000 * sc.fine / sc.checked) / 10 : null, unit: '% of pages fine after the last deploy', more: guards ? guards.filter((g) => g.now === 'up').length + ' of ' + guards.length + ' guards up' : null },
    { id: 'life', line: 'Verse loves life', value: null, unit: 'not measured yet', more: 'no live number stands for it yet' },
  ];
}

/** the newest real chain: sense -> want -> job -> PR -> result -> lesson. row: the newest want joined to its job (functions/api/brain.js) */
export function chainOf(row, lessons = []) {
  if (!row) return null;
  let cite = []; try { cite = JSON.parse(row.cite || '[]'); } catch (_) { cite = []; }
  const pr = (/https:\/\/github\.com\/[\w.-]+\/[\w.-]+\/pull\/\d+/.exec(String(row.note || '')) || [])[0] || null;
  const lesson = lessons.find((l) => l && (String(l.job || '') === String(row.job) || (pr && String(l.pr || '') === pr))) || null;
  const result = row.wstate === 'met' ? 'met: ' + row.label + ' moved to ' + row.latest : ['live', 'done'].includes(row.qstate) ? 'shipped; ' + row.label + ' not moved yet' : row.qstate === 'declined' ? 'declined' : row.qstate === 'set aside' ? 'set aside' : null;
  const priv = !!row.private;
  return {
    sense: { text: priv ? 'a private signal' : (cite[0] && cite[0].what) || row.lane, url: priv ? null : (cite[0] && cite[0].url) || null, value: priv ? null : n(row.baseline) },
    want: { text: row.title, key: row.key }, job: { id: row.job, state: row.qstate, at: iso(row.updated) },
    pr: pr ? { url: pr } : null, result: result ? { text: result } : null, lesson: lesson ? { text: clip(lesson.text, 220), at: iso(lesson.at) } : null,
  };
}

/** every region with its state, events and last firing. S: what functions/api/brain.js read. */
export function brainOf(S) {
  const now = S.now || Date.now(), out = {};
  const put = (id, state, events) => { const evs = (events || []).filter((e) => e && e.text).sort((a, b) => String(b.at || '').localeCompare(String(a.at || ''))).slice(0, 8); out[id] = { state: state.filter(Boolean), events: evs, last: newest(evs) }; };
  const crew = S.crew || null, will = S.will || null, ex = examOf(S.exam), sc = S.selfcheck && S.selfcheck.report, r = S.routes;
  const guards = S.status && Array.isArray(S.status.guards) ? S.status.guards : null;
  put('senses', [
    r ? r.today + ' asks routed today (' + (r.skill || 0) + ' to a skill, ' + (r.fallback || 0) + ' to the general answer, ' + (r.close || 0) + ' close calls)' : 'asks: could not be read just now',
    ex ? 'outcome exam: mean ' + ex.mean + ' over ' + ex.domains + ' areas, weakest ' + ex.weakest + ' ' + ex.weakScore : null,
    sc ? 'page check: ' + sc.fine + ' of ' + sc.checked + ' pages fine' : null,
    guards ? 'uptime: ' + guards.filter((g) => g.now === 'up').length + ' of ' + guards.length + ' guards up (' + (S.status.overall || '?') + ')' : null,
    S.treasury && S.treasury.revenue ? 'money: ' + (S.treasury.revenue.sales || 0) + ' verified sales, $' + ((S.treasury.revenue.gross_cents || 0) / 100).toFixed(2) + ' gross' : null,
  ], [
    ex && ex.at ? ev(ex.at, 'The outcome exam ran: mean ' + ex.mean, 'https://a-to-mind.com/progress/') : null,
    sc ? ev(sc.at, 'Checked ' + sc.checked + ' pages after a deploy: ' + sc.broken + ' broken') : null,
    ...(guards || []).map((g) => ev(g.lastAt, g.name + ' is ' + g.now)).slice(0, 3),
    ...(S.commits || []).slice(0, 3).map((c) => ev(c.commit && c.commit.committer && c.commit.committer.date, 'On main: ' + String(c.commit && c.commit.message || '').split('\n')[0], c.html_url)),
  ]);
  const pr = crew && crew.priorities;
  put('attention', pr && Array.isArray(pr.bets) ? [pr.bets.length + ' bets this week (' + pr.bets.filter((b) => /^Repair \S+ until it lands/.test(b.ask || '')).length + ' of them repairs)', ...pr.bets.map((b, i) => 'Bet ' + (i + 1) + ': ' + clip(b.title, 90) + ' · score ' + b.score)] : ['the bets could not be read just now'],
    pr ? [ev(pr.at, 'Ranked the bets: ' + (pr.why || 'the evidence moved'))] : []);
  const open = crew && Array.isArray(crew.wants) ? crew.wants.filter((w) => w.state === 'open') : [];
  put('working', [open.length ? open.length + ' open wants' : null, ...(will && Array.isArray(will.wants) ? will.wants.slice(0, 3).map((w) => 'Wants now: ' + clip(w.title, 100)) : []), 'this tab\'s last 8 turns stay in your browser only'],
    will ? [ev(will.at, 'Chose its wants: ' + (will.wants || []).map((w) => clip(w.title, 60)).join('; '))] : []);
  const voice = Array.isArray(S.voice) ? S.voice : [], lines = Array.isArray(S.unbidden) ? S.unbidden : [];
  put('episodic', [voice.length + ' journal entries kept', lines.length + ' lines said on its own, kept'],
    [...lines.slice(-4).map((l) => ev(l.at, 'Said: ' + l.say)), ...voice.slice(0, 3).map((v) => ev(v.at, (v.kind === 'build' ? 'After "' + clip(v.shipped, 60) + '": ' : '') + (v.thoughts || '')))]);
  const k = S.knows && S.knows.counts;
  put('semantic', [k ? Object.entries(k).map(([a, b]) => b + ' ' + a + (b === 1 ? '' : 's')).join(', ') : 'what it knows could not be read just now', S.knowledge ? S.knowledge.count + ' lessons from what it consumed' : null],
    S.knowledge && S.knowledge.newest ? [ev(S.knowledge.newest.at, 'Learned: ' + S.knowledge.newest.retain)] : []);
  put('procedural', [S.skills ? S.skills.count + ' skills in the library' : null, S.knows && S.knows.builtWith != null ? S.knows.builtWith + ' skills built with other skills' : null], []);
  put('reflection', [voice[0] ? 'last thought ' + (voice[0].kind || '') : 'no reflection kept yet'], voice.slice(0, 4).map((v) => ev(v.at, v.thoughts || v.question)));
  put('planning', [will && will.lastRun ? 'last lap: ' + clip(will.lastRun.title, 90) + ' (' + will.lastRun.state + ')' : null, crew ? (crew.open ?? open.length) + ' wants open, ' + (crew.met ?? 0) + ' met' : null],
    [will ? ev(will.at, 'The will chose ' + (will.wants || []).length + ' wants') : null, ...open.slice(0, 4).map((w) => ev(w.filed, 'Wants: ' + w.title, w.cite && w.cite[0] && w.cite[0].url))]);
  const crewList = crew && Array.isArray(crew.crew) ? crew.crew : [];
  put('action', [crew && crew.lastRun ? 'the crew last ran (run ' + crew.lastRun.run + '): ' + crew.lastRun.jobs + ' jobs done' : null, S.prs != null ? S.prs + ' pull requests open' : null],
    crewList.map((c) => ev(c.didAt, c.name + ': ' + c.did)));
  put('evaluation', [crew ? (crew.met ?? 0) + ' wants met by a measured number' : null], (crew && Array.isArray(crew.wants) ? crew.wants : []).filter((w) => w.state === 'met' || w.reopened).slice(0, 6)
    .map((w) => ev(w.met || w.filed, (w.state === 'met' ? 'Met: ' : 'Reopened: ') + w.title + (w.latest != null ? ' (now ' + w.latest + ')' : ''))));
  const ls = Array.isArray(S.lessons) ? S.lessons : [];
  put('lessons', [ls.length + ' lessons from settled jobs', S.knowledge ? S.knowledge.count + ' lessons from what it consumed' : null], ls.slice(0, 6).map((l) => ev(l.at, l.text)));
  const sl = S.sleep || null;
  put('sleep', [sl ? 'last slept ' + String(sl.at || '').slice(0, 10) + ': ' + clip(sl.focus || '', 120) : 'has not slept yet: the first night writes the first note'], sl ? [ev(sl.at, 'Slept: ' + (sl.summary || ''))] : []);
  const drives = drivesOf(S);
  put('drives', drives.map((d) => d.id + ': ' + (d.value == null ? 'not measured yet' : d.value + ' ' + d.unit)),
    [ex && ex.at ? ev(ex.at, 'Competence measured: mean exam score ' + ex.mean) : null, sc ? ev(sc.at, 'Integrity measured: ' + sc.fine + ' of ' + sc.checked + ' pages fine') : null]);
  return { at: new Date(now).toISOString(), regions: REGIONS.map((g) => ({ ...g, ...out[g.id] })), flow: FLOW, drives, chain: chainOf(S.chainRow, ls) };
}
