/**
 * task-board skill — "add task call mum friday high priority 30 min" puts tasks on one card: a Today stack (due today or
 * earlier, overdue ones in red), all next tasks, a Waiting-for list, a Someday/maybe pile and a Done archive. Each task has
 * words, an optional due day, a high/med/low mark and an estimate in minutes; the card totals what the Today stack asks for.
 * Kept with the stage in this browser only, nothing sent anywhere. Asked for by the owner (2026-10-18, items 21 and 23 to 30);
 * the plain checkbox list that saves (item 22) is skills/list.js. The mark-by-words asks need the word "task" so a bare
 * "mark milk done" stays with the list.
 */
import { addThing, cardEl, keepOut, firstOf, localDay, tidy, escHtml } from '../lib/stage-pack.js';
import { parseTask, cleanTask, addTask, completeTask, moveTask, clearDone, restoreTask, findTask, view, counts, isOverdue, dueText, MAX_TASKS } from '../lib/tasks.js';

const TABS = [['today', 'Today'], ['all', 'All'], ['waiting', 'Waiting for'], ['someday', 'Someday'], ['done', 'Done']];
const PRI_MARK = { high: '▲', med: '●', low: '▽' };
const PRI_NAME = { high: 'high priority', med: 'medium priority', low: 'low priority' };

const ADD = /^(?:please\s+)?(?:(?:add|new|make|create)\s+(?:a\s+|an\s+|another\s+|new\s+)?task\s*[:,-]?\s*|task\s*:\s*)(.+)$/i;
const ADD_WAIT = /^(?:please\s+)?(?:add\s+(?:a\s+)?(?:task\s+)?|task\s+)?waiting[\s-]*for\s*[:,-]\s*(.+)$|^(?:please\s+)?add\s+(?:a\s+)?(?:task\s+)?waiting[\s-]*for\s+(.+)$/i;
const ADD_SOME = /^(?:please\s+)?(?:add\s+(?:to\s+)?(?:the\s+|my\s+)?|task\s+)?someday(?:[\s/-]*maybe)?\s*[:,-]\s*(.+)$|^(?:please\s+)?someday[\s/-]+maybe\s+(.+)$/i;
const ADD_SOME_TO = /^(?:please\s+)?add\s+(.+?)\s+to\s+(?:the\s+|my\s+)?someday(?:[\s/-]*maybe)?(?:\s+(?:pile|list))?$/i;
const DONE = [/^(?:please\s+)?(?:done|finish|complete|tick\s+off|check\s+off|cross\s+off)\s+(?:the\s+|my\s+)?task\s+(.+)$/i, /^(?:please\s+)?mark\s+(?:the\s+|my\s+)?task\s+(.+?)\s+(?:as\s+)?(?:done|complete|completed|finished)$/i];
const MOVE = /^(?:please\s+)?move\s+(?:the\s+|my\s+)?task\s+(.+?)\s+to\s+(?:the\s+|my\s+)?(waiting|someday|next|today)(?:[\s-]*(?:for|maybe|list|pile|stack))*$/i;
const REMOVE = /^(?:please\s+)?(?:delete|remove)\s+(?:the\s+|my\s+)?task\s+(.+)$/i;
const CLEAR = /^(?:please\s+)?(?:clear|empty|archive)\s+(?:the\s+|my\s+)?(?:done|finished|completed)\s+tasks(?:\s+(?:away|out))?$/i;
const SHOW = new RegExp('^(?:please\\s+)?(?:(?:show|open|make|start|give|bring\\s+up|display)\\s+(?:me\\s+)?(?:a\\s+|my\\s+|the\\s+)?)?(?:'
  + '(task\\s+(?:board|manager|stack)|task\\s+list|tasks|my\\s+tasks)'
  + '|(today\'?s?\\s+(?:tasks|stack)|tasks?\\s+(?:for\\s+)?today|task\\s+today(?:\\s+stack)?|today\\s+stack)'
  + '|(waiting[\\s-]for\\s+(?:list|pile)|waiting[\\s-]for\\s+tasks|waiting[\\s-]for)'
  + '|(someday[\\s/-]*maybe(?:\\s+(?:pile|list))?|someday\\s+(?:pile|list))'
  + '|((?:done|finished|completed)\\s+tasks|task\\s+archive|done\\s+archive)'
  + ')(?:\\s+please)?$', 'i');

