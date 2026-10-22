/**
 * label skill: labels and arrows on the stage (board "Later": text annotation / labels, connectors between objects).
 * "label the clock kitchen" puts a small tag on the clock that rides along when it moves; "draw an arrow from the clock
 * to the note" or "connect the timer to the counter" draws an arrow between two things that follows either one when it is
 * dragged or when its group moves (skills/group.js). "add a label that says to do" puts a free-floating label on the stage
 * that arrows can point at. A labelled thing can be named by its label: "connect kitchen to groceries".
 * Labels and arrows are saved with the stage (th.label, th.arrows), so they survive a reload; "undo" takes the last one back.
 * Living arrows (frontier #24, 2026-10-11, absorbed from tldraw computer without its palette or a model call per hop): an arrow
 * carries what its source produces. A thing emits a value (the page's emit(); a timer at 0:00 is the first) and deliver() hands
 * it to each thing its arrows point at, through that kind's receiveInput (a sticky writes it down); a short pulse runs along the
 * arrow. "connect the timer to the note in capitals" (or "... as a word count") transforms it on the way (PIPES, all plain code).
 * "lock the note" makes a thing ignore what arrows bring; "unlock the note" lets it listen again.
 * Empty surface stays empty: an ask on an empty stage only says so.
 */
import { KIND_WORDS } from './layer.js';
import { clean } from '../lib/ask-text.js';

