// The task board's logic (tools pack 2, owner 2026-10-18, items 21 and 23 to 30): a task has words, an optional due day, a
// priority mark, an estimate in minutes and a place (next, waiting for, someday maybe); finishing it moves it to a local
// done archive. Pure: the stage card (skills/task-board.js) keeps the list on the stage, which the browser saves. Nothing is sent.
import { findDay, daysBetween, weekdayOf } from './date-words.js';

export const BUCKETS = ['next', 'waiting', 'someday'];
export const PRI_RANK = { high: 0, med: 1, low: 2, '': 3 };
export const MAX_TASKS = 300;
const uid = () => 't' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

const PRI_WORD = { high: 'high', urgent: 'high', med: 'med', medium: 'med', low: 'low' };

/** a priority named in the words ("high priority", "!low", "p1", "urgent"): { pri, rest }. Pure. */
export function takePriority(s) {
  let pri = '', rest = String(s || '');
  const cut = (re, f) => { const m = re.exec(rest); if (m) { pri = pri || f(m); rest = (rest.slice(0, m.index) + ' ' + rest.slice(m.index + m[0].length)); } };
  cut(/\b(high|medium|med|low)[\s-]+priority\b/i, (m) => PRI_WORD[m[1].toLowerCase()]);
  cut(/\bpriority\s*[:=]?\s*(high|medium|med|low)\b/i, (m) => PRI_WORD[m[1].toLowerCase()]);
  cut(/(?:^|\s)!(high|medium|med|low)\b/i, (m) => PRI_WORD[m[1].toLowerCase()]);
  cut(/(?:^|\s)p([123])\b/i, (m) => ({ 1: 'high', 2: 'med', 3: 'low' }[m[1]]));
  cut(/\burgent\b/i, () => 'high');
  return { pri, rest: rest.replace(/\s+/g, ' ').trim() };
}

/** an estimate named in the words ("30 min", "2h", "1.5 hours", "est 45m"): { est, rest } in minutes (1 to 1440). Pure. */
export function takeEstimate(s) {
  const src = String(s || ''), m = /(?:\b(?:est(?:imate)?d?|takes?|about|for)\s*[:=]?\s*)?\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|minutes?|mins?|m)\b/i.exec(src);
  if (!m) return { est: 0, rest: src };
  const n = parseFloat(m[1]), mins = Math.round(/^h/i.test(m[2]) ? n * 60 : n);
  if (!(mins >= 1 && mins <= 1440)) return { est: 0, rest: src };
  return { est: mins, rest: (src.slice(0, m.index) + ' ' + src.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() };
}

/** the words left once the marks are cut out, without the dangling "due", "by", "on" and punctuation. Pure. */
export function tidyText(s) {
  return String(s || '').replace(/\s+/g, ' ').replace(/\b(?:due|by|on|for|at|est|estimate)\s*$/i, '').replace(/^[\s,;:.\-–]+|[\s,;:.\-–]+$/g, '').replace(/\b(?:due|by|on)\s*$/i, '').trim().slice(0, 140);
}

/** the words of a new task -> { text, due, pri, est, bucket }. `bucket` is the default place. Pure given `now`. */
export function parseTask(body, now = new Date(), bucket = 'next') {
  let rest = String(body || '').trim(), b = BUCKETS.includes(bucket) ? bucket : 'next';
  let m = /^waiting[\s-]*(?:for|on)\s*[:,-]?\s*(.+)$/i.exec(rest); if (m) { b = 'waiting'; rest = m[1]; }
  else if ((m = /^(?:someday|maybe)(?:[\s/-]*maybe)?\s*[:,-]?\s*(.+)$/i.exec(rest))) { b = 'someday'; rest = m[1]; }
  const p = takePriority(rest); rest = p.rest;
  const e = takeEstimate(rest); rest = e.rest;
  const d = findDay(rest, now, 'future'); let due = null;
  if (d) { due = d.iso; rest = d.rest; }
  return { text: tidyText(rest), due, pri: p.pri, est: e.est, bucket: b };
}

/** a stored task, whatever it held: nothing else survives the mount. Pure. */
export function cleanTask(t) {
  if (!t || typeof t !== 'object') return null;
  const text = String(t.text || '').trim().slice(0, 140);
  if (!text) return null;
  return { id: String(t.id || uid()), text, due: /^\d{4}-\d{2}-\d{2}$/.test(t.due || '') ? t.due : null, pri: PRI_RANK[t.pri] < 3 ? t.pri : '', est: Math.min(1440, Math.max(0, Math.round(+t.est || 0))),
    bucket: BUCKETS.includes(t.bucket) ? t.bucket : 'next', done: /^\d{4}-\d{2}-\d{2}$/.test(t.done || '') ? t.done : null };
}