/** what an ask wants of the board: { act, ... } or null. Pure. `board` says a task board is already on the stage (the bare
 *  "waiting for" words only mean the board then). */
export function taskIntent(text, board = false) {
  const t = tidy(text);
  let m;
  if ((m = CLEAR.exec(t))) return { act: 'clear' };
  if ((m = MOVE.exec(t))) return { act: 'move', query: m[1].trim(), to: m[2].toLowerCase() };
  for (const re of DONE) if ((m = re.exec(t))) return { act: 'done', query: m[1].trim() };
  if ((m = REMOVE.exec(t))) return { act: 'remove', query: m[1].trim() };
  if ((m = ADD_WAIT.exec(t))) return { act: 'add', body: m[1] || m[2], bucket: 'waiting' };
  if ((m = ADD_SOME.exec(t))) return { act: 'add', body: m[1] || m[2], bucket: 'someday' };
  if ((m = ADD_SOME_TO.exec(t))) return { act: 'add', body: m[1], bucket: 'someday' };
  if ((m = ADD.exec(t)) && !/^(?:to|on|for)\s/i.test(m[1]) && !/^(?:board|manager|list|stack)$/i.test(m[1].trim())) return { act: 'add', body: m[1], bucket: 'next' };
  if ((m = SHOW.exec(t))) {
    if (m[3] && !board && !/list|pile|tasks/i.test(m[3])) return null; // a bare "waiting for" is not an ask
    return { act: 'show', tab: m[2] ? 'today' : m[3] ? 'waiting' : m[4] ? 'someday' : m[5] ? 'done' : null };
  }
  return null;
}

/** the saved stage holds a task board (so words about it are meant for it). Reads the browser's saved stage. */
export function boardSaved(store) {
  try {
    const bag = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    const saved = JSON.parse((bag && bag.getItem('a2m.void.state.v1')) || '{}');
    return Object.values(saved || {}).some((t) => t && t.kind === 'tasks');
  } catch (_) { return false; }
}

const tasksOf = (th) => { th.tasks = (Array.isArray(th.tasks) ? th.tasks : []).map(cleanTask).filter(Boolean).slice(-MAX_TASKS); return th.tasks; };
const defaultTab = (th, today) => (th.tab && TABS.some((x) => x[0] === th.tab) ? th.tab : (counts(tasksOf(th), today).today ? 'today' : 'all'));

