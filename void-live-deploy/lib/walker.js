// The walker (owner, 2026-10-25, on the cartoon card they drew: "drop him onto a solid floor so he actually walks across a stage instead of
// drifting through space ... anchor him to a physical horizon line ... bottom: 24px ... a subtle CSS drop shadow cast downward onto a rendered
// stage baseline"; "if a user taps or clicks on walking Claude, he drops a little diagnostic card or reacts with a speech bubble").
// Pure: the pacing (step), the shadow under a bobbing figure (shadowOf), the true lines the bubble may say (factLines, pickLine) and the
// record kept in this browser (recordOf, parseRecord). skills/walker.js owns the DOM and the requestAnimationFrame loop.
export const SPRITE = 96; // px: the figure's box on the stage
export const FLOOR = 24; // px above the stage's bottom edge: the horizon line the figure stands on
export const SPEED = 60; // px/s: walking pace
export const BOB = 3; // px: how high a step lifts the figure
export const STRIDE = 28; // px of ground per step (one bob per stride)
export const TURN_PAUSE = 900; // ms stood still after turning at an edge
export const PAUSE_EVERY = [4000, 9000]; // ms walked between a pause, chosen in this range
export const PAUSE_FOR = [700, 1800]; // ms a pause lasts
export const BUBBLE_MS = 4000; // the speech bubble's time on screen
export const STORE_KEY = 'a2m.void.walker.v1';
export const DT_MAX = 100; // ms: a frame after a long hidden tab counts as one short step, never a leap across the stage

const lerp = (a, b, t) => a + (b - a) * Math.max(0, Math.min(1, t));

/** the figure's first state: standing in the middle of a `width` px stage, facing right; `still` holds it there (reduced motion). Pure. */
export function startState(width, { still = false, rnd = () => 0.5 } = {}) {
  const w = Math.max(SPRITE, Number(width) || SPRITE);
  return { x: Math.round((w - SPRITE) / 2), dir: 1, pauseMs: 0, walked: 0, nextPause: lerp(PAUSE_EVERY[0], PAUSE_EVERY[1], rnd()), stride: 0, bob: 0, still: !!still, turned: false };
}

/** one frame: the figure after `dtMs` more milliseconds on a `width` px stage. It paces at SPEED, bobs BOB px once a STRIDE, turns (dir flips) and
 *  waits TURN_PAUSE at either edge, and now and then stops for a moment (rnd picks how long and how soon the next). `still` keeps it standing where
 *  it is, bob 0. Returns a new state; never mutates the one given. Pure given rnd. */
export function step(state, dtMs, width, rnd = () => 0.5) {
  const s = { ...state, turned: false };
  const dt = Math.max(0, Math.min(DT_MAX, Number(dtMs) || 0));
  const w = Math.max(SPRITE, Number(width) || SPRITE), maxX = w - SPRITE;
  if (s.still) { s.x = Math.max(0, Math.min(maxX, s.x)); s.bob = 0; return s; }
  if (s.pauseMs > 0) { s.pauseMs = Math.max(0, s.pauseMs - dt); s.bob = 0; return s; }
  const dx = (SPEED * dt) / 1000;
  let x = s.x + s.dir * dx;
  if (x <= 0 || x >= maxX) { // the edge: stand there a moment, then walk back the other way
    x = Math.max(0, Math.min(maxX, x));
    s.dir = x <= 0 ? 1 : -1; s.turned = true; s.pauseMs = TURN_PAUSE; s.bob = 0;
    s.x = x; return s;
  }
  s.x = x;
  s.stride = (s.stride + dx) % STRIDE;
  s.bob = Math.round(Math.abs(Math.sin((s.stride / STRIDE) * Math.PI)) * BOB * 100) / 100;
  s.walked += dt;
  if (s.walked >= s.nextPause) { s.walked = 0; s.nextPause = lerp(PAUSE_EVERY[0], PAUSE_EVERY[1], rnd()); s.pauseMs = lerp(PAUSE_FOR[0], PAUSE_FOR[1], rnd()); s.bob = 0; }
  return s;
}

/** the cast shadow for a figure lifted `bob` px: a little narrower and fainter the higher it steps, so the light reads as coming from above. Pure. */
export function shadowOf(bob = 0) {
  const t = Math.max(0, Math.min(1, (Number(bob) || 0) / BOB));
  return { scale: Math.round((1 - 0.12 * t) * 1000) / 1000, opacity: Math.round((0.55 - 0.2 * t) * 1000) / 1000 };
}

/** the true lines the bubble may say, from what the page itself counted: never a number that was not read off a file.
 *  facts: { skills?: number, surpassed?: number, learned?: string, motto?: string, about?: string }. Pure. */
