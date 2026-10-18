/**
 * overload skill - too much at once (asked by the owner, 2026-10-18, stage pack E, the Opposite Era). "overload me" floods the stage
 * with 24 glitching mini-cards, each wearing a short label borrowed from the skill names the page already knows (skills/index.json;
 * a built-in handful when it cannot be read), laid out from a seed. Drag one onto another and they merge: the one dropped on grows a
 * size and the dropped one goes. "purge the overload" removes them all. They are never saved (ephemeral): a reload is a clean stage.
 * With reduced motion the cards glitch no more than they must (no animation). "overload a circuit" and "sensory overload symptoms"
 * are not this. The spawn, the drop target and the merge are pure and tested in tools/stage-pack-e.test.mjs.
 */
import { rng } from '../lib/opposite-era.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** 'spawn' | 'purge' | null. Pure. */
export function overloadOf(text) {
  const t = CLEAN(text);
  if (/^(?:overload(?:\s+me|\s+the\s+stage|\s+it)?|start\s+the\s+overload|flood\s+the\s+stage|overload\s+mode)$/.test(t)) return 'spawn';
  if (/^(?:(?:purge|clear|end|stop|remove|kill|dismiss)\s+(?:the\s+)?overload|overload\s+(?:off|over|purge)|purge\s+(?:the\s+)?(?:mini[- ]?cards|glitch(?:es|\s+cards)?))$/.test(t)) return 'purge';
  return null;
}

export const COUNT = 24, CARD_W = 78, CARD_H = 30;
export const FALLBACK = ['sticky', 'timer', 'clock', 'counter', 'weather', 'chess', 'joke', 'tip', 'calc', 'draw', 'moon', 'news', 'list', 'quiz', 'pong', 'snake', 'poster', 'recipe', 'breath', 'define', 'convert', 'loan', 'uv', 'sky'];
/** n mini-cards from a seed: a label each from `labels` (cycled when there are fewer than n), a spot inside { w, h }, a glitch flavour
 *  0..2 and a hue. Pure. */
export function spawnCards(seed, labels, bounds, n = COUNT) {
  const r = rng(seed), L = (labels && labels.length ? labels : FALLBACK).map((s) => String(s).slice(0, 14));
  const W = Math.max(CARD_W + 16, +bounds.w || 800), H = Math.max(CARD_H + 16, +bounds.h || 600);
  const out = [];
  for (let i = 0; i < n; i++) out.push({ id: 'overload-' + seed.toString(36) + '-' + i, kind: 'overload', label: L[r.int(L.length)], x: 8 + r.int(W - CARD_W - 16), y: 8 + r.int(H - CARD_H - 70), glitch: r.int(3), hue: r.int(360), size: 1 });
  return out;
}
/** the card a dropped one landed on: the other whose box holds the dropped one's centre, else the one it overlaps most; null when none.
 *  boxes: { id: { x, y, w, h } }. Pure. */
export function dropTarget(droppedId, boxes) {
  const d = boxes && boxes[droppedId]; if (!d) return null;
  const cx = d.x + d.w / 2, cy = d.y + d.h / 2; let best = null, bestA = 0;
  for (const [id, b] of Object.entries(boxes)) {
    if (id === droppedId || !b) continue;
    if (cx >= b.x && cx <= b.x + b.w && cy >= b.y && cy <= b.y + b.h) return id;
    const a = Math.max(0, Math.min(d.x + d.w, b.x + b.w) - Math.max(d.x, b.x)) * Math.max(0, Math.min(d.y + d.h, b.y + b.h) - Math.max(d.y, b.y));
    if (a > bestA) { bestA = a; best = id; }
  }
  return best;
}
/** two cards into one: the target grows by the dropped one's size and wears both labels; the dropped one is to be removed. Pure. */
export function merge(target, dropped) {
  const label = (String(target.label || '') + '+' + String(dropped.label || '')).slice(0, 40);
  return { keep: { ...target, size: (target.size || 1) + (dropped.size || 1), label }, drop: dropped.id };
}

