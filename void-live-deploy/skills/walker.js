/**
 * walker skill: the cartoon you drew walks the stage (owner, 2026-10-25, on the cartoon card they drew: "drop him onto a solid floor so he actually
 * walks across a stage instead of drifting through space ... anchor him to a physical horizon line ... bottom: 24px ... a subtle CSS drop shadow cast
 * downward onto a rendered stage baseline"; "if a user taps or clicks on walking Claude, he drops a little diagnostic card or reacts with a speech bubble").
 * Every cartoon card has a "Let it walk" button (skills/cartoon.js); "let it walk", "make it walk" and "walk around" take the newest cartoon card's
 * painting. The figure is a 96 px sprite on the stage root, bottom 24 px (the horizon), with an elliptical shadow on a faint baseline under it; it
 * paces left and right at walking speed, bobs 3 px a step, turns and faces the other way at an edge, and stops now and then (lib/walker.js step, pure,
 * driven by requestAnimationFrame from the elapsed time). Reduced motion (the system setting or the a11y hard switch) stands it still. A tap shows
 * a speech bubble for 4 s with a true line the page counted itself (how many skills, how many sites surpassed, what it learned last, from
 * skills/index.json, the tower files, the growth ledger and self.json): never an invented number. Remembered in this browser (a2m.void.walker.v1:
 * the picture, its subject and the ask) so it is there on the next visit; "stop walking" takes it away and forgets it. The character is whatever
 * cartoon the person drew: nothing is drawn by this file.
 */
import { step, startState, shadowOf, factLines, pickLine, recordOf, parseRecord, tossOf, fly, dropX, SPRITE, FLOOR, BUBBLE_MS, STORE_KEY, LIFT } from '../lib/walker.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[’']/g, "'").replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const WHO = '(?:it|him|her|them|the (?:cartoon|toon|character|little guy))';
const WALK_RE = new RegExp('^(?:please\\s+)?(?:(?:let|make|have) ' + WHO + ' (?:walk|pace|stroll)(?: around| across the stage| about)?|' + WHO + ' walks?|walk around|(?:go|take) (?:for )?a walk|start walking)$');
const STOP_RE = /^(?:please\s+)?(?:stop (?:walking|the walk(?:ing|er)?|pacing)|(?:no more|enough) walking|(?:take|put) (?:it|him|her|them|the walker) (?:away|off the floor)|sit (?:it|him|her) down|(?:clear|remove|delete|get rid of|hide|throw away) (?:the )?(?:walker|walking (?:cartoon|figure|guy)|cartoon (?:that is |that's )?walking(?: around)?))$/;

/** 'walk' | 'stop' | null for an ask. Pure. */
export function walkOf(text) {
  const t = CLEAN(text);
  if (STOP_RE.test(t)) return 'stop';
  if (WALK_RE.test(t)) return 'walk';
  return null;
}

const CSS = '.walker-root{position:absolute;inset:0;pointer-events:none;z-index:0}' // its bottom is lifted by however far the ask bar (#dock) overlaps the stage, so the floor is the visible floor
  + '.walker-floor{position:absolute;left:0;right:0;bottom:' + FLOOR + 'px;height:1px;background:linear-gradient(90deg,transparent,rgba(255,255,255,.14) 15%,rgba(255,255,255,.14) 85%,transparent)}'
  + '.walker-shadow{position:absolute;bottom:' + (FLOOR - 5) + 'px;width:' + Math.round(SPRITE * 0.72) + 'px;height:12px;border-radius:50%;background:radial-gradient(ellipse at center,rgba(0,0,0,.9),rgba(0,0,0,.45) 55%,transparent 75%);filter:blur(2px);transform-origin:center}'
  + '.walker{position:absolute;bottom:' + FLOOR + 'px;width:' + SPRITE + 'px;height:' + SPRITE + 'px;padding:0;margin:0;border:0;background:none;cursor:pointer;pointer-events:auto;display:flex;align-items:flex-end;justify-content:center;filter:drop-shadow(0 6px 4px rgba(0,0,0,.35));touch-action:none}' // none: a finger on the figure lifts it (a drag or a throw), never a scroll of the page
  + '.walker:focus-visible{outline:2px solid rgba(170,190,255,.85);outline-offset:4px;border-radius:12px}'
  + '.walker img{width:' + SPRITE + 'px;height:' + SPRITE + 'px;object-fit:contain;display:block;pointer-events:none}'
  + '.walker .walker-emoji{font-size:' + Math.round(SPRITE * 0.8) + 'px;line-height:1;pointer-events:none}'
  + '.walker-bubble{position:absolute;--tail:50%;width:max-content;max-width:min(260px,calc(100vw - 32px));padding:8px 12px;border-radius:14px;background:#fffdf4;color:#1d1d1d;border:2px solid #1d1d1d;font:13px/1.35 system-ui,sans-serif;text-align:left;box-shadow:3px 3px 0 #1d1d1d;pointer-events:none}'
  + '.walker-bubble::after{content:"";position:absolute;left:var(--tail);bottom:-9px;width:12px;height:12px;background:#fffdf4;border-right:2px solid #1d1d1d;border-bottom:2px solid #1d1d1d;transform:translateX(-50%) rotate(45deg)}'
  + '.walker-bubble[hidden]{display:none}'
  + '.walker.walker-left{transform:scaleX(-1)}';

let live = null; // { root, el, shadow, bubble, state, raf, lastT, rec, said }
let facts = null, factsP = null;
const stageEl = () => (typeof document === 'undefined' ? null : document.getElementById('stage'));
const still = () => { try { return (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) || document.documentElement.classList.contains('a11y-motion'); } catch (_) { return false; } };
const read = () => { try { return parseRecord(localStorage.getItem(STORE_KEY)); } catch (_) { return null; } };
const write = (rec) => { try { localStorage.setItem(STORE_KEY, JSON.stringify(rec)); return true; } catch (_) { try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...rec, src: '' })); } catch (__) {} return false; } }; // a picture too big for the quota: the rest is kept, and the figure comes back as its emoji
const forget = () => { try { localStorage.removeItem(STORE_KEY); } catch (_) {} };

