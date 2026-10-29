// The stage's camera (asked by Owner, 2026-10-18: "You should be able to look around and fly around in v01d"): the maths of a
// 2D pan-and-zoom view over the whole stage, pure, so skills/fly.js only has to wire keys, pointers and the wheel to it.
// A camera is { x, y, z }: screen = stage * z + (x, y), applied as `translate(x, y) scale(z)` on #stage with its origin at the
// top-left. It is a view only: no thing's saved position changes, ever. The things stay where they are; the eye moves.
//   zoomAt(cam, factor, px, py)  zoom by factor keeping the stage point under the screen point (px, py) still
//   pan(cam, dx, dy)             slide the view by screen pixels
//   fly(cam, vel, keys, dt, opts) one frame of key-held flight with easing: returns { cam, vel }
//   ease(cam, target, dt, opts)  one frame of the landing glide towards `target`; snaps when opts.still (reduced motion)
//   transformOf(cam)             the CSS transform string ('' at home)
//   fromStored(text) / toStored(cam, flying)  what localStorage keeps, validated (a bad value is home)
// Run its tests: node --test tools/stage-camera.test.mjs

export const HOME = Object.freeze({ x: 0, y: 0, z: 1 });
export const MIN_Z = 0.25, MAX_Z = 4; // a quarter to four times: far enough to see a whole stage, close enough to read a sticky
export const SPEED = 900; // px/s at full speed, in screen pixels (the eye moves at the same pace however far it is zoomed)
export const WARP = 6; // hold Shift for this multiplier
export const ACCEL = 6; // how quickly held keys reach full speed and let go come to rest (per second, exponential)
export const LAND = 8; // how quickly landing glides home (per second, exponential)
export const EPS = 0.5; // nearer home than this, in pixels or hundredths of zoom, counts as home

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const clampZ = (z) => Math.min(MAX_Z, Math.max(MIN_Z, num(z, 1)));

/** a camera from loose parts, every field finite and the zoom within its limits. Pure. */
export function camera(x = 0, y = 0, z = 1) { return { x: num(x), y: num(y), z: clampZ(z) }; }

/** the stage point under a screen point. Pure. */
export function toStage(cam, px, py) { return { x: (num(px) - cam.x) / cam.z, y: (num(py) - cam.y) / cam.z }; }
/** where a stage point is drawn on screen. Pure. */
export function toScreen(cam, sx, sy) { return { x: num(sx) * cam.z + cam.x, y: num(sy) * cam.z + cam.y }; }

/** zoom by `factor` (1.1 = closer) keeping the stage point under screen (px, py) exactly where it is. Pure. */
export function zoomAt(cam, factor, px, py) {
  const z = clampZ(cam.z * num(factor, 1)), s = toStage(cam, px, py);
  return { x: num(px) - s.x * z, y: num(py) - s.y * z, z };
}

/** slide the view by screen pixels (dragging the stage to the right moves the view right with it). Pure. */
export function pan(cam, dx, dy) { return { x: cam.x + num(dx), y: cam.y + num(dy), z: cam.z }; }

/** the direction the held keys ask for: { x, y } each -1, 0 or 1 (right and down positive). Pure. */
export function heading(keys) {
  const k = keys || {}, on = (n) => !!k[n];
  const x = (on('d') || on('arrowright') ? 1 : 0) - (on('a') || on('arrowleft') ? 1 : 0);
  const y = (on('s') || on('arrowdown') ? 1 : 0) - (on('w') || on('arrowup') ? 1 : 0);
  return { x, y };
}

/**
 * One frame of flight. The eye moves where the keys point; the view slides the other way (walk right, the stage passes
 * leftwards). Speed eases in while a key is held and out when it is let go (ACCEL), unless `still` (reduced motion): then
 * full speed at once and a dead stop. Returns the new camera and velocity (screen px/s). Pure.
 */
export function fly(cam, vel, keys, dt, { still = false, speed = SPEED, warp = false } = {}) {
  const h = heading(keys), len = Math.hypot(h.x, h.y) || 1, want = { x: (h.x / len) * speed, y: (h.y / len) * speed };
  // warp flies forward: zoom into the centre of the view instead of sliding up
  if (warp) {
    const t = Math.min(0.25, Math.max(0, num(dt)));
    const z = Math.min(MAX_Z, cam.z * (1 + 1.8 * t)); // ~1.8x closer per second
    const cx = (typeof innerWidth === 'number' ? innerWidth : 800) / 2, cy = (typeof innerHeight === 'number' ? innerHeight : 600) / 2;
    const s = { x: (cx - cam.x) / cam.z, y: (cy - cam.y) / cam.z };
    return { cam: { x: cx - s.x * z, y: cy - s.y * z, z }, vel: { x: 0, y: 0 } };
  }
  const t = Math.min(0.25, Math.max(0, num(dt))); // a tab that slept does not leap on waking
  const v = vel || { x: 0, y: 0 };
  const k = still ? 1 : 1 - Math.exp(-ACCEL * t);
  let nv = { x: v.x + (want.x - v.x) * k, y: v.y + (want.y - v.y) * k };
  if (Math.hypot(nv.x, nv.y) < 1 && !h.x && !h.y) nv = { x: 0, y: 0 };
  return { cam: { x: cam.x - nv.x * t, y: cam.y - nv.y * t, z: cam.z }, vel: nv };
}

