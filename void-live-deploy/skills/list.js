/**
 * list skill — the checklist on the stage: "make a list", "list: eggs, milk", "a shopping list with eggs, milk and bread",
 * "add bread to the list", "add milk", "check off milk", "mark milk as done", "remove bread from the list", "clear the list",
 * "remove the list"; "make the list red" edges it through the page's shared colours. The card adds, ticks and removes in
 * place, its title is typed on it, it links what is left to buy to a store's search, and it is Verse's own dark panel (no clipboard;
 * the old 3D clipboard, skills/mini/list.js, no longer mounts beside it). Moved out of void.html in cleanup step 6, the last of the built-ins. The page asks `ask`
 * at the place its list code always ran (`askAt`), and the shared targeting reaches the list through `ensure`.
 * Two bridges (asked by Void, 2026-10-16): drop any stage thing onto the list card and its words become a new entry (the page
 * says 'void:dropped' when a drag sets something down; lib/bridges.js entryFor says what the entry reads); the small "→ note"
 * on every entry copies it as a line into the notepad (skills/notepad.js append).
 * A goal (asked by Void, 2026-10-18, the "density-indicator"): "set a goal of 10 on the list", "goal: 10 items", "aim for 5 on my
 * shopping list", "the list is full at 8" keep a `goal` on the list thing (lib/list-goal.js reads the ask); the head then shows
 * "7 of 10" in mono and a 3px density bar runs under it (violet, amber within one of the goal, a quiet green at or past it), redrawn
 * with every add, tick or removal because the card mounts again on each render. "clear the goal" takes both off; no goal, nothing shows.
 */
import { append as noteAppend } from './notepad.js';
import { goalOf, density } from '../lib/list-goal.js';
import { soundOf } from './soundscape.js'; // "add soft rain" is a sound for the soundscape, not a list item
import { entryFor, itemLine, boxOverlap, plainOf } from '../lib/bridges.js';
import { markerOf, cloudOf, reorder, PRIORITY } from '../lib/list-ops.js';

let dragId = ''; // the item whose grip is being dragged (tools pack 10)
const uid = (prefix) => prefix + '_' + Math.random().toString(36).slice(2, 9);

/** an item's words without the punctuation around them. Pure. */
export const cleanText = (value) => String(value || '').replace(/^[\s,;:]+|[\s,;.!?]+$/g, '').trim();

/** items as { id, text, done }, from strings or stored items; empty ones dropped. */
export function normalizeItems(items) {
  return (Array.isArray(items) ? items : []).map((item) => {
    if (typeof item === 'string') return { id: uid('item'), text: cleanText(item), done: false };
    const kept = {}; // nesting and priority (tools pack 10) survive a clean-up
    if (item && item.depth > 0) kept.depth = Math.min(2, item.depth | 0);
    if (item && item.pri) kept.pri = item.pri;
    return { id: (item && item.id) || uid('item'), text: cleanText(item && item.text), done: !!(item && item.done), ...kept };
  }).filter((item) => item.text);
}

/** the items an ask starts a list with: "list: a, b" or "a shopping list with a, b and c" (texts). Pure. */
export function seedsOf(raw) {
  const match = String(raw || '').match(/\blist\s*:\s*([\s\S]+)/i);
  const plain = !match && String(raw || '').match(/\blist\s+(?:with|containing|including)\s+([\s\S]+)/i);
  if (!match && !plain) return [];
  return (match || plain)[1].split(plain ? /\s*(?:,|\band\b|&|\n)\s*/i : /[,\n]/).map(cleanText).filter(Boolean);
}