let css = false;
function style() {
  if (css || typeof document === 'undefined') return; css = true;
  const s = document.createElement('style');
  s.textContent = '.overload-card{position:absolute;padding:4px 10px;border-radius:6px;font:12px/1.5 ui-monospace,monospace;color:#fff;background:#111;border:1px solid hsl(var(--oh) 90% 60%);text-shadow:2px 0 hsl(var(--oh) 100% 60%),-2px 0 hsl(calc(var(--oh) + 180) 100% 60%);cursor:grab;white-space:nowrap;user-select:none;box-shadow:0 0 10px hsl(var(--oh) 90% 60% / .6)}'
    + '.overload-card[data-glitch="0"]{animation:ovl-a 1.1s steps(2) infinite}.overload-card[data-glitch="1"]{animation:ovl-b .7s steps(3) infinite}.overload-card[data-glitch="2"]{animation:ovl-c 1.6s steps(4) infinite}'
    + '@keyframes ovl-a{0%{clip-path:inset(0 0 0 0)}25%{clip-path:inset(30% 0 20% 0);translate:2px 0}50%{clip-path:inset(0 0 0 0);translate:-2px 1px}75%{clip-path:inset(60% 0 5% 0)}100%{clip-path:inset(0)}}'
    + '@keyframes ovl-b{0%{filter:none}33%{filter:hue-rotate(90deg) contrast(1.6);translate:-3px 0}66%{filter:invert(.2);translate:3px -1px}100%{filter:none}}'
    + '@keyframes ovl-c{0%{opacity:1}20%{opacity:.4;skew:8deg}40%{opacity:1;translate:1px 2px}60%{opacity:.7;clip-path:inset(10% 0 50% 0)}100%{opacity:1;clip-path:inset(0)}}'
    + '@media (prefers-reduced-motion: reduce){.overload-card{animation:none!important}}';
  document.head.appendChild(s);
}
const cardsOf = (st) => Object.values(st.things()).filter((t) => t && t.kind === 'overload');
function mount(th, stageApi) {
  style();
  const el = document.createElement('div');
  el.className = 'thing overload-card'; el.dataset.id = th.id; el.dataset.glitch = String(th.glitch || 0); el.dataset.size = String(th.size || 1);
  el.style.left = th.x + 'px'; el.style.top = th.y + 'px'; el.style.setProperty('--oh', String(th.hue || 0));
  if ((th.size || 1) > 1) el.style.fontSize = Math.min(28, 12 + (th.size - 1) * 4) + 'px';
  el.textContent = th.label || 'overload';
  el.setAttribute('aria-label', 'overload card ' + (th.label || ''));
  stageApi.bindDrag(el, th);
  stageApi.stage.appendChild(el);
}
/** a card set down: on another overload card, the two merge */
function dropped(th, st) {
  const boxes = {};
  for (const t of cardsOf(st)) { const el = st.stage.querySelector('[data-id="' + CSS.escape(t.id) + '"]'); if (el) boxes[t.id] = { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth || CARD_W, h: el.offsetHeight || CARD_H }; }
  const onto = dropTarget(th.id, boxes); if (!onto) return;
  const things = st.things(), m = merge(things[onto], th);
  things[onto] = m.keep; delete things[m.drop];
  if (st.selected() === m.drop) st.select(onto);
  st.save(); st.render(); st.say('merged · ' + m.keep.label + ' is size ' + m.keep.size);
}
/** the labels: the skill names the page knows, else the built-in list */
async function labels() {
  try { const r = await fetch('/skills/index.json'); const j = await r.json(); if (Array.isArray(j) && j.length > 5) return j.filter((n) => typeof n === 'string' && n.length <= 14); } catch (_) {}
  return FALLBACK;
}
export function purge(st) {
  const things = st.things(), gone = cardsOf(st);
  for (const t of gone) { delete things[t.id]; if (st.selected() === t.id) st.select(null); }
  if (gone.length) { st.save(); st.render(); }
  return gone.length;
}

async function run(text, api) {
  const want = overloadOf(text);
  if (!want) return 'none';
  const st = api.stage;
  if (want === 'purge') { const n = purge(st); api.say(n ? 'purged · ' + n + ' card' + (n === 1 ? '' : 's') + ' gone' : 'no overload to purge'); return 'overload'; }
  const things = st.things(), L = await labels();
  for (const c of spawnCards((Date.now() % 100000) + 1, L, { w: st.stage.clientWidth || 800, h: st.stage.clientHeight || 600 })) things[c.id] = c;
  st.save(); st.render();
  api.say('overload · ' + COUNT + ' cards · drop one on another to merge them · "purge the overload" clears them');
  return 'overload';
}

export default {
  name: 'overload',
  examples: ['overload me', 'purge the overload'],
  nearMisses: ['overload a circuit', 'sensory overload symptoms', 'information overload meaning'],
  match(lower, text) { return !!overloadOf(text || lower); },
  run,
  overloadOf, spawnCards, dropTarget, merge,
  stageKinds: { overload: { mount, dropped, ephemeral: true } },
};