/** true at (or within EPS of) `target`, HOME by default. Pure. */
export function atHome(cam, target = HOME) { return Math.abs(cam.x - target.x) < EPS && Math.abs(cam.y - target.y) < EPS && Math.abs(cam.z - target.z) < EPS / 100; }

/** one frame of the landing glide towards `target` (HOME by default); `still` snaps there at once. Pure. */
export function ease(cam, target = HOME, dt = 0.016, { still = false } = {}) {
  if (still) return { ...target };
  const t = Math.min(0.25, Math.max(0, num(dt))), k = 1 - Math.exp(-LAND * t);
  const next = { x: cam.x + (target.x - cam.x) * k, y: cam.y + (target.y - cam.y) * k, z: cam.z + (target.z - cam.z) * k };
  return atHome(next, target) ? { ...target } : next;
}

/** the CSS transform for the stage: '' at home, so a landed stage is exactly the page as it always was. Pure. */
export function transformOf(cam) { return atHome(cam) ? '' : 'translate(' + r(cam.x) + 'px, ' + r(cam.y) + 'px) scale(' + r(cam.z, 4) + ')'; }
const r = (n, d = 2) => { const p = 10 ** d; return String(Math.round(n * p) / p); };

/** the wheel's zoom factor from a wheel delta (lines or pixels): small steps, never a jump. Pure. */
export function wheelFactor(deltaY, deltaMode = 0) {
  const d = num(deltaY) * (deltaMode === 1 ? 16 : deltaMode === 2 ? 100 : 1);
  return Math.exp(-Math.max(-120, Math.min(120, d)) * 0.0025); // 120 px of wheel is about 35% closer or further
}

/** what is kept in localStorage: { x, y, z, flying }. Pure. */
export function toStored(cam, flying) { return JSON.stringify({ x: Math.round(cam.x * 100) / 100, y: Math.round(cam.y * 100) / 100, z: Math.round(cam.z * 1000) / 1000, flying: !!flying }); }
/** the kept camera, or home when there is none or it is not a camera: { cam, flying }. Pure. */
export function fromStored(text) {
  try {
    const o = JSON.parse(String(text || 'null'));
    if (!o || typeof o !== 'object' || ![o.x, o.y, o.z].every((v) => Number.isFinite(v))) return { cam: { ...HOME }, flying: false };
    return { cam: camera(o.x, o.y, o.z), flying: !!o.flying };
  } catch (_) { return { cam: { ...HOME }, flying: false }; }
}

// Dynamic scale (asked by Verse, 2026-10-18: "posters and paintings ... subtly enlarge or gain depth when the fly camera passes near them"): how near
// a picture's centre is to the middle of the screen, 0 (NEAR_R of the shorter side away or more) to 1 (dead centre), eased so it swells softly;
// and what that looks like: up to NEAR_SCALE bigger and a soft drop shadow that deepens with it. Off under reduced motion (skills/fly.js).
export const NEAR_SCALE = 1.08, NEAR_R = 0.55;
/** nearness 0..1 of a point (cx, cy) to the centre of a vw x vh screen. Pure. */
export function nearness(cx, cy, vw, vh) {
  const R = NEAR_R * Math.max(1, Math.min(num(vw), num(vh))), d = Math.hypot(num(cx) - num(vw) / 2, num(cy) - num(vh) / 2), t = Math.max(0, 1 - d / R);
  return t * t * (3 - 2 * t); // smoothstep: no edge where it starts
}
/** the look for a nearness: { scale, shadow } (shadow a CSS filter, '' far away). Pure. */
export function nearLook(n) {
  const k = Math.max(0, Math.min(1, num(n)));
  if (k < 0.01) return { scale: 1, shadow: '' };
  return { scale: Math.round((1 + (NEAR_SCALE - 1) * k) * 1000) / 1000, shadow: 'drop-shadow(0 ' + Math.round(4 + 14 * k) + 'px ' + Math.round(8 + 22 * k) + 'px rgba(0,0,0,' + (0.18 + 0.32 * k).toFixed(2) + '))' };
}