/** the ask makes (or opens) a list. Pure. */
export function wantsCreate(lower, raw = lower) {
  const t = String(raw || '').trim();
  // only the ask's own words count, not the items after "list with" / "list:" (a plan's "check it" step is an item, not a tick)
  const head = String(lower || '').split(/\blist\s*(?::|\b(?:with|containing|including)\b)/)[0];
  if (/\b(add\s+item|list\s+add|check|done|complete|remove|delete|clear|empty)\b/.test(head)) return false;
  if (/^list\s*:/i.test(t)) return true;
  if (/^(todo\s+list|list)(\s+please)?\s*[.!]?$/i.test(t)) return true;
  if (/^(?:a\s+)?(?:grocery|groceries|shopping|packing|todo|to-do|chores?)\s+list\s+(?:with|containing|including)\s+\S/i.test(t)) return true;
  if (/^(?:a\s+)?(?:grocery|groceries|shopping|packing|todo|to-do|chores?)\s+list\s*[.!]?$/i.test(t) || /^list\s+(?:groceries|shopping|chores|todos?)\s*[.!]?$/i.test(t)) return true;
  return /\b(make|add|create|show|spawn|put|place|drop|start|open)\s+(a\s+|my\s+|new\s+|a\s+new\s+)?(todo|to-do|grocery|groceries|shopping|packing|chores?)?\s*list\b/.test(lower);
}

/** the item an ask adds ("add item x", "list add x", "add x to the list", "make a list and add x", a bare "add milk"), or ''.
 *  `isThing(words)` says the words name a stage thing ("add a clock" is not an item). Pure given isThing. */
