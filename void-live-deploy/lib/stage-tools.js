// Stage tools (owner, 2026-10-18; "tools pack 4"): align, distribute, grid, guides, multi-select, lock, look of a card, stage background,
// folders, tags, snapshots, layouts, templates. Pure logic only (no DOM, no storage of its own): the three skills stage-arrange,
// stage-style and stage-organize read the stage through these and draw it. Everything is device-local; nothing is sent anywhere.

export const norm = (s) => String(s || '').trim().toLowerCase().replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[?!.]+$/, '').replace(/\s+/g, ' ').replace(/^(?:please|pls)\s+/, '').replace(/\s+please$/, '');

/** HTML-escape a value before it goes into markup. Pure. */
export const esc = (v) => String(v == null ? '' : v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- colours ----------
export const COLORS = { red: '#e5484d', orange: '#f59e42', yellow: '#f5d90a', green: '#3fb950', teal: '#2bb5a6', blue: '#4c8dff', purple: '#9b6bff', violet: '#9b6bff', pink: '#ff6fb1', white: '#ffffff', black: '#000000', gray: '#8a8a92', grey: '#8a8a92', brown: '#9a6b3f', gold: '#e0b43a', navy: '#14275c', maroon: '#6b1b2b' };
/** a colour word or #rgb / #rrggbb as a #rrggbb string, or ''. Pure. */
export function colorOf(word) {
  const w = String(word || '').trim().toLowerCase();
  if (COLORS[w]) return COLORS[w];
  let m = /^#([0-9a-f]{6})$/.exec(w); if (m) return '#' + m[1];
  m = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(w); if (m) return '#' + m[1] + m[1] + m[2] + m[2] + m[3] + m[3];
  return '';
}
const COLOR_RE = '(' + Object.keys(COLORS).join('|') + '|#[0-9a-f]{3}|#[0-9a-f]{6})';
/** #rrggbb and an alpha 0..1 as rgba(). Pure. */
export function rgba(hex, a) { const h = colorOf(hex) || '#000000'; return 'rgba(' + parseInt(h.slice(1, 3), 16) + ',' + parseInt(h.slice(3, 5), 16) + ',' + parseInt(h.slice(5, 7), 16) + ',' + a + ')'; }

// ---------- who: the words that name stage things ----------
// kind words, the same everyday names layer.js and group.js use (kept here so this file stays free of imports)
export const KIND_WORDS = [
  ['notepad', /^notepads?$/], ['image', /^(?:images?|pictures?|photos?)$/], ['link', /^links?$/], ['kept', /^(?:kept cards?|kept items?|kept answers?|cards?|maps?|weather|translations?|pages?)$/],
  ['sticky', /^(?:stick(?:y|ies)|sticky notes?|notes?)$/], ['list', /^(?:lists?|checklists?|to-?do lists?)$/], ['calc', /^(?:calcs?|calculators?)$/], ['timer', /^(?:timers?|countdowns?)$/],
  ['counter', /^counters?$/], ['shape', /^(?:shapes?|rect(?:angles?)?|squares?|circles?)$/], ['clock', /^clocks?$/], ['label', /^(?:labels?|captions?)$/],
];
const EVERYTHING = /^(?:everything|all|all things|all of it|all of them|all the things|everything on the stage|the lot|the whole stage|every thing|them all|all cards|every card)$/;
const SELF = /^(?:it|this|that|this one|that one|the selected one|selected|the selected thing|the selected card|what i picked)$/;
const SELECTION = /^(?:the selection|my selection|the selected ones|the selected things|selected things|selected cards|the picked ones|the multi-selection|multi-selection)$/;

/** one noun ("the clock", "all notes") to a kind name, or ''. Pure. */
export function kindWord(w) {
  const s = String(w || '').replace(/^(?:all\s+(?:of\s+)?(?:the\s+|my\s+)?|every\s+|each\s+|both\s+(?:the\s+)?|the\s+|my\s+|that\s+|this\s+|those\s+|these\s+|two\s+|three\s+|four\s+|five\s+)/, '').trim();
  const k = KIND_WORDS.find(([, re]) => re.test(s));
  return k ? k[0] : '';
}
/** what a "who" phrase names: { all } | { self } | { sel } | { kinds: [kind, ...] } | null for anything else. Pure. */
export function whoOf(phrase) {
  const t = norm(phrase);
  if (!t) return { none: true };
  if (EVERYTHING.test(t)) return { all: true };
  if (SELF.test(t)) return { self: true };
  if (/^(?:them|these|those)$/.test(t)) return { none: true }; // "space them out": the selection if there is one, else the cards that fit the verb
  if (SELECTION.test(t)) return { sel: true };
  const parts = t.split(/\s*(?:,|\band\b|&)\s*/).filter(Boolean), kinds = [];
  for (const p of parts) { const k = kindWord(p); if (!k) return null; if (!kinds.includes(k)) kinds.push(k); }
  return kinds.length ? { kinds } : null;
}
/** the ids a who names on this stage; none named = the multi-selection, else the picked one, else everything. Pure.
 *  ctx { things, multi: [ids], selected: id|null }. Returns an array (possibly empty). */
export function resolveWho(who, ctx) {
  const things = ctx.things || {}, live = (id) => things[id] && things[id].kind !== 'figure';
  const all = Object.keys(things).filter(live), multi = (ctx.multi || []).filter(live);
  if (!who || who.none) return multi.length ? multi : ctx.selected && live(ctx.selected) ? [ctx.selected] : all;
  if (who.all) return all;
  if (who.self) return ctx.selected && live(ctx.selected) ? [ctx.selected] : multi;
  if (who.sel) return multi.length ? multi : ctx.selected && live(ctx.selected) ? [ctx.selected] : [];
  return all.filter((id) => who.kinds.includes(things[id].kind));
}

// ---------- geometry ----------
/** snap a number to the nearest multiple of a grid size. Pure. */
export const snapTo = (v, grid) => { const g = Math.max(2, Math.round(+grid) || 20); return Math.round((+v || 0) / g) * g; };
/** positions after aligning boxes [{id,x,y,w,h}] by `mode` (left, right, center, top, bottom, middle); one box aligns to the stage edge.
 *  bounds { w, h } is the stage. Returns { id: {x, y} } for the boxes that move. Pure. */
export function align(boxes, mode, bounds) {
  const b = boxes.filter((x) => x && Number.isFinite(+x.x) && Number.isFinite(+x.y)).map((x) => ({ id: x.id, x: +x.x, y: +x.y, w: +x.w || 0, h: +x.h || 0 }));
  if (!b.length) return {};
  const out = {}, bw = +(bounds && bounds.w) || 0, bh = +(bounds && bounds.h) || 0, many = b.length > 1;
  const left = many ? Math.min(...b.map((x) => x.x)) : 10, right = many ? Math.max(...b.map((x) => x.x + x.w)) : Math.max(10, bw - 10);
  const top = many ? Math.min(...b.map((x) => x.y)) : 10, bottom = many ? Math.max(...b.map((x) => x.y + x.h)) : Math.max(10, bh - 10);
  const cx = (left + right) / 2, cy = (top + bottom) / 2;
  for (const x of b) {
    const p = { x: x.x, y: x.y };
    if (mode === 'left') p.x = left; else if (mode === 'right') p.x = right - x.w; else if (mode === 'center') p.x = cx - x.w / 2;
    else if (mode === 'top') p.y = top; else if (mode === 'bottom') p.y = bottom - x.h; else if (mode === 'middle') p.y = cy - x.h / 2;
    p.x = Math.max(0, Math.round(p.x)); p.y = Math.max(0, Math.round(p.y));
    if (p.x !== Math.round(x.x) || p.y !== Math.round(x.y)) out[x.id] = p;
  }
  return out;
}
/** positions after spreading boxes evenly along an axis ('h' across, 'v' down): the two outermost stay, the gaps between all are equal. Needs 3. Pure. */
export function distribute(boxes, axis) {
  const h = axis !== 'v', pos = (x) => (h ? +x.x : +x.y), len = (x) => (h ? +x.w : +x.h) || 0;
  const b = boxes.filter((x) => x && Number.isFinite(+x.x) && Number.isFinite(+x.y)).sort((p, q) => pos(p) - pos(q) || String(p.id).localeCompare(String(q.id)));
  if (b.length < 3) return {};
  const first = pos(b[0]), last = pos(b[b.length - 1]) + len(b[b.length - 1]);
  const gap = (last - first - b.reduce((s, x) => s + len(x), 0)) / (b.length - 1), out = {};
  let at = first;
  for (const x of b) { const v = Math.max(0, Math.round(at)); if (v !== Math.round(pos(x))) out[x.id] = h ? { x: v, y: Math.round(+x.y) } : { x: Math.round(+x.x), y: v }; at += len(x) + gap; }
  return out;
}
/** positions after snapping every box's corner to the grid. Pure. */
export function snapAll(boxes, grid) {
  const out = {};
  for (const x of boxes) { if (!x || !Number.isFinite(+x.x) || !Number.isFinite(+x.y)) continue; const p = { x: Math.max(0, snapTo(x.x, grid)), y: Math.max(0, snapTo(x.y, grid)) }; if (p.x !== Math.round(x.x) || p.y !== Math.round(x.y)) out[x.id] = p; }
  return out;
}

// ---------- asks: stage-arrange ----------
const ALIGN_MODE = { left: 'left', right: 'right', center: 'center', centre: 'center', top: 'top', bottom: 'bottom', middle: 'middle' };
/** { op: 'align', mode, who } | { op: 'distribute', axis, who } | { op: 'snap', on, now, who, grid } | { op: 'grid', on?, size? } | { op: 'guide', ... }
 *  | { op: 'select', mode, who } | { op: 'lock', on, who } | null. Pure. */
export function arrangeOf(text) {
  let t = norm(text), m;
  if ((m = /^align(?: (.+?))?(?: to)?(?: the)? (left|right|center|centre|top|bottom|middle)(?: edge| edges| side)?$/.exec(t))) {
    const who = whoOf(m[1] || ''); if (who) return { op: 'align', mode: ALIGN_MODE[m[2]], who };
  }
  if ((m = /^(left|right|center|centre|top|bottom|middle)[ -]align (.+)$/.exec(t))) {
    const who = whoOf(m[2]); if (who) return { op: 'align', mode: ALIGN_MODE[m[1]], who };
  }
  // distribute: the axis and the filler words come off first
  let axis = 'h';
  const ax = /\b(horizontally|sideways|across|vertically|down)\b/.exec(t);
  if (ax) { axis = /vert|down/.test(ax[1]) ? 'v' : 'h'; }
  const d = t.replace(/\b(horizontally|sideways|across|vertically|down)\b/, '').replace(/\b(?:the |their )(?:spacing|space|gaps?)\b/g, '').replace(/\b(?:spacing|gaps?)\b/g, '').replace(/\b(?:evenly|equally)\b/g, '').replace(/\s+/g, ' ').trim();
  if ((m = /^(distribute|space|spread|even)(?: out)?(?: (.+?))?( out)?$/.exec(d)) && (m[1] === 'distribute' || /\bout\b/.test(d))) {
    const who = whoOf((m[2] || '').replace(/^out\b\s*/, '')); if (who) return { op: 'distribute', axis, who };
  }
  if (/^(?:turn |switch )?(?:off |stop )(?:snap(?:ping)?(?: to (?:the )?grid)?)$|^snap(?:ping)? (?:to (?:the )?grid )?off$|^stop snapping$|^no snap(?:ping)?(?: to (?:the )?grid)?$/.test(t)) return { op: 'snap', on: false, now: false };
  if ((m = /^(?:turn on |switch on |enable )?snap(?:ping)?(?: (.+?))? to (?:the )?grid(?: on)?$/.exec(t))) {
    const w = (m[1] || '').trim(), who = whoOf(w); if (who) return { op: 'snap', on: !w || /^(?:on)$/.test(w) ? true : false, now: true, who };
  }
  if (/^(?:show|display|turn on|switch on|enable|add|toggle)(?: the| a)? grid(?: lines)?$|^grid(?: lines)? (?:on|visible)$/.test(t)) return { op: 'grid', on: true };
  if (/^(?:hide|turn off|switch off|disable|remove|clear)(?: the)? grid(?: lines)?$|^grid(?: lines)? (?:off|hidden)$|^no grid$/.test(t)) return { op: 'grid', on: false };
  if ((m = /^(?:set )?(?:the )?grid(?: size)?(?: to| of)? (\d{1,3})(?: ?px)?$/.exec(t)) || (m = /^(?:set|make) (?:the )?grid(?: size)? (?:to )?(\d{1,3})(?: ?px)?$/.exec(t))) { const n = +m[1]; if (n >= 8 && n <= 200) return { op: 'grid', size: n, on: true }; }
  if ((m = /^(?:(?:add|put|drop|place|make|set)(?: a| an)? )?(?:ruler )?(vertical|horizontal)(?: ruler)? guide(?: line)?(?: (?:at|on))?(?: (\d{1,4})(?: ?px)?| (center|centre|middle))?$/.exec(t))) {
    return { op: 'guide', add: true, axis: /^h/.test(m[1]) ? 'h' : 'v', at: m[2] ? +m[2] : 'center' };
  }
  if ((m = /^(?:(?:add|put|drop|place)(?: a| an)? )?ruler guide(?: (?:at|on))?(?: (\d{1,4})(?: ?px)?)?$/.exec(t))) return { op: 'guide', add: true, axis: 'v', at: m[1] ? +m[1] : 'center' };
  if (/^(?:clear|remove|hide|delete|turn off)(?: all| the| my)?(?: ruler)? guides$/.test(t)) return { op: 'guide', clear: true };
  if (/^(?:show|turn on)(?: the| my)?(?: ruler)? guides$/.test(t)) return { op: 'guide', show: true };
  if (/^(?:deselect|unselect)(?: all| everything| them)?$|^select (?:none|nothing)$|^clear(?: the| my)? (?:multi-)?selection$/.test(t)) return { op: 'select', mode: 'none' };
  if ((m = /^(?:add|include) (.+?) (?:to|in|into) (?:the |my )?selection$/.exec(t)) || (m = /^select (?:also|more|another) (.+)$/.exec(t))) { const who = whoOf(m[1]); if (who && !who.none && !who.sel) return { op: 'select', mode: 'add', who }; }
  if ((m = /^select (.+)$/.exec(t))) { const who = whoOf(m[1]); if (who && !who.none && !who.sel && !who.self) return { op: 'select', mode: 'replace', who }; }
  if ((m = /^(lock|unlock|freeze|unfreeze)(?: (.+?))?(?: in (?:place|position))?$/.exec(t))) {
    const w = (m[2] || '').trim(), who = whoOf(w); const on = /^(?:lock|freeze)$/.test(m[1]);
    if (who && (!who.none || /in (?:place|position)$/.test(t))) return { op: 'lock', on, who };
  }
  return null;
}

// ---------- asks: stage-style ----------
const PX = (n, lo, hi) => Math.max(lo, Math.min(hi, Math.round(+n)));
/** { op: 'fx', prop, value, who } (opacity 0..100, tint colour or '', border px, radius px, shadow bool) | { op: 'reset', who } | { op: 'bg', color }
 *  | { op: 'bgimage' } | { op: 'blur', px } | { op: 'contrast', on } | { op: 'type', on } | null. Pure. */
export function styleOf(text) {
  const t = norm(text); let m, who;
  const ofWho = (w) => { const x = whoOf(w || ''); return x; };
  // opacity
  if ((m = /^(?:set |change |make )?(?:the )?opacity(?: of (.+?))?(?: to| at| =)? (\d{1,3}) ?%?$/.exec(t)) && (who = ofWho(m[1]))) return { op: 'fx', prop: 'opacity', value: PX(m[2], 5, 100), who };
  if ((m = /^(?:set |change |make )?(.+?) opacity(?: to| at)? (\d{1,3}) ?%?$/.exec(t)) && (who = ofWho(m[1])) && !who.none) return { op: 'fx', prop: 'opacity', value: PX(m[2], 5, 100), who };
  if ((m = /^make (.+?) (\d{1,3}) ?% (transparent|opaque|see-through)$/.exec(t)) && (who = ofWho(m[1])) && !who.none) return { op: 'fx', prop: 'opacity', value: PX(m[3] === 'opaque' ? m[2] : 100 - m[2], 5, 100), who };
  if ((m = /^make (.+?) (?:see-through|translucent|semi-transparent|half transparent|a bit transparent)$/.exec(t)) && (who = ofWho(m[1])) && !who.none) return { op: 'fx', prop: 'opacity', value: 50, who };
  if ((m = /^make (.+?) (?:fully opaque|opaque|solid again)$/.exec(t)) && (who = ofWho(m[1])) && !who.none) return { op: 'fx', prop: 'opacity', value: 100, who };
  // tint
  if ((m = new RegExp('^tint(?: (.+?))? ' + COLOR_RE + '$').exec(t)) && (who = ofWho(m[1]))) return { op: 'fx', prop: 'tint', value: colorOf(m[2]), who };
  if ((m = new RegExp('^give (.+?) an? ' + COLOR_RE + ' tint$').exec(t)) && (who = ofWho(m[1])) && !who.none) return { op: 'fx', prop: 'tint', value: colorOf(m[2]), who };
  if ((m = /^(?:remove|clear|take off|no)(?: the)? tint(?: (?:from|on|of) (.+))?$/.exec(t)) && (who = ofWho(m[1]))) return { op: 'fx', prop: 'tint', value: '', who };
  if ((m = /^untint(?: (.+))?$/.exec(t)) && (who = ofWho(m[1]))) return { op: 'fx', prop: 'tint', value: '', who };
  // border weight
  if ((m = /^(?:set |change |make )?(?:the )?border (?:weight|width|thickness|size)(?: (?:of|on|for) (.+?))?(?: to| at)? (\d{1,2}) ?(?:px)?$/.exec(t)) && (who = ofWho(m[1]))) return { op: 'fx', prop: 'border', value: PX(m[2], 0, 12), who };
  if ((m = /^(?:give|put|add) (.+?) an? (\d{1,2}) ?px border$/.exec(t)) && (who = ofWho(m[1])) && !who.none) return { op: 'fx', prop: 'border', value: PX(m[2], 0, 12), who };
  if ((m = /^(?:remove|clear|take off|no)(?: the)? border(?: (?:from|on|of) (.+))?$/.exec(t)) && (who = ofWho(m[1]))) return { op: 'fx', prop: 'border', value: 0, who };
  // corner radius
  if ((m = /^(?:set |change |make )?(?:the )?(?:corner radius|corner roundness|rounding)(?: (?:of|on|for) (.+?))?(?: to| at)? (\d{1,3}) ?(?:px)?$/.exec(t)) && (who = ofWho(m[1]))) return { op: 'fx', prop: 'radius', value: PX(m[2], 0, 60), who };
  if ((m = /^round(?: off)? (?:the )?corners(?: (?:of|on) (.+?))?(?: (?:to|by) (\d{1,3}) ?(?:px)?)?$/.exec(t)) && (who = ofWho(m[1]))) return { op: 'fx', prop: 'radius', value: m[2] ? PX(m[2], 0, 60) : 24, who };
  if ((m = /^(?:square|sharp|sharpen)(?: off)? (?:the )?corners(?: (?:of|on) (.+))?$/.exec(t)) && (who = ofWho(m[1]))) return { op: 'fx', prop: 'radius', value: 0, who };
  // shadow
  if ((m = /^(?:turn |switch )?(?:on|add|give|put)(?: a| the)? (?:drop )?shadow(?: (?:on|to|for|around) (.+))?$/.exec(t)) && (who = ofWho(m[1]))) return { op: 'fx', prop: 'shadow', value: true, who };
  if ((m = /^(?:turn |switch )?(?:off|remove|clear|take off|no)(?: the)? (?:drop )?shadow(?: (?:on|from|of|for) (.+))?$/.exec(t)) && (who = ofWho(m[1]))) return { op: 'fx', prop: 'shadow', value: false, who };
  if ((m = /^(?:drop )?shadow (on|off)(?: (?:on|for|of) (.+))?$/.exec(t)) && (who = ofWho(m[2]))) return { op: 'fx', prop: 'shadow', value: m[1] === 'on', who };
  if ((m = /^(?:reset|clear|undo)(?: the)? (?:styles?|styling|look)(?: (?:of|on|for) (.+))?$/.exec(t)) && (who = ofWho(m[1]))) return { op: 'reset', who };
  // the stage itself
  if ((m = new RegExp('^(?:set |make |change |turn )?(?:the |my )?(?:stage |(?:verse|void) )?background(?: colou?r)?(?: to| is| =)? ' + COLOR_RE + '$').exec(t)) || (m = new RegExp('^(?:make|turn) the (?:stage |(?:verse|void) )?background ' + COLOR_RE + '$').exec(t))) return { op: 'bg', color: colorOf(m[1]) };
  if (/^(?:reset|restore|clear|default)(?: the| my)? (?:stage )?background(?: colou?r)?$|^background (?:colou?r )?(?:default|reset)$/.test(t)) return { op: 'bg', color: '' };
  if (/^(?:set |use |choose |pick |add |change )?(?:a |an |my |the )?(?:local |own )?(?:image|picture|photo)(?: from (?:my )?(?:files|computer|device|phone))?(?: file)? (?:as|for) (?:the |my )?(?:stage )?background$|^(?:stage )?background (?:image|picture|photo)$|^(?:set|use|choose|pick|change) (?:a |the |my )?(?:stage )?background (?:image|picture|photo)(?: from (?:my )?(?:files|computer|device|phone))?$/.test(t)) return { op: 'bgimage' };
  if ((m = /^blur(?: the| my)?(?: stage)? background(?: (?:by |to )?(\d{1,2}) ?(?:px)?)?$/.exec(t))) return { op: 'blur', px: m[1] ? PX(m[1], 0, 30) : 8 };
  if (/^(?:unblur|sharpen)(?: the| my)?(?: stage)? background$|^(?:stage )?background blur off$|^(?:turn |switch )?(?:the |my )?blur(?: the| my)?(?: stage)? background off$|^(?:make )?(?:the |my )?(?:stage )?background (?:sharp|clear) again$|^no (?:stage )?background blur$|^(?:remove|clear|turn off)(?: the)? background blur$/.test(t)) return { op: 'blur', px: 0 };
  if (/^(?:turn on |switch on |enable |use |go )?(?:high[- ]contrast|high contrast mode)(?: mode)?(?: on)?$/.test(t)) return { op: 'contrast', on: true };
  if (/^(?:turn off |switch off |disable |stop |no )(?:high[- ]contrast)(?: mode)?$|^high[- ]contrast(?: mode)? off$|^normal contrast$/.test(t)) return { op: 'contrast', on: false };
  if (/^(?:turn on |switch on |enable |use )?(?:larger|large|bigger|big) (?:type|text|font) mode(?: on)?$|^(?:larger|large) type$/.test(t)) return { op: 'type', on: true };
  if (/^(?:turn off |switch off |disable |stop |no )(?:larger|large|bigger|big) (?:type|text|font) mode$|^(?:larger|large) (?:type|text) mode off$|^normal (?:type|text) size$/.test(t)) return { op: 'type', on: false };
  return null;
}

/** the inline style a card's fx record draws: { opacity, boxShadow, border, borderRadius } as strings ('' = leave the card's own). Pure. */
export function fxStyle(fx) {
  const f = fx || {}, out = { opacity: '', boxShadow: '', borderWidth: '', borderStyle: '', borderColor: '', borderRadius: '', filter: '' };
  if (Number.isFinite(+f.opacity) && f.opacity != null) out.opacity = String(Math.max(0.05, Math.min(1, +f.opacity / 100)));
  const parts = [];
  if (f.tint) parts.push('inset 0 0 0 999px ' + rgba(f.tint, 0.3));
  if (f.shadow === true) parts.push('0 12px 28px rgba(0,0,0,.55)');
  if (parts.length) out.boxShadow = parts.join(', ');
  else if (f.shadow === false) { out.boxShadow = 'none'; out.filter = 'none'; }
  if (f.shadow === false && f.tint) { out.boxShadow = 'inset 0 0 0 999px ' + rgba(f.tint, 0.3); out.filter = 'none'; }
  if (Number.isFinite(+f.border) && f.border != null) { out.borderWidth = (+f.border) + 'px'; out.borderStyle = +f.border > 0 ? 'solid' : 'none'; if (+f.border > 0) out.borderColor = 'rgba(255,255,255,.65)'; }
  if (Number.isFinite(+f.radius) && f.radius != null) out.borderRadius = (+f.radius) + 'px';
  return out;
}
/** a fx record after setting one property (a '' tint, a null shadow clears it); an empty record is null. Pure. */
export function withFx(fx, prop, value) {
  const f = { ...(fx || {}) };
  if (value === '' || value == null || (prop === 'opacity' && +value >= 100)) delete f[prop]; else f[prop] = value;
  return Object.keys(f).length ? f : null;
}
/** the stage background colour as the look the page keeps (bg and glow, both the one solid colour). Pure. */
export function solidLook(color) { const c = colorOf(color); return c ? { bg: c, glow: c } : null; }

// ---------- asks: stage-organize ----------
const NAME = '([a-z0-9][a-z0-9 _-]{0,38}?)';
export const cleanName = (s) => String(s || '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, ' ').slice(0, 40);
const toName = (s) => cleanName(norm(s));
/** { op, ... } for folders, tags, colour labels, layouts, snapshots, diffs, templates and "clear unkept"; null for anything else. Pure. */
export function organizeOf(text) {
  const t = norm(text); let m, who;
  // clear unkept
  if (/^clear(?: the stage| everything)?(?: except| but)? (?:the )?(?:unkept|not kept)(?: things| cards| stuff| ones)?(?: only)?$|^clear (?:the )?unkept(?: things| cards| stuff| ones)?(?: only)?$|^(?:clear|remove|dismiss|throw away) (?:all )?(?:the )?unkept(?: things| cards| stuff| ones)?$|^clear (?:everything|all|the stage) (?:except|but) (?:the )?kept(?: ones| things| cards| items)?$|^clear (?:only )?unkept(?: only)?$/.test(t)) return { op: 'clear-unkept' };
  // snapshots
  if ((m = new RegExp('^(?:take |save |make |create )?(?:a )?snapshot(?: of (?:the |this )?stage)?(?: as| called| named| titled| for)? ' + NAME + '$').exec(t)) && !/^(?:diffs?|compare)\b/.test(m[1]) && !/^snapshots?$/.test(m[1])) return { op: 'snap-save', name: toName(m[1]) };
  if ((m = new RegExp('^(?:restore|load|apply|go back to|roll back to|revert to) (?:the )?snapshot ' + NAME + '$').exec(t))) return { op: 'snap-restore', name: toName(m[1]) };
  if (/^(?:list|show|what are)(?: me)?(?: my| the| all)?(?: saved| named)? snapshots(?: i have)?$/.test(t)) return { op: 'snap-list' };
  if ((m = new RegExp('^(?:delete|remove|forget) (?:the )?snapshot ' + NAME + '$').exec(t))) return { op: 'snap-delete', name: toName(m[1]) };
  if ((m = /^(?:diff|compare)(?: the)? snapshots? (.+?) (?:and|with|to|vs\.?|versus|against) (.+)$/.exec(t))) return { op: 'snap-diff', a: toName(m[1]), b: toName(m[2].replace(/^snapshot\s+/, '')) };
  // layouts
  if ((m = new RegExp('^save (?:this |the |my )?(?:stage )?layout(?: as| called| named)? ' + NAME + '$').exec(t)) || (m = new RegExp('^(?:remember|keep) (?:this |the )?(?:stage )?layout(?: as| called| named) ' + NAME + '$').exec(t))) return { op: 'layout-save', name: toName(m[1]) };
  if ((m = new RegExp('^(?:restore|load|apply|use|go to|switch to|bring back) (?:the )?(?:stage )?layout ' + NAME + '$').exec(t))) return { op: 'layout-restore', name: toName(m[1]) };
  if (/^(?:list|show)(?: me)?(?: my| the| all)?(?: saved)? (?:stage )?layouts$/.test(t)) return { op: 'layout-list' };
  if ((m = new RegExp('^(?:delete|remove|forget) (?:the )?layout ' + NAME + '$').exec(t))) return { op: 'layout-delete', name: toName(m[1]) };
  if ((m = new RegExp('^duplicate (?:the )?(?:stage )?layout ' + NAME + ' (?:as|to|called|named) ' + NAME + '$').exec(t))) return { op: 'layout-duplicate', from: toName(m[1]), name: toName(m[2]) };
  if ((m = new RegExp('^duplicate (?:this |the |my |current )?(?:stage )?layout(?: (?:as|to|called|named) ' + NAME + ')?$').exec(t))) return { op: 'layout-duplicate', from: '', name: toName(m[1] || '') };
  // templates
  if ((m = new RegExp('^(?:save|make|turn) (?:this |the )?(?:stage )?(?:as )?(?:a )?template(?: called| named| as)? ' + NAME + '$').exec(t)) || (m = new RegExp('^make (?:this |the )?stage a template(?: called| named)? ' + NAME + '$').exec(t))) return { op: 'template-save', name: toName(m[1]) };
  if ((m = new RegExp('^(?:new stage from|start from|use|apply|build from|load) (?:the )?template ' + NAME + '$').exec(t))) return { op: 'template-use', name: toName(m[1]) };
  if (/^(?:list|show)(?: me)?(?: my| the| all)?(?: saved)? templates$/.test(t)) return { op: 'template-list' };
  if ((m = new RegExp('^(?:delete|remove|forget) (?:the )?template ' + NAME + '$').exec(t))) return { op: 'template-delete', name: toName(m[1]) };
  // folders (for kept items)
  if ((m = new RegExp('^(?:put|file|move|add|store) (.+?) (?:in|into|under|to) (?:the |a )?folder ' + NAME + '$').exec(t)) && (who = whoOf(m[1]))) return { op: 'folder-put', who, name: toName(m[2]) };
  if ((m = new RegExp('^(?:new|make|create|add) (?:a )?folder ' + NAME + '$').exec(t))) return { op: 'folder-new', name: toName(m[1]) };
  if ((m = new RegExp('^(?:open|show|go to|view) (?:the )?folder ' + NAME + '$').exec(t))) return { op: 'folder-open', name: toName(m[1]) };
  if (/^(?:close|leave|exit)(?: the| this)? folder$|^(?:show|open) (?:all|every) folders$|^(?:leave|close) folders$|^show everything again$/.test(t)) return { op: 'folder-close' };
  if (/^(?:list|show)(?: me)?(?: my| the| all)? folders$|^folders$/.test(t)) return { op: 'folder-list' };
  if ((m = /^(?:take|remove|pull) (.+?) (?:out of|from) (?:its |their |the |a )?folders?$/.exec(t)) && (who = whoOf(m[1]))) return { op: 'folder-put', who, name: '' };
  // tags
  if ((m = /^tag (.+?) (?:as|with) (.+)$/.exec(t)) && (who = whoOf(m[1]))) { const tags = tagsOf(m[2]); if (tags.length) return { op: 'tag', who, tags }; }
  if ((m = /^(?:untag|remove (?:the )?tags?) (.+?)(?: from (.+))?$/.exec(t))) {
    if (m[2] && (who = whoOf(m[2]))) return { op: 'untag', who, tags: tagsOf(m[1]) };
    if (!m[2] && (who = whoOf(m[1]))) return { op: 'untag', who, tags: [] };
    if (/^(?:all|every)(?: the)? tags?$/.test(m[1]) && !m[2]) return { op: 'untag', who: { none: true }, tags: [] };
  }
  if ((m = /^(?:remove|clear|delete) all tags(?: (?:from|on|of) (.+))?$/.exec(t)) && (who = whoOf(m[1] || ''))) return { op: 'untag', who, tags: [] };
  if (/^(?:list|show)(?: me)?(?: my| the| all)? tags$|^tags$/.test(t)) return { op: 'tag-list' };
  if ((m = /^(?:show|filter|display)(?: only| just)?(?: the)?(?: things| cards| stuff| items)?(?: tagged| with tag| by tag| for tag| with the tag)(?: as)? (.+)$/.exec(t)) || (m = /^filter (?:the stage )?by tag (.+)$/.exec(t)) || (m = /^(?:show|open) tag (.+)$/.exec(t))) { const tg = tagsOf(m[1]); if (tg.length) return { op: 'tag-filter', tag: tg[0] }; }
  if (/^(?:clear|remove|reset|turn off)(?: the)? tag filter$|^show (?:all|every) tags$|^unfilter tags$|^show (?:everything|all cards|all things) (?:again )?(?:regardless of|ignoring) tags$/.test(t)) return { op: 'tag-clear' };
  // colour labels
  if ((m = new RegExp('^colou?r[- ]?(?:label|code|mark) (.+?)(?: as| in| with)? ' + COLOR_RE + '$').exec(t)) && (who = whoOf(m[1]))) return { op: 'dot', who, color: colorOf(m[2]) };
  if ((m = new RegExp('^give (.+?) an? ' + COLOR_RE + ' (?:dot|colou?r label|colou?r tag)$').exec(t)) && (who = whoOf(m[1])) && !who.none) return { op: 'dot', who, color: colorOf(m[2]) };
  if ((m = /^(?:remove|clear) (?:the )?colou?r labels?(?: (?:from|on|of) (.+))?$/.exec(t)) && (who = whoOf(m[1] || ''))) return { op: 'dot', who, color: '' };
  return null;
}
/** "work, home and errands" to ['work', 'home', 'errands'] (lower-cased, up to 5, 24 characters each). Pure. */
export function tagsOf(s) {
  return String(s || '').toLowerCase().replace(/^(?:the )?(?:tags?\s+)?/, '').split(/\s*(?:,|&|\band\b)\s*/).map((x) => x.trim().replace(/^["'#]|["']$/g, '').replace(/[^a-z0-9 _-]/g, '').trim().slice(0, 24)).filter(Boolean).slice(0, 5);
}

// ---------- named things kept on this device ----------
/** a thing's name for people: its label, name or title, else its kind; a second of the same gets " 2". Pure. */
export function namesOf(things) {
  const out = {}, seen = {};
  for (const [id, t] of Object.entries(things || {})) {
    if (!t || typeof t !== 'object') continue;
    const base = String(t.label || t.name || t.title || t.kind || 'thing').slice(0, 40).trim() || 'thing';
    seen[base] = (seen[base] || 0) + 1; out[id] = seen[base] > 1 ? base + ' ' + seen[base] : base;
  }
  return out;
}
/** what changed between two stages, by name only: { added, removed, moved }. Pure. */
export function diffNames(a, b) {
  const na = namesOf(a), nb = namesOf(b), added = [], removed = [], moved = [];
  for (const id of Object.keys(b || {})) if (!(a && a[id])) added.push(nb[id]);
  for (const id of Object.keys(a || {})) if (!(b && b[id])) removed.push(na[id]);
  for (const id of Object.keys(b || {})) { const p = a && a[id], q = b[id]; if (p && q && (Math.abs((+p.x || 0) - (+q.x || 0)) > 2 || Math.abs((+p.y || 0) - (+q.y || 0)) > 2)) moved.push(nb[id]); }
  return { added: added.sort(), removed: removed.sort(), moved: moved.sort() };
}
/** the diff as one line of names. Pure. */
export function diffLine(d, a, b) {
  const part = (label, list) => (list.length ? label + ' ' + list.join(', ') : '');
  const s = [part('only in ' + b, d.added), part('only in ' + a, d.removed), part('moved', d.moved)].filter(Boolean).join(' · ');
  return s || a + ' and ' + b + ' have the same things in the same places';
}
/** where every thing stands: { id: {x, y, kind} }. Pure. */
export function layoutOf(things) {
  const out = {};
  for (const [id, t] of Object.entries(things || {})) if (t && t.kind !== 'figure' && Number.isFinite(+t.x) && Number.isFinite(+t.y)) out[id] = { x: Math.round(+t.x), y: Math.round(+t.y), kind: t.kind };
  return out;
}
/** move the things a layout names back to where it had them; returns how many moved and how many are not on the stage any more. Mutates `things`. */
export function applyLayout(things, layout) {
  let moved = 0, missing = 0;
  for (const [id, p] of Object.entries(layout || {})) {
    const t = things && things[id];
    if (!t) { missing++; continue; }
    if (t.x !== p.x || t.y !== p.y) { t.x = p.x; t.y = p.y; t.pinned = true; moved++; }
  }
  return { moved, missing };
}
/** a template keeps what is on the stage and where, and none of what was typed into it: [{ kind, x, y }]. Pure. */
export function templateOf(things) {
  return Object.values(things || {}).filter((t) => t && t.kind !== 'figure' && t.kind !== 'tab' && Number.isFinite(+t.x) && Number.isFinite(+t.y)).slice(0, 40).map((t) => ({ kind: String(t.kind), x: Math.round(+t.x), y: Math.round(+t.y) }));
}
/** a small named collection: put (newest first, at most `max`), get, remove. Pure; returns new objects. */
export function putNamed(bag, name, value, max = 12) {
  const next = { ...(bag || {}) }; delete next[name]; next[name] = { ...value, at: value && value.at || 0 };
  const names = Object.keys(next).sort((p, q) => (next[q].at || 0) - (next[p].at || 0)).slice(0, max), out = {};
  for (const n of names) out[n] = next[n];
  return out;
}
export function dropNamed(bag, name) { const next = { ...(bag || {}) }; const had = name in next; delete next[name]; return { bag: next, had }; }
/** is a thing one the person keeps? A kept answer, a locked thing, or one marked keep. "clear unkept" leaves these. Pure. */
export const isKept = (t) => !!t && (t.kind === 'kept' || t.locked === true || t.keep === true);
/** ids of the things "clear unkept" would clear. Pure. */
export const unkeptIds = (things) => Object.entries(things || {}).filter(([, t]) => t && t.kind !== 'figure' && !isKept(t)).map(([id]) => id);
/** the folders in use with how many things each holds: [{ name, n }]. Pure. */
export function foldersOf(things) {
  const n = {}; for (const t of Object.values(things || {})) if (t && t.folder) n[t.folder] = (n[t.folder] || 0) + 1;
  return Object.entries(n).map(([name, c]) => ({ name, n: c })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}
/** the tags in use with how many things carry each. Pure. */
export function tagCounts(things) {
  const n = {}; for (const t of Object.values(things || {})) if (t && Array.isArray(t.tags)) for (const g of t.tags) n[g] = (n[g] || 0) + 1;
  return Object.entries(n).map(([name, c]) => ({ name, n: c })).sort((a, b) => b.n - a.n || a.name.localeCompare(b.name));
}
/** does a thing show under the open folder and the tag filter? Pure. */
export const shows = (t, folder, tag) => (!folder || (t && t.folder === folder)) && (!tag || (t && Array.isArray(t.tags) && t.tags.includes(tag)));
