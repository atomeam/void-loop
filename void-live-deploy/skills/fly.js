/**
 * fly skill - look around and fly around the stage (asked by Owner, 2026-10-18: "You should be able to look around and fly around
 * in v01d"). "fly around", "look around", "fly mode" or "explore the stage" gives the whole stage a camera: a 2D pan-and-zoom view
 * (a translate and scale on #stage, maths in lib/stage-camera.js) that moves the eye and never a thing. While flying, WASD or the
 * arrow keys move with easing, dragging the stage pans, the wheel zooms at the pointer, one finger pans and two pinch; a small
 * HUD chip says so. Esc, "land" or "stop flying" eases back to the normal view (a snap under reduced motion). The camera is kept
 * on this device (a2m.void.camera.v1, lib/state.js) so a reload takes off where you were; nothing appears until asked, and
 * "fly to tokyo", "flights to paris", "look around the room" and "fly me to the moon" are other skills' asks, not this one.
 * The stars move with the eye (owner, 2026-10-18: "you cant tell you are flying rhe stars dont move"): each camera move is told
 * to the page as a 'void-camera' event and void.html's sky slides its two star layers with parallax (lib/star-parallax.js).
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { HOME, camera, zoomAt, pan, fly, ease, atHome, transformOf, wheelFactor, toStored, fromStored, nearness, nearLook } from '../lib/stage-camera.js';

export const KEY = 'a2m.void.camera.v1';
const HUD_ID = 'void-fly-hud', CLASS = 'void-flying';
const KEYS = new Set(['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']);
const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');

/** 'fly' for an ask to take off, 'land' for one to come back, else null. Pure. */
export function flyAskOf(text) {
  const t = CLEAN(text);
  if (/^(?:(?:let(?:'s| me| us)|i want to|can i|could i)\s+)?(?:fly|float|look|wander|roam|move|zoom)\s+(?:around|about)(?:\s+(?:in|on|the|my)?\s*(?:the\s+)?(?:void|stage|(?:verse|v01d)|here))?(?:\s+please)?$/.test(t)) return 'fly';
  if (/^(?:(?:enter|start|turn on|open|go to)\s+)?(?:fly|flying|flight|explore|explorer|camera|free[- ]?look|look[- ]around)\s+mode(?:\s+on)?$/.test(t)) return 'fly';
  if (/^(?:(?:let(?:'s| me)\s+)?explore|fly (?:around|over|through)|look (?:around|over|at))\s+(?:the\s+|my\s+)?(?:whole\s+)?(?:void|stage|(?:verse|v01d)|cards|things)$/.test(t)) return 'fly';
  if (/^(?:land|stop flying|stop (?:the )?(?:flight|camera|flying)|(?:fly|flying|flight|camera) mode off|exit (?:fly|flying|camera) mode|back to (?:the )?normal view|reset (?:the )?(?:view|camera)|land (?:the )?camera)$/.test(t)) return 'land';
  return null;
}

// ---- the live camera (one per page) ----
const S = { cam: { ...HOME }, vel: { x: 0, y: 0 }, keys: {}, flying: false, landing: false, raf: 0, last: 0, pointers: new Map(), moved: false, bound: false };
const stageEl = () => document.getElementById('stage');
const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches || localStorage.getItem('a2m.void.motion.v1') === 'still'; } catch (_) { return false; } };
const typing = (t) => !!t && (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName || '') || t.isContentEditable);
const keep = () => { try { localStorage.setItem(KEY, toStored(S.cam, S.flying)); } catch (_) {} };

function apply() {
  const st = stageEl(); if (!st) return;
  st.style.transformOrigin = '0 0';
  st.style.transform = transformOf(S.cam);
  tell();
  depth(st);
}
// dynamic scale (asked by Verse): a poster or a painting on the stage (a thing holding a picture) swells up to 8% and casts a softer, deeper shadow as
// the camera's centre passes over it; nothing changes under reduced motion or on the ground. Uses the separate `scale` property, so a card's own
// transform and translate are untouched; a thing that already has a filter of its own keeps it.
const PICTURES = '.thing img, .thing canvas.vc-forge-img';
function depth(st) {
  const on = S.flying && !still(), vw = innerWidth, vh = innerHeight, seen = new Set();
  if (on) for (const im of st.querySelectorAll(PICTURES)) {
    const th = im.closest('.thing'); if (!th || seen.has(th) || (th.style.filter && !th.dataset.flyNear)) continue;
    seen.add(th); const r = th.getBoundingClientRect(), look = nearLook(nearness(r.left + r.width / 2, r.top + r.height / 2, vw, vh));
    th.style.scale = look.scale === 1 ? '' : String(look.scale); th.style.filter = look.shadow; th.dataset.flyNear = String(look.scale);
  }
  for (const th of st.querySelectorAll('.thing[data-fly-near]')) if (!seen.has(th)) { th.style.scale = ''; th.style.filter = ''; delete th.dataset.flyNear; }
}
// the stars behind the stage follow the eye at a fraction of its pace (void.html's sky, lib/star-parallax.js; owner, 2026-10-18:
// "you cant tell you are flying rhe stars dont move"): every move of the camera is told to the page as 'void-camera'
function tell() { try { window.dispatchEvent(new CustomEvent('void-camera', { detail: { x: S.cam.x, y: S.cam.y, z: S.cam.z, flying: S.flying } })); } catch (_) {} }
function loop(t) {
  S.raf = 0;
  const dt = S.last ? (t - S.last) / 1000 : 1 / 60; S.last = t;
  const idle = !Object.keys(S.keys).length && !S.vel.x && !S.vel.y;
  if (S.flying) ({ cam: S.cam, vel: S.vel } = fly(S.cam, S.vel, S.keys, dt, { still: still(), warp: !!S.warp }));
  if (S.landing) S.cam = ease(S.cam, HOME, dt, { still: still() });
  apply();
  if (S.landing && atHome(S.cam)) { S.landing = false; S.cam = { ...HOME }; const st = stageEl(); if (st) { st.style.transform = ''; st.style.transformOrigin = ''; st.style.willChange = ''; depth(st); } tell(); keep(); return; }
  if (S.landing || (S.flying && !idle)) S.raf = requestAnimationFrame(loop); else { S.last = 0; keep(); }
}
const kick = () => { if (!S.raf) { S.last = 0; S.raf = requestAnimationFrame(loop); } };

function hud(on) {
  let el = document.getElementById(HUD_ID);
  if (!on) { if (el) el.remove(); return; }
  if (el) return;
  if (!document.getElementById('void-fly-style')) {
    const css = document.createElement('style'); css.id = 'void-fly-style';
    css.textContent = '#' + HUD_ID + '{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:6;display:flex;align-items:center;gap:10px;padding:6px 12px;border-radius:999px;font:12px/1.3 ui-sans-serif,system-ui,sans-serif;color:#dfe4ff;background:rgba(16,18,30,.78);border:1px solid rgba(160,180,255,.28);box-shadow:0 10px 30px rgba(0,0,0,.4);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);pointer-events:auto;white-space:nowrap;max-width:calc(100vw - 24px)}'
      + '#' + HUD_ID + ' button{font:inherit;color:#fff;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:999px;padding:3px 10px;cursor:pointer}'
      + '#' + HUD_ID + ' button:hover{background:rgba(255,255,255,.22)}'
      + 'html.' + CLASS + ' #stage{cursor:grab;touch-action:none;overflow:visible}html.' + CLASS + '.void-fly-drag #stage{cursor:grabbing}';
    document.head.appendChild(css);
  }
  el = document.createElement('div'); el.id = HUD_ID; el.setAttribute('role', 'status');
  const coarse = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (_) { return false; } })();
  const words = document.createElement('span'); words.textContent = coarse ? 'flying · drag to look · pinch to zoom · tap land' : 'flying · WASD to move · hold Shift to fly forward · scroll to zoom · Esc to land';
  const btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'land'; btn.setAttribute('aria-label', 'land: back to the normal view');
  btn.addEventListener('click', () => land());
  el.append(words, btn);
  document.body.appendChild(el);
}

// ---- input while flying: keys, the wheel, drags and pinches (capture phase, so a drag never lifts a card) ----
function onKeyDown(e) {
  if (!S.flying) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); land(); return; }
  if (typing(e.target)) return;
  const k = String(e.key || '').toLowerCase();
  if (e.key === 'Shift') { e.preventDefault(); S.warp = true; kick(); return; }
  if (!KEYS.has(k) || e.metaKey || e.ctrlKey || e.altKey) return;
  e.preventDefault(); S.keys[k] = true; kick();
}
function onKeyUp(e) { if (e.key === 'Shift') { S.warp = false; kick(); return; } const k = String(e.key || '').toLowerCase(); if (S.keys[k]) { delete S.keys[k]; kick(); } }
function onBlur() { S.keys = {}; }
// a card up over the stage, the ask bar and the chip keep their own pointer and wheel; everywhere else is the void, and the eye moves
// (on document, not #stage: once the view is zoomed or panned the stage's own box no longer covers the screen)
const OWN = '.vpage, #dock, #row, #' + HUD_ID + ', input, textarea, select, button, a[href], [contenteditable="true"], .side-card'; // void-review: ok (a CSS selector string, no SQL)
const theirs = (t) => !!(t && t.closest && t.closest(OWN));
function onWheel(e) {
  if (!S.flying || theirs(e.target)) return;
  e.preventDefault();
  S.cam = zoomAt(S.cam, wheelFactor(e.deltaY, e.deltaMode), e.clientX, e.clientY);
  apply(); keep();
}
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y), mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
function onPointerDown(e) {
  if (!S.flying || e.button > 0 || theirs(e.target)) return;
  e.stopPropagation(); // the stage's own drag (bindDrag) never sees it: while flying, a drag moves the eye, not the card
  if (!S.pointers.size) { S.moved = false; window.addEventListener('pointermove', onPointerMove); window.addEventListener('pointerup', onPointerUp); window.addEventListener('pointercancel', onPointerUp); document.documentElement.classList.add('void-fly-drag'); }
  S.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
}
function onPointerMove(e) {
  const was = S.pointers.get(e.pointerId); if (!was) return;
  const now = { x: e.clientX, y: e.clientY };
  if (Math.hypot(now.x - was.x, now.y - was.y) > 4) S.moved = true;
  const others = [...S.pointers.entries()].filter(([id]) => id !== e.pointerId);
  if (others.length) { // two fingers: zoom at their middle by how far they spread, then slide with their middle
    const o = others[0][1], d0 = dist(was, o), d1 = dist(now, o), m0 = mid(was, o), m1 = mid(now, o);
    if (d0 > 0) S.cam = zoomAt(S.cam, d1 / d0, m0.x, m0.y);
    S.cam = pan(S.cam, m1.x - m0.x, m1.y - m0.y);
  } else S.cam = pan(S.cam, now.x - was.x, now.y - was.y);
  S.pointers.set(e.pointerId, now);
  apply();
}
function onPointerUp(e) {
  S.pointers.delete(e.pointerId);
  if (S.pointers.size) return;
  window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp); window.removeEventListener('pointercancel', onPointerUp);
  document.documentElement.classList.remove('void-fly-drag');
  if (S.moved) { const swallow = (ev) => { ev.stopPropagation(); ev.preventDefault(); }; document.addEventListener('click', swallow, { capture: true, once: true }); setTimeout(() => document.removeEventListener('click', swallow, true), 400); } // a pan is not a tap on what it ended over
  keep();
}
function bind(on) {
  if (S.bound === on) return; S.bound = on;
  const f = on ? 'addEventListener' : 'removeEventListener';
  document[f]('keydown', onKeyDown, true); document[f]('keyup', onKeyUp, true); window[f]('blur', onBlur);
  document[f]('wheel', onWheel, { passive: false, capture: true }); document[f]('pointerdown', onPointerDown, true);
}