export function addOf(raw, isThing = () => false) {
  const t = String(raw || '');
  let match = t.match(/^\s*add\s+item\s+([\s\S]+?)\s*[.!]?\s*$/i)
    || t.match(/^\s*list\s+add\s+([\s\S]+?)\s*[.!]?\s*$/i)
    || t.match(/^\s*(?:please\s+)?(?:add|put)\s+([\s\S]+?)\s+(?:to|on)\s+(?:the\s+|my\s+)?(?:(?:grocery|groceries|shopping|packing|todo|to-do|chores?)\s+)?list\s*[.!]?\s*$/i)
    || t.match(/^\s*(?:make|create|start)\s+(?:a\s+)?(?:new\s+)?list\s*(?:,|and)?\s+add\s+([\s\S]+?)\s*[.!]?\s*$/i);
  if (match) return cleanText(match[1]);
  // bare "add milk": onto the open list (or a new one), unless it names a stage thing, a look, a number or a link
  match = t.match(/^\s*add\s+([a-z][a-z' -]{0,40}?)\s*[.!]?\s*$/i);
  if (match && !soundOf(t) && !isThing(match[1].toLowerCase()) && !/\b(a|an|another|some|more|the|my|stars?|glow|sparkles?|clock|timer|sticky|note|notepad|list|counter|calc(ulator)?|shape|circle|square|line|image|picture|photo|link|card|item)\b/i.test(match[1])) return cleanText(match[1]);
  return '';
}

/** the item an ask ticks ("check off x", "cross off x on the list", "mark x as done"), or ''. Pure. */
export function checkOf(raw) {
  const t = String(raw || '');
  const match = t.match(/^\s*(?:check(?:\s+off)?|cross\s+off|tick(?:\s+off)?|done|complete)\s+([\s\S]+?)(?:\s+(?:on|from)\s+(?:the\s+|my\s+)?(?:\w+\s+)?list)?\s*[.!]?\s*$/i)
    || t.match(/^\s*mark\s+([\s\S]+?)\s+(?:as\s+)?(?:done|complete|completed|bought|checked)\s*[.!]?\s*$/i);
  return match ? cleanText(match[1]) : '';
}

/** the item an ask takes off ("remove x from the list"), or ''. Pure. */
export function removeOf(raw) {
  const match = String(raw || '').match(/^\s*remove\s+([\s\S]+?)\s+from\s+(?:the\s+)?list\s*[.!]?\s*$/i);
  return match ? cleanText(match[1]) : '';
}

export const wantsRemove = (lower) => /^(remove|delete|get\s+rid\s+of|hide)\s+(the\s+)?list\s*[.!]?$/i.test(lower);
export const wantsClear = (lower) => /^(clear|empty)\s+(the\s+)?list\s*[.!]?$/i.test(lower);

/** the plain asks the skill takes before the page's own parser: a list by itself ("make a list", "list", "todo list").
 *  Seeds, adds and the rest reach `ask` at the page's place, after the asks that come before them. Pure. */
export const plainList = (lower) => /^(?:please\s+)?(?:(?:make|create|start|open)\s+(?:me\s+)?(?:a\s+)?(?:new\s+)?)?(?:todo\s+|to-do\s+)?list(?:\s+please)?\s*[.!]?$/.test(lower);

/** the picked list, or the first */
export function find(stageApi) {
  const things = stageApi.things(), sel = things[stageApi.selected()];
  return (sel && sel.kind === 'list' && sel) || Object.values(things).find((t) => t && t.kind === 'list') || null;
}

/** the list (picked, or the first, or a new one in the middle), with any seeds it does not have yet; picked */
export function ensure(stageApi, seedItems = []) {
  let list = find(stageApi);
  const seeds = normalizeItems(seedItems);
  if (!list) {
    const st = stageApi.stage;
    list = { id: uid('list'), kind: 'list', x: Math.max(40, (st.clientWidth || 800) / 2 - 140), y: Math.max(40, (st.clientHeight || 600) / 2 - 120), title: '', items: seeds };
    stageApi.things()[list.id] = list;
  } else {
    list.items = normalizeItems(list.items);
    seeds.forEach((seed) => { if (!list.items.some((item) => item.text.toLowerCase() === seed.text.toLowerCase())) list.items.push(seed); });
  }
  stageApi.select(list.id);
  return list;
}

const itemNamed = (list, text) => list && list.items.find((item) => item.text.toLowerCase() === text.toLowerCase());

/** every list ask, at the place the page's list code ran: what it did ('no list' and 'list-item-not-found' when there is
 *  nothing to act on), or '' */
export function ask(lower, text, stageApi) {
  const done = (d, list) => { if (list) stageApi.select(list.id); stageApi.save(); stageApi.render(); return d; };
  if (wantsRemove(lower)) {
    const list = find(stageApi);
    if (!list) return 'no list';
    delete stageApi.things()[list.id];
    if (stageApi.selected() === list.id) stageApi.select(null);
    return done('list-removed');
  }
  if (wantsClear(lower)) {
    const list = find(stageApi);
    if (!list) return 'no list';
    list.items = [];
    return done('list-cleared', list);
  }
  // a goal on the list (asked by Void; lib/list-goal.js): kept on the thing, so it survives a reload; a set with no list makes one to count
  const goal = goalOf(text);
  if (goal) {
    if (goal.clear) {
      const list = find(stageApi);
      if (!list) return 'no list';
      delete list.goal;
      stageApi.say('goal cleared');
      return done('list-goal-cleared', list);
    }
    const list = ensure(stageApi);
    list.goal = goal.goal;
    stageApi.say('goal: ' + density(list.items.length, list.goal).label);
    return done('list-goal', list);
  }
  // an ask about a "task" is the task board's (skills/task-board.js: "add task x", "mark task x done"); a list that already holds an item with that word keeps it
  const forBoard = /\btasks?\b/i.test(text) && !((find(stageApi) || { items: [] }).items || []).some((item) => /\btasks?\b/i.test(item && item.text));
  const off = forBoard ? '' : removeOf(text);
  if (off) {
    const list = find(stageApi), item = itemNamed(list, off);
    if (!item) return 'list-item-not-found';
    list.items = list.items.filter((candidate) => candidate.id !== item.id);
    return done('list-item-removed', list);
  }
  const tick = forBoard ? '' : checkOf(text);
  if (tick) {
    const list = find(stageApi), item = itemNamed(list, tick);
    if (!item) return 'list-item-not-found';
    item.done = !item.done;
    return done(item.done ? 'list-item-complete' : 'list-item-uncomplete', list);
  }
  const add = forBoard ? '' : addOf(text, (words) => !!stageApi.targetKind(words));
  if (add) {
    const list = ensure(stageApi);
    if (!itemNamed(list, add)) { list.items.push({ id: uid('item'), text: add, done: false }); return done('list-item-added'); }
    stageApi.say('already on the list');
    return done('list-item-already-exists', list);
  }
  if (wantsCreate(lower, text)) { ensure(stageApi, seedsOf(text)); return done('list'); }
  return '';
}

// the stores "shop this list" links to (owner, 2026-10-11: "should have links to stores ... sams walmart is good start"): one
// search link per item still to buy, at the store picked. Nothing leaves the page until a link is tapped; no cart, no account.
const SHOPS = [['walmart', 'Walmart', (q) => 'https://www.walmart.com/search?q=' + encodeURIComponent(q)],
  ['sams', "Sam's Club", (q) => 'https://www.samsclub.com/s/' + encodeURIComponent(q)]];

const quiet = (el) => { el.addEventListener('pointerdown', (e) => e.stopPropagation()); return el; }; // a control, not a drag
function make(tag, className, props = {}) { const el = document.createElement(tag); if (className) el.className = className; return Object.assign(el, props); }

function mount(th, stageApi) {
  const keep = () => { stageApi.save(); stageApi.render(); };
  const el = make('div', 'thing list-card');
  el.dataset.id = th.id;
  el.style.left = th.x + 'px';
  el.style.top = th.y + 'px';
  if (th.color) el.style.borderColor = th.color;
  if (stageApi.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';

  const title = quiet(make('div', 'list-title', { contentEditable: 'true', spellcheck: false, textContent: th.title || '' }));
  title.dataset.placeholder = 'List';
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
  title.addEventListener('input', () => { th.title = title.textContent || ''; stageApi.save(); });
  const items = Array.isArray(th.items) ? th.items : (th.items = []);
  const head = make('div', 'list-head'); // the title bar: the typed title, and how many are still to do in mono
  // the goal's count ("7 of 10") beside the open/total count, and the density bar under the head: only when a goal is set (asked by Void)
  const dense = density(items.length, th.goal);
  head.appendChild(title);
  if (dense) { const g = make('span', 'list-goal', { textContent: dense.label, title: 'goal: ' + th.goal + ' items' }); g.dataset.state = dense.state; head.appendChild(g); }
  head.appendChild(make('span', 'list-count', { textContent: items.filter((i) => i && !i.done).length + '/' + items.length }));
  el.appendChild(head);
  if (dense) {
    const bar = make('div', 'list-density'); bar.dataset.state = dense.state;
    bar.setAttribute('role', 'progressbar'); bar.setAttribute('aria-label', 'goal'); bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(th.goal)); bar.setAttribute('aria-valuenow', String(items.length)); bar.setAttribute('aria-valuetext', dense.label);
    const fill = make('div', 'list-density-fill'); fill.style.width = Math.round(dense.ratio * 100) + '%';
    bar.appendChild(fill);
    el.appendChild(bar);
  }
  // tools pack 10 (owner, 2026-10-18; lib/list-ops.js, skills/list-tools.js): a count badge, numbered or lettered items, a priority dot,
  // nested sub-items, columns, a tag cloud and drag-to-reorder by the grip. All of it is only drawn when the list carries the setting.
  let host = el, top = 0;
  if (th.view === 'cloud' && items.length) {
    host = make('div', 'list-cloud'); host.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px 10px;align-items:baseline;padding:6px 2px;max-width:320px';
    cloudOf(items).forEach((w) => host.appendChild(make('span', 'list-cloud-word', { textContent: w.word, title: w.count + ' time' + (w.count === 1 ? '' : 's'), style: 'font-size:' + (11 + w.size * 4) + 'px;opacity:' + (0.55 + w.size * 0.09) })));
  } else if (th.cols > 1) { host = make('div', 'list-rows'); host.style.cssText = 'column-count:' + Math.min(4, th.cols) + ';column-gap:14px'; }
  const rowItems = th.view === 'cloud' ? [] : items;
  rowItems.forEach((item) => {
    if (!item || !item.id) return;
    const row = make('div', 'list-entry' + (item.done ? ' done' : ''));
    if (item.depth > 0) row.style.marginLeft = Math.min(2, item.depth) * 18 + 'px';
    if (th.cols > 1) row.style.breakInside = 'avoid';
    const grip = quiet(make('span', 'list-grip', { textContent: '\u22ee\u22ee', title: 'drag to reorder', draggable: true }));
    grip.style.cssText = 'cursor:grab;opacity:.45;font-size:11px;padding:0 3px;user-select:none';
    grip.addEventListener('dragstart', (e) => { dragId = item.id; try { e.dataTransfer.setData('text/plain', item.text || ''); e.dataTransfer.effectAllowed = 'move'; } catch (x) { /* some browsers refuse */ } }); // void-review: ok (dataTransfer can be refused by the browser; the drag still works)
    grip.addEventListener('dragend', () => { dragId = ''; });
    row.addEventListener('dragover', (e) => { if (dragId) e.preventDefault(); });
    row.addEventListener('drop', (e) => { if (!dragId) return; e.preventDefault(); if (stageApi.snapshot) stageApi.snapshot(); th.items = reorder(th.items, dragId, item.id); dragId = ''; keep(); });
    const check = quiet(make('input', '', { type: 'checkbox', checked: !!item.done }));
    check.setAttribute('aria-label', 'complete ' + (item.text || 'item'));
    check.addEventListener('change', () => { item.done = check.checked; keep(); });
    const remove = quiet(make('button', 'list-remove', { type: 'button', textContent: '\u00d7' }));
    remove.setAttribute('aria-label', 'remove ' + (item.text || 'item'));
    remove.addEventListener('click', () => { th.items = th.items.filter((candidate) => candidate.id !== item.id); keep(); });
    const toNote = quiet(make('button', 'list-to-note', { type: 'button', textContent: '\u2192 note', title: 'copy this entry into the notepad' }));
    toNote.setAttribute('aria-label', 'copy ' + (item.text || 'item') + ' to the notepad');
    toNote.style.cssText = 'font:inherit;font-size:10px;padding:0 5px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:transparent;color:inherit;cursor:pointer;opacity:.7';
    toNote.addEventListener('click', () => { noteAppend(stageApi, itemLine(item)); stageApi.say('in the notepad'); });
    if (!(item.depth > 0)) top++;
    const mark = item.depth > 0 ? '\u2013' : markerOf(th.style, top);
    const lead = (mark ? mark + ' ' : '') + (item.pri && PRIORITY[item.pri] ? PRIORITY[item.pri] + ' ' : '');
    row.append(grip, check, make('span', 'list-item-text', { textContent: lead + (item.text || '') }), toNote, remove);
    host.appendChild(row);
  });
  if (host !== el) el.appendChild(host);
  if (!items.length) el.appendChild(make('div', 'list-empty', { textContent: 'No items yet' }));

  const addRow = make('div', 'list-add-row');
  const addInput = quiet(make('input', 'list-add-input', { type: 'text', placeholder: 'Add item' }));
  const addButton = quiet(make('button', 'list-add-button', { type: 'button', textContent: '+' }));
  const addItem = () => { const value = addInput.value.trim(); if (!value) return; th.items.push({ id: uid('item'), text: value, done: false }); keep(); };
  addInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addItem(); });
  addButton.addEventListener('click', addItem);
  addRow.append(addInput, addButton);
  el.appendChild(addRow);

  const toBuy = items.filter((item) => item && !item.done && item.text);
  if (toBuy.length) { // its own labelled group under a divider, apart from the add-item row
    const group = make('div', 'list-shop-group');
    group.setAttribute('role', 'group'); group.setAttribute('aria-label', 'Shop this list');
    const shop = make('div', 'list-shop');
    shop.appendChild(make('span', 'list-shop-label', { textContent: 'Shop this list' }));
    const stores = make('div', 'list-shop-stores');
    const links = make('div', 'list-shop-links');
    SHOPS.forEach(([key, name]) => {
      const b = quiet(make('button', 'list-shop-store', { type: 'button', textContent: name }));
      b.dataset.store = key;
      b.setAttribute('aria-pressed', String(th.shop === key));
      b.addEventListener('click', () => { th.shop = th.shop === key ? '' : key; keep(); });
      stores.appendChild(b);
    });
    shop.appendChild(stores);
    const s = SHOPS.find((x) => x[0] === th.shop);
    if (s) toBuy.forEach((item) => links.appendChild(quiet(make('a', '', { href: s[2](item.text), target: '_blank', rel: 'noopener noreferrer', textContent: item.text + ' at ' + s[1] }))));
    group.append(shop, links);
    el.appendChild(group);
  }
  // no 3D clipboard beside the card any more (owner, 2026-10-18): the card is Verse's own dark panel, and the miniature drew a
  // second faded clipboard in the dead space beside it. skills/mini/list.js stays on the salvage shelf.
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

// drag-and-drop into the list: a thing set down over a list card becomes an entry on it (the thing stays; "undo" takes the entry back)
const boxOf = (root, id) => { const el = root && root.querySelector('[data-id="' + (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(id) : id) + '"]'); return el ? { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth || 1, h: el.offsetHeight || 1 } : null; };
/** the list the dropped thing landed on, or null. Pure given the boxes. */
export function landedOn(things, boxes, id) {
  const me = boxes[id]; if (!me) return null;
  return Object.values(things).find((t) => t && t.kind === 'list' && t.id !== id && boxOverlap(me, boxes[t.id])) || null;
}
let lastStage = null;
export function decorate(st) { if (st && st.things) lastStage = st; } // the page hands its stage here after each draw; the drop below uses it
function onDropped(e) {
  const st = lastStage, id = e && e.detail && e.detail.id;
  if (!st || !id) return;
  const things = st.things(), th = things[id];
  if (!th || th.kind === 'list') return;
  const boxes = {}; for (const t of Object.values(things)) { const b = boxOf(st.stage, t.id); if (b) boxes[t.id] = b; }
  const list = landedOn(things, boxes, id);
  if (!list) return;
  const text = entryFor(th, plainOf(th.html));
  if (!text) return;
  list.items = normalizeItems(list.items);
  if (list.items.some((i) => i.text.toLowerCase() === text.toLowerCase())) { st.say('already on the list'); return; }
  if (st.snapshot) st.snapshot();
  list.items.push({ id: uid('item'), text, done: false });
  st.save(); st.render();
  st.say('added to the list: ' + text);
}
if (typeof document !== 'undefined' && !globalThis.__voidListDrop) { globalThis.__voidListDrop = true; document.addEventListener('void:dropped', onDropped); }

export default {
  name: 'list',
  decorate,
  examples: ['make a list', 'list', 'todo list', 'set a goal of 10 on the list', 'goal: 10 items', 'the list is full at 8', 'clear the goal'],
  nearMisses: ['list my routines', 'add a clock', 'what is a linked list', 'set a goal to run 5k', 'my goals', 'set a 10 minute timer'],
  // the goal asks are claimed here (before the calendar reads "at 8" as a time); every other list ask reaches `ask` at the page's place
  match(lower) { return plainList(lower) || !!goalOf(lower); },
  async run(text, api) { const d = ask(String(text || '').toLowerCase(), text, api.stage); return d && d !== 'no list' && d !== 'list-item-not-found' ? 'list' : 'none'; },
  // askAt: the page asks this kind's ask at its own place, after the calculator and before the notepad, as it always ran
  stageKinds: { list: { mount, ensure: (stageApi) => ensure(stageApi), ask, askAt: 'list' } },
};
