/**
 * kanban-board skill - "kanban board", "make a kanban board", "free kanban board", "kanban": a card that opens /kanban/, the boards kept on this device
 * (owner, 2026-10-26: the Kanban floor of Versus). "Task board" and "my tasks" stay with skills/task-board.js. The board itself is lib/kanban.js and lib/kanban-ui.js.
 */
import { KANBAN_ASK } from '../lib/tool-sites.js';

function run(text, api) {
  const { showPage } = api, de = /\b(?:deutsch|german)\b/i.test(text);
  showPage((el) => {
    const d = el.ownerDocument, h = (tag, props = {}, ...kids) => { const e = d.createElement(tag); Object.assign(e, props); e.append(...kids); return e; };
    const go = h('a', { href: '/kanban/' + (de ? '?lang=de' : ''), className: 'vc-page' }, 'Open the kanban board →'); go.style.cssText = 'display:inline-block;margin:10px 0;padding:10px 18px;border-radius:999px;background:#6d4aff;color:#fff;font-weight:600;text-decoration:none';
    el.replaceChildren(h('h2', {}, 'Kanban board'), h('p', {}, 'Columns and cards you drag or move with the keyboard, with labels, due dates, checklists, comments, WIP limits, swimlanes, a timer, archive, search and export. Kept on this device: no account, works offline, English and German.'), go, h('div', { className: 'src' }, 'Source: the kanban page on this site · as of 2026-10'));
  });
  return 'kanban-board';
}

export default {
  name: 'kanban-board',
  examples: ['kanban board', 'make a kanban board', 'free kanban board', 'kanban', 'start a kanban board', 'online kanban'],
  nearMisses: ['task board', 'my tasks', 'kanban meaning', 'what is kanban', 'toyota kanban history'],
  match(lower) { return (String(lower).trim().startsWith('free ') ? KANBAN_ASK.test(String(lower).trim().replace(/^free /, '')) : KANBAN_ASK.test(String(lower).trim())); },
  run,
};
