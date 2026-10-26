/**
 * kanban: the data of /kanban/ and the pages built for each site of its lane (owner, 2026-10-26: "everything the sites have", Kanban floor).
 * A state holds boards; a board holds labels, columns (with an optional work-in-progress limit) and an archive; a column holds cards; a card
 * holds a title, notes, labels, a due day, a checklist, comments, an assignee's name, a colour, a repeat, and time spent. Everything here is
 * pure and works on plain objects, so it is tested in node (tools/kanban.test.mjs); lib/kanban-ui.js draws it and keeps it on the device.
 * Import reads this page's own export and a Trello board's JSON export; nothing is fetched.
 */
export const VERSION = 1;
export const LABEL_COLORS = Object.freeze(['#2e9e5b', '#c8a21c', '#d9822b', '#cf4a3c', '#8a5bd1', '#2f7fd1', '#2aa0a8', '#6b7280']);
export const LIMITS = Object.freeze({ boards: 50, columns: 30, cards: 2000, title: 200, notes: 20000 });
export const TEMPLATES = Object.freeze({
  basic: ['To do', 'Doing', 'Done'],
  flow: ['Backlog', 'In progress', 'Review', 'Done'],
  week: ['This week', 'Today', 'Waiting', 'Done'],
  empty: [],
});
const RECUR = ['', 'daily', 'weekly', 'monthly'];

