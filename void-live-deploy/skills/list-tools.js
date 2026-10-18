/**
 * list-tools skill — the list and table transforms (owner, 2026-10-18: "1000 more simple things", tools pack 10, items 282-331;
 * 281 "add a list item" and 331 "empty placeholder" were already skills/list.js). One skill, many asks, driven by the table of
 * operations in lib/list-ops.js: "check all on the list", "remove checked items from the list", "invert the checks", "move milk up",
 * "indent milk under bread", "sort the list", "number the list", "dedupe the list ignoring case", "first 3 of the list",
 * "pick 2 random from the list", "assign the list to Ann, Bob", "split the list into groups of 3", "show the list in 2 columns",
 * "show the list as a tag cloud", "merge the lists", "turn the list into a table"; and for a data table (a stage card of its own):
 * "csv to table: a,b // 1,2", "data table with columns name, age", "add a column", "sum of column 2", "sort the table by column 2
 * descending", "transpose the table", "freeze the header", "zebra stripe the table", "pivot count of column 1", "export the table
 * as markdown". The new cards (groups, pairs, samples, merges) are new; the list you asked about is not changed by them.
 * A list asked about must be on the stage; an ask that names "the list" or "the table" is the only kind a list op answers, so a
 * plain "sort" or "move the clock up" stays with whoever had it. Device-local; nothing is sent anywhere.
 */
import { addThing, cardEl, keepOut } from '../lib/stage-pack.js';
import { parseOp, parseTableCreate, runOp } from '../lib/list-ops.js';
import { find as findList, normalizeItems } from './list.js';

const TABLE_KIND = 'datatable';
const listsOf = (stageApi) => Object.values(stageApi.things()).filter((t) => t && t.kind === 'list');
const tableOf = (stageApi) => {
  const things = stageApi.things(), sel = things[stageApi.selected()];
  return (sel && sel.kind === TABLE_KIND && sel) || Object.values(things).find((t) => t && t.kind === TABLE_KIND) || null;
};

/** the rows of a table card that are on show (all of them unless a filter or "hide empty rows" is on): [{ r, row }] with r the row's place. Pure. */
export function visibleRows(th) {
  const rows = th.rows || [], q = String(th.filter || '').toLowerCase().trim(), out = [];
  rows.forEach((row, r) => {
    if (th.header && r === 0) return;
    if (th.hideEmpty && row.every((c) => String(c).trim() === '')) return;
    if (q && !row.some((c) => String(c).toLowerCase().includes(q))) return;
    out.push({ r, row });
  });
  return out;
}

/** every list/table ask, at the place the skill runs: 'list-tools' when it did something, 'table' for a new table, '' when it is not ours. */
export function ask(lower, text, stageApi) {
  const created = parseTableCreate(text);
  if (created) {
    if (stageApi.snapshot) stageApi.snapshot();
    addThing(stageApi, TABLE_KIND, created);
    stageApi.save(); stageApi.render();
    stageApi.say('a table: tap a cell to type, or say "add a column"');
    return 'table';
  }
  const things = stageApi.things(), sel = things[stageApi.selected()];
  const kinds = new Set(); for (const t of Object.values(things)) if (t && t.kind === 'list') kinds.add('list'); else if (t && t.kind === TABLE_KIND) kinds.add('table');
  const hint = sel && sel.kind === 'list' ? 'list' : sel && sel.kind === TABLE_KIND ? 'table' : null;
  const p = parseOp(text, { hint, kinds });
  if (!p) return '';
  const lists = listsOf(stageApi);
  const pair = ['merge', 'intersect', 'subtract'].includes(p.op.id);
  const th = p.target === 'list' ? (pair ? lists[0] : findList(stageApi)) : tableOf(stageApi);
  if (!th) { stageApi.say(p.target === 'list' ? 'there is no list on the stage: say "make a list" first' : 'there is no table on the stage: say "data table with columns name, age" first'); return 'list-tools'; }
  if (p.target === 'list') th.items = normalizeItems(th.items);
  const r = runOp(p.op, th, p.args, { other: pair ? lists[1] : null, rng: Math.random });
  if (!r) return '';
  if (r.fail) { stageApi.say(r.say); return 'list-tools'; }
  if (stageApi.snapshot) stageApi.snapshot();
  if (r.patch) {
    Object.assign(th, r.patch);
    if (r.patch.rows && !('result' in r.patch)) { th.result = ''; th.exportText = ''; th.exportAs = ''; } // the old sum or export no longer describes the rows
    if (stageApi.select) stageApi.select(th.id);
  }
  if (r.spawn) addThing(stageApi, r.spawn.kind, r.spawn.props);
  stageApi.save(); stageApi.render();
  stageApi.say(r.say);
  return 'list-tools';
}