// what the bubble may say: counted from the site's own files once, on this page (never an invented number)
const get = async (u) => { try { const r = await fetch(u, { cache: 'no-store' }); return r.ok ? r.json() : null; } catch (_) { return null; } };
export async function gatherFacts() {
  if (facts) return facts;
  if (!factsP) factsP = (async () => {
    const f = {};
    const [idx, selfJ, ledger, inv, ev, fr] = await Promise.all([get('/skills/index.json'), get('/self.json'), get('/void.growth.json'), get('/lap.items.json'), get('/tower.evidence.json'), get('/tower.frontier.json')]);
    if (Array.isArray(idx)) f.skills = idx.length;
    if (selfJ && typeof selfJ === 'object') { if (typeof selfJ.about === 'string') f.about = selfJ.about; if (selfJ.canon && typeof selfJ.canon.motto === 'string') f.motto = selfJ.canon.motto; }
    try { const { tower } = await import('/lib/tower.js'); f.surpassed = tower((inv && inv.onlySite) || [], (ev && ev.floors) || {}, fr).beaten; } catch (_) {}
    try {
      const list = Array.isArray(ledger) ? ledger : (ledger && ledger.entries) || [];
      const newest = list.filter((e) => e && typeof e.at === 'string' && /^(?:grow|build|fix)$/.test(e.kind)).sort((a, b) => (a.at < b.at ? 1 : -1))[0];
      if (newest) { const { plainly } = await import('/skills/growth-tree.js'); f.learned = newest.show || plainly(newest.what); }
    } catch (_) {}
    facts = f; return f;
  })();
  return factsP;
}

function style() {
  if (document.getElementById('walker-css')) return;
  const s = document.createElement('style'); s.id = 'walker-css'; s.textContent = CSS; document.head.appendChild(s);
}

/** the figure (an <img> of the painting, else the emoji it was drawn as) */
function figure(rec) {
  if (rec.src) { const img = document.createElement('img'); img.src = rec.src; img.alt = ''; img.draggable = false; return img; }
  const e = document.createElement('span'); e.className = 'walker-emoji'; e.textContent = rec.emoji || '✏️'; e.setAttribute('aria-hidden', 'true'); return e;
}

/** how far the ask bar (#dock) overlaps the stage's bottom: on a phone the dock stands taller than the 72 px the stage leaves it, so the
 *  visible floor is the dock's top edge, not the stage's bottom (the first screenshot had the figure standing behind the ask bar) */