let seq = 0;
/** a short id, random when the browser can, never repeated in a run. Pure enough: only the id differs. */
export function uid() {
  let r = ''; try { const a = new Uint8Array(5); globalThis.crypto.getRandomValues(a); r = [...a].map((b) => b.toString(36).padStart(2, '0')).join(''); } catch (_) { r = Math.random().toString(36).slice(2, 12); }
  return r.slice(0, 8) + (++seq).toString(36);
}
const clip = (s, n) => String(s == null ? '' : s).replace(/\r/g, '').slice(0, n);
const day = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !Number.isNaN(Date.parse(s + 'T00:00:00Z')) ? String(s) : '');
export const todayText = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export function newCard(title, extra = {}) {
  return { id: uid(), title: clip(title, LIMITS.title).trim() || 'Untitled', desc: clip(extra.desc, LIMITS.notes), labels: [...(extra.labels || [])], due: day(extra.due), checklist: (extra.checklist || []).map((c) => ({ id: c.id || uid(), t: clip(c.t, 200), done: !!c.done })),
    comments: (extra.comments || []).map((c) => ({ at: +c.at || 0, t: clip(c.t, 2000) })), assignee: clip(extra.assignee, 60), color: /^#[0-9a-f]{6}$/i.test(extra.color || '') ? extra.color : '', recur: RECUR.includes(extra.recur) ? extra.recur : '', timeSec: Math.max(0, Math.floor(+extra.timeSec || 0)), pomos: Math.max(0, Math.floor(+extra.pomos || 0)), created: +extra.created || Date.now() };
}
export function newBoard(name, template = 'basic') {
  const cols = TEMPLATES[template] || TEMPLATES.basic;
  return { id: uid(), name: clip(name, 80).trim() || 'My board', labels: LABEL_COLORS.slice(0, 6).map((color, i) => ({ id: uid(), name: ['Done well', 'Watch', 'Soon', 'Blocked', 'Idea', 'Info'][i], color })), columns: cols.map((n) => ({ id: uid(), name: n, wip: 0, cards: [] })), archive: [], created: Date.now() };
}
export function newState() { const b = newBoard('My board'); return { v: VERSION, active: b.id, boards: [b] }; }
/** a state read from stored text, mended: unknown shapes become a fresh state, missing fields their defaults. Pure. */
export function mend(raw) {
  let s = raw; if (typeof raw === 'string') { try { s = JSON.parse(raw); } catch (_) { return newState(); } }
  if (!s || !Array.isArray(s.boards) || !s.boards.length) return newState();
  const boards = s.boards.slice(0, LIMITS.boards).map((b) => ({ id: String(b.id || uid()), name: clip(b.name, 80) || 'Board', labels: (b.labels || []).map((l) => ({ id: String(l.id || uid()), name: clip(l.name, 40), color: /^#[0-9a-f]{6}$/i.test(l.color || '') ? l.color : LABEL_COLORS[7] })),
    columns: (b.columns || []).slice(0, LIMITS.columns).map((c) => ({ id: String(c.id || uid()), name: clip(c.name, 60) || 'List', wip: Math.max(0, Math.floor(+c.wip || 0)), cards: (c.cards || []).slice(0, LIMITS.cards).map((k) => ({ ...newCard(k.title, k), id: String(k.id || uid()) })) })),
    archive: (b.archive || []).slice(0, LIMITS.cards).map((k) => ({ ...newCard(k.title, k), id: String(k.id || uid()) })), created: +b.created || Date.now() }));
  return { v: VERSION, active: boards.some((b) => b.id === s.active) ? s.active : boards[0].id, boards };
}
export const boardOf = (state) => state.boards.find((b) => b.id === state.active) || state.boards[0];

export function addBoard(state, name, template) { if (state.boards.length >= LIMITS.boards) return null; const b = newBoard(name, template); state.boards.push(b); state.active = b.id; return b; }
export function deleteBoard(state, id) { if (state.boards.length < 2) return false; state.boards = state.boards.filter((b) => b.id !== id); if (state.active === id) state.active = state.boards[0].id; return true; }
export function renameBoard(board, name) { board.name = clip(name, 80).trim() || board.name; }
export function addColumn(board, name, at) { if (board.columns.length >= LIMITS.columns) return null; const c = { id: uid(), name: clip(name, 60).trim() || 'List', wip: 0, cards: [] }; if (Number.isInteger(at)) board.columns.splice(Math.max(0, Math.min(board.columns.length, at)), 0, c); else board.columns.push(c); return c; }
export const colOf = (board, id) => board.columns.find((c) => c.id === id) || null;
export function renameColumn(board, id, name) { const c = colOf(board, id); if (c) c.name = clip(name, 60).trim() || c.name; }
export function setWip(board, id, n) { const c = colOf(board, id); if (c) c.wip = Math.max(0, Math.min(999, Math.floor(+n || 0))); }
export function moveColumn(board, id, delta) { const i = board.columns.findIndex((c) => c.id === id), j = i + delta; if (i < 0 || j < 0 || j >= board.columns.length) return false; board.columns.splice(j, 0, board.columns.splice(i, 1)[0]); return true; }
/** delete a column; its cards go to the archive, not away */
export function deleteColumn(board, id) { const i = board.columns.findIndex((c) => c.id === id); if (i < 0) return false; board.archive.unshift(...board.columns[i].cards); board.columns.splice(i, 1); return true; }
export function addCard(board, colId, title, extra) { const c = colOf(board, colId); if (!c || !String(title || '').trim()) return null; const k = newCard(title, extra); c.cards.push(k); return k; }
export function findCard(board, id) { for (const col of board.columns) { const i = col.cards.findIndex((k) => k.id === id); if (i >= 0) return { col, i, card: col.cards[i] }; } return null; }
export const overWip = (col) => col.wip > 0 && col.cards.length > col.wip;
/** move a card to a column at an index (the end when none). Returns { ok, over }: over is true when the move leaves the column past its limit. */
export function moveCard(board, id, toColId, toIndex) {
  const at = findCard(board, id), to = colOf(board, toColId); if (!at || !to) return { ok: false, over: false };
  at.col.cards.splice(at.i, 1); const idx = Number.isInteger(toIndex) ? Math.max(0, Math.min(to.cards.length, toIndex)) : to.cards.length; to.cards.splice(idx, 0, at.card);
  return { ok: true, over: overWip(to), done: board.columns[board.columns.length - 1] === to };
}
/** a keyboard step: left/right to the next column (same row where it can), up/down inside the column */
export function moveCardBy(board, id, dir) {
  const at = findCard(board, id); if (!at) return { ok: false };
  const ci = board.columns.indexOf(at.col);
  if (dir === 'up' || dir === 'down') { const j = at.i + (dir === 'up' ? -1 : 1); if (j < 0 || j >= at.col.cards.length) return { ok: false }; return moveCard(board, id, at.col.id, j); }
  const nc = board.columns[ci + (dir === 'left' ? -1 : 1)]; if (!nc) return { ok: false }; return moveCard(board, id, nc.id, Math.min(at.i, nc.cards.length));
}
export function archiveCard(board, id) { const at = findCard(board, id); if (!at) return false; at.col.cards.splice(at.i, 1); board.archive.unshift(at.card); return true; }
export function restoreCard(board, id, colId) { const i = board.archive.findIndex((k) => k.id === id); if (i < 0) return false; const col = colOf(board, colId) || board.columns[0]; if (!col) return false; col.cards.push(board.archive.splice(i, 1)[0]); return true; }
export function deleteArchived(board, id) { const i = board.archive.findIndex((k) => k.id === id); if (i < 0) return false; board.archive.splice(i, 1); return true; }
export function updateCard(card, patch) {
  if ('title' in patch) card.title = clip(patch.title, LIMITS.title).trim() || card.title; if ('desc' in patch) card.desc = clip(patch.desc, LIMITS.notes); if ('due' in patch) card.due = day(patch.due);
  if ('assignee' in patch) card.assignee = clip(patch.assignee, 60); if ('color' in patch) card.color = /^#[0-9a-f]{6}$/i.test(patch.color || '') ? patch.color : ''; if ('recur' in patch && RECUR.includes(patch.recur)) card.recur = patch.recur;
  if ('labels' in patch) card.labels = [...new Set(patch.labels)]; return card;
}
export function toggleLabel(card, labelId) { const i = card.labels.indexOf(labelId); if (i >= 0) card.labels.splice(i, 1); else card.labels.push(labelId); return card.labels.includes(labelId); }
export function addLabel(board, name, color) { const l = { id: uid(), name: clip(name, 40), color: /^#[0-9a-f]{6}$/i.test(color || '') ? color : LABEL_COLORS[board.labels.length % LABEL_COLORS.length] }; board.labels.push(l); return l; }
export function deleteLabel(board, id) { board.labels = board.labels.filter((l) => l.id !== id); for (const c of [...board.columns.flatMap((x) => x.cards), ...board.archive]) c.labels = c.labels.filter((x) => x !== id); }
export function addCheck(card, t) { if (!String(t || '').trim()) return null; const c = { id: uid(), t: clip(t, 200), done: false }; card.checklist.push(c); return c; }
export function toggleCheck(card, id) { const c = card.checklist.find((x) => x.id === id); if (c) c.done = !c.done; return c ? c.done : null; }
export function removeCheck(card, id) { card.checklist = card.checklist.filter((c) => c.id !== id); }
export function checkProgress(card) { const total = card.checklist.length, done = card.checklist.filter((c) => c.done).length; return { done, total, pct: total ? Math.round((done / total) * 100) : 0 }; }
export function addComment(card, t, at = Date.now()) { if (!String(t || '').trim()) return null; const c = { at, t: clip(t, 2000) }; card.comments.unshift(c); return c; }
export function addTime(card, sec, pomo) { card.timeSec += Math.max(0, Math.floor(sec)); if (pomo) card.pomos += 1; return card.timeSec; }
export const clock = (sec) => { const s = Math.max(0, Math.floor(sec)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? h + 'h ' + String(m).padStart(2, '0') + 'm' : m + 'm ' + String(s % 60).padStart(2, '0') + 's'; };
/** overdue, today, soon (the next 2 days) or later; '' with no due day. Pure. */
export function dueState(card, today = todayText()) {
  if (!card.due) return ''; if (card.due < today) return 'overdue'; if (card.due === today) return 'today';
  const t = Date.parse(today + 'T00:00:00Z'), d = Date.parse(card.due + 'T00:00:00Z'); return (d - t) / 86400000 <= 2 ? 'soon' : 'later';
}
/** the day after `due` by a repeat (daily, weekly, monthly), kept on the same day of the month where it exists. Pure. */
export function nextDue(due, recur, from = todayText()) {
  const base = due && due >= from ? due : from, d = new Date(base + 'T00:00:00Z'); if (!recur) return '';
  if (recur === 'daily') d.setUTCDate(d.getUTCDate() + 1); else if (recur === 'weekly') d.setUTCDate(d.getUTCDate() + 7); else { const dom = d.getUTCDate(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() + 1); const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate(); d.setUTCDate(Math.min(dom, last)); }
  return d.toISOString().slice(0, 10);
}
/** a repeating card that reached the last column leaves a fresh copy in the first, due next time; returns that copy or null */
export function repeatIfDone(board, card, today = todayText()) {
  if (!card.recur || board.columns.length < 2) return null; const first = board.columns[0];
  const k = newCard(card.title, { ...card, due: nextDue(card.due, card.recur, today), checklist: card.checklist.map((c) => ({ ...c, id: uid(), done: false })), comments: [], timeSec: 0, pomos: 0 }); first.cards.push(k); return k;
}
/** whether a card passes the filter { q, label, assignee, due: 'overdue'|'today'|'soon'|'none'|'' } */
export function matches(card, f = {}, today = todayText()) {
  const q = String(f.q || '').toLowerCase().trim();
  if (q && !(card.title + ' ' + card.desc + ' ' + card.assignee + ' ' + card.checklist.map((c) => c.t).join(' ') + ' ' + card.comments.map((c) => c.t).join(' ')).toLowerCase().includes(q)) return false;
  if (f.label && !card.labels.includes(f.label)) return false; if (f.assignee && card.assignee.toLowerCase() !== String(f.assignee).toLowerCase()) return false;
  if (f.due === 'none') return !card.due; if (f.due && f.due !== 'none') return dueState(card, today) === f.due;
  return true;
}
/** swimlanes: rows by label ('label') or assignee; each row holds the cards of each column that belong to it; a card with several labels shows in each, one with none in "No label" */
export function lanes(board, by = 'label', f = {}, today = todayText()) {
  const keys = by === 'assignee' ? [...new Set(board.columns.flatMap((c) => c.cards.map((k) => k.assignee)).filter(Boolean))].map((n) => ({ key: n, name: n })) : board.labels.map((l) => ({ key: l.id, name: l.name || 'Label', color: l.color }));
  const rows = [...keys, { key: '', name: by === 'assignee' ? 'Nobody' : 'No label' }].map((r) => ({ ...r, cells: Object.fromEntries(board.columns.map((c) => [c.id, c.cards.filter((k) => matches(k, f, today) && (by === 'assignee' ? k.assignee === r.key : r.key ? k.labels.includes(r.key) : !k.labels.length))])) }));
  return rows.filter((r) => Object.values(r.cells).some((x) => x.length));
}
export function stats(board, today = todayText()) {
  const all = board.columns.flatMap((c) => c.cards), time = all.reduce((s, k) => s + k.timeSec, 0);
  return { cards: all.length, columns: board.columns.map((c) => ({ id: c.id, name: c.name, n: c.cards.length, wip: c.wip, over: overWip(c) })), overdue: all.filter((k) => dueState(k, today) === 'overdue').length, archived: board.archive.length, timeSec: time };
}

// ---- export and import ----
/** one board (or all) as text a person can keep: JSON, one object */
export function exportJSON(state, boardId) {
  const boards = boardId ? state.boards.filter((b) => b.id === boardId) : state.boards;
  return JSON.stringify({ app: 'verse-kanban', v: VERSION, exported: new Date().toISOString(), boards }, null, 2);
}
/** one board as CSV: column, title, labels, due, assignee, checklist done/total */
export function exportCSV(board) {
  const q = (s) => '"' + String(s).replace(/"/g, '""') + '"', names = new Map(board.labels.map((l) => [l.id, l.name])), rows = [['Column', 'Title', 'Labels', 'Due', 'Assignee', 'Checklist', 'Notes'].map(q).join(',')];
  for (const c of board.columns) for (const k of c.cards) { const p = checkProgress(k); rows.push([c.name, k.title, k.labels.map((l) => names.get(l) || '').join('; '), k.due, k.assignee, p.total ? p.done + '/' + p.total : '', k.desc].map(q).join(',')); }
  return rows.join('\n');
}
/** boards from text: this page's export, a state, or a Trello board export (lists, cards, labels, checklists, due dates, closed ones archived). Throws a plain Error on anything else. */
export function importText(text) {
  let j; try { j = JSON.parse(text); } catch (_) { throw new Error('That is not JSON. Choose a file exported from this page or from Trello.'); }
  if (j && Array.isArray(j.boards)) { const s = mend({ boards: j.boards }); return s.boards.map((b) => ({ ...b, id: uid() })); }
  if (j && Array.isArray(j.lists) && Array.isArray(j.cards)) return [fromTrello(j)];
  throw new Error('That file is not a board this page can read (it takes its own export and Trello\'s JSON export).');
}
const TRELLO_COLORS = { green: LABEL_COLORS[0], yellow: LABEL_COLORS[1], orange: LABEL_COLORS[2], red: LABEL_COLORS[3], purple: LABEL_COLORS[4], blue: LABEL_COLORS[5], sky: LABEL_COLORS[6], lime: LABEL_COLORS[0], pink: LABEL_COLORS[4], black: LABEL_COLORS[7] };
export function fromTrello(j) {
  const board = { id: uid(), name: clip(j.name, 80) || 'Imported board', labels: [], columns: [], archive: [], created: Date.now() }, lmap = new Map(), cmap = new Map();
  for (const l of j.labels || []) { if (l.closed) continue; const nl = { id: uid(), name: clip(l.name, 40), color: TRELLO_COLORS[l.color] || LABEL_COLORS[7] }; board.labels.push(nl); lmap.set(l.id, nl.id); }
  for (const list of [...(j.lists || [])].filter((l) => !l.closed).sort((a, b) => (a.pos || 0) - (b.pos || 0))) { const col = { id: uid(), name: clip(list.name, 60) || 'List', wip: 0, cards: [] }; board.columns.push(col); cmap.set(list.id, col); }
  const checks = new Map(); for (const cl of j.checklists || []) checks.set(cl.idCard, [...(checks.get(cl.idCard) || []), ...[...(cl.checkItems || [])].sort((a, b) => (a.pos || 0) - (b.pos || 0)).map((i) => ({ t: i.name, done: i.state === 'complete' }))]);
  const comments = new Map(); for (const a of j.actions || []) if (a.type === 'commentCard' && a.data && a.data.card) comments.set(a.data.card.id, [...(comments.get(a.data.card.id) || []), { at: Date.parse(a.date) || 0, t: (a.data.text || '') }]);
  for (const c of [...j.cards].sort((a, b) => (a.pos || 0) - (b.pos || 0))) {
    const k = newCard(c.name, { desc: c.desc, labels: (c.idLabels || []).map((x) => lmap.get(x)).filter(Boolean), due: c.due ? String(c.due).slice(0, 10) : '', checklist: checks.get(c.id) || [], comments: comments.get(c.id) || [] });
    if (c.closed) board.archive.push(k); else if (cmap.has(c.idList)) cmap.get(c.idList).cards.push(k);
  }
  return board;
}
