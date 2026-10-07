/**
 * group skill: "group the clock and the note", "move the group to the top left", "make the group bigger", "ungroup".
 * Board Next #3 (grouped objects / layers), the grouping half; the z-order half is skills/layer.js.
 * A group is a shared `group` id on each stage thing, saved with the stage, so it survives a reload.
 * Dragging one grouped thing carries the rest along (bindDrag in void.html); "bring the group to the front" is layer.js.
 * Empty surface stays empty: grouping adds nothing to the stage, and an ask on an empty stage only says so.
 */
import { KIND_WORDS } from './layer.js';

const CLEAN = (s) => String(s || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').toLowerCase();
const GROUP_NOUN = String.raw`(?:the\s+|my\s+|this\s+|that\s+)?(?:group|grouped\s+(?:things|ones|stuff|items)|bunch|cluster)`;
const EVERYTHING = /^(?:everything|all|all of (?:it|them)|them(?: all)?|these|those|all of these|all of those|the lot|it all|all things|all the things|everything on the stage)$/;

// Default sizes the page draws each kind at (void.html mount* functions), so a group resize scales from what you see.
const SIZE_FIELD = { clock: ['size', 48], timer: ['size', 40], counter: ['size', 26] };
const SIZE_CAP = 200, SIZE_MIN = 10;

/** One noun phrase ("the clock", "all the notes", "both timers") to { kind, all } or null. */
export function nounOf(words) {
  let w = CLEAN(words).replace(/\btogether$/, '').trim();
  const all = /^(?:all|every|each|both)\b/.test(w) || /^(?:the|my)\s+\w+s$/.test(w) || /^(?:two|three|four|five|2|3|4|5)\s+\w+s$/.test(w);
  w = w.replace(/^(?:all\s+(?:of\s+)?(?:the|my)\s+|all\s+|every\s+|each\s+|both\s+(?:the\s+)?|the\s+|my\s+|that\s+|this\s+|those\s+|these\s+|two\s+|three\s+|four\s+|five\s+|[2-5]\s+)/, '').trim();
  const k = KIND_WORDS.find(([, re]) => re.test(w));
  if (!k) return null;
  return { kind: k[0], all: all || (/s$/.test(w) && !/^(?:weather|glass)$/.test(w)) };
}

/**
 * Parse an ask. Returns one of:
 *   { op: 'group', parts: [{kind, all}, ...] | 'all' }
 *   { op: 'ungroup', part: {kind, all} | 'all' | 'group' }
 *   { op: 'move', to: 'top left' | ... | { dx, dy } }
 *   { op: 'scale', by: number }
 *   { op: 'show' }
 * or null when the ask is not about grouping.
 */
export function groupOf(text) {
  const t = CLEAN(text).replace(/^(?:please\s+|can you\s+|could you\s+)/, '');
  let m;
  // ungroup
  if ((m = /^(?:ungroup|un-group)(?:\s+(.*))?$/.exec(t))) {
    const w = (m[1] || '').trim();
    if (!w || EVERYTHING.test(w) || new RegExp('^' + GROUP_NOUN + '$').test(w) || /^(?:it|this|that|them)$/.test(w)) return { op: 'ungroup', part: w && !/^(?:it|this|that|them)$/.test(w) && !EVERYTHING.test(w) ? 'group' : 'all' };
    const n = nounOf(w); return n ? { op: 'ungroup', part: n } : null;
  }
  if ((m = new RegExp(String.raw`^(?:break|split)\s+up\s+` + GROUP_NOUN + '$').exec(t))) return { op: 'ungroup', part: 'group' };
  if ((m = new RegExp(String.raw`^(?:take|pull|remove|drop)\s+(.+?)\s+(?:out\s+of|from)\s+` + GROUP_NOUN + '$').exec(t))) {
    const n = nounOf(m[1]); return n ? { op: 'ungroup', part: n } : null;
  }
  // what is grouped
  if (new RegExp(String.raw`^(?:what(?:'s| is)\s+in|show(?:\s+me)?|which\s+things\s+are\s+in|list)\s+` + GROUP_NOUN + '$').test(t)) return { op: 'show' };
  // group
  let list = null;
  if ((m = /^(?:group|glue|stick|join|link up|tie)\s+(.+?)\s+together$/.exec(t))) list = m[1];
  else if ((m = /^(?:group(?:\s+up)?)\s+(.+)$/.exec(t))) list = m[1];
  else if ((m = /^(?:put|make|turn|place)\s+(.+?)\s+(?:in(?:to)?|as)\s+(?:a|one)\s+group$/.exec(t))) list = m[1];
  else if ((m = /^(?:make|create|form)\s+a\s+group\s+(?:of|from|with)\s+(.+)$/.exec(t))) list = m[1];
  else if ((m = /^(?:glue|stick|attach|tie)\s+(.+?)\s+to\s+(.+)$/.exec(t))) list = m[1] + ' and ' + m[2];
  else if ((m = /^keep\s+(.+?)\s+together$/.exec(t))) list = m[1];
  if (list != null) {
    if (EVERYTHING.test(list.trim())) return { op: 'group', parts: 'all' };
    const bits = list.split(/\s*(?:,\s*(?:and\s+)?|\band\b|\bwith\b|\bplus\b|&|\+)\s*/).filter(Boolean);
    const parts = bits.map(nounOf);
    if (!parts.length || parts.some((p) => !p)) return null;
    if (parts.length < 2 && !parts[0].all) return null; // "group the clock" alone is not a group
    return { op: 'group', parts };
  }
  // move the group (front / back is a layer ask: skills/layer.js)
  if ((m = new RegExp(String.raw`^(?:move|put|slide|shift|send|take|drag|place|nudge)\s+` + GROUP_NOUN + String.raw`\s*(.*)$`).exec(t))) {
    const rest = m[1].trim().replace(/^(?:over\s+)?(?:to\s+|in\s+|into\s+|at\s+|in\s+to\s+)?(?:the\s+)?/, '');
    if (/\b(?:front|back|behind|forward|backward|foreground|background|layer)\b/.test(rest) || /\b(?:on\s+top\s+of|above|under|below)\b/.test(rest)) return null;
    const to = placeOf(rest);
    return to ? { op: 'move', to } : null;
  }
  // resize the group
  if ((m = new RegExp(String.raw`^(?:make|scale|resize|turn)\s+` + GROUP_NOUN + String.raw`\s+(.+)$`).exec(t))) {
    const by = scaleOf(m[1]); return by ? { op: 'scale', by } : null;
  }
  if ((m = new RegExp(String.raw`^(grow|enlarge|shrink|double|halve)\s+` + GROUP_NOUN + '$').exec(t))) {
    return { op: 'scale', by: { grow: 1.25, enlarge: 1.25, shrink: 0.8, double: 2, halve: 0.5 }[m[1]] };
  }
  return null;
}

function placeOf(rest) {
  const r = rest.replace(/\s+(?:of\s+the\s+(?:screen|stage|page|void))$/, '').trim();
  const corner = [['top left', /^(?:top[\s-]*left|left[\s-]*top|upper[\s-]*left)(?:\s+corner)?$/], ['top right', /^(?:top[\s-]*right|right[\s-]*top|upper[\s-]*right)(?:\s+corner)?$/],
    ['bottom left', /^(?:bottom[\s-]*left|left[\s-]*bottom|lower[\s-]*left)(?:\s+corner)?$/], ['bottom right', /^(?:bottom[\s-]*right|right[\s-]*bottom|lower[\s-]*right)(?:\s+corner)?$/]].find(([, re]) => re.test(r));
  if (corner) return corner[0];
  if (/^(?:cent(?:er|re)|middle)$/.test(r)) return 'center';
  if (/^(?:top|upper\s+edge)$/.test(r)) return 'top';
  if (/^(?:bottom|lower\s+edge)$/.test(r)) return 'bottom';
  if (/^(?:left\s+side|left\s+edge)$/.test(r)) return 'left edge';
  if (/^(?:right\s+side|right\s+edge)$/.test(r)) return 'right edge';
  const d = /^(left|right|up|down|higher|lower)(?:\s+(a\s+bit|a\s+little|slightly|a\s+lot|a\s+bunch|(\d{1,4})\s*(?:px|pixels?)?))?$/.exec(r)
    || /^(?:a\s+bit|a\s+little|slightly)\s+(left|right|up|down|higher|lower)$/.exec(r);
  if (d) {
    const amount = d[3] ? Math.min(2000, Number(d[3])) : /lot|bunch/.test(d[2] || '') ? 240 : 80;
    const dir = { left: [-1, 0], right: [1, 0], up: [0, -1], higher: [0, -1], down: [0, 1], lower: [0, 1] }[d[1]];
    return { dx: dir[0] * amount, dy: dir[1] * amount };
  }
  return null;
}

function scaleOf(w) {
  const s = CLEAN(w);
  if (/^(?:twice\s+as\s+big|double(?:\s+the)?\s+size|2x|twice\s+the\s+size)$/.test(s)) return 2;
  if (/^(?:half\s+(?:the\s+)?size|half\s+as\s+big)$/.test(s)) return 0.5;
  if (/^(?:a\s+(?:bit|little)\s+)?(?:bigger|larger)$/.test(s)) return 1.25;
  if (/^(?:a\s+lot|much)\s+(?:bigger|larger)$/.test(s)) return 1.6;
  if (/^(?:a\s+(?:bit|little)\s+)?smaller$/.test(s)) return 0.8;
  if (/^(?:a\s+lot|much)\s+smaller$/.test(s)) return 0.6;
  if (/^(?:big|large|huge|giant)$/.test(s)) return 1.5;
  if (/^(?:small|tiny|little|mini)$/.test(s)) return 0.66;
  return null;
}

/** Which ids a group ask takes, given the stage in draw order. Newest first for singular picks. Pure. */
export function pickGroup(order, parts, selected) {
  const list = order.filter((t) => t && t.kind !== 'figure');
  if (parts === 'all') return list.map((t) => t.id);
  const taken = new Set();
  for (const p of parts) {
    const hits = list.filter((t) => t.kind === p.kind && !taken.has(t.id));
    if (!hits.length) return { missing: p.kind };
    if (p.all) { hits.forEach((t) => taken.add(t.id)); continue; }
    const pick = (selected && hits.find((t) => t.id === selected)) || hits[hits.length - 1];
    taken.add(pick.id);
  }
  return [...taken];
}

/** The group an ask means: the selected thing's group, else the newest group. */
export function currentGroup(order, selected) {
  const sel = order.find((t) => t && t.id === selected && t.group);
  if (sel) return sel.group;
  const gs = order.filter((t) => t && t.group).map((t) => t.group);
  return gs.sort().pop() || null;
}

/** Move every member so the group's box lands at `to` (or shifts by dx/dy). boxes: id -> {w,h}. Pure. */
export function moveGroup(members, to, boxes, stageW, stageH) {
  const b = (t) => (boxes && boxes[t.id]) || { w: 180, h: 80 };
  const minX = Math.min(...members.map((t) => Number(t.x) || 0)), minY = Math.min(...members.map((t) => Number(t.y) || 0));
  const maxX = Math.max(...members.map((t) => (Number(t.x) || 0) + b(t).w)), maxY = Math.max(...members.map((t) => (Number(t.y) || 0) + b(t).h));
  const gw = maxX - minX, gh = maxY - minY, pad = 24, W = stageW || 1280, H = stageH || 800;
  let nx = minX, ny = minY;
  if (typeof to === 'object') { nx = minX + to.dx; ny = minY + to.dy; }
  else {
    const left = pad, right = Math.max(pad, W - gw - pad), top = pad, bottom = Math.max(pad, H - gh - pad);
    const cx = Math.max(pad, (W - gw) / 2), cy = Math.max(pad, (H - gh) / 2);
    const spots = { 'top left': [left, top], 'top right': [right, top], 'bottom left': [left, bottom], 'bottom right': [right, bottom],
      center: [cx, cy], top: [cx, top], bottom: [cx, bottom], 'left edge': [left, minY], 'right edge': [right, minY] };
    [nx, ny] = spots[to] || [minX, minY];
  }
  nx = Math.max(0, Math.min(nx, Math.max(0, W - 40))); ny = Math.max(0, Math.min(ny, Math.max(0, H - 40)));
  const dx = nx - minX, dy = ny - minY;
  for (const t of members) { t.x = Math.round((Number(t.x) || 0) + dx); t.y = Math.round((Number(t.y) || 0) + dy); }
  return { dx, dy };
}

/** Scale the group about its top-left corner: spacing and each member's own size. Pure on the members. */
export function scaleGroup(members, by) {
  const minX = Math.min(...members.map((t) => Number(t.x) || 0)), minY = Math.min(...members.map((t) => Number(t.y) || 0));
  for (const t of members) {
    t.x = Math.round(minX + ((Number(t.x) || 0) - minX) * by);
    t.y = Math.round(minY + ((Number(t.y) || 0) - minY) * by);
    const f = SIZE_FIELD[t.kind];
    if (f) t[f[0]] = Math.max(SIZE_MIN, Math.min(SIZE_CAP, Math.round((Number(t[f[0]]) || f[1]) * by)));
    if (t.kind === 'shape') { t.width = Math.max(20, Math.min(400, Math.round((Number(t.width) || 80) * by))); t.height = Math.max(20, Math.min(400, Math.round((Number(t.height) || 80) * by))); }
    if (Number(t.w)) t.w = Math.max(160, Math.min(720, Math.round(t.w * by)));
  }
}

const NAMES = { kept: 'card', sticky: 'note', calc: 'calculator' };
const nameOf = (t) => (NAMES[t.kind] || t.kind);
const listNames = (ms) => { const c = {}; ms.forEach((t) => { const n = nameOf(t); c[n] = (c[n] || 0) + 1; }); const w = Object.entries(c).map(([n, k]) => (k > 1 ? k + ' ' + n + 's' : 'the ' + n)); return w.length > 1 ? w.slice(0, -1).join(', ') + ' and ' + w[w.length - 1] : w[0] || ''; };
let seq = 0;
const newGroupId = () => 'g' + Date.now().toString(36) + (seq++).toString(36);

function boxesOf(st, members) {
  const out = {};
  const root = st && st.stage;
  for (const t of members) {
    const el = root && root.querySelector ? root.querySelector('[data-id="' + String(t.id).replace(/"/g, '') + '"]') : null;
    if (el && el.offsetWidth) out[t.id] = { w: el.offsetWidth, h: el.offsetHeight };
  }
  return out;
}

async function run(text, api) {
  const hit = groupOf(text);
  if (!hit) return 'none';
  const say = (s) => { if (api.say) api.say(s); };
  const st = api.stage || {};
  const live = st.things ? st.things() : {};
  const order = Object.values(live);
  const selected = st.selected ? st.selected() : null;
  const done = () => { if (st.save) st.save(); if (st.render) st.render(); return 'group'; };
  if (!order.length) { say('the void is empty · summon a few things first, then group them'); return 'group'; }

  if (hit.op === 'group') {
    const ids = pickGroup(order, hit.parts, selected);
    if (!Array.isArray(ids)) { say('no ' + (NAMES[ids.missing] || ids.missing) + ' on the stage'); return 'group'; }
    if (ids.length < 2) { say('only one thing on the stage · a group needs two'); return 'group'; }
    const g = newGroupId();
    for (const id of ids) live[id].group = g;
    say('grouped ' + listNames(ids.map((id) => live[id])) + ' · drag one and they all move');
    return done();
  }
  if (hit.op === 'ungroup') {
    let ms;
    if (hit.part === 'all') ms = order.filter((t) => t.group);
    else if (hit.part === 'group') { const g = currentGroup(order, selected); ms = order.filter((t) => g && t.group === g); }
    else ms = order.filter((t) => t.group && t.kind === hit.part.kind);
    if (!ms.length) { say(hit.part === 'all' || hit.part === 'group' ? 'nothing is grouped' : 'that ' + (NAMES[hit.part.kind] || hit.part.kind) + ' is not in a group'); return 'group'; }
    if (hit.part !== 'all' && hit.part !== 'group' && !hit.part.all) ms = [(selected && ms.find((t) => t.id === selected)) || ms[ms.length - 1]];
    const touched = new Set(ms.map((t) => t.group));
    for (const t of ms) delete t.group;
    for (const g of touched) { const left = order.filter((t) => t.group === g); if (left.length === 1) delete left[0].group; } // a group of one is no group
    say(hit.part === 'all' || hit.part === 'group' ? 'ungrouped · each one moves on its own again' : 'took ' + listNames(ms) + ' out of the group');
    return done();
  }
  const g = currentGroup(order, selected);
  const members = order.filter((t) => g && t.group === g);
  if (!members.length) { say('nothing is grouped yet · try "group the clock and the note"'); return 'group'; }
  if (hit.op === 'show') { say('the group: ' + listNames(members)); return 'group'; }
  if (hit.op === 'move') {
    const root = st.stage || {};
    moveGroup(members, hit.to, boxesOf(st, members), root.clientWidth, root.clientHeight);
    say('moved the group');
    return done();
  }
  if (hit.op === 'scale') {
    scaleGroup(members, hit.by);
    say(hit.by > 1 ? 'made the group bigger' : 'made the group smaller');
    return done();
  }
  return 'none';
}

export default {
  name: 'group',
  examples: ['group the clock and the note', 'group the timer with the clock', 'group everything', 'group all the notes',
    'glue the clock to the note', 'put the clock and the timer in a group', 'make a group of the clock and the counter',
    'stick the clock and the note together', 'keep the clock and the timer together',
    'move the group to the top left', 'move the group left', 'move the group down a bit', 'put the group in the middle',
    'make the group bigger', 'make the group smaller', 'shrink the group', 'what is in the group',
    'ungroup', 'ungroup everything', 'break up the group', 'take the clock out of the group'],
  nearMisses: ['bring the group to the front', 'send the group to the back', 'group therapy near me', 'what is a group in maths',
    'stick a note that says hi', 'add a sticky', 'make the clock bigger', 'move the clock to the top left', 'join the waitlist',
    'make a group chat', 'the beatles were a group', 'put the clock on top'],
  groupOf,
  pickGroup,
  currentGroup,
  moveGroup,
  scaleGroup,
  match(lower, text) { return !!groupOf(text); },
  run,
  suite() {
    const mk = () => ({ a: { id: 'a', kind: 'clock', x: 100, y: 100 }, b: { id: 'b', kind: 'sticky', x: 300, y: 140 }, c: { id: 'c', kind: 'sticky', x: 500, y: 200 }, d: { id: 'd', kind: 'timer', x: 40, y: 400 } });
    const s = mk(), o = Object.values(s);
    const two = pickGroup(o, groupOf('group the clock and the note').parts, null);
    const notes = pickGroup(o, groupOf('group all the notes').parts, null);
    const every = pickGroup(o, groupOf('group everything').parts, null);
    const miss = pickGroup(o, groupOf('group the clock and the counter').parts, null);
    s.a.group = 'g1'; s.c.group = 'g1';
    const cur = currentGroup(Object.values(s), null);
    const ms = [s.a, s.c];
    moveGroup(ms, { dx: -80, dy: 0 }, {}, 1280, 800);
    const keptGap = s.c.x - s.a.x === 400 && s.a.x === 20;
    moveGroup(ms, 'top left', {}, 1280, 800);
    const corner = s.a.x === 24 && s.a.y === 24 && s.c.x === 424 && s.c.y === 124;
    scaleGroup(ms, 2);
    const scaled = s.a.size === 96 && s.c.x === 824 && s.a.x === 24;
    const parse = groupOf('move the group to the top left').to === 'top left' && groupOf('move the group left a bit').to.dx === -80
      && groupOf('make the group bigger').by === 1.25 && groupOf('ungroup').part === 'all' && groupOf('take the clock out of the group').part.kind === 'clock'
      && !groupOf('bring the group to the front') && !groupOf('send the group to the back') && !groupOf('stick a note that says hi')
      && !groupOf('group therapy near me') && !groupOf('make the clock bigger');
    const ok = two.join('') === 'ac' && notes.join('') === 'bc' && every.length === 4 && miss.missing === 'counter' && cur === 'g1' && keptGap && corner && scaled && parse;
    return { ok, got: ok ? 'group, pick, move, scale, parse' : JSON.stringify({ two, notes, every: every.length, miss, cur, keptGap, corner, scaled, parse, s }) };
  }
};
