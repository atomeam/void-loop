/**
 * stage-arrange skill — arrange what is on the stage (owner, 2026-10-18, "tools pack 4", items 61 to 69 of the list):
 * "align left" / "align the notes to the right" / "align everything center" (61), "distribute spacing" / "space them out evenly" (62),
 * "snap to grid" / "snap everything to the grid" / "stop snapping" (63), "show the grid" / "grid off" / "grid size 40" (64),
 * "add a vertical guide at 300" / "clear guides" (65), "select all clocks" / "select the clock and the notes" (66, 67) with "deselect all",
 * "lock everything" / "unlock all" (68, 69: "lock the clock" was already label.js, which now also keeps the card from being dragged).
 * Bring to front (70) was already live: skills/layer.js.
 * Align and distribute act on the multi-selection, else the picked thing, else everything; the cards stay where they are put (pinned).
 * The grid and guides are lines drawn behind and over the stage, kept on this device; nothing is sent anywhere.
 */
import { arrangeOf, align, distribute, snapAll, snapTo } from '../lib/stage-tools.js';
import { multi, read, write, targets, boxesOf, moveTo, plural, boundsOf, whenReady } from '../lib/stage-tools-dom.js';

const GRID_KEY = 'a2m.void.grid.v1', GUIDE_KEY = 'a2m.void.guides.v1';
const grid = () => ({ on: false, size: 20, snap: false, ...read(GRID_KEY, {}) });
const guides = () => { const g = read(GUIDE_KEY, {}); return { show: g.show !== false, v: Array.isArray(g.v) ? g.v : [], h: Array.isArray(g.h) ? g.h : [] }; };
let lastApi = null;