function dockLift(st) {
  const d = document.getElementById('dock'), dr = d && d.getBoundingClientRect(), sr = st.getBoundingClientRect();
  return dr && dr.height && dr.top < sr.bottom ? Math.round(sr.bottom - dr.top) : 0;
}

function paint() {
  if (!live) return;
  const { el, shadow, bubble, state, root } = live, sh = shadowOf(state.bob);
  root.style.bottom = live.lift + 'px';
  el.style.left = state.x + 'px';
  el.style.bottom = (FLOOR + state.bob) + 'px';
  el.classList.toggle('walker-left', state.dir < 0);
  el.dataset.x = String(Math.round(state.x)); el.dataset.dir = String(state.dir); el.dataset.bob = String(state.bob);
  shadow.style.left = (state.x + Math.round(SPRITE * 0.14)) + 'px';
  shadow.style.transform = 'scaleX(' + sh.scale + ')'; shadow.style.opacity = String(sh.opacity);
  if (!bubble.hidden) { // over the figure's head, kept inside the stage (it was cut off at the right edge), its tail pointing at the figure
    const W = live.width || SPRITE, bw = bubble.offsetWidth || 0, centre = state.x + SPRITE / 2, left = Math.max(8, Math.min(W - bw - 8, centre - bw / 2));
    bubble.style.left = left + 'px'; bubble.style.bottom = (FLOOR + SPRITE + 14 + state.bob) + 'px'; bubble.style.setProperty('--tail', Math.max(14, Math.min(bw - 14, centre - left)) + 'px');
  }
}

function frame(t) {
  if (!live) return;
  const dt = live.lastT ? t - live.lastT : 16; live.lastT = t;
  if (live.held || live.flying) { live.raf = requestAnimationFrame(frame); return; } // in the hand or in the air: it does not walk
  const st = stageEl(); if (!st) { live.raf = requestAnimationFrame(frame); return; }
  if (!(live.n++ % 4)) { live.lift = dockLift(st); live.width = st.clientWidth; } // the floor and the width, looked up every few frames (the ask bar grows with a whispered line; a turned phone; a resized window)
  live.state.still = still();
  live.state = step(live.state, dt, live.width, Math.random);
  paint();
  live.raf = requestAnimationFrame(frame);
}

const label = (rec) => (rec.subject ? 'Cartoon ' + rec.subject : 'your cartoon') + ', walking the stage. Tap for a word from Verse.';

function speak() {
  if (!live) return;
  const { bubble } = live;
  const lines = factLines(facts || {}), line = pickLine(lines, Math.random, live.said);
  live.said = line; bubble.textContent = line; bubble.hidden = false; live.el.setAttribute('aria-label', (live.rec.subject ? 'Cartoon ' + live.rec.subject : 'the walker') + ' says: ' + line);
  paint(); // placed over the head at once, inside the stage
  clearTimeout(live.bubbleT); live.bubbleT = setTimeout(() => { if (live) { live.bubble.hidden = true; live.el.setAttribute('aria-label', label(live.rec)); } }, BUBBLE_MS);
  // the first tap before the count landed: the line is replaced by a counted one as soon as it has
  if (!facts) gatherFacts().then(() => { if (live && !live.bubble.hidden && lines.length === 0) { const l2 = pickLine(factLines(facts), Math.random); live.said = l2; live.bubble.textContent = l2; } }).catch(() => {});
}

// the friction slider's setting (skills/friction.js through the page's window.voidTossFriction), the stage's 0.995 when there is none
const friction = () => { try { const f = typeof window !== 'undefined' && window.voidTossFriction ? window.voidTossFriction() : 0.995; return Number.isFinite(f) ? f : 0.995; } catch (_) { return 0.995; } };

/** gone for good: off the stage and forgotten (a throw, a cleared stage) */
function drop(me) {
  cancelAnimationFrame(me.raf); cancelAnimationFrame(me.flyRaf || 0); clearTimeout(me.bubbleT); me.root.remove();
  if (live === me) live = null;
}

/** a press on the figure, like any thing on the stage (index.html bindDrag): a tap is a tap (the click speaks), a move of LIFT px lifts it in the
 *  hand, a flick (or a release off the stage) throws it: it flies with gravity and spin and is gone, and forgotten; a slow drop sets it back on the
 *  floor where it was let go, and it walks on from there */
