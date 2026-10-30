/**
 * kanban-ui: the screen of /kanban/ and the pages built for each site of its lane. `mountKanban(root, cfg)` draws the boards in lib/kanban.js with the
 * features cfg.features switches on (boards, WIP limits, swimlanes, labels, due days, checklists, comments, assignees, archive, filter, time and
 * Pomodoro, repeats, print, CSV, Trello import, share by link). Cards move by pointer drag (mouse and touch, from the grip), by HTML5 drag, by
 * Alt+arrow keys on a focused card, and by the Move to menu in the card. Boards are kept on this device (localStorage), nothing is sent anywhere,
 * and the page works offline. English and German (?lang=de, or the browser's language).
 */
import * as K from './kanban.js';

const S = {
  en: { boards: 'Boards', board: 'Board', newBoard: 'Add a board', addColumnBtn: 'Add column', rename: 'Rename', del: 'Delete', addCard: 'Add a card', addCardPh: 'Card title, then Enter', addColumn: 'Add a column', addColumnPh: 'Column name', search: 'Search cards', all: 'All', filter: 'Filter',
    anyLabel: 'Any label', anyDue: 'Any due date', overdue: 'Overdue', today: 'Due today', soon: 'Due soon', noDue: 'No due date', anyone: 'Anyone', group: 'Group', noGroup: 'No grouping', byLabel: 'By label', byPerson: 'By person', export: 'Export', exportJson: 'Export JSON', exportCsv: 'Export CSV', import: 'Import', print: 'Print',
    share: 'Share link', archive: 'Archive', archived: 'Archived cards', restore: 'Restore', none: 'Nothing here yet.', cardTitle: 'Title', notes: 'Notes', labels: 'Labels', due: 'Due date', checklist: 'Checklist', addItem: 'Add an item', comments: 'Comments', addComment: 'Add a comment', assignee: 'Assigned to',
    colour: 'Colour', repeat: 'Repeat when done', noRepeat: 'Never', daily: 'Every day', weekly: 'Every week', monthly: 'Every month', time: 'Time spent', start: 'Start', stop: 'Stop', pomodoro: 'Pomodoro (25 min)', cancel: 'Cancel', close: 'Close', moveTo: 'Move to', archiveCard: 'Archive card', deleteCard: 'Delete card',
    wip: 'WIP limit', wipHint: 'Most cards allowed in this column (0 = no limit)', labelName: 'New label name', addLabel: 'Add label', left: 'Move left', right: 'Move right', template: 'Start from', tBasic: 'To do, Doing, Done', tFlow: 'Backlog, In progress, Review, Done', tWeek: 'This week, Today, Waiting, Done', tEmpty: 'An empty board',
    confirmDel: 'Delete this?', over: 'Over the limit', imported: 'Imported {n} board(s).', copied: 'Link copied. It holds the whole board and is read only by this page.', tooBig: 'This board is too big for a link; use Export instead.', saved: 'Everything is kept on this device.', lang: 'Deutsch',
    ft: { boards: 'several boards', columns: 'columns you can add, rename and move', cards: 'cards with a title and description', labels: 'labels', due: 'due dates', checklist: 'checklists', comments: 'comments', assignee: 'assignees', wip: 'WIP limits', lanes: 'swimlanes', archive: 'an archive', filter: 'search and filter', timer: 'a card timer and Pomodoro', recur: 'repeating cards', print: 'print', colour: 'card colours', csv: 'CSV export', share: 'a share link' },
    h1: 'Drag and drop cards between columns by their grip, or focus a card and press Alt+←, Alt+→, Alt+↑ or Alt+↓: the keyboard works too.', h2: 'What is here: ', h3: 'Export and import JSON', h4: ' (Trello exports too)', h5: '. Kept on this device, no account, works offline.',
    checks: '{d} of {t}', onBoard: '{n} cards', limit: 'limit {n}', cardOpen: 'Open card', moved: 'Moved to {c}', repeated: 'A new copy is waiting in {c}.', oneBoard: 'Boards', untitled: 'Untitled', dueOn: 'due {d}' },
  de: { boards: 'Boards', board: 'Board', newBoard: 'Board hinzufügen', addColumnBtn: 'Spalte hinzufügen', rename: 'Umbenennen', del: 'Löschen', addCard: 'Karte hinzufügen', addCardPh: 'Titel der Karte, dann Enter', addColumn: 'Spalte hinzufügen', addColumnPh: 'Name der Spalte', search: 'Karten suchen', all: 'Alle', filter: 'Filter',
    anyLabel: 'Jedes Label', anyDue: 'Jedes Datum', overdue: 'Überfällig', today: 'Heute fällig', soon: 'Bald fällig', noDue: 'Ohne Datum', anyone: 'Alle', group: 'Gruppieren', noGroup: 'Nicht gruppieren', byLabel: 'Nach Label', byPerson: 'Nach Person', export: 'Exportieren', exportJson: 'JSON exportieren', exportCsv: 'CSV exportieren', import: 'Importieren', print: 'Drucken',
    share: 'Link teilen', archive: 'Archivieren', archived: 'Archivierte Karten', restore: 'Wiederherstellen', none: 'Noch nichts hier.', cardTitle: 'Titel', notes: 'Notizen', labels: 'Labels', due: 'Fällig am', checklist: 'Checkliste', addItem: 'Eintrag hinzufügen', comments: 'Kommentare', addComment: 'Kommentar hinzufügen', assignee: 'Zugewiesen an',
    colour: 'Farbe', repeat: 'Wiederholen, wenn erledigt', noRepeat: 'Nie', daily: 'Jeden Tag', weekly: 'Jede Woche', monthly: 'Jeden Monat', time: 'Verbrachte Zeit', start: 'Start', stop: 'Stopp', pomodoro: 'Pomodoro (25 Min.)', cancel: 'Abbrechen', close: 'Schließen', moveTo: 'Verschieben nach', archiveCard: 'Karte archivieren', deleteCard: 'Karte löschen',
    wip: 'WIP-Limit', wipHint: 'Höchstens so viele Karten in dieser Spalte (0 = kein Limit)', labelName: 'Name des neuen Labels', addLabel: 'Label hinzufügen', left: 'Nach links', right: 'Nach rechts', template: 'Beginnen mit', tBasic: 'Zu tun, In Arbeit, Erledigt', tFlow: 'Backlog, In Arbeit, Prüfung, Erledigt', tWeek: 'Diese Woche, Heute, Wartet, Erledigt', tEmpty: 'Ein leeres Board',
    confirmDel: 'Wirklich löschen?', over: 'Über dem Limit', imported: '{n} Board(s) importiert.', copied: 'Link kopiert. Er enthält das ganze Board und wird nur von dieser Seite gelesen.', tooBig: 'Dieses Board ist für einen Link zu groß; nutze den Export.', saved: 'Alles bleibt auf diesem Gerät.', lang: 'English',
    ft: { boards: 'mehrere Boards', columns: 'Spalten zum Hinzufügen, Umbenennen und Verschieben', cards: 'Karten mit Titel und Beschreibung', labels: 'Labels', due: 'Fälligkeitsdaten', checklist: 'Checklisten', comments: 'Kommentare', assignee: 'Zuständige', wip: 'WIP-Limits', lanes: 'Swimlanes', archive: 'ein Archiv', filter: 'Suche und Filter', timer: 'Karten-Timer und Pomodoro', recur: 'wiederkehrende Karten', print: 'Drucken', colour: 'Kartenfarben', csv: 'CSV-Export', share: 'ein Link zum Teilen' },
    h1: 'Karten per Drag and Drop zwischen Spalten ziehen, am Griff, oder eine Karte fokussieren und Alt+←, Alt+→, Alt+↑ oder Alt+↓ drücken: auch die Tastatur geht.', h2: 'Was es gibt: ', h3: 'JSON exportieren und importieren', h4: ' (auch Trello-Exporte)', h5: '. Bleibt auf diesem Gerät, kein Konto, funktioniert offline.',
    checks: '{d} von {t}', onBoard: '{n} Karten', limit: 'Limit {n}', cardOpen: 'Karte öffnen', moved: 'Verschoben nach {c}', repeated: 'Eine neue Kopie wartet in {c}.', oneBoard: 'Boards', untitled: 'Ohne Titel', dueOn: 'fällig {d}' },
};
export const STRINGS = S;
const KEY = 'a2m.void.kanban.v1', LANG = 'a2m.void.kanban.lang';
const h = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'value' || k === 'checked' || k === 'disabled' || k === 'hidden' || k === 'draggable' || k === 'tabIndex') e[k] = v; else e.setAttribute(k, v); }
  for (const kid of kids.flat()) if (kid != null && kid !== false) e.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return e;
};
const ink = (hex) => { const n = parseInt(hex.slice(1), 16), l = (0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)) / 255; return l > 0.6 ? '#111' : '#fff'; };