const CLEAN = clean; // shared: lib/ask-text.js
const LOW = (s) => CLEAN(s).toLowerCase();
const QUOTE = /^["'“‘](.+)["'”’]$/;
const unquote = (s) => { const t = CLEAN(s); const m = QUOTE.exec(t); return m ? m[1].trim() : t; };
const ARTICLE = /^(?:the|my|this|that|a|an)\s+/;
const SELF = /^(?:it|this|that|this one|that one|the selected one|selected)$/;
const MAX_LABEL = 40;

/** One noun phrase ("the clock", "the kitchen clock", "kitchen", "it") to a reference, or null when it names no kind. */
export function refOf(words, loose) {
  const w = LOW(unquote(words)).replace(/^(?:the|my|this|that)\s+/, '').trim();
  if (!w) return null;
  if (SELF.test(w) || SELF.test(LOW(words))) return { self: true };
  const k = KIND_WORDS.find(([, re]) => re.test(w));
  if (k) return { kind: k[0] };
  // "the kitchen clock": a label in front of a kind word
  const parts = w.split(' ');
  if (parts.length >= 2) {
    const last = KIND_WORDS.find(([, re]) => re.test(parts[parts.length - 1]));
    if (last) return { kind: last[0], name: parts.slice(0, -1).join(' ') };
  }
  // a bare name ("kitchen") only where the ask itself is clearly about labels or arrows
  if (loose && /^[\p{L}\p{N}][\p{L}\p{N} '’&-]{0,39}$/u.test(w) && parts.length <= 4) return { name: w };
  return null;
}

function labelText(s) {
  let t = unquote(String(s || '').replace(/^(?:as|with|:)\s+/i, '').replace(/^(?:the\s+(?:label|tag|name|word)\s+)/i, ''));
  t = t.replace(/^(?:that\s+says|saying|reading|which\s+says)\s+/i, '');
  t = unquote(t);
  if (!t || t.length > MAX_LABEL) return null;
  return t;
}

// a transform on an arrow, said at the end of the ask: "... to the note in capitals", "... as a word count". Pure.
export const PIPES = {
  upper: (t) => String(t).toUpperCase(),
  count: (t) => { const n = (String(t).match(/\S+/g) || []).length; return n + (n === 1 ? ' word' : ' words'); },
};
const PIPE_RE = /\s+(?:in\s+(?:capitals|caps|capital\s+letters|upper\s*case)|as\s+(?:a\s+)?word\s+count|counting\s+(?:the\s+)?words)$/;
function pipeOf(s) {
  const m = PIPE_RE.exec(s);
  if (!m) return [s, null];
  return [s.slice(0, m.index), /word/.test(m[0]) ? 'count' : 'upper'];
}

/**
 * Parse an ask. Returns one of:
 *   { op: 'label', ref, text }          tag a thing ("label the clock kitchen")
 *   { op: 'free', text }                a free-floating label ("add a label that says to do")
 *   { op: 'unlabel', ref | 'all' }      take a tag off
 *   { op: 'arrow', from, to }           draw an arrow ("draw an arrow from the clock to the note")
 *   { op: 'unarrow', from?, to? | 'all' }
 *   { op: 'show' }
 *   { op: 'lock', ref, on }            "lock the note" / "unlock the note": a locked thing ignores what arrows bring
 * or null when the ask is not about labels or arrows.
 */
export function labelOf(text) {
  const raw = CLEAN(text).replace(/^(?:please\s+|can you\s+|could you\s+)/i, '');
  const t = raw.toLowerCase();
  let m;
  // free-floating label
  if ((m = /^(?:add|make|put|create|write|place|drop)\s+(?:a\s+)?(?:label|caption)\s+(?:that\s+says|saying|reading|which\s+says|with\s+the\s+words?|:)\s*(.+)$/i.exec(raw))
    || (m = /^(?:add|make|put|create|place)\s+(?:a\s+)?(?:label|caption)\s+(["'“‘].+["'”’])$/i.exec(raw))
    || (m = /^(?:write|put)\s+(["'“‘].+["'”’])\s+on\s+the\s+(?:stage|(?:verse|void)|screen)$/i.exec(raw))) {
    const tx = labelText(m[1]); return tx ? { op: 'free', text: tx } : null;
  }
  // remove labels
  if (/^(?:remove|delete|clear|erase|drop|take\s+off|take\s+away)\s+(?:all\s+(?:of\s+)?)?(?:the\s+|my\s+)?(?:labels|tags)$/.test(t) || /^(?:unlabel|untag)\s+(?:everything|all|it all)$/.test(t)) return { op: 'unlabel', ref: 'all' };
  if ((m = /^(?:remove|delete|clear|erase|drop|take)\s+(?:the\s+)?(?:label|tag)\s+(?:from|on|off(?:\s+of)?|of)\s+(.+)$/.exec(t)) || (m = /^(?:unlabel|untag)\s+(.+)$/.exec(t))
    || (m = /^take\s+(?:the\s+)?(?:label|tag)\s+off\s+(.+)$/.exec(t))) {
    const ref = refOf(m[1], true); return ref ? { op: 'unlabel', ref } : null;
  }
  if (/^(?:remove|delete|clear|erase|drop)\s+(?:the|that|this)\s+(?:label|tag)$/.test(t)) return { op: 'unlabel', ref: { self: true, any: true } };
  // remove arrows
  if (/^(?:remove|delete|clear|erase|drop|take\s+away|get\s+rid\s+of)\s+(?:all\s+(?:of\s+)?)?(?:the\s+|my\s+|that\s+|this\s+)?(?:arrows?|connectors?|connections?)$/.test(t) || /^(?:disconnect|unlink|unconnect)\s+(?:everything|all|it all)$/.test(t)) return { op: 'unarrow', ref: 'all' };
  if ((m = /^(?:disconnect|unlink|unconnect)\s+(.+?)\s+(?:from|and)\s+(.+)$/.exec(t)) || (m = /^(?:remove|delete|erase)\s+(?:the\s+)?(?:arrow|connector|connection)\s+(?:from|between)\s+(.+?)\s+(?:to|and)\s+(.+)$/.exec(t))) {
    const from = refOf(m[1], true), to = refOf(m[2], true); return from && to ? { op: 'unarrow', from, to } : null;
  }
  // lock / unlock a thing against what arrows bring (it must name a kind: "lock the screen" is not this)
  if ((m = /^(lock|unlock)\s+(.+)$/.exec(t))) {
    const ref = refOf(m[2], false); if (ref && (ref.kind || ref.self)) return { op: 'lock', ref, on: m[1] === 'lock' };
  }
  // draw an arrow: the arrow word makes it clear, so a bare label name is fine on either end
  if ((m = /^(?:draw|add|make|put|create)\s+(?:an?\s+)?(?:arrow|connector|line)\s+(?:from|between)\s+(.+?)\s+(?:to|and|towards?)\s+(.+)$/.exec(t))
    || (m = /^(?:point|aim)\s+(?:an?\s+)?arrow\s+(?:from\s+)?(.+?)\s+(?:to|at|towards?)\s+(.+)$/.exec(t))
    || (m = /^arrow\s+from\s+(.+?)\s+to\s+(.+)$/.exec(t))) {
    const [end, pipe] = pipeOf(m[2]);
    const from = refOf(m[1], true), to = refOf(end, true); return from && to ? { op: 'arrow', from, to, ...(pipe ? { pipe } : {}) } : null;
  }
  // "connect the clock to the note", "point the note at the clock": both ends must name a kind, or be quoted
  if ((m = /^(?:connect|link|wire|join\s+up|join)\s+(.+?)\s+(?:to|and|with)\s+(.+)$/.exec(t)) || (m = /^point\s+(.+?)\s+(?:at|to|towards?)\s+(.+)$/.exec(t))) {
    const [end, pipe] = pipeOf(m[2]);
    const strict = (s) => (QUOTE.test(CLEAN(s)) ? refOf(s, true) : refOf(s, false));
    const from = strict(m[1]), to = strict(end); return from && to && !(from.self && to.self) ? { op: 'arrow', from, to, ...(pipe ? { pipe } : {}) } : null;
  }
  // tag a thing
  if ((m = /^(?:put|add|stick|give\s+it|place)\s+(?:a\s+)?(?:label|tag|name)\s+(?:on|to)\s+(.+?)\s+(?:that\s+says|saying|reading|which\s+says|of|:)\s*(.+)$/i.exec(raw))) {
    const ref = refOf(m[1], false), tx = labelText(m[2]); return ref && tx ? { op: 'label', ref, text: tx } : null;
  }
  if ((m = /^give\s+(.+?)\s+(?:a|the)\s+(?:label|tag)\s*(?:of|:)?\s+(.+)$/i.exec(raw))) {
    const ref = refOf(m[1], false), tx = labelText(m[2]); return ref && tx ? { op: 'label', ref, text: tx } : null;
  }
  if ((m = /^(?:label|tag)\s+(it|this|that|this one|that one)\s+(?:as\s+|with\s+)?(.+)$/i.exec(raw))) {
    const tx = labelText(m[2]); return tx ? { op: 'label', ref: { self: true }, text: tx } : null;
  }
  if ((m = /^(?:label|tag)\s+((?:the|my|this|that)\s+\S+)\s+(?:as\s+|with\s+)?(.+)$/i.exec(raw))) {
    const ref = refOf(m[1], false), tx = labelText(m[2]); return ref && ref.kind && tx ? { op: 'label', ref, text: tx } : null;
  }
  if (/^(?:what\s+are\s+the|show(?:\s+me)?\s+the|list\s+the)\s+(?:labels|arrows|connections)$/.test(t)) return { op: 'show' };
  return null;
}

/** Which stage thing a reference means. Labels match first, then the selected or newest of a kind. Pure. */
export function pick(order, ref, selected) {
  const list = order.filter((t) => t && t.kind !== 'figure');
  if (!ref) return null;
  if (ref.self) {
    const s = list.find((t) => t.id === selected);
    if (ref.any) return (s && (s.label || s.kind === 'label') ? s : null) || [...list].reverse().find((t) => t.kind === 'label') || [...list].reverse().find((t) => t.label) || null;
    return s || list[list.length - 1] || null;
  }
  const named = (t) => ref.name && (LOW(t.label) === ref.name || (t.kind === 'label' && LOW(t.text) === ref.name));
  if (ref.name) {
    const hits = list.filter((t) => named(t) && (!ref.kind || t.kind === ref.kind));
    if (hits.length) return hits[hits.length - 1];
    if (!ref.kind) return null;
  }
  const hits = list.filter((t) => t.kind === ref.kind);
  if (!hits.length) return null;
  return hits.find((t) => t.id === selected) || hits[hits.length - 1];
}

/** Add an arrow from a to b (one per pair, either way round). Returns false when it was already there. Pure on the things. */
export function addArrow(a, b, pipe = null) {
  if (!a || !b || a === b) return false;
  if ((a.arrows || []).includes(b.id)) {
    if (!pipe || (a.pipes && a.pipes[b.id] === pipe)) return false;
    a.pipes = { ...(a.pipes || {}), [b.id]: pipe }; return true; // the same arrow, a new transform on it
  }
  if ((b.arrows || []).includes(a.id)) { b.arrows = b.arrows.filter((x) => x !== a.id); if (!b.arrows.length) delete b.arrows; dropPipe(b, a.id); }
  a.arrows = [...(a.arrows || []), b.id];
  if (pipe) a.pipes = { ...(a.pipes || {}), [b.id]: pipe };
  return true;
}
function dropPipe(x, id) { if (x && x.pipes && x.pipes[id]) { delete x.pipes[id]; if (!Object.keys(x.pipes).length) delete x.pipes; } }

/** Take the arrow between a and b off (either way round). Returns how many went. Pure on the things. */
export function dropArrow(a, b) {
  let n = 0;
  for (const [x, y] of [[a, b], [b, a]]) {
    if (x && y && x.arrows && x.arrows.includes(y.id)) { x.arrows = x.arrows.filter((id) => id !== y.id); n++; if (!x.arrows.length) delete x.arrows; dropPipe(x, y.id); }
  }
  return n;
}

/** The two ends of an arrow between two boxes {x,y,w,h}: from edge to edge along the line between their centres. Pure. */
export function arrowEnds(A, B, gap = 6) {
  const ca = { x: A.x + A.w / 2, y: A.y + A.h / 2 }, cb = { x: B.x + B.w / 2, y: B.y + B.h / 2 };
  const dx = cb.x - ca.x, dy = cb.y - ca.y;
  const edge = (box, sx, sy) => { // distance from the centre to the box edge along (sx, sy)
    const hx = box.w / 2, hy = box.h / 2;
    const tx = sx ? hx / Math.abs(sx) : Infinity, ty = sy ? hy / Math.abs(sy) : Infinity;
    return Math.min(tx, ty);
  };
  const len = Math.hypot(dx, dy);
  if (!len) return null;
  const ux = dx / len, uy = dy / len;
  const ta = edge(A, ux, uy) + gap, tb = edge(B, ux, uy) + gap;
  if (ta + tb >= len) return null; // overlapping boxes: no room for an arrow
  return { x1: ca.x + ux * ta, y1: ca.y + uy * ta, x2: cb.x - ux * tb, y2: cb.y - uy * tb };
}

// --- living arrows: what a thing produces goes along its arrows ---
/** Hand a value from one thing to everything its arrows point at that can take it (a kind with receiveInput) and is not locked;
 *  the arrow's transform (PIPES) runs on the way. Returns the ids that took it. Changes the receiving things. */
export function deliver(things, kinds, fromId, value) {
  const from = things && things[fromId];
  if (!from || !Array.isArray(from.arrows) || !value) return [];
  const took = [];
  for (const id of from.arrows) {
    const to = things[id], kind = to && kinds && kinds[to.kind];
    if (!to || to.locked || !kind || typeof kind.receiveInput !== 'function') continue;
    const f = from.pipes && PIPES[from.pipes[id]];
    const v = f && typeof value.text === 'string' ? { ...value, text: f(value.text) } : value;
    try { if (kind.receiveInput(to, v)) took.push(id); } catch (_) {}
  }
  return took;
}
// a dot that runs along the arrow from its source to its target, so the hand-over is seen
function pulse(root, fromId, toId) {
  const ln = root && root.querySelector && root.querySelector('.void-arrows line[data-from="' + fromId + '"][data-to="' + toId + '"]');
  if (!ln || typeof ln.animate !== 'function') return;
  const p = (k) => Number(ln.getAttribute(k)) || 0, x1 = p('x1'), y1 = p('y1'), x2 = p('x2'), y2 = p('y2');
  const dot = document.createElement('div');
  dot.className = 'void-annot void-pulse';
  dot.style.cssText = 'position:absolute;left:0;top:0;width:10px;height:10px;margin:-5px 0 0 -5px;border-radius:50%;background:#fff;box-shadow:0 0 12px 3px rgba(190,210,255,.8);pointer-events:none;z-index:2';
  root.appendChild(dot);
  const a = dot.animate([{ transform: 'translate(' + x1 + 'px,' + y1 + 'px)', opacity: 0.2 }, { transform: 'translate(' + x2 + 'px,' + y2 + 'px)', opacity: 1, offset: 0.85 }, { transform: 'translate(' + x2 + 'px,' + y2 + 'px)', opacity: 0 }], { duration: 900, easing: 'ease-in-out' });
  a.onfinish = () => dot.remove();
}
import { note as notePulse } from '../lib/pulse.js';
let lastStage = null; // the page's stageApi, kept from the last decorate(); outputs arrive as 'void:output' events
function onOutput(e) {
  const st = lastStage, d = e && e.detail;
  if (!st || !d || !st.things || !st.kinds) return;
  const took = deliver(st.things(), st.kinds(), d.id, d.value);
  if (!took.length) return;
  if (st.save) st.save();
  if (st.render) st.render();
  for (const id of took) notePulse(d.id, id); // the pulse is recorded the moment it is added, not when a poll looks (lib/pulse.js; asked by Verse)
  requestAnimationFrame(() => { for (const id of took) pulse(st.stage, d.id, id); });
}
if (typeof document !== 'undefined' && !globalThis.__voidLivingArrows) { globalThis.__voidLivingArrows = true; document.addEventListener('void:output', onOutput); }
// what a source produces, said when an arrow from it is drawn to a thing that can take it
const OUTPUTS = { timer: 'when the timer ends' };

const NAMES = { kept: 'card', sticky: 'note', calc: 'calculator' };
const nameOf = (t) => (t.kind === 'label' ? 'label “' + t.text + '”' : t.label ? (NAMES[t.kind] || t.kind) + ' “' + t.label + '”' : 'the ' + (NAMES[t.kind] || t.kind));
const refName = (ref) => (ref.name ? '“' + ref.name + '”' : 'no ' + (NAMES[ref.kind] || ref.kind || 'thing'));

// --- drawing: one overlay under the things (arrows) plus a small tag over each labelled thing ---
const SVGNS = 'http://www.w3.org/2000/svg';
function boxOf(root, t) {
  const el = root.querySelector('[data-id="' + (typeof CSS !== 'undefined' && CSS.escape ? CSS.escape(t.id) : String(t.id)) + '"]');
  if (!el) return null;
  return { el, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth || 1, h: el.offsetHeight || 1 };
}
// Ghosting on restore (asked by Verse, twice: "a 'visual ghosting' effect for labels and arrows during stage restoration to make memory recovery
// feel intentional"): the first time labels and arrows are drawn in the moments after a page load, they come back as ghosts (faint, blurred,
// dashed) and settle solid over about a second. Anything labelled later in the visit appears at once. Nothing moves under reduced motion.
export const GHOST_WINDOW_MS = 6000, GHOST_MS = 1100;
let ghostAt = null; // when the restore's ghosts began (performance.now()), or -1 once decided there is none
const GHOST_CSS = '@keyframes void-ghost-in{from{opacity:.12;filter:blur(2px)}to{opacity:1;filter:none}}'
  + '.void-ghost{animation:void-ghost-in ' + GHOST_MS + 'ms ease-out both}.void-arrows.void-ghost line{stroke-dasharray:4 5}'
  + '@media (prefers-reduced-motion:reduce){.void-ghost{animation:none}.void-arrows.void-ghost line{stroke-dasharray:none}}';
/** true while a page is still restoring its stage: the first drawing of annotations within GHOST_WINDOW_MS of load. Pure. */
export const restoring = (sinceLoadMs, already) => !already && sinceLoadMs >= 0 && sinceLoadMs < GHOST_WINDOW_MS;
function ghost(root) {
  const now = typeof performance !== 'undefined' ? performance.now() : Infinity;
  const nodes = [...root.querySelectorAll('.void-annot, .void-label')]; if (!nodes.length || ghostAt === -1) return;
  if (ghostAt === null) { if (!restoring(now, false)) { ghostAt = -1; return; } ghostAt = now;
    if (!document.getElementById('void-ghost-css')) { const st = document.createElement('style'); st.id = 'void-ghost-css'; st.textContent = GHOST_CSS; document.head.appendChild(st); }
    setTimeout(() => { ghostAt = -1; for (const n of root.querySelectorAll('.void-ghost')) n.classList.remove('void-ghost'); }, GHOST_MS + 150); }
  // a redraw during the fade (decorate draws the annotations afresh) carries on from where the fade is, never from the start
  for (const n of nodes) { n.classList.add('void-ghost'); n.style.animationDelay = -Math.round(now - ghostAt) + 'ms'; }
}
export function decorate(st) {
  if (st && st.things) lastStage = st;
  const root = st && st.stage;
  if (!root || !root.querySelector) return;
  root.querySelectorAll('.void-annot').forEach((n) => n.remove());
  const things = st.things ? st.things() : {};
  const list = Object.values(things).filter((t) => t && t.kind !== 'figure');
  const lines = [];
  for (const t of list) for (const id of t.arrows || []) if (things[id]) lines.push([t, things[id]]);
  if (lines.length) {
    const svg = document.createElementNS(SVGNS, 'svg');
    svg.setAttribute('class', 'void-annot void-arrows');
    svg.setAttribute('aria-hidden', 'true');
    const W = Math.max(root.scrollWidth, root.clientWidth), H = Math.max(root.scrollHeight, root.clientHeight);
    svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none;overflow:visible;z-index:0';
    const defs = document.createElementNS(SVGNS, 'defs'), mk = document.createElementNS(SVGNS, 'marker');
    mk.setAttribute('id', 'void-arrowhead'); mk.setAttribute('viewBox', '0 0 10 10'); mk.setAttribute('refX', '9'); mk.setAttribute('refY', '5');
    mk.setAttribute('markerWidth', '7'); mk.setAttribute('markerHeight', '7'); mk.setAttribute('orient', 'auto-start-reverse');
    const head = document.createElementNS(SVGNS, 'path'); head.setAttribute('d', 'M0,0 L10,5 L0,10 z'); head.setAttribute('fill', 'currentColor');
    mk.appendChild(head); defs.appendChild(mk); svg.appendChild(defs);
    svg.style.color = 'var(--muted, rgba(255,255,255,0.55))';
    for (const [a, b] of lines) {
      const A = boxOf(root, a), B = boxOf(root, b);
      if (!A || !B) continue;
      const e = arrowEnds(A, B);
      if (!e) continue;
      const ln = document.createElementNS(SVGNS, 'line');
      ln.setAttribute('x1', e.x1.toFixed(1)); ln.setAttribute('y1', e.y1.toFixed(1)); ln.setAttribute('x2', e.x2.toFixed(1)); ln.setAttribute('y2', e.y2.toFixed(1));
      ln.setAttribute('stroke', 'currentColor'); ln.setAttribute('stroke-width', '1.5'); ln.setAttribute('stroke-linecap', 'round');
      ln.setAttribute('marker-end', 'url(#void-arrowhead)');
      ln.setAttribute('data-from', a.id); ln.setAttribute('data-to', b.id);
      svg.appendChild(ln);
    }
    root.insertBefore(svg, root.firstChild); // under the things, so cards stay readable
  }
  for (const t of list) {
    if ((!t.label && !t.locked) || t.kind === 'label') continue;
    const B = boxOf(root, t);
    if (!B) continue;
    const tag = document.createElement('div');
    tag.className = 'void-annot void-tag';
    tag.dataset.for = t.id;
    tag.textContent = (t.label || '') + (t.locked ? (t.label ? ' · ' : '') + 'locked' : '');
    tag.style.cssText = 'position:absolute;left:' + B.x + 'px;top:' + Math.max(0, B.y - 20) + 'px;font-size:11px;letter-spacing:.04em;color:var(--muted, rgba(255,255,255,0.6));pointer-events:none;white-space:nowrap;max-width:240px;overflow:hidden;text-overflow:ellipsis'; // ellipsis-ok: drawn picture or short label, the full text is on the card
    root.appendChild(tag);
  }
  ghost(root);
}

// A free-floating label: just the words on the stage, draggable and throwable like anything else.
function mount(th, st) {
  const el = document.createElement('div');
  el.className = 'thing void-label';
  el.dataset.id = th.id;
  el.textContent = th.text || '';
  el.setAttribute('aria-label', 'label: ' + (th.text || ''));
  el.style.cssText += ';left:' + th.x + 'px;top:' + th.y + 'px;font-size:' + (Number(th.size) || 16) + 'px;color:' + (th.color || 'var(--fg, #eee)') + ';padding:2px 4px;cursor:grab;user-select:none;white-space:nowrap;letter-spacing:.02em';
  if (st.selected && st.selected() === th.id) el.style.outline = '1px solid rgba(255,255,255,0.25)';
  st.bindDrag(el, th);
  st.stage.appendChild(el);
}

async function run(text, api) {
  const hit = labelOf(text);
  if (!hit) return 'none';
  const say = (s) => { if (api.say) api.say(s); };
  const st = api.stage || {};
  const live = st.things ? st.things() : {};
  const order = Object.values(live);
  const selected = st.selected ? st.selected() : null;
  const snap = () => { if (st.snapshot) st.snapshot(); };
  const done = () => { if (st.save) st.save(); if (st.render) st.render(); return 'label'; };

  if (hit.op === 'free') {
    if (!api.summon) return 'none';
    snap();
    const root = st.stage || {}, W = root.clientWidth || 1280, H = root.clientHeight || 800;
    api.summon('label', { text: hit.text, x: Math.round(W / 2 - 60 + (order.length % 5) * 24), y: Math.round(H / 3 + (order.length % 5) * 24) });
    say('added a label “' + hit.text + '” · drag it anywhere, or draw an arrow from it');
    return 'label';
  }
  if (!order.filter((t) => t.kind !== 'figure').length) { say('the void is empty · summon something first, then label it'); return 'label'; }

  if (hit.op === 'label') {
    const t = pick(order, hit.ref, selected);
    if (!t) { say(refName(hit.ref) + ' on the stage'); return 'label'; }
    snap();
    if (t.kind === 'label') t.text = hit.text; else t.label = hit.text;
    say('labelled ' + (t.kind === 'label' ? 'it' : 'the ' + (NAMES[t.kind] || t.kind)) + ' “' + hit.text + '” · the label moves with it');
    return done();
  }
  if (hit.op === 'unlabel') {
    if (hit.ref === 'all') {
      const tagged = order.filter((t) => t.label), free = order.filter((t) => t.kind === 'label');
      if (!tagged.length && !free.length) { say('nothing is labelled'); return 'label'; }
      snap();
      for (const t of tagged) delete t.label;
      for (const t of free) delete live[t.id];
      say('took the labels off');
      return done();
    }
    const t = pick(order, hit.ref, selected);
    if (!t) { say(hit.ref.any ? 'nothing is labelled' : refName(hit.ref) + ' on the stage'); return 'label'; }
    if (t.kind !== 'label' && !t.label) { say('the ' + (NAMES[t.kind] || t.kind) + ' has no label'); return 'label'; }
    snap();
    if (t.kind === 'label') delete live[t.id]; else delete t.label;
    say('took the label off');
    return done();
  }
  if (hit.op === 'arrow') {
    const a = pick(order, hit.from, selected), b = pick(order, hit.to, selected);
    if (!a) { say(refName(hit.from) + ' on the stage'); return 'label'; }
    if (!b) { say(refName(hit.to) + ' on the stage'); return 'label'; }
    if (a === b) { say('that is the same thing · an arrow needs two'); return 'label'; }
    snap();
    if (!addArrow(a, b, hit.pipe || null)) { say('there is already an arrow from ' + nameOf(a) + ' to ' + nameOf(b)); return 'label'; }
    const kinds = st.kinds ? st.kinds() : {}, takes = !!(kinds[b.kind] && typeof kinds[b.kind].receiveInput === 'function');
    const live_ = OUTPUTS[a.kind] && takes ? ' · ' + OUTPUTS[a.kind] + ', ' + nameOf(b) + ' gets it' + (hit.pipe === 'upper' ? ' in capitals' : hit.pipe === 'count' ? ' as a word count' : '') : '';
    say('drew an arrow from ' + nameOf(a) + ' to ' + nameOf(b) + ' · it follows them when you drag' + live_);
    return done();
  }
  if (hit.op === 'unarrow') {
    if (hit.ref === 'all') {
      const with_ = order.filter((t) => t.arrows && t.arrows.length);
      if (!with_.length) { say('there are no arrows'); return 'label'; }
      snap();
      for (const t of with_) delete t.arrows;
      say('took the arrows away');
      return done();
    }
    const a = pick(order, hit.from, selected), b = pick(order, hit.to, selected);
    if (!a || !b) { say('no arrow between those'); return 'label'; }
    snap();
    if (!dropArrow(a, b)) { say('no arrow between ' + nameOf(a) + ' and ' + nameOf(b)); return 'label'; }
    say('took the arrow away');
    return done();
  }
  if (hit.op === 'lock') {
    const t = pick(order, hit.ref, selected);
    if (!t) { say(refName(hit.ref) + ' on the stage'); return 'label'; }
    if (!!t.locked === hit.on) { say(nameOf(t) + (hit.on ? ' is already locked' : ' is not locked')); return 'label'; }
    snap();
    if (hit.on) t.locked = true; else delete t.locked;
    say(hit.on ? 'locked ' + nameOf(t) + ' · it stays put and arrows bring it nothing until you unlock it' : 'unlocked ' + nameOf(t));
    return done();
  }
  if (hit.op === 'show') {
    const tags = order.filter((t) => t.label || t.kind === 'label').map((t) => (t.kind === 'label' ? '“' + t.text + '”' : (NAMES[t.kind] || t.kind) + ' “' + t.label + '”'));
    const arrows = order.reduce((n, t) => n + ((t.arrows || []).filter((id) => live[id]).length), 0);
    say((tags.length ? 'labels: ' + tags.join(', ') : 'no labels') + ' · ' + (arrows === 1 ? '1 arrow' : arrows + ' arrows'));
    return 'label';
  }
  return 'none';
}

export default {
  name: 'label',
  examples: ['label the clock kitchen', 'label the note groceries', 'label it pasta', 'put a label on the timer that says pasta',
    'give the clock a label of office', 'add a label that says to do', 'add a label "ideas"',
    'draw an arrow from the clock to the note', 'connect the timer to the counter', 'point the note at the clock',
    'draw an arrow from kitchen to groceries', 'link the clock and the note',
    'remove the label from the clock', 'unlabel the note', 'remove the labels', 'remove the arrows', 'disconnect the clock from the note',
    'show the labels'],
  nearMisses: ['connect to wifi', 'how do i connect my phone to my tv', 'link my spotify', 'what is a record label', 'label maker',
    'draw a line', 'add a sticky that says hi', 'group the clock and the note', 'point of view', 'make the clock bigger',
    'what does the label on my shirt mean', 'remove the clock', 'arrow the tv show'],
  labelOf,
  refOf,
  pick,
  addArrow,
  dropArrow,
  arrowEnds,
  decorate,
  stageKinds: { label: { mount } },
  match(lower, text) { return !!labelOf(text); },
  run,
  suite() {
    const s = { a: { id: 'a', kind: 'clock', x: 0, y: 0 }, b: { id: 'b', kind: 'sticky', x: 300, y: 0, label: 'groceries' }, c: { id: 'c', kind: 'label', text: 'ideas', x: 0, y: 300 } };
    const o = Object.values(s);
    const p = (q) => labelOf(q);
    const parse = p('label the clock kitchen').text === 'kitchen' && p('label the clock kitchen').ref.kind === 'clock'
      && p('put a label on the timer that says pasta').text === 'pasta' && p('label it "big plans"').text === 'big plans'
      && p('add a label that says to do').text === 'to do' && p('draw an arrow from kitchen to groceries').from.name === 'kitchen'
      && p('connect the timer to the counter').to.kind === 'counter' && p('remove the arrows').ref === 'all'
      && p('unlabel the note').ref.kind === 'sticky' && p('disconnect the clock from the note').op === 'unarrow'
      && !p('connect to wifi') && !p('how do i connect my phone to my tv') && !p('link my spotify') && !p('what is a record label')
      && !p('draw a line') && !p('add a sticky that says hi') && !p('group the clock and the note') && !p('remove the clock');
    const picks = pick(o, { name: 'groceries' }, null) === s.b && pick(o, { name: 'ideas' }, null) === s.c && pick(o, { kind: 'clock' }, null) === s.a
      && pick(o, { kind: 'sticky', name: 'groceries' }, null) === s.b && pick(o, { name: 'nope' }, null) === null;
    const added = addArrow(s.a, s.b) && !addArrow(s.a, s.b) && addArrow(s.b, s.a) && s.b.arrows[0] === 'a' && !s.a.arrows;
    const dropped = dropArrow(s.a, s.b) === 1 && !s.b.arrows;
    const e = arrowEnds({ x: 0, y: 0, w: 100, h: 50 }, { x: 300, y: 0, w: 100, h: 50 });
    const ends = e && Math.round(e.x1) === 106 && Math.round(e.x2) === 294 && e.y1 === 25 && arrowEnds({ x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: 0, w: 100, h: 100 }) === null;
    const ok = parse && picks && added && dropped && ends;
    return { ok, got: ok ? 'parse, pick, arrows, ends' : JSON.stringify({ parse, picks, added, dropped, ends, e }) };
  }
};