function grab(e) {
  e.stopPropagation(); // never a drag of the stage
  const me = live, st = stageEl();
  if (!me || !st || me.flying || e.button > 0) return;
  const x0 = e.clientX, y0 = e.clientY;
  let held = false, dx = 0, dy = 0, vx = 0, vy = 0, lx = x0, ly = y0, lt = performance.now();
  const mirror = () => (me.state.dir < 0 ? ' scaleX(-1)' : '');
  const move = (ev) => {
    if (live !== me) return;
    if (!held) {
      if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < LIFT) return;
      held = true; me.held = true; me.bubble.hidden = true; me.shadow.style.opacity = '0.2';
      document.documentElement.classList.add('dragging');
    }
    dx = ev.clientX - x0; dy = ev.clientY - y0;
    const now = performance.now(), dt = Math.max(16, now - lt); // a real frame's worth: synthetic near-zero gaps never read as a flick
    vx = (ev.clientX - lx) / dt; vy = (ev.clientY - ly) / dt; lx = ev.clientX; ly = ev.clientY; lt = now;
    me.el.style.transform = 'translate(' + dx + 'px,' + dy + 'px) rotate(-6deg)' + mirror(); // lifted in the hand
  };
  const up = () => {
    window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up);
    if (!held) return;
    document.documentElement.classList.remove('dragging');
    me.heldAt = performance.now();
    if (live !== me) return;
    const sr = st.getBoundingClientRect(), r = me.el.getBoundingClientRect();
    if (!tossOf({ x: r.left - sr.left, y: r.top - sr.top, w: r.width, h: r.height, vx, vy, stageW: sr.width, stageH: sr.height }).thrown) {
      me.state = { ...me.state, x: dropX(me.state.x + dx, me.width || st.clientWidth), bob: 0 }; // a slow drop: back on the floor, here
      me.el.style.transform = ''; me.shadow.style.opacity = ''; me.held = false; paint();
      return;
    }
    // thrown: it leaves at once (forgotten now, so a reload during the flight does not bring it back); only its picture flies
    me.held = false; me.flying = true; forget();
    me.shadow.style.opacity = '0'; me.root.querySelector('.walker-floor').style.opacity = '0';
    let f = { x: dx, y: dy, vx: vx || (dx < 0 ? -1.2 : 1.2), vy: vy || -0.4, spin: 0 }, prev = performance.now();
    f.spin = f.vx * 40;
    const fr = friction();
    const stepFly = (t) => {
      if (!me.root.isConnected) return;
      const dt = Math.min(32, t - prev); prev = t;
      f = fly(f, dt, fr);
      me.el.style.transform = 'translate(' + f.x + 'px,' + f.y + 'px) rotate(' + f.spin + 'deg)' + mirror();
      const s = st.getBoundingClientRect(), b = me.el.getBoundingClientRect();
      if (b.right < s.left || b.bottom < s.top || b.left > s.right || b.top > s.bottom) { drop(me); return; }
      me.flyRaf = requestAnimationFrame(stepFly);
    };
    me.flyRaf = requestAnimationFrame(stepFly);
  };
  window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
}

/** put the figure on the stage from a record; replaces one already walking */
function mount(rec) {
  const st = stageEl(); if (!st) return null;
  style(); unmount(false);
  const root = document.createElement('div'); root.className = 'walker-root'; root.id = 'walker';
  const floor = document.createElement('div'); floor.className = 'walker-floor'; floor.setAttribute('aria-hidden', 'true');
  const shadow = document.createElement('div'); shadow.className = 'walker-shadow'; shadow.setAttribute('aria-hidden', 'true');
  const el = document.createElement('button'); el.type = 'button'; el.className = 'walker'; el.dataset.subject = rec.subject || ''; el.setAttribute('aria-label', label(rec)); el.title = 'tap me';
  const bubble = document.createElement('div'); bubble.className = 'walker-bubble'; bubble.setAttribute('role', 'status'); bubble.hidden = true;
  el.append(figure(rec));
  el.addEventListener('pointerdown', grab); // a press: a tap speaks, a move lifts it, a flick throws it away (never a drag of the stage)
  el.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); if (live && (live.flying || performance.now() - (live.heldAt || -1e9) < 400)) return; speak(); }); // the click that ends a lift is not a tap
  root.append(floor, shadow, el, bubble); // the bubble beside the figure, not inside it: a figure facing left is mirrored, its words never are
  st.prepend(root); // under the cards: the figure walks the floor, the cards float above it
  live = { root, el, shadow, bubble, rec, state: startState(st.clientWidth, { still: still(), rnd: Math.random }), raf: 0, lastT: 0, said: '', bubbleT: 0, n: 0, lift: dockLift(st), width: st.clientWidth };
  paint();
  live.raf = requestAnimationFrame(frame);
  gatherFacts().catch(() => {});
  return live;
}