export const FEATURES = Object.freeze({
  all: { boards: 1, wip: 1, lanes: 1, labels: 1, due: 1, checklist: 1, comments: 1, assignee: 1, archive: 1, filter: 1, trello: 1, timer: 1, recur: 1, print: 1, csv: 1, share: 1, colour: 1, templates: 1 },
});

export function mountKanban(root, cfg = {}) {
  const F = cfg.features || FEATURES.all;
  let lang = 'en'; try { lang = localStorage.getItem(LANG) || ''; } catch (_) {} const qp = new URLSearchParams(location.search); lang = qp.get('lang') === 'de' || qp.get('lang') === 'en' ? qp.get('lang') : lang || ((navigator.language || '').toLowerCase().startsWith('de') ? 'de' : 'en');
  const t = (k, o = {}) => String((S[lang] && S[lang][k]) || S.en[k] || k).replace(/\{(\w+)\}/g, (_, n) => (o[n] != null ? o[n] : ''));
  let state; try { state = K.mend(localStorage.getItem(KEY)); } catch (_) { state = K.newState(); }
  let filter = { q: '', label: '', due: '', assignee: '' }, group = '', openId = '', toast = '';
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) {} };
  const live = h('p', { class: 'live', role: 'status', 'aria-live': 'polite' });
  const say = (m) => { live.textContent = m; };
  const board = () => K.boardOf(state);

  // a board shared in the link's #b= part joins the boards when asked
  const share = /^#b=([\w-]+)$/.exec(location.hash);
  if (share) { try { const text = decodeURIComponent(escape(atob(share[1].replace(/-/g, '+').replace(/_/g, '/')))); const bs = K.importText(text); for (const b of bs) { state.boards.push(b); state.active = b.id; } save(); say(t('imported', { n: bs.length })); history.replaceState(null, '', location.pathname + location.search); } catch (_) {} }

  const rerender = () => { save(); draw(); };
  function bar() {
    const b = board(), r = h('div', { class: 'bar' });
    if (F.boards) {
      const sel = h('select', { 'aria-label': t('boards'), onchange: (e) => { state.active = e.target.value; rerender(); } }, state.boards.map((x) => h('option', { value: x.id, selected: x.id === b.id }, x.name)));
      const tpl = F.templates ? h('select', { 'aria-label': t('template'), id: 'tpl' }, [['basic', t('tBasic')], ['flow', t('tFlow')], ['week', t('tWeek')], ['empty', t('tEmpty')]].map(([v, x]) => h('option', { value: v }, x))) : null;
      r.append(sel, tpl, h('button', { type: 'button', onclick: () => { const n = prompt(t('newBoard')); if (n && n.trim()) { K.addBoard(state, n, tpl ? tpl.value : 'basic'); rerender(); } } }, '+ ' + t('newBoard')),
        h('button', { type: 'button', onclick: () => { const n = prompt(t('rename'), b.name); if (n) { K.renameBoard(b, n); rerender(); } } }, t('rename')),
        h('button', { type: 'button', disabled: state.boards.length < 2, onclick: () => { if (confirm(t('confirmDel') + ' ' + b.name)) { K.deleteBoard(state, b.id); rerender(); } } }, t('del')));
    } else r.append(h('h2', { class: 'bname' }, b.name));
    r.append(h('button', { type: 'button', class: 'addcolbtn', onclick: () => { const n = prompt(t('addColumnPh')); if (n && n.trim()) { K.addColumn(b, n); rerender(); } } }, '+ ' + t('addColumnBtn')));
    return r;
  }
  function filters() {
    const b = board(); if (!F.filter) return null;
    const upd = () => draw(true);
    const q = h('input', { type: 'search', placeholder: t('search'), 'aria-label': t('search'), value: filter.q, oninput: (e) => { filter.q = e.target.value; upd(); } });
    const row = h('div', { class: 'bar filters', role: 'search' }, q);
    if (F.labels) row.append(h('select', { 'aria-label': t('anyLabel'), onchange: (e) => { filter.label = e.target.value; upd(); } }, h('option', { value: '' }, t('anyLabel')), b.labels.map((l) => h('option', { value: l.id, selected: filter.label === l.id }, l.name || l.color))));
    if (F.due) row.append(h('select', { 'aria-label': t('anyDue'), onchange: (e) => { filter.due = e.target.value; upd(); } }, [['', t('anyDue')], ['overdue', t('overdue')], ['today', t('today')], ['soon', t('soon')], ['none', t('noDue')]].map(([v, x]) => h('option', { value: v, selected: filter.due === v }, x))));
    if (F.lanes) row.append(h('select', { 'aria-label': t('group'), onchange: (e) => { group = e.target.value; draw(true); } }, [['', t('noGroup')], ['label', t('byLabel')], ['assignee', t('byPerson')]].map(([v, x]) => h('option', { value: v, selected: group === v }, x))));
    return row;
  }
  function tools() {
    const b = board(), r = h('div', { class: 'bar tools' });
    r.append(h('button', { type: 'button', onclick: () => download(b.name + '.json', K.exportJSON(state, b.id), 'application/json') }, t('exportJson')));
    if (F.csv) r.append(h('button', { type: 'button', onclick: () => download(b.name + '.csv', K.exportCSV(b), 'text/csv') }, t('exportCsv')));
    const file = h('input', { type: 'file', accept: '.json,application/json', hidden: true, 'aria-label': t('import'), onchange: async (e) => { const f = e.target.files[0]; if (!f) return; try { const bs = K.importText(await f.text()); for (const x of bs) { state.boards.push(x); state.active = x.id; } if (!F.boards) state.boards = state.boards.slice(-1); rerender(); say(t('imported', { n: bs.length })); } catch (err) { say(err.message); } e.target.value = ''; } });
    r.append(h('button', { type: 'button', onclick: () => file.click() }, t('import')), file);
    if (F.share) r.append(h('button', { type: 'button', onclick: async () => { const text = K.exportJSON(state, b.id), enc = btoa(unescape(encodeURIComponent(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); if (enc.length > 6000) { say(t('tooBig')); return; } const url = location.origin + location.pathname + '#b=' + enc; try { await navigator.clipboard.writeText(url); say(t('copied')); } catch (_) { prompt(t('share'), url); } } }, t('share')));
    if (F.print) r.append(h('button', { type: 'button', onclick: () => window.print() }, t('print')));
    r.append(h('button', { type: 'button', class: 'lang', onclick: () => { lang = lang === 'en' ? 'de' : 'en'; try { localStorage.setItem(LANG, lang); } catch (_) {} document.documentElement.lang = lang; draw(); } }, t('lang')));
    return r;
  }
  function download(name, text, type) { const url = URL.createObjectURL(new Blob([text], { type })), a = h('a', { href: url, download: name.replace(/[^\w.-]+/g, '-') }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000); }

  // ---- cards ----
  function cardEl(card, col) {
    const b = board(), st = K.dueState(card), p = K.checkProgress(card), names = new Map(b.labels.map((l) => [l.id, l])), todo = col === b.columns[0];
    const badges = [];
    if (F.due && card.due) badges.push(h('span', { class: 'badge due ' + st, title: t('dueOn', { d: card.due }) }, '⏰ ' + card.due));
    if (F.checklist && p.total) badges.push(h('span', { class: 'badge' + (p.done === p.total ? ' ok' : '') }, '☑ ' + t('checks', { d: p.done, t: p.total })));
    if (F.comments && card.comments.length) badges.push(h('span', { class: 'badge' }, '💬 ' + card.comments.length));
    if (F.assignee && card.assignee) badges.push(h('span', { class: 'badge who' }, '👤 ' + card.assignee));
    if (F.timer && card.timeSec) badges.push(h('span', { class: 'badge' }, '⏱ ' + K.clock(card.timeSec)));
    if (F.recur && card.recur) badges.push(h('span', { class: 'badge' }, '↻'));
    const li = h('li', { class: 'card' + (card.id === openId ? ' open' : ''), tabIndex: 0, draggable: true, 'data-id': card.id, 'aria-label': card.title + (card.due && F.due ? ', ' + t('dueOn', { d: card.due }) : '') + ', ' + col.name, style: card.color && F.colour ? 'border-left:6px solid ' + card.color : null },
      F.labels && card.labels.length ? h('div', { class: 'dots' }, card.labels.map((id) => names.get(id)).filter(Boolean).map((l) => h('span', { class: 'dot', style: 'background:' + l.color + ';color:' + ink(l.color), title: l.name }, l.name))) : null,
      h('div', { class: 'ctitle' }, h('button', { type: 'button', class: 'grip', 'aria-hidden': 'true', tabIndex: -1, title: 'Drag' }, '⋮⋮'), h('span', {}, card.title)), badges.length ? h('div', { class: 'badges' }, badges) : null);
    li.addEventListener('click', (e) => { if (!e.target.closest('.grip')) openCard(card.id); });
    li.addEventListener('keydown', (e) => {
      if (e.target !== li) return;
      const dir = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
      if (e.altKey && dir) { e.preventDefault(); const r = K.moveCardBy(b, card.id, dir); if (r.ok) { finishMove(card, r); rerender(); focusCard(card.id); } return; }
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openCard(card.id); }
    });
    li.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', card.id); e.dataTransfer.effectAllowed = 'move'; li.classList.add('dragging'); });
    li.addEventListener('dragend', () => { li.classList.remove('dragging'); document.querySelectorAll('.dropping').forEach((x) => x.classList.remove('dropping')); });
    grip(li, card);
    return li;
  }
  function focusCard(id) { const el = root.querySelector('.card[data-id="' + id + '"]'); if (el) el.focus(); }
  function finishMove(card, r) {
    const at = K.findCard(board(), card.id); if (r.over) say(t('over') + ': ' + at.col.name);
    if (r.done && card.recur) { const k = K.repeatIfDone(board(), card); if (k) say(t('repeated', { c: board().columns[0].name })); }
  }
  // pointer drag from the grip: works with a finger as well as a mouse
  function grip(li, card) {
    const g = li.querySelector('.grip'); let ghost = null, over = null;
    g.style.touchAction = 'none';
    g.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') return; // a mouse uses the browser's own drag
      e.preventDefault(); g.setPointerCapture(e.pointerId); const rc = li.getBoundingClientRect();
      ghost = li.cloneNode(true); ghost.classList.add('ghost'); ghost.style.cssText = 'position:fixed;z-index:50;pointer-events:none;width:' + rc.width + 'px;left:' + rc.left + 'px;top:' + rc.top + 'px;opacity:.9'; document.body.append(ghost); li.classList.add('dragging');
      const dx = e.clientX - rc.left, dy = e.clientY - rc.top;
      const move = (ev) => { ghost.style.left = ev.clientX - dx + 'px'; ghost.style.top = ev.clientY - dy + 'px'; const el = document.elementFromPoint(ev.clientX, ev.clientY), target = el && el.closest('[data-col]'); if (over && over !== target) over.classList.remove('dropping'); over = target; if (over) over.classList.add('dropping'); };
      const up = (ev) => { g.removeEventListener('pointermove', move); g.removeEventListener('pointerup', up); g.removeEventListener('pointercancel', up); ghost.remove(); li.classList.remove('dragging'); if (over) { over.classList.remove('dropping'); dropAt(card.id, over, ev.clientY); } over = null; };
      g.addEventListener('pointermove', move); g.addEventListener('pointerup', up); g.addEventListener('pointercancel', up);
    });
  }
  function dropAt(cardId, cell, y) {
    const b = board(), colId = cell.dataset.col, kids = [...cell.querySelectorAll('.card:not(.dragging):not(.ghost)')]; let idx = kids.length;
    for (let i = 0; i < kids.length; i++) { const rc = kids[i].getBoundingClientRect(); if (y < rc.top + rc.height / 2) { idx = i; break; } }
    const col = K.colOf(b, colId), shown = new Set(kids.map((k) => k.dataset.id)); // the index counts hidden (filtered) cards too
    let real = col.cards.length; if (idx < kids.length) real = col.cards.findIndex((k) => k.id === kids[idx].dataset.id); else if (shown.size) real = col.cards.findIndex((k) => k.id === kids[kids.length - 1].dataset.id) + 1;
    const before = K.findCard(b, cardId); if (before && before.col === col && before.i < real) real--;
    const r = K.moveCard(b, cardId, colId, Math.max(0, real)); if (r.ok) { finishMove(before.card, r); say(t('moved', { c: col.name })); rerender(); focusCard(cardId); }
  }
  function cellDrop(el, col) {
    el.addEventListener('dragover', (e) => { e.preventDefault(); el.classList.add('dropping'); }); el.addEventListener('dragleave', () => el.classList.remove('dropping'));
    el.addEventListener('drop', (e) => { e.preventDefault(); el.classList.remove('dropping'); const id = e.dataTransfer.getData('text/plain'); if (id) dropAt(id, el, e.clientY); });
    el.dataset.col = col.id;
  }

  // ---- columns ----
  function colEl(col, cards) {
    const b = board(), i = b.columns.indexOf(col), over = K.overWip(col);
    const head = h('div', { class: 'chead' },
      h('h3', {}, col.name), h('span', { class: 'count' + (over ? ' over' : ''), title: over ? t('over') : '' }, col.cards.length + (F.wip && col.wip ? ' / ' + col.wip : '')),
      h('details', { class: 'cmenu' }, h('summary', { 'aria-label': col.name + ' ⋯' }, '⋯'), h('div', { class: 'menu' },
        h('button', { type: 'button', onclick: () => { const n = prompt(t('rename'), col.name); if (n) { K.renameColumn(b, col.id, n); rerender(); } } }, t('rename')),
        h('button', { type: 'button', disabled: i === 0, onclick: () => { K.moveColumn(b, col.id, -1); rerender(); } }, '← ' + t('left')), h('button', { type: 'button', disabled: i === b.columns.length - 1, onclick: () => { K.moveColumn(b, col.id, 1); rerender(); } }, t('right') + ' →'),
        F.wip ? h('label', { class: 'wipl' }, t('wip'), h('input', { type: 'number', min: 0, max: 999, value: col.wip, 'aria-label': t('wip') + ': ' + col.name, title: t('wipHint'), onchange: (e) => { K.setWip(b, col.id, e.target.value); rerender(); } })) : null,
        h('button', { type: 'button', onclick: () => { if (confirm(t('confirmDel') + ' ' + col.name)) { K.deleteColumn(b, col.id); rerender(); } } }, t('del')))));
    const list = h('ol', { class: 'cards', 'data-col': col.id }, cards.map((k) => cardEl(k, col)));
    cellDrop(list, col);
    const add = h('input', { type: 'text', class: 'addcard', placeholder: '+ ' + t('addCard'), 'aria-label': t('addCard') + ': ' + col.name, maxlength: 200, onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) { K.addCard(b, col.id, e.target.value); rerender(); const nx = root.querySelector('.col[data-cid="' + col.id + '"] .addcard'); if (nx) nx.focus(); } } });
    return h('section', { class: 'col' + (over ? ' wipover' : ''), 'data-cid': col.id, 'aria-label': col.name }, head, list, h('div', { class: 'note addl' }, t('addCard')), add);
  }
  function laneGrid() {
    const b = board(), rows = K.lanes(b, group, filter), grid = h('div', { class: 'lanes' });
    grid.style.setProperty('--n', b.columns.length);
    grid.append(h('div', { class: 'lane-h' }), ...b.columns.map((c) => h('div', { class: 'lane-h' }, c.name)));
    if (!rows.length) grid.append(h('p', { class: 'note' }, t('none')));
    for (const r of rows) { grid.append(h('div', { class: 'lane-name', style: r.color ? 'border-left:6px solid ' + r.color : null }, r.name)); for (const c of b.columns) { const cell = h('ol', { class: 'cards cell' }, r.cells[c.id].map((k) => cardEl(k, c))); cellDrop(cell, c); grid.append(cell); } }
    return grid;
  }

  // ---- the card dialog ----
  let dlg = null, timerStop = null;
  function closeCard() { if (timerStop) timerStop(); if (dlg) { dlg.close(); dlg.remove(); dlg = null; } openId = ''; }
  function openCard(id) {
    const b = board(), at = K.findCard(b, id) || { card: b.archive.find((k) => k.id === id), col: null }; const card = at.card; if (!card) return; if (dlg) closeCard(); openId = id;
    const commit = (patch) => { K.updateCard(card, patch); save(); };
    const dl = h('dialog', { class: 'dlg', 'aria-label': card.title });
    dlg = dl;
    const body = h('div', { class: 'dbody' },
      h('label', { class: 'f' }, h('span', {}, t('cardTitle')), h('input', { type: 'text', value: card.title, maxlength: 200, onchange: (e) => { commit({ title: e.target.value }); draw(true); } })),
      h('label', { class: 'f' }, h('span', {}, t('notes')), h('textarea', { rows: 4, onchange: (e) => commit({ desc: e.target.value }) }, card.desc)));
    if (at.col) body.append(h('label', { class: 'f' }, h('span', {}, t('moveTo')), h('select', { onchange: (e) => { const r = K.moveCard(b, card.id, e.target.value); finishMove(card, r); save(); say(t('moved', { c: K.colOf(b, e.target.value).name })); closeCard(); draw(); } }, b.columns.map((c) => h('option', { value: c.id, selected: c === at.col }, c.name)))));
    if (F.labels) {
      const wrap = h('div', { class: 'f' }, h('span', {}, t('labels'))), chips = h('div', { class: 'chips' });
      const paint = () => { chips.replaceChildren(...b.labels.map((l) => h('button', { type: 'button', class: 'chip' + (card.labels.includes(l.id) ? ' on' : ''), 'aria-pressed': String(card.labels.includes(l.id)), style: 'background:' + l.color + ';color:' + ink(l.color), onclick: () => { K.toggleLabel(card, l.id); save(); paint(); draw(true); } }, l.name || '·')), h('input', { type: 'text', class: 'newlabel', placeholder: t('labelName'), 'aria-label': t('labelName'), onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) { const l = K.addLabel(b, e.target.value); K.toggleLabel(card, l.id); save(); paint(); draw(true); } } })); };
      paint(); wrap.append(chips); body.append(wrap);
    }
    if (F.due) body.append(h('label', { class: 'f' }, h('span', {}, t('due')), h('input', { type: 'date', value: card.due, onchange: (e) => { commit({ due: e.target.value }); draw(true); } })));
    if (F.assignee) body.append(h('label', { class: 'f' }, h('span', {}, t('assignee')), h('input', { type: 'text', value: card.assignee, maxlength: 60, onchange: (e) => { commit({ assignee: e.target.value }); draw(true); } })));
    if (F.colour) body.append(h('label', { class: 'f' }, h('span', {}, t('colour')), h('input', { type: 'color', value: card.color || '#6d4aff', onchange: (e) => { commit({ color: e.target.value }); draw(true); } }), h('button', { type: 'button', onclick: () => { commit({ color: '' }); draw(true); closeCard(); } }, '✕')));
    if (F.recur) body.append(h('label', { class: 'f' }, h('span', {}, t('repeat')), h('select', { onchange: (e) => commit({ recur: e.target.value }) }, [['', t('noRepeat')], ['daily', t('daily')], ['weekly', t('weekly')], ['monthly', t('monthly')]].map(([v, x]) => h('option', { value: v, selected: card.recur === v }, x)))));
    if (F.checklist) {
      const box = h('div', { class: 'f' }, h('span', {}, t('checklist'))), list = h('ul', { class: 'checks' }), bar = h('progress', { max: 100, value: 0, 'aria-label': t('checklist') });
      const paint = () => { const p = K.checkProgress(card); bar.value = p.pct; bar.hidden = !p.total; list.replaceChildren(...card.checklist.map((c) => h('li', {}, h('label', {}, h('input', { type: 'checkbox', checked: c.done, onchange: () => { K.toggleCheck(card, c.id); save(); paint(); draw(true); } }), ' ', h('span', { class: c.done ? 'done' : '' }, c.t)), h('button', { type: 'button', 'aria-label': t('del') + ' ' + c.t, onclick: () => { K.removeCheck(card, c.id); save(); paint(); draw(true); } }, '✕')))); };
      paint(); box.append(bar, list, h('input', { type: 'text', placeholder: t('addItem'), 'aria-label': t('addItem'), onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) { K.addCheck(card, e.target.value); e.target.value = ''; save(); paint(); draw(true); } } })); body.append(box);
    }
    if (F.timer) {
      const out = h('output', { 'aria-live': 'off' }, K.clock(card.timeSec)); let tick = 0, from = 0, pomo = 0;
      const stopAll = (add) => { clearInterval(tick); tick = 0; if (from) { if (add) { const sec = (Date.now() - from) / 1000; K.addTime(card, sec, pomo && sec >= 1490); save(); } from = 0; pomo = 0; } out.textContent = K.clock(card.timeSec); startB.textContent = t('start'); poB.textContent = t('pomodoro'); draw(true); };
      const run = (pm) => { if (from) { stopAll(true); return; } from = Date.now(); pomo = pm; startB.textContent = t('stop'); poB.textContent = pm ? t('cancel') : t('pomodoro'); tick = setInterval(() => { const s = (Date.now() - from) / 1000; if (pomo) { const left = Math.max(0, 1500 - s); out.textContent = K.clock(left); if (left <= 0) stopAll(true); } else out.textContent = K.clock(card.timeSec + s); }, 500); };
      const startB = h('button', { type: 'button', onclick: () => run(0) }, t('start')), poB = h('button', { type: 'button', onclick: () => { if (from && pomo) { stopAll(false); } else if (!from) run(1); } }, t('pomodoro'));
      timerStop = () => stopAll(true); body.append(h('div', { class: 'f' }, h('span', {}, t('time')), h('div', { class: 'row' }, out, startB, poB, card.pomos ? h('span', { class: 'note' }, '🍅 ' + card.pomos) : null)));
    }
    if (F.comments) {
      const box = h('div', { class: 'f' }, h('span', {}, t('comments'))), list = h('ul', { class: 'comments' });
      const paint = () => list.replaceChildren(...card.comments.map((c) => h('li', {}, h('span', { class: 'note' }, new Date(c.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) + ' '), c.t)));
      paint(); box.append(h('input', { type: 'text', placeholder: t('addComment'), 'aria-label': t('addComment'), onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) { K.addComment(card, e.target.value); e.target.value = ''; save(); paint(); draw(true); } } }), list); body.append(box);
    }
    const foot = h('div', { class: 'row dfoot' });
    if (at.col) foot.append(h('button', { type: 'button', onclick: () => { if (F.archive) K.archiveCard(b, card.id); else K.archiveCard(b, card.id) && K.deleteArchived(b, card.id); closeCard(); rerender(); } }, F.archive ? t('archiveCard') : t('deleteCard')));
    if (F.archive && at.col) foot.append(h('button', { type: 'button', onclick: () => { if (confirm(t('confirmDel'))) { K.archiveCard(b, card.id); K.deleteArchived(b, card.id); closeCard(); rerender(); } } }, t('deleteCard')));
    foot.append(h('button', { type: 'button', class: 'go', onclick: closeCard }, t('close')));
    dl.append(body, foot); dl.addEventListener('close', () => { if (dlg === dl) { if (timerStop) timerStop(); dlg = null; openId = ''; focusCard(id); } }); dl.addEventListener('click', (e) => { if (e.target === dl) closeCard(); });
    document.body.append(dl); if (dl.showModal) dl.showModal(); else dl.setAttribute('open', '');
  }

  // ---- the page ----
  const helpText = () => { const ft = S[lang].ft, on = ['boards', 'columns', 'cards', 'labels', 'due', 'checklist', 'comments', 'assignee', 'wip', 'lanes', 'archive', 'filter', 'timer', 'recur', 'print', 'colour', 'csv', 'share'].filter((k) => k === 'columns' || k === 'cards' || F[k]).map((k) => ft[k]); return t('h1') + ' ' + t('h2') + on.join(', ') + '. ' + t('h3') + (F.trello ? t('h4') : '') + t('h5'); };
  const wrap = h('div', { class: 'kb' });
  root.append(wrap, live);
  let drawing = false, again = false;
  function draw(keepScroll) {
    if (drawing) { again = true; return; } // a blur or change fired by replacing the page asks for another draw: do it once this one is done
    drawing = true; try { paint(keepScroll); } finally { drawing = false; } if (again) { again = false; draw(keepScroll); }
  }
  function paint(keepScroll) {
    const ae = document.activeElement, typing = ae && ae.type === 'search' && wrap.contains(ae) ? ae.selectionStart : -1;
    const b = board(), sc = wrap.querySelector('.cols') ? wrap.querySelector('.cols').scrollLeft : 0, fl = !!(F.lanes && group);
    const cols = fl ? laneGrid() : h('div', { class: 'cols' }, ...b.columns.map((c) => colEl(c, c.cards.filter((k) => K.matches(k, filter)))),
      h('section', { class: 'col addcol' }, h('input', { type: 'text', class: 'addcolumn', placeholder: '+ ' + t('addColumn'), 'aria-label': t('addColumn'), maxlength: 60, onkeydown: (e) => { if (e.key === 'Enter' && e.target.value.trim()) { K.addColumn(b, e.target.value); rerender(); const nx = root.querySelector('.addcolumn'); if (nx) nx.focus(); } } })));
    const arch = F.archive ? h('details', { class: 'archive' }, h('summary', {}, t('archived') + ' (' + b.archive.length + ')'), b.archive.length ? h('ul', {}, b.archive.map((k) => h('li', {}, h('span', {}, k.title), ' ', h('button', { type: 'button', onclick: () => { K.restoreCard(b, k.id); rerender(); } }, t('restore')), h('button', { type: 'button', 'aria-label': t('del') + ' ' + k.title, onclick: () => { K.deleteArchived(b, k.id); rerender(); } }, '✕')))) : h('p', { class: 'note' }, t('none'))) : null;
    const st = K.stats(b);
    wrap.replaceChildren(bar(), filters(), tools(), cols, arch, h('p', { class: 'note stat' }, t('onBoard', { n: st.cards }) + (st.overdue && F.due ? ' · ' + t('overdue') + ': ' + st.overdue : '')), h('p', { class: 'note help' }, helpText()), h('p', { class: 'note' }, t('saved')));
    if (keepScroll && sc) { const c = wrap.querySelector('.cols'); if (c) c.scrollLeft = sc; }
    document.documentElement.lang = lang;
    if (typing >= 0) { const q = wrap.querySelector('input[type=search]'); if (q) { q.focus(); q.setSelectionRange(typing, typing); } }
  }
  draw();
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dlg) closeCard(); });
  return { state: () => state, draw };
}