export function factLines(facts = {}) {
  const out = [], n = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
  const skills = n(facts.skills), beaten = n(facts.surpassed);
  if (skills != null) out.push('I have ' + skills.toLocaleString('en') + ' skill' + (skills === 1 ? '' : 's') + ' right now. Ask for anything.');
  if (beaten != null) out.push(beaten === 0 ? "I haven't surpassed a site yet. Working on it." : "I've surpassed " + beaten.toLocaleString('en') + ' site' + (beaten === 1 ? '' : 's') + ' so far.');
  const learned = String(facts.learned || '').replace(/\s+/g, ' ').trim();
  if (learned) out.push('The last thing I learned: ' + learned.replace(/[.]+$/, '') + '.');
  const motto = String(facts.motto || '').trim();
  if (motto) out.push('“' + motto.replace(/[.]+$/, '') + '.”');
  const about = String(facts.about || '').trim();
  if (about) out.push(about);
  return out;
}

/** one line to say, chosen by rnd (0..1) from the lines; a line other than the last said when there are two or more. Pure. */
export function pickLine(lines, rnd = () => 0.5, last = '') {
  const l = (lines || []).filter((x) => typeof x === 'string' && x.trim());
  if (!l.length) return "Give me a moment: I'm still counting.";
  const pool = l.length > 1 ? l.filter((x) => x !== last) : l;
  return pool[Math.min(pool.length - 1, Math.floor(Math.max(0, Math.min(0.999999, rnd())) * pool.length))];
}

const DATA_IMG = /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/;
export const SRC_MAX = 1400040; // the Art Forge's largest kept picture (lib/art-rules.js IMG_MAX) plus its data URL head
/** what this browser keeps so the walker is there on the next visit: the picture (a small data URL, or none), the emoji it was drawn as first,
 *  its subject and the ask that started it. Nothing else. Pure. */
export function recordOf({ src = '', emoji = '', subject = '', ask = '' } = {}) {
  const s = typeof src === 'string' && src.length <= SRC_MAX && DATA_IMG.test(src) ? src : '';
  return { v: 1, src: s, emoji: String(emoji || '').slice(0, 8), subject: String(subject || '').replace(/[^a-z0-9 '-]/gi, '').trim().slice(0, 60), ask: String(ask || '').slice(0, 80) };
}
/** the kept record, or null when there is none or it is not ours. Pure. */
export function parseRecord(raw) {
  try { const j = JSON.parse(raw || 'null'); if (!j || j.v !== 1 || (!j.src && !j.emoji && !j.subject)) return null; return recordOf(j); } catch (_) { return null; }
}

// Thrown (owner, 2026-10-30: "the cartoon walking around wont clear and cant be thrown"): the walker is lifted and thrown like every other thing on
// the stage (index.html bindDrag): the same flick speed, gravity, spin and friction slider. A slow drop sets it back on the floor where it was let go.
export const TOSS_SPEED = 0.9; // px/ms: a flick, not a place-down (the stage's own TOSS_SPEED)
export const GRAVITY = 0.0016; // px/ms² added to the fall each ms of flight (the stage's toss)
export const LIFT = 5; // px the pointer moves before a press is a lift, not a tap

/** on release: thrown when the flick is fast enough or the figure is let go off the stage. Box { x, y, w, h } in stage px. Pure. */
export function tossOf({ x = 0, y = 0, w = SPRITE, h = SPRITE, vx = 0, vy = 0, stageW = 0, stageH = 0 } = {}) {
  const off = x + w < 0 || y + h < 0 || (stageW > 0 && x > stageW) || (stageH > 0 && y > stageH);
  return { thrown: Math.hypot(Number(vx) || 0, Number(vy) || 0) >= TOSS_SPEED || off };
}

/** one frame of the throw: { x, y, vx, vy, spin } after dtMs (at most 32), with friction fr (0..1, the slider's setting). Pure. */
export function fly(f, dtMs, fr = 0.995) {
  const dt = Math.max(0, Math.min(32, Number(dtMs) || 0)), k = Math.max(0, Math.min(1, Number(fr)));
  const vx = f.vx * (Number.isFinite(k) ? k : 0.995), vy = f.vy + GRAVITY * dt;
  return { x: f.x + vx * dt, y: f.y + vy * dt, vx, vy, spin: f.spin + vx * dt * 0.4 };
}

/** where a slow drop sets the figure: the floor, at the x it was let go, kept inside the stage. Pure. */
export function dropX(x, width) {
  const maxX = Math.max(0, (Number(width) || SPRITE) - SPRITE);
  return Math.round(Math.max(0, Math.min(maxX, Number(x) || 0)));
}
