// The stars follow the flying eye (asked by Owner, 2026-10-18: "you cant tell you are flying rhe stars dont move"): the pure
// maths that lets the two star layers behind the stage (#void-stars-far and #void-stars in void.html) slide and swell with the
// fly camera (lib/stage-camera.js, skills/fly.js) at a fraction of its pace, so space has depth: the far layer barely moves,
// the near one more, and both are always full (each layer wraps like a tile, so no edge is ever empty). Pure, no DOM.
//   layerView(cam, depth, W, H, opts)  how far one layer slides and how much it swells for a camera: { ox, oy, s }
//   placeAxis(v, o, s, L, margin)      where one star's coordinate lands on screen, every wrapped copy that shows
//   streakOf(vx, vy, zoomRate, opts)   the near stars' motion streak from the layer's speed (px/s) and the zoom rate (1/s)
// Run its tests: node --test tools/star-parallax.test.mjs

export const FAR = Object.freeze({ pan: 0.15, zoom: 0.06 }); // the far layer: 0.15 of the eye's travel, swells little
export const NEAR = Object.freeze({ pan: 0.4, zoom: 0.18 }); // the near layer: 0.4 of it, swells more
export const DRIFT = 6; // reduced motion: a layer never strays more than this many pixels, however far the eye goes
export const STREAK_T = 0.05; // a streak is where the star was this many seconds ago...
export const STREAK_MAX = 44; // ...but never longer than this (px)
export const STREAK_MIN = 1.5; // shorter than this is no streak at all (a slow drift stays a dot)
export const WARP_MIN = 0.6; // zooming in faster than this (ln z per second) pulls the near stars into a soft warp
export const WARP_MAX = 0.22; // a warp streak is at most this share of a star's distance from the middle

const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
const REST = Object.freeze({ ox: 0, oy: 0, s: 1 });

/**
 * How one star layer sits for a camera { x, y, z } over a W x H screen. The slide is `depth.pan` of how far the eye (the stage
 * point under the middle of the screen) has travelled over the stage (fly right and the layer slides left, more slowly than the
 * stage; zoomed in, the eye covers less stage, so the stars slide less, as far things do); zooming at the middle swells the layer
 * by z ** depth.zoom without sliding it. Home is exactly rest: { ox: 0, oy: 0, s: 1 }.
 * opts.still (reduced motion): no swell, and the slide eases toward at most DRIFT px. Pure.
 */
export function layerView(cam, depth, W, H, { still = false } = {}) {
  if (!cam || !depth) return { ...REST };
  const z = Math.max(0.01, num(cam.z, 1)), cx = num(W) / 2, cy = num(H) / 2;
  const tx = cx - (cx - num(cam.x)) / z, ty = cy - (cy - num(cam.y)) / z; // minus how far the eye has gone from the stage's middle
  if (still) return { ox: round(DRIFT * Math.tanh((tx * depth.pan) / 200)), oy: round(DRIFT * Math.tanh((ty * depth.pan) / 200)), s: 1 };
  return { ox: round(tx * depth.pan), oy: round(ty * depth.pan), s: round(z ** depth.zoom, 5) };
}
const round = (n, d = 3) => { const p = 10 ** d; const r = Math.round(n * p) / p; return r === 0 ? 0 : r; };

/**
 * Where a star at `v` (0..L) of a layer that slid by `o` and swelled by `s` (about the middle) shows on an axis of length L:
 * the layer repeats every L, so the star is drawn at each copy that lands within `margin` of the screen. A layer that shrinks
 * (s < 1) shows more than one copy and never leaves an edge empty. Returns screen coordinates. Pure.
 */
export function placeAxis(v, o, s, L, margin = 0) {
  L = num(L); if (!(L > 0)) return [];
  const c = L / 2, u = ((((num(v) + num(o)) % L) + L) % L), k = num(s, 1) || 1, out = [];
  const reach = Math.ceil((c + margin) / (L * k) + 0.5); // copies either side needed to cover the screen
  for (let i = -reach; i <= reach; i++) { const p = c + (u + i * L - c) * k; if (p >= -margin && p < L + margin) out.push(p); }
  return out;
}

/**
 * The near stars' streak while moving fast: { dx, dy } is the line back to where a star was STREAK_T seconds ago (the layer's
 * velocity vx, vy in px/s), capped at STREAK_MAX and nothing under STREAK_MIN; `warp` is the share of a star's distance from the
 * middle its streak reaches when zooming in faster than WARP_MIN (zoomRate in ln z per second). Reduced motion: none. Pure.
 */
export function streakOf(vx, vy, zoomRate = 0, { still = false } = {}) {
  if (still) return { dx: 0, dy: 0, warp: 0 };
  let dx = -num(vx) * STREAK_T, dy = -num(vy) * STREAK_T;
  const len = Math.hypot(dx, dy);
  if (len < STREAK_MIN) { dx = 0; dy = 0; } else if (len > STREAK_MAX) { dx *= STREAK_MAX / len; dy *= STREAK_MAX / len; }
  const zr = num(zoomRate), warp = zr > WARP_MIN ? Math.min(WARP_MAX, (zr - WARP_MIN) * 0.08) : 0;
  return { dx: round(dx, 2), dy: round(dy, 2), warp: round(warp, 4) };
}