function mount(th, stageApi) {
  const today = localDay(), tasks = tasksOf(th), c = counts(tasks, today), tab = defaultTab(th, today);
  const el = cardEl(th, stageApi, 'task-board');
  el.dataset.tab = tab; el.style.minWidth = 'min(88vw,340px)'; el.style.width = 'min(92vw,420px)';
  const rerender = (focus) => { stageApi.save(); stageApi.render(); if (focus) setTimeout(() => { const i = stageApi.stage.querySelector('.task-board .tb-add'); if (i) i.focus(); }, 0); };
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:6px';
  head.innerHTML = '<b>Tasks</b><span class="tb-sum" style="font-size:12px;opacity:.75">' + escHtml(c.overdue ? c.overdue + ' overdue' : 'nothing overdue') + (c.todayMinutes ? ' · ' + c.todayMinutes + ' min today' : '') + '</span>';
  el.appendChild(head);
  const tabs = document.createElement('div'); tabs.setAttribute('role', 'tablist'); tabs.style.cssText = 'display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px';
  for (const [id, name] of TABS) {
    const b = document.createElement('button'); b.type = 'button'; b.dataset.tab = id; b.setAttribute('role', 'tab'); b.setAttribute('aria-selected', id === tab ? 'true' : 'false');
    b.textContent = name + ' ' + c[id];
    b.style.cssText = 'font:12px system-ui;padding:3px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.22);cursor:pointer;color:#e8e8e8;background:' + (id === tab ? 'rgba(143,180,255,.28)' : 'transparent');
    b.addEventListener('click', (e) => { e.stopPropagation(); th.tab = id; rerender(); });
    tabs.appendChild(keepOut(b));
  }
  el.appendChild(tabs);
  const rows = view(tasks, tab, today), list = document.createElement('div'); list.className = 'tb-list';
  if (!rows.length) {
    const e = document.createElement('div'); e.className = 'tb-empty'; e.style.cssText = 'font-size:13px;opacity:.7;padding:6px 0';
    e.textContent = { today: 'Nothing due today.', all: 'No tasks yet. Add one below.', waiting: 'Nothing waiting on anyone.', someday: 'The someday pile is empty.', done: 'Nothing finished yet.' }[tab];
    list.appendChild(e);
  }
  for (const t of rows) {
    const od = isOverdue(t, today), row = document.createElement('div');
    row.className = 'tb-task'; row.dataset.task = t.id; row.dataset.overdue = od ? '1' : '0'; if (t.pri) row.dataset.pri = t.pri;
    row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 6px;margin:2px 0;border-radius:8px;border-left:3px solid ' + (od ? '#ff6b6b' : 'transparent') + ';background:' + (od ? 'rgba(255,107,107,.12)' : 'rgba(255,255,255,.04)');
    const cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = !!t.done; cb.setAttribute('aria-label', (t.done ? 'reopen ' : 'finish ') + t.text);
    cb.addEventListener('change', () => { if (t.done) restoreTask(t); else t.done = localDay(); rerender(); });
    const tx = document.createElement('span'); tx.className = 'tb-text'; tx.textContent = t.text; tx.style.cssText = 'flex:1;min-width:0;overflow-wrap:anywhere' + (t.done ? ';text-decoration:line-through;opacity:.6' : '');
    row.append(keepOut(cb), tx);
    const chip = (txt, color, cls, title) => { const s = document.createElement('span'); s.className = cls; s.textContent = txt; if (title) s.title = title; s.style.cssText = 'font-size:11px;padding:1px 6px;border-radius:999px;white-space:nowrap;border:1px solid ' + color + ';color:' + color; row.appendChild(s); };
    if (t.pri) chip(PRI_MARK[t.pri] + ' ' + t.pri, t.pri === 'high' ? '#ff9f6b' : t.pri === 'med' ? '#ffd166' : '#8fb4ff', 'tb-pri', PRI_NAME[t.pri]);
    if (t.due && !t.done) chip(dueText(t.due, today), od ? '#ff6b6b' : '#b8b8c8', 'tb-due', 'due ' + t.due);
    if (t.est) chip(t.est + ' min', '#b8b8c8', 'tb-est', 'estimate');
    if (t.done) chip('done ' + t.done.slice(5).replace('-', '/'), '#78dc96', 'tb-donedate');
    if (!t.done) {
      const sel = document.createElement('select'); sel.setAttribute('aria-label', 'place of ' + t.text); sel.style.cssText = 'font:11px system-ui;max-width:78px;background:transparent;color:#e8e8e8;border:1px solid rgba(255,255,255,.22);border-radius:6px';
      for (const [v, n] of [['next', 'Next'], ['waiting', 'Waiting'], ['someday', 'Someday']]) { const o = document.createElement('option'); o.value = v; o.textContent = n; o.style.color = '#111'; if (t.bucket === v) o.selected = true; sel.appendChild(o); }
      sel.addEventListener('change', () => { t.bucket = sel.value; rerender(); });
      row.appendChild(keepOut(sel));
    }
    const x = document.createElement('button'); x.type = 'button'; x.textContent = '×'; x.setAttribute('aria-label', 'delete ' + t.text); x.style.cssText = 'all:unset;cursor:pointer;opacity:.6;padding:0 4px;font-size:16px';
    x.addEventListener('click', (e) => { e.stopPropagation(); const i = th.tasks.indexOf(t); if (i >= 0) th.tasks.splice(i, 1); rerender(); });
    row.appendChild(keepOut(x));
    list.appendChild(row);
  }
  el.appendChild(list);
  if (tab === 'done' && rows.length) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'tb-clear'; b.textContent = 'Clear done'; b.style.cssText = 'margin-top:6px;font:12px system-ui;padding:3px 10px;border-radius:8px;border:1px solid rgba(255,255,255,.22);background:transparent;color:#e8e8e8;cursor:pointer';
    b.addEventListener('click', (e) => { e.stopPropagation(); clearDone(th.tasks); rerender(); });
    el.appendChild(keepOut(b));
  }
  const form = document.createElement('form'); form.style.cssText = 'display:flex;gap:6px;margin-top:8px';
  const inp = document.createElement('input'); inp.className = 'tb-add'; inp.type = 'text'; inp.maxLength = 160; inp.placeholder = 'call mum friday high 30 min'; inp.setAttribute('aria-label', 'add a task');
  inp.style.cssText = 'flex:1;min-width:0;padding:5px 8px;border-radius:8px;border:1px solid rgba(255,255,255,.22);background:rgba(0,0,0,.25);color:#e8e8e8;font:13px system-ui';
  const go = document.createElement('button'); go.type = 'submit'; go.textContent = 'Add'; go.style.cssText = 'padding:5px 12px;border-radius:8px;border:1px solid rgba(143,180,255,.5);background:rgba(143,180,255,.2);color:#e8e8e8;cursor:pointer';
  form.append(keepOut(inp), keepOut(go));
  form.addEventListener('submit', (e) => {
    e.preventDefault(); e.stopPropagation();
    const p = parseTask(inp.value, new Date(), tab === 'waiting' ? 'waiting' : tab === 'someday' ? 'someday' : 'next');
    if (!p.text || !addTask(th.tasks, p)) return;
    rerender(true);
  });
  el.appendChild(form);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

