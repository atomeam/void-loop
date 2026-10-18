/**
 * date-grid skill — calendar grids you can fill in (tools pack 11, owner 2026-10-18, DATES & CALENDARS 371-379): "empty month grid for
 * november 2026", "empty week grid", "7x5 heatmap", "streak calendar for reading", "timesheet row for this week"; then a tap marks a
 * day (done, then skip, then clear) or "mark 2026-10-18 done" / "skip yesterday" does it by words; "export my dates" shows the marked
 * days as text, "import dates 2026-10-01 done, 2026-10-03 skip" brings them back. Kept with the stage in this browser only, nothing sent.
 * The date math is lib/date-math.js (pure; tested with fixed days in tools/date-pack.test.mjs). The marking-by-words ask is answered by
 * the stage kind's hook, so it only fires when a grid that takes marks is on the stage (marksSavedGrid), like the habit ring's.
 */
import { addThing, cardEl, keepOut, firstOf, localDay, tidy } from '../lib/stage-pack.js';
import * as M from '../lib/date-math.js';

export const MODES = ['month', 'week', 'heat', 'sheet', 'streak'];
const MON = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const MAKE = '^(?:please\\s+)?(?:(?:make|build|create|show|start|give|set\\s+up|add|open)\\s+(?:me\\s+)?)?(?:an?\\s+|my\\s+|the\\s+)?';

/** the first day of the month an ask names ("november 2026", "march", "2026-11", "next month"), else today's. Pure. */
export function anchorOf(phrase, today) {
  const p = tidy(phrase || '').toLowerCase();
  if (!p || p === 'this month' || p === 'now' || p === 'today') return today;
  if (p === 'next month') return M.addMonths(today, 1);
  if (p === 'last month') return M.addMonths(today, -1);
  let m = /^(\d{4})-(\d{2})$/.exec(p);
  if (m && +m[2] >= 1 && +m[2] <= 12) return M.mk(+m[1], +m[2], 1);
  m = new RegExp('^(' + MON + ')(?:\\s+(\\d{4}))?$').exec(p);
  if (m) { const mo = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1].slice(0, 3)) + 1; return M.mk(m[2] ? +m[2] : M.parts(today).y, mo, 1); }
  const d = M.parseDay(p, today);
  return d || today;
}