/** take off: the stage gets its camera, the HUD chip shows, keys and the pointer move the eye */
export function takeOff() {
  const st = stageEl(); if (!st || S.flying) return false;
  S.flying = true; S.landing = false; S.keys = {}; S.vel = { x: 0, y: 0 }; S.warp = false;
  document.documentElement.classList.add(CLASS);
  st.style.willChange = 'transform';
  hud(true); bind(true); apply(); keep();
  const input = document.getElementById('input'); if (input && document.activeElement === input) input.blur(); // W, A, S and D steer; a click in the box types again
  return true;
}
/** land: ease back to the plain view (a snap under reduced motion), the chip goes, the keys are the page's again */
export function land() {
  if (!S.flying && !S.landing && atHome(S.cam)) return false;
  S.flying = false; S.keys = {}; S.vel = { x: 0, y: 0 }; S.landing = true;
  document.documentElement.classList.remove(CLASS, 'void-fly-drag');
  hud(false); bind(false); kick();
  return true;
}
/** the camera as it is now: { x, y, z, flying } (tests and the console: window.__voidFly) */
export const state = () => ({ ...S.cam, flying: S.flying, landing: S.landing });

// a reload takes off where you were (the camera is kept on this device); a landed one is exactly the page as it always was
(function resume() {
  if (typeof document === 'undefined') return;
  let kept = { cam: { ...HOME }, flying: false };
  try { kept = fromStored(localStorage.getItem(KEY)); } catch (_) {}
  if (!kept.flying) return;
  const go = () => { S.cam = kept.cam; takeOff(); };
  if (stageEl()) go(); else document.addEventListener('DOMContentLoaded', go, { once: true });
})();
try { window.__voidFly = { state, takeOff, land }; } catch (_) {} // the tests and the console read the camera here

async function run(text, api) {
  const what = flyAskOf(text);
  if (!what) return 'none';
  if (what === 'fly') {
    if (!takeOff()) { api.say(S.flying ? 'already flying · WASD or the arrows to move · scroll to zoom · Esc to land' : 'no stage to fly over'); return 'fly'; }
    const coarse = (() => { try { return matchMedia('(pointer: coarse)').matches; } catch (_) { return false; } })();
    api.say(coarse ? 'flying · drag to look around · pinch to zoom · tap land to come back' : 'flying · WASD or the arrows to move · drag to look around · scroll to zoom · Esc to land');
    return 'fly';
  }
  api.say(land() ? 'landed' : 'already on the ground · "fly around" to take off');
  return 'fly';
}

export default {
  name: 'fly',
  examples: ['fly around', 'look around', 'fly mode', 'explore the stage', 'stop flying', 'land'],
  nearMisses: ['fly to tokyo', 'flights to paris', 'look around the room', 'fly me to the moon', 'how long is the flight from london to paris', 'explore mars', 'how do birds fly', 'landing page'],
  match(lower, text) { return !!flyAskOf(text || lower); },
  run,
  flyAskOf,
};