const board = (stageApi) => firstOf(stageApi, 'tasks') || addThing(stageApi, 'tasks', { tasks: [], tab: '' });

/** the stage kind's ask hook: what happened ('task-added', 'task-done', ...), or '' */
export function ask(lower, text, stageApi) {
  const it = taskIntent(text, !!firstOf(stageApi, 'tasks'));
  if (!it) return '';
  const done = (name) => { stageApi.save(); stageApi.render(); return name; };
  const today = localDay();
  if (it.act === 'show') { const th = board(stageApi); if (it.tab) th.tab = it.tab; else if (!firstOf(stageApi, 'tasks')) th.tab = ''; stageApi.select(th.id); return done('tasks'); }
  const th = board(stageApi), tasks = tasksOf(th);
  stageApi.select(th.id);
  if (it.act === 'add') {
    const p = parseTask(it.body, new Date(), it.bucket);
    if (it.bucket !== 'next') p.bucket = it.bucket;
    const t = p.text && addTask(tasks, p);
    if (!t) return '';
    th.tab = t.bucket === 'waiting' ? 'waiting' : t.bucket === 'someday' ? 'someday' : (t.due && t.due <= today ? 'today' : 'all');
    stageApi.say('task added: ' + t.text + (t.due ? ' · due ' + t.due : '') + (t.pri ? ' · ' + t.pri : '') + (t.est ? ' · ' + t.est + ' min' : ''));
    return done('task-added');
  }
  if (it.act === 'done') { const t = completeTask(tasks, it.query, today); stageApi.say(t ? 'done: ' + t.text : 'no open task like "' + it.query + '"'); return done(t ? 'task-done' : 'task-not-found'); }
  if (it.act === 'move') { const t = moveTask(tasks, it.query, it.to, today); stageApi.say(t ? t.text + ' → ' + it.to : 'no open task like "' + it.query + '"'); return done(t ? 'task-moved' : 'task-not-found'); }
  if (it.act === 'remove') {
    const t = findTask(tasks, it.query, true) || findTask(tasks, it.query, false);
    if (t) tasks.splice(tasks.indexOf(t), 1);
    stageApi.say(t ? 'removed: ' + t.text : 'no task like "' + it.query + '"');
    return done(t ? 'task-removed' : 'task-not-found');
  }
  if (it.act === 'clear') { const n = clearDone(tasks); stageApi.say(n ? n + ' done task' + (n === 1 ? '' : 's') + ' cleared' : 'no done tasks'); return done('tasks-cleared'); }
  return '';
}

export default {
  name: 'task-board',
  examples: ['add task call mum friday high priority 30 min', 'task board', "today's tasks", 'someday: learn piano', 'add waiting for Sam to reply: invoice', 'finish task call mum', 'show the done tasks'],
  nearMisses: ['add milk to my list', 'what is a task force', 'make a todo list', 'mark milk done', 'what is the task manager in windows', 'waiting for godot summary', 'someday we will meet again lyrics', 'set a timer for 5 minutes', 'tasks for a new puppy owner explained'],
  taskIntent,
  match(lower, text) { const t = text || lower; return !!taskIntent(t, boardSaved()); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'task-board' : 'none'; },
  stageKinds: { tasks: { mount, ensure: board, ask } },
};