/** { mode, anchor, label } for a grid ask, or null. Pure. */
export function gridAsk(text, today) {
  const t = tidy(text).toLowerCase();
  let m;
  if ((m = new RegExp(MAKE + '(?:empty\\s+|blank\\s+)?(?:month|monthly)\\s+(?:grid|planner\\s+grid)(?:\\s+(?:for|of)\\s+(.+))?$').exec(t)) || (m = new RegExp(MAKE + '(?:empty|blank)\\s+(?:month|monthly)(?:\\s+(?:grid|calendar|planner))?(?:\\s+(?:for|of)\\s+(.+))?$').exec(t)) || (m = new RegExp(MAKE + 'calendar\\s+grid(?:\\s+(?:for|of)\\s+(.+))?$').exec(t)))
    return { mode: 'month', anchor: anchorOf(m[1], today), label: '' };
  if ((m = new RegExp(MAKE + '(?:empty\\s+|blank\\s+)?(?:week|weekly)\\s+grid(?:\\s+(?:for|of)\\s+(.+))?$').exec(t)) || (m = new RegExp(MAKE + '(?:empty|blank)\\s+(?:week|weekly)(?:\\s+(?:grid|planner))?(?:\\s+(?:for|of)\\s+(.+))?$').exec(t)))
    return { mode: 'week', anchor: m[1] ? (M.parseDay(m[1], today) || today) : today, label: '' };
  if ((m = new RegExp(MAKE + '(?:7\\s*x\\s*5|7\\s+by\\s+5|seven\\s+by\\s+five|five[- ]week)\\s+(?:heat\\s?map|heat\\s?grid|grid)(?:\\s+(?:for|of)\\s+(.+))?$').exec(t)) || (m = new RegExp(MAKE + '(?:heat\\s?map|heat\\s?grid)\\s+(?:7\\s*x\\s*5|7\\s+by\\s+5)(?:\\s+(?:for|of)\\s+(.+))?$').exec(t)) || (m = new RegExp(MAKE + '(?:week|weekly|habit|daily)\\s+heat\\s?map(?:\\s+(?:for|of)\\s+(.+))?$').exec(t)))
    return { mode: 'heat', anchor: today, label: tidy(m[1] || '').slice(0, 40) };
  if ((m = new RegExp(MAKE + '(?:streak\\s+calendar|streak\\s+marks|streak\\s+grid)(?:\\s+(?:for|of)\\s+(.+))?$').exec(t)))
    return { mode: 'streak', anchor: today, label: tidy(m[1] || '').slice(0, 40) };
  if ((m = new RegExp(MAKE + 'timesheet(?:\\s+row)?(?:\\s+for\\s+(?:the\\s+)?(this\\s+week|next\\s+week|last\\s+week|week\\s+of\\s+.+?)|\\s+(this\\s+week|next\\s+week|last\\s+week))?$').exec(t)) || (m = /^(?:this|next|last)\s+week(?:'s)?\s+timesheet(?:\s+row)?$/.exec(t))) {
    const w = (m[1] || m[2] || m[0] || '').replace(/^week of /, ''), fromWord = /^(this|next|last) week/.exec(w);
    const anchor = fromWord ? M.addDays(today, fromWord[1] === 'next' ? 7 : fromWord[1] === 'last' ? -7 : 0) : (M.parseDay(w, today) || today);
    return { mode: 'sheet', anchor, label: '' };
  }
  return null;
}

/** { iso, state: 'done' | 'skip' | 'off' } for "mark today done", "skip yesterday", "mark 2026-10-18 skipped", "unmark today", or null. Pure. */
export function markAsk(text, today) {
  const t = tidy(text).toLowerCase();
  const DAYP = '(\\d{4}-\\d{2}-\\d{2}|today|yesterday|tomorrow|' + MON + '\\s+\\d{1,2}(?:st|nd|rd|th)?(?:\\s+\\d{4})?)';
  let m = new RegExp('^(?:please\\s+)?(un)?mark\\s+' + DAYP + '(?:\\s+(?:as\\s+)?(done|complete|completed|finished|skipped|skip))?(?:\\s+on\\s+(?:the|my)\\s+(?:streak\\s+calendar|month\\s+grid|grid|calendar))?$').exec(t)
    || new RegExp('^(?:please\\s+)?(skip)\\s+' + DAYP + '$').exec(t);
  if (!m) return null;
  if (m[1] === 'skip') { const iso = M.parseDay(m[2], today); return iso ? { iso, state: 'skip' } : null; }
  const iso = M.parseDay(m[2], today);
  if (!iso) return null;
  if (m[1] === 'un') return { iso, state: 'off' };
  return { iso, state: /skip/.test(m[3] || '') ? 'skip' : 'done' };
}
/** the dates after "import dates ...", or null. Pure. */
export function importAsk(text) {
  const m = /^(?:please\s+)?import\s+(?:my\s+)?(?:marked\s+)?dates?\s*:?\s*(.+)$/i.exec(tidy(text));
  if (!m) return null;
  const marks = M.importMarks(m[1]);
  return Object.keys(marks).length ? marks : null;
}
export const exportAsk = (text) => /^(?:please\s+)?(?:export|copy|show)\s+(?:my\s+)?(?:marked\s+)?dates?(?:\s+(?:list|as\s+text))?$/i.test(tidy(text));

const TAKES_MARKS = new Set(['month', 'streak']);
const grids = (stageApi) => Object.values(stageApi.things()).filter((t) => t && t.kind === 'dategrid');
const markable = (stageApi) => grids(stageApi).filter((t) => TAKES_MARKS.has(t.mode));

/** a mark / import / export ask for a grid that is on the saved stage (read from this browser's stage, as the page saves it). With no
 *  grid it says no and the ask goes on as before. */
export function marksSavedGrid(text, store) {
  const asks = markAsk(text, localDay()) || importAsk(text) || exportAsk(text);
  if (!asks) return false;
  try {
    const bag = store || (typeof localStorage !== 'undefined' ? localStorage : null);
    const saved = JSON.parse((bag && bag.getItem('a2m.void.state.v1')) || '{}');
    return Object.values(saved || {}).some((t) => t && t.kind === 'dategrid' && TAKES_MARKS.has(t.mode));
  } catch (_) { return false; }
}

const CYCLE = [undefined, 'done', 'skip'];
const nextMark = (cur) => CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
const HEAT = ['rgba(255,255,255,.06)', 'rgba(120,220,150,.28)', 'rgba(120,220,150,.5)', 'rgba(120,220,150,.75)', 'rgba(120,220,150,1)'];
const el = (tag, css, text) => { const e = document.createElement(tag); if (css) e.style.cssText = css; if (text != null) e.textContent = text; return e; };
const BTN = 'all:unset;cursor:pointer;box-sizing:border-box;min-width:44px;min-height:44px;display:flex;align-items:center;justify-content:center;border-radius:8px;font:13px system-ui,sans-serif;color:#e8e8e8;';

function title(th) {
  const a = th.anchor || localDay(), { y, m } = M.parts(a);
  if (th.mode === 'week' || th.mode === 'sheet') { const s = M.isoWeekStart(a); return 'Week of ' + M.formatDay(s, 'short').replace(/^\w+ /, ''); }
  if (th.mode === 'heat') return (th.label ? th.label + ' · ' : '') + 'last 5 weeks';
  return (th.label ? th.label + ' · ' : '') + M.MONTH_NAMES[m - 1] + ' ' + y;
}

function mount(th, stageApi) {
  const card = cardEl(th, stageApi, 'date-grid');
  card.dataset.mode = th.mode;
  const today = localDay(), anchor = th.anchor || today;
  th.marks = th.marks || {}; th.heat = th.heat || {}; th.notes = th.notes || {}; th.hours = th.hours || [0, 0, 0, 0, 0, 0, 0];
  const redraw = () => { stageApi.save(); stageApi.render(); };
  const head = el('div', 'display:flex;align-items:center;gap:6px;margin-bottom:8px');
  if (th.mode !== 'heat') {
    const prev = el('button', BTN + 'background:rgba(255,255,255,.08);min-width:44px', '‹'); prev.type = 'button'; prev.className = 'dg-prev'; prev.setAttribute('aria-label', 'previous');
    prev.addEventListener('click', (e) => { e.stopPropagation(); th.anchor = th.mode === 'month' || th.mode === 'streak' ? M.addMonths(M.mk(M.parts(anchor).y, M.parts(anchor).m, 1), -1) : M.addDays(anchor, -7); redraw(); });
    head.appendChild(keepOut(prev));
  }
  const ttl = el('div', 'flex:1;text-align:center;font-weight:600', title(th)); ttl.className = 'dg-title'; head.appendChild(ttl);
  if (th.mode !== 'heat') {
    const next = el('button', BTN + 'background:rgba(255,255,255,.08)', '›'); next.type = 'button'; next.className = 'dg-next'; next.setAttribute('aria-label', 'next');
    next.addEventListener('click', (e) => { e.stopPropagation(); th.anchor = th.mode === 'month' || th.mode === 'streak' ? M.addMonths(M.mk(M.parts(anchor).y, M.parts(anchor).m, 1), 1) : M.addDays(anchor, 7); redraw(); });
    head.appendChild(keepOut(next));
  }
  card.appendChild(head);

  const dayHead = () => { const r = el('div', 'display:grid;grid-template-columns:repeat(7,44px);gap:3px;margin-bottom:3px'); for (const n of ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']) r.appendChild(el('div', 'text-align:center;font-size:11px;opacity:.6', n)); return r; };
  const cell = (iso, bg, label) => {
    const b = el('button', BTN + 'background:' + bg + ';' + (iso === today ? 'outline:2px solid #8fb4ff;' : ''), label);
    b.type = 'button'; b.dataset.day = iso; b.className = 'dg-day';
    return keepOut(b);
  };
  if (th.mode === 'month' || th.mode === 'streak') {
    card.appendChild(dayHead());
    const grid = el('div', 'display:grid;grid-template-columns:repeat(7,44px);gap:3px');
    for (const week of M.monthGrid(anchor)) for (const iso of week) {
      if (!iso) { grid.appendChild(el('div', '')); continue; }
      const st = th.marks[iso];
      const b = cell(iso, st === 'done' ? 'rgba(120,220,150,.55)' : st === 'skip' ? 'rgba(255,200,100,.35)' : 'rgba(255,255,255,.06)', String(M.parts(iso).d));
      b.dataset.mark = st || '';
      b.setAttribute('aria-label', M.formatDay(iso, 'long') + ': ' + (st || 'not marked') + '. Tap to change.');
      b.addEventListener('click', (e) => { e.stopPropagation(); th.marks = M.markDay(th.marks, iso, nextMark(th.marks[iso])); redraw(); });
      grid.appendChild(b);
    }
    card.appendChild(grid);
    const info = M.streakInfo(Object.keys(th.marks).filter((d) => th.marks[d] === 'done'), today);
    const done = Object.values(th.marks).filter((v) => v === 'done').length, skipped = Object.values(th.marks).filter((v) => v === 'skip').length;
    const sub = el('div', 'margin-top:8px;font-size:12px;opacity:.75', (th.mode === 'streak' ? 'Streak ' + info.current + ' · best ' + info.best + ' · ' : '') + done + ' done · ' + skipped + ' skipped · tap a day: done, skip, clear'); sub.className = 'dg-info';
    card.appendChild(sub);
    const row = el('div', 'display:flex;gap:6px;margin-top:6px;flex-wrap:wrap');
    const ex = el('button', BTN + 'background:rgba(255,255,255,.08);padding:0 12px', 'export'); ex.type = 'button'; ex.className = 'dg-export-btn';
    ex.addEventListener('click', (e) => { e.stopPropagation(); th.showText = !th.showText; redraw(); });
    row.appendChild(keepOut(ex)); card.appendChild(row);
    if (th.showText) {
      const ta = el('textarea', 'width:100%;box-sizing:border-box;margin-top:6px;min-height:90px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(0,0,0,.3);color:#e8e8e8;font:12px ui-monospace,monospace;padding:6px');
      ta.className = 'dg-text'; ta.value = M.exportMarks(th.marks); ta.setAttribute('aria-label', 'marked dates, one per line; edit and press import');
      const imp = el('button', BTN + 'background:rgba(255,255,255,.08);padding:0 12px;margin-top:6px', 'import'); imp.type = 'button'; imp.className = 'dg-import-btn';
      imp.addEventListener('click', (e) => { e.stopPropagation(); th.marks = M.importMarks(ta.value); redraw(); });
      keepOut(ta); keepOut(imp); card.append(ta, imp);
    }
  } else if (th.mode === 'week') {
    const grid = el('div', 'display:grid;grid-template-columns:repeat(7,minmax(44px,1fr));gap:4px');
    for (const iso of M.weekDays(anchor)) {
      const col = el('div', 'display:flex;flex-direction:column;gap:4px;min-width:44px');
      col.appendChild(el('div', 'text-align:center;font-size:11px;opacity:.7' + (iso === today ? ';color:#8fb4ff' : ''), M.dayName(iso).slice(0, 3) + ' ' + M.parts(iso).d));
      const inp = el('textarea', 'box-sizing:border-box;width:100%;min-height:84px;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#e8e8e8;font:12px system-ui,sans-serif;padding:4px;resize:none');
      inp.dataset.day = iso; inp.className = 'dg-note'; inp.value = th.notes[iso] || ''; inp.setAttribute('aria-label', 'notes for ' + M.formatDay(iso, 'long'));
      inp.addEventListener('input', () => { th.notes[iso] = inp.value.slice(0, 300); stageApi.save(); });
      keepOut(inp); col.appendChild(inp); grid.appendChild(col);
    }
    card.style.maxWidth = 'min(96vw,640px)'; card.appendChild(grid);
  } else if (th.mode === 'heat') {
    card.appendChild(dayHead());
    const grid = el('div', 'display:grid;grid-template-columns:repeat(7,44px);gap:3px');
    for (const week of M.heatGrid(today)) for (const iso of week) {
      const lv = th.heat[iso] || 0, b = cell(iso, HEAT[lv], String(M.parts(iso).d));
      b.dataset.level = String(lv); b.setAttribute('aria-label', M.formatDay(iso, 'long') + ': level ' + lv + ' of 4. Tap to raise.');
      b.addEventListener('click', (e) => { e.stopPropagation(); th.heat[iso] = (lv + 1) % 5; redraw(); });
      grid.appendChild(b);
    }
    card.appendChild(grid);
    const total = Object.values(th.heat).reduce((a, b) => a + b, 0);
    card.appendChild(el('div', 'margin-top:8px;font-size:12px;opacity:.75', '7 by 5: five weeks, Monday first · tap a day to raise it 0 to 4 · total ' + total));
  } else if (th.mode === 'sheet') {
    const row = M.timesheetRow(anchor, th.hours);
    const total = el('div', 'margin-top:8px;font-weight:600', 'Total ' + row.total + ' h'); total.className = 'dg-total';
    const grid = el('div', 'display:grid;grid-template-columns:repeat(7,minmax(44px,1fr));gap:4px');
    row.days.forEach((iso, i) => {
      const col = el('div', 'display:flex;flex-direction:column;gap:4px;align-items:stretch');
      col.appendChild(el('div', 'text-align:center;font-size:11px;opacity:.7', M.dayName(iso).slice(0, 3) + ' ' + M.parts(iso).d));
      const inp = el('input', 'box-sizing:border-box;width:100%;min-height:44px;text-align:center;border-radius:8px;border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.05);color:#e8e8e8;font:14px system-ui,sans-serif');
      inp.type = 'number'; inp.min = '0'; inp.max = '24'; inp.step = '0.25'; inp.value = row.hours[i] ? String(row.hours[i]) : ''; inp.dataset.day = iso; inp.className = 'dg-hours'; inp.setAttribute('aria-label', 'hours on ' + M.formatDay(iso, 'long'));
      inp.addEventListener('input', () => { th.hours[i] = Math.min(24, Math.max(0, +inp.value || 0)); stageApi.save(); const t = M.timesheetRow(anchor, th.hours).total; total.textContent = 'Total ' + t + ' h'; });
      keepOut(inp); col.appendChild(inp); grid.appendChild(col);
    });
    card.style.maxWidth = 'min(96vw,640px)'; card.appendChild(grid);
    card.appendChild(total);
    card.appendChild(el('div', 'font-size:12px;opacity:.7;margin-top:4px', 'Hours only, no rates or amounts · kept in this browser'));
  }
  stageApi.bindDrag(card, th);
  stageApi.stage.appendChild(card);
}

/** the stage kind's ask hook: a new grid, a mark by words, an import, or an export; the name of what happened, or '' */
export function ask(lower, text, stageApi) {
  const today = localDay();
  const g = gridAsk(text, today);
  if (g) {
    addThing(stageApi, 'dategrid', { mode: g.mode, anchor: g.anchor, label: g.label, marks: {}, heat: {}, notes: {}, hours: [0, 0, 0, 0, 0, 0, 0] });
    stageApi.save(); stageApi.render();
    return 'date-grid';
  }
  const mk = markAsk(text, today);
  const imp = importAsk(text);
  const exp = exportAsk(text);
  if (!mk && !imp && !exp) return '';
  let th = markable(stageApi).find((t) => t.id === stageApi.selected()) || markable(stageApi)[0];
  if (!th && imp) th = addThing(stageApi, 'dategrid', { mode: 'streak', anchor: today, label: '', marks: {}, heat: {}, notes: {}, hours: [0, 0, 0, 0, 0, 0, 0] }); // an import with no grid starts a streak calendar
  if (!th) return '';
  th.marks = th.marks || {};
  if (mk) {
    th.marks = M.markDay(th.marks, mk.iso, mk.state === 'off' ? null : mk.state);
    if (mk.state !== 'off') th.anchor = th.anchor && M.startOfMonth(th.anchor) === M.startOfMonth(mk.iso) ? th.anchor : mk.iso;
    stageApi.save(); stageApi.render();
    stageApi.say(M.formatDay(mk.iso, 'short') + (mk.state === 'off' ? ' cleared' : ' marked ' + mk.state));
    return 'date-grid-mark';
  }
  if (imp) { th.marks = { ...th.marks, ...imp }; stageApi.save(); stageApi.render(); stageApi.say(Object.keys(imp).length + ' dates imported'); return 'date-grid-import'; }
  th.showText = true; stageApi.save(); stageApi.render();
  stageApi.say(M.exportMarks(th.marks) ? 'your marked dates are in the box below the grid' : 'no marked dates yet');
  return 'date-grid-export';
}

export default {
  name: 'date-grid',
  examples: ['empty month grid for november 2026', 'empty week grid', '7x5 heatmap', 'streak calendar for reading', 'timesheet row for this week', 'import dates 2026-10-01 done, 2026-10-03 skip'],
  nearMisses: ['what is a heatmap', 'my calendar', 'mark walk done today', 'how do I keep a streak', 'timesheet software for freelancers', 'export my contacts'],
  gridAsk, markAsk, importAsk, exportAsk, marksSavedGrid,
  match(lower, text) { const t = text || lower; return !!gridAsk(t, localDay()) || !!importAsk(t) || marksSavedGrid(t); },
  async run(text, api) { return ask(String(text || '').toLowerCase(), text, api.stage) || 'none'; },
  stageKinds: { dategrid: { mount, ask } },
};