function unmount(forgetToo = true) {
  if (live) drop(live); // a figure in the air goes too
  if (forgetToo) forget();
}

/** the cartoon card's "Let it walk" (skills/cartoon.js) and the asks come here: { src, emoji, subject, ask } -> the figure walks and is remembered */
export function letWalk(from, api) {
  const rec = recordOf(from);
  if (!mount(rec)) return null;
  write(rec);
  if (api && api.say) api.say((rec.subject ? 'Cartoon ' + rec.subject : 'your cartoon') + ' is walking the stage · tap it for a word · "stop walking" sits it down');
  return live;
}

/** "stop walking": the figure goes and is forgotten */
export function stopWalk(api) {
  const was = !!live || !!read();
  unmount(true);
  if (api && api.say) api.say(was ? 'sat down' : 'nothing is walking');
  return was;
}

// the newest cartoon card on the stage (the last one in the stage's draw order is in front): its painting when it has one, else its emoji
function newestCartoon(stageApi) {
  const things = stageApi && stageApi.things ? Object.values(stageApi.things()).filter((t) => t && t.kind === 'cartoon') : [];
  const th = things[things.length - 1]; if (!th) return null;
  const card = document.querySelector('#stage .cartoon-card[data-id="' + (window.CSS && CSS.escape ? CSS.escape(th.id) : th.id) + '"]');
  const img = card && card.querySelector('.cartoon-pic img');
  return { src: img ? img.getAttribute('src') || '' : '', emoji: th.emoji || '', subject: th.subject || '' };
}

/** after every stage redraw (the page calls decorate(stageApi) after render()): the figure, if walking, is put back under the cards */
export function decorate() {
  if (!live) return;
  const st = stageEl(); if (st && !live.root.isConnected) st.prepend(live.root);
}

async function run(text, api) {
  const op = walkOf(text);
  if (!op) return 'none';
  if (op === 'stop') { stopWalk(api); return 'walker'; }
  const from = newestCartoon(api.stage);
  if (!from) { if (api.say) api.say('draw a cartoon first: "draw a cartoon cat", then "let it walk"'); return 'walker'; }
  letWalk({ ...from, ask: text }, api);
  return 'walker';
}

/** the walker kept from last time comes back as soon as the stage is there (the page keeps the record; no ask needed) */
function restore() {
  if (typeof document === 'undefined' || live) return;
  const rec = read(); if (!rec) return;
  const go = () => { const st = stageEl(); if (!st) return false; if (!live) mount(rec); return true; };
  if (go()) return;
  const t0 = Date.now(), tick = () => { if (!go() && Date.now() - t0 < 15000) setTimeout(tick, 250); }; tick();
}
if (typeof document !== 'undefined' && typeof window !== 'undefined' && document.getElementById && document.getElementById('stage')) setTimeout(restore, 0);
// "clear" clears the walker too (owner, 2026-10-30: "the cartoon walking around wont clear"): the page says so when it empties the stage
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('void:stage-cleared', () => { if (live) drop(live); forget(); });

export default {
  name: 'walker',
  examples: ['let it walk', 'make it walk', 'walk around', 'stop walking', 'let him walk around', 'take a walk', 'remove the walker'],
  nearMisses: ['walk me through it', 'how far did i walk today', 'walking directions to the station', 'walk', 'walk the dog', 'walking dead'],
  walkOf,
  letWalk,
  stopWalk,
  decorate,
  match(lower, text) { return !!walkOf(text || lower); },
  run,
  suite() {
    const ok = walkOf('let it walk') === 'walk' && walkOf('Make him walk around') === 'walk' && walkOf('stop walking') === 'stop' && walkOf('walk me through it') === null && walkOf('walk the dog') === null
      && step(startState(400), 1000, 400).x > startState(400).x && recordOf({ src: 'nope', subject: 'cat' }).src === '';
    return { ok, got: walkOf('let it walk') };
  }
};