// ---------- the data table card ----------

const btnCss = 'font:inherit;font-size:12px;padding:2px 10px;border-radius:12px;border:1px solid rgba(255,255,255,.3);background:transparent;color:inherit;cursor:pointer';

function mount(th, stageApi) {
  const { save, render } = stageApi;
  if (!Array.isArray(th.rows)) th.rows = [];
  const el = cardEl(th, stageApi, 'datatable-card');
  const head = document.createElement('div');
  head.style.cssText = 'display:flex;gap:8px;align-items:baseline;margin-bottom:6px';
  const title = keepOut(document.createElement('span'));
  title.className = 'dt-title'; title.contentEditable = 'true'; title.spellcheck = false; title.style.cssText = 'font-weight:700;min-width:40px;outline:none';
  title.textContent = th.title || 'Table';
  title.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); title.blur(); } });
  title.addEventListener('input', () => { th.title = title.textContent || ''; save(); });
  const width = Math.max(0, ...th.rows.map((r) => r.length)), vis = visibleRows(th);
  const badge = document.createElement('span');
  badge.className = 'dt-count'; badge.style.cssText = 'font-size:12px;opacity:.7';
  const bodyCount = th.rows.length - (th.header && th.rows.length ? 1 : 0);
  badge.textContent = bodyCount + ' row' + (bodyCount === 1 ? '' : 's') + ' × ' + width + ' column' + (width === 1 ? '' : 's') + (vis.length !== bodyCount ? ' · showing ' + vis.length : '');
  head.append(title, badge);
  el.appendChild(head);

  const wrap = document.createElement('div');
  wrap.className = 'dt-wrap';
  wrap.style.cssText = th.freeze ? 'max-height:200px;overflow:auto' : 'overflow:auto;max-height:70vh';
  const table = document.createElement('table');
  table.className = 'dt'; table.style.cssText = 'border-collapse:collapse;font-size:13px';
  const cell = (tag, r, c, bg) => {
    const td = document.createElement(tag);
    td.style.cssText = 'border:1px solid rgba(255,255,255,.14);padding:0' + (bg ? ';background:' + bg : '');
    if (tag === 'th' && th.freeze) td.style.cssText += ';position:sticky;top:0;z-index:1;background:#2a2a3c';
    const i = keepOut(document.createElement('input'));
    i.className = 'dt-cell'; i.value = (th.rows[r] && th.rows[r][c]) || ''; i.dataset.r = String(r); i.dataset.c = String(c);
    i.setAttribute('aria-label', (th.header && th.rows[0] && r > 0 && th.rows[0][c] ? th.rows[0][c] + ', ' : '') + 'row ' + (r + 1) + ' column ' + (c + 1));
    i.style.cssText = 'font:inherit;width:' + (tag === 'th' ? 92 : 84) + 'px;background:transparent;color:inherit;border:0;padding:3px 6px;' + (tag === 'th' ? 'font-weight:700' : '');
    i.addEventListener('input', () => { th.rows[r][c] = i.value; th.result = ''; save(); });
    td.appendChild(i);
    return td;
  };
  if (th.header && th.rows[0]) {
    const tr = document.createElement('tr');
    for (let c = 0; c < width; c++) tr.appendChild(cell('th', 0, c));
    const thead = document.createElement('thead'); thead.appendChild(tr); table.appendChild(thead);
  }
  const tbody = document.createElement('tbody');
  vis.forEach(({ r }, k) => {
    const tr = document.createElement('tr');
    tr.dataset.row = String(r);
    const bg = th.zebra && k % 2 === 1 ? 'rgba(255,255,255,.07)' : '';
    for (let c = 0; c < width; c++) tr.appendChild(cell('td', r, c, bg));
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);
  el.appendChild(wrap);
  if (!th.rows.length) {
    const empty = document.createElement('div');
    empty.className = 'dt-empty'; empty.style.cssText = 'opacity:.7;padding:6px 2px';
    empty.textContent = 'No rows yet: say "add a column" and "add a row"';
    el.appendChild(empty);
  } else if (!vis.length) {
    const none = document.createElement('div');
    none.className = 'dt-empty'; none.style.cssText = 'opacity:.7;padding:6px 2px';
    none.textContent = th.filter ? 'No row contains "' + th.filter + '": say "show all rows"' : 'Every row is empty or hidden';
    el.appendChild(none);
  }
  if (th.result) {
    const res = document.createElement('div');
    res.className = 'dt-result'; res.style.cssText = 'margin-top:6px;font-size:13px;color:#ffd166';
    res.textContent = th.result;
    el.appendChild(res);
  }
  if (th.exportText) {
    const box = document.createElement('div');
    box.className = 'dt-export'; box.style.cssText = 'margin-top:6px';
    const label = document.createElement('div'); label.style.cssText = 'font-size:12px;opacity:.75'; label.textContent = String(th.exportAs || 'csv').toUpperCase();
    const ta = keepOut(document.createElement('textarea'));
    ta.readOnly = true; ta.value = th.exportText; ta.rows = Math.min(8, th.exportText.split('\n').length + 1);
    ta.style.cssText = 'width:100%;box-sizing:border-box;font:12px/1.4 ui-monospace,monospace;background:rgba(255,255,255,.06);color:inherit;border:1px solid rgba(255,255,255,.18);border-radius:6px';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:6px;margin-top:4px';
    const mk = (txt, fn) => { const b = keepOut(document.createElement('button')); b.type = 'button'; b.textContent = txt; b.style.cssText = btnCss; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); }); row.appendChild(b); };
    mk('Copy', () => { try { navigator.clipboard.writeText(th.exportText).then(() => stageApi.say('copied'), () => { ta.select(); stageApi.say('select and copy'); }); } catch (x) { ta.select(); stageApi.say('select and copy'); } });
    mk('Close', () => { th.exportText = ''; th.exportAs = ''; save(); render(); });
    box.append(label, ta, row);
    el.appendChild(box);
  }
  const bar = document.createElement('div');
  bar.style.cssText = 'margin-top:8px;display:flex;gap:6px;flex-wrap:wrap';
  const addBtn = (label, fn) => { const b = keepOut(document.createElement('button')); b.type = 'button'; b.textContent = label; b.style.cssText = btnCss; b.addEventListener('click', (e) => { e.stopPropagation(); fn(); save(); render(); }); bar.appendChild(b); };
  addBtn('+ row', () => { th.rows.push(new Array(Math.max(1, width)).fill('')); });
  addBtn('+ column', () => { if (width >= 12) return; if (!th.rows.length) th.rows.push(['Column 1']); else th.rows.forEach((r, i) => { while (r.length < width) r.push(''); r.push(i === 0 && th.header ? 'Column ' + (width + 1) : ''); }); });
  el.appendChild(bar);
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}

export default {
  name: 'list-tools',
  examples: ['check all on the list', 'remove checked items from the list', 'sort the list', 'csv to table: name,age // Ann,31', 'sum of column 2', 'transpose the table', 'turn the list into a table'],
  nearMisses: ['sort my photos by date', 'move the clock up', 'what is a hash table', 'how to merge two lists in python', 'make a table'],
  match(lower, text) { const t = text || lower; return !!(parseTableCreate(t) || parseOp(t)); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) ? 'list-tools' : 'none'; },
  stageKinds: { [TABLE_KIND]: { mount, ask } },
  visibleRows,
};