/** add a parsed task to the list (newest first kept to MAX_TASKS); the task, or null when it has no words. Mutates `tasks`. */
export function addTask(tasks, parsed) {
  const t = cleanTask({ ...parsed, id: uid(), done: null });
  if (!t) return null;
  tasks.push(t);
  if (tasks.length > MAX_TASKS) { const i = tasks.findIndex((x) => x.done); tasks.splice(i >= 0 ? i : 0, 1); }
  return t;
}

/** the open task a few words name: the exact words first, then the one that starts with them, then one that holds all of them. Pure. */
export function findTask(tasks, query, open = true) {
  const q = String(query || '').toLowerCase().replace(/[.!?]+$/, '').trim();
  if (!q) return null;
  const pool = (tasks || []).filter((t) => (open ? !t.done : !!t.done));
  const words = q.split(/\s+/);
  return pool.find((t) => t.text.toLowerCase() === q) || pool.find((t) => t.text.toLowerCase().startsWith(q))
    || pool.find((t) => words.every((w) => t.text.toLowerCase().includes(w))) || null;
}

/** finish a task on `today` (it moves to the done archive); the task or null. Mutates. */
export function completeTask(tasks, query, today) {
  const t = findTask(tasks, query, true);
  if (t) t.done = today;
  return t;
}
/** undo a finish. */
export function restoreTask(t) { if (t) t.done = null; return t; }
/** move to another place ("today" is next, due today); the task or null. Mutates. */
export function moveTask(tasks, query, to, today) {
  const t = findTask(tasks, query, true);
  if (!t) return null;
  if (to === 'today') { t.bucket = 'next'; t.due = today; } else if (BUCKETS.includes(to)) t.bucket = to;
  return t;
}
/** drop the done tasks; how many went. Mutates. */
export function clearDone(tasks) {
  let n = 0;
  for (let i = tasks.length - 1; i >= 0; i--) if (tasks[i].done) { tasks.splice(i, 1); n++; }
  return n;
}

/** open, dated before today, and not parked in someday. Pure. */
export const isOverdue = (t, today) => !t.done && t.bucket !== 'someday' && !!t.due && t.due < today;

const byUrgency = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || PRI_RANK[a.pri] - PRI_RANK[b.pri] || a.text.localeCompare(b.text);

/** the tasks of a tab, in the order the card shows them. Pure.
 *  today: next-list tasks due today or earlier (overdue first); all: every open next-list task, overdue then by day; waiting; someday; done: newest first. */
export function view(tasks, tab, today) {
  const list = (tasks || []).filter(Boolean);
  if (tab === 'done') return list.filter((t) => t.done).sort((a, b) => b.done.localeCompare(a.done));
  const open = list.filter((t) => !t.done);
  if (tab === 'waiting') return open.filter((t) => t.bucket === 'waiting').sort(byUrgency);
  if (tab === 'someday') return open.filter((t) => t.bucket === 'someday').sort(byUrgency);
  const next = open.filter((t) => t.bucket === 'next');
  if (tab === 'today') return next.filter((t) => t.due && t.due <= today).sort(byUrgency);
  return next.sort(byUrgency);
}

/** how many tasks each tab holds, the overdue count, and the minutes the Today stack still asks for. Pure. */
export function counts(tasks, today) {
  const c = {};
  for (const tab of ['today', 'all', 'waiting', 'someday', 'done']) c[tab] = view(tasks, tab, today).length;
  c.overdue = (tasks || []).filter((t) => isOverdue(t, today)).length;
  c.todayMinutes = view(tasks, 'today', today).reduce((s, t) => s + (t.est || 0), 0);
  return c;
}

/** a due day in a few words: "today", "tomorrow", "3 days overdue", "Fri", "10/25". Pure. */
export function dueText(due, today) {
  if (!due) return '';
  const d = daysBetween(today, due);
  if (d === 0) return 'today';
  if (d === 1) return 'tomorrow';
  if (d === -1) return '1 day overdue';
  if (d < 0) return -d + ' days overdue';
  if (d < 7) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][weekdayOf(due)];
  return due.slice(5).replace('-', '/');
}