/** draw the grid and the guides (no stage needed: they are lines in fixed positions) */
export function paintOverlays() {
  if (typeof document === 'undefined') return;
  const st = document.getElementById('stage'); if (!st) return;
  const r = st.getBoundingClientRect(), g = grid(), gd = guides();
  let el = document.getElementById('stage-grid');
  if (!g.on) { if (el) el.remove(); } else {
    if (!el) { el = document.createElement('div'); el.id = 'stage-grid'; el.setAttribute('aria-hidden', 'true'); st.parentNode.insertBefore(el, st); }
    el.style.cssText = 'position:fixed;inset:0;pointer-events:none;background-image:linear-gradient(rgba(255,255,255,.08) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.08) 1px,transparent 1px);background-size:' + g.size + 'px ' + g.size + 'px;background-position:' + Math.round(r.left) + 'px ' + Math.round(r.top) + 'px';
    el.dataset.size = String(g.size);
  }
  let gl = document.getElementById('stage-guides');
  const lines = gd.show ? gd.v.map((x) => ['v', x]).concat(gd.h.map((y) => ['h', y])) : [];
  if (!lines.length) { if (gl) gl.remove(); return; }
  if (!gl) { gl = document.createElement('div'); gl.id = 'stage-guides'; gl.setAttribute('aria-hidden', 'true'); gl.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:4'; document.body.appendChild(gl); }
  gl.textContent = '';
  for (const [axis, at] of lines) {
    const l = document.createElement('div'); l.className = 'stage-guide'; l.dataset.axis = axis; l.dataset.at = String(at);
    l.style.cssText = 'position:absolute;background:rgba(255,209,102,.75);' + (axis === 'v' ? 'left:' + Math.round(r.left + at) + 'px;top:0;width:1px;height:100%' : 'top:' + Math.round(r.top + at) + 'px;left:0;height:1px;width:100%');
    gl.appendChild(l);
  }
}

/** after a drop with snap on, the card lands on the grid */
function onDropped(e) {
  const g = grid(); if (!g.snap || !lastApi) return;
  const id = e && e.detail && e.detail.id, t = id && lastApi.stage.things()[id]; if (!t || t.locked) return;
  const x = Math.max(0, snapTo(t.x, g.size)), y = Math.max(0, snapTo(t.y, g.size)); if (x === t.x && y === t.y) return;
  t.x = x; t.y = y; lastApi.stage.save(); lastApi.stage.render();
}
if (typeof document !== 'undefined' && !window.__voidSnapDrop) {
  window.__voidSnapDrop = true;
  document.addEventListener('void:dropped', onDropped);
  window.addEventListener('resize', paintOverlays);
  whenReady(paintOverlays);
}

/** the stage's decorator: the multi-selection's dashed outline, and the lines again after a redraw */
function decorate(stageApi) {
  lastApi = { stage: stageApi };
  const things = stageApi.things();
  for (const el of stageApi.stage.querySelectorAll(':scope > [data-id]')) {
    const id = el.dataset.id, on = multi.has(id) && things[id];
    if (on) { el.style.outline = '2px dashed #8fb4ff'; el.style.outlineOffset = '3px'; el.dataset.multi = '1'; }
    else if (el.dataset.multi) { el.style.outline = ''; el.style.outlineOffset = ''; delete el.dataset.multi; }
  }
  paintOverlays();
}

const SAY_MODE = { left: 'the left edge', right: 'the right edge', center: 'the middle, across', top: 'the top edge', bottom: 'the bottom edge', middle: 'the middle, down' };

function run(text, api) {
  const h = arrangeOf(text);
  if (!h) return 'none';
  lastApi = { stage: api.stage };
  const say = api.say || (() => {}), things = api.stage.things();
  const empty = !Object.keys(things).length;
  const needStage = () => { if (empty) { say('the stage is empty · put something on it first'); return true; } return false; };
  if (h.op === 'align') {
    if (needStage()) return 'stage-arrange';
    const ids = targets(api, h.who, false, true), boxes = boxesOf(api, ids);
    if (!boxes.length) { say('nothing like that on the stage to align'); return 'stage-arrange'; }
    const moved = moveTo(api, align(boxes, h.mode, boundsOf(api)));
    say(moved ? 'aligned ' + plural(moved, 'thing') + ' to ' + SAY_MODE[h.mode] : 'already aligned');
    return 'stage-arrange';
  }
  if (h.op === 'distribute') {
    if (needStage()) return 'stage-arrange';
    const boxes = boxesOf(api, targets(api, h.who, false, true));
    if (boxes.length < 3) { say('spacing out needs three or more things · there are ' + boxes.length); return 'stage-arrange'; }
    const moved = moveTo(api, distribute(boxes, h.axis));
    say(moved ? 'spaced ' + boxes.length + ' things evenly ' + (h.axis === 'v' ? 'down' : 'across') : 'already evenly spaced');
    return 'stage-arrange';
  }
  if (h.op === 'snap') {
    const g = grid();
    if (h.who === undefined) { write(GRID_KEY, { ...g, snap: false }); say('snapping off'); return 'stage-arrange'; }
    if (h.on === true) write(GRID_KEY, { ...g, snap: true });
    const moved = empty ? 0 : moveTo(api, snapAll(boxesOf(api, targets(api, h.who, false, true)), g.size));
    say((h.on === true ? 'snap to grid on · ' : '') + (empty ? 'nothing on the stage yet · drops will land on the ' + g.size + ' px grid' : moved ? 'snapped ' + plural(moved, 'thing') + ' to the ' + g.size + ' px grid' : 'already on the grid'));
    return 'stage-arrange';
  }
  if (h.op === 'grid') {
    const g = grid(); const next = { ...g, on: h.on === undefined ? !g.on : h.on, size: h.size || g.size };
    write(GRID_KEY, next); paintOverlays();
    say(next.on ? 'grid on · ' + next.size + ' px' + (next.snap ? ' · snapping' : ' · say "snap to grid" to land things on it') : 'grid off');
    return 'stage-arrange';
  }
  if (h.op === 'guide') {
    const gd = guides();
    if (h.clear) { write(GUIDE_KEY, { show: true, v: [], h: [] }); paintOverlays(); say('guides cleared'); return 'stage-arrange'; }
    if (h.show) { write(GUIDE_KEY, { ...gd, show: true }); paintOverlays(); say(gd.v.length + gd.h.length ? 'guides shown' : 'no guides yet · say "add a vertical guide at 300"'); return 'stage-arrange'; }
    const b = boundsOf(api), at = h.at === 'center' ? Math.round((h.axis === 'v' ? b.w : b.h) / 2) : Math.max(0, Math.min(h.axis === 'v' ? b.w : b.h, h.at));
    const list = (h.axis === 'v' ? gd.v : gd.h).filter((x) => x !== at).concat([at]).slice(-8);
    write(GUIDE_KEY, { show: true, v: h.axis === 'v' ? list : gd.v, h: h.axis === 'h' ? list : gd.h }); paintOverlays();
    say((h.axis === 'v' ? 'vertical' : 'horizontal') + ' guide at ' + at + ' px · "clear guides" takes them off');
    return 'stage-arrange';
  }
  if (h.op === 'select') {
    if (h.mode === 'none') { const n = multi.size; multi.clear(); api.stage.render(); say(n ? 'selection cleared' : 'nothing was selected'); return 'stage-arrange'; }
    const ids = targets(api, h.who);
    if (!ids.length) { say('nothing like that on the stage'); return 'stage-arrange'; }
    if (h.mode === 'replace') multi.clear();
    for (const id of ids) multi.add(id);
    api.stage.render();
    say(plural(multi.size, 'thing') + ' selected · align, lock, tint, tag or space them out together');
    return 'stage-arrange';
  }
  if (h.op === 'lock') {
    if (needStage()) return 'stage-arrange';
    const ids = targets(api, h.who, true);
    if (!ids.length) { say('pick something first, or say which: "lock the clocks"'); return 'stage-arrange'; }
    let n = 0;
    for (const id of ids) { const t = things[id]; if (!t || !!t.locked === h.on) continue; if (h.on) t.locked = true; else delete t.locked; n++; }
    if (n) { api.stage.save(); api.stage.render(); }
    say(n ? (h.on ? 'locked ' : 'unlocked ') + plural(n, 'thing') + (h.on ? ' · they stay where they are until you unlock them' : '') : h.on ? 'already locked' : 'nothing was locked');
    return 'stage-arrange';
  }
  return 'none';
}

export default {
  name: 'stage-arrange',
  arrangeOf,
  examples: ['align left', 'align the notes to the right', 'distribute spacing', 'space them out evenly', 'snap to grid', 'show the grid', 'grid off', 'add a vertical guide at 300',
    'clear guides', 'select all clocks', 'select the clock and the notes', 'deselect all', 'lock everything', 'unlock all'],
  nearMisses: ['align my chakras', 'what is align-items in css', 'text align center in word', 'grid of 3 columns for my site', 'snap chat me a picture', 'select all emails', 'lock the screen',
    'how do i unlock my phone', 'guide to paris', 'space out my payments'],
  match(lower, text) { return !!arrangeOf(text || lower); },
  run,
  decorate,
};
