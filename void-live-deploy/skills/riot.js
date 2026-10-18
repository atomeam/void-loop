/**
 * riot skill - every thing on the stage breaks loose (asked by the owner, 2026-10-18, stage pack E, the Opposite Era). "start the riot":
 * each card, note, clock and counter gets a velocity and a little jitter, bounces off the stage edges and shoves the others out of its
 * way, frame by frame (requestAnimationFrame). Only how each is drawn moves (a CSS transform): where it was put (th.x, th.y) is never
 * written, so nothing is saved until "end the riot", which lets every thing ease back to its saved spot. A system that asks for reduced
 * motion gets no riot, and the line says so. "riot games" and "riot in paris today" are not this.
 * The physics is pure (step, seedBodies) and tested in tools/stage-pack-e.test.mjs.
 */
import { rng, elOf, stillness } from '../lib/opposite-era.js';

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
/** 'start' | 'end' | null: what the ask wants of the riot. Pure. */
export function riotOf(text) {
  const t = CLEAN(text);
  if (/^(?:(?:start|begin|unleash|launch)\s+(?:the\s+|a\s+)?riot|let\s+the\s+riot\s+begin|riot\s+on\s+the\s+stage|riot\s+time)$/.test(t)) return 'start';
  if (/^(?:(?:end|stop|calm|quell|finish)\s+(?:the\s+)?riot|riot\s+(?:over|off|done)|the\s+riot\s+is\s+over)$/.test(t)) return 'end';
  return null;
}

export const BOUNCE = 0.82, JITTER = 0.35, MAX = 9, PUSH = 0.5, SPIN = 0.6;
/** bodies from boxes [{ id, x, y, w, h }]: each gets a direction and a speed of 2 to 5 px a frame from the seed. Pure. */
export function seedBodies(boxes, seed = 1) {
  const r = rng(seed);
  return (boxes || []).map((b) => { const a = r() * Math.PI * 2, s = 2 + r() * 3; return { id: b.id, x: +b.x || 0, y: +b.y || 0, w: Math.max(1, +b.w || 1), h: Math.max(1, +b.h || 1), ox: +b.x || 0, oy: +b.y || 0, vx: Math.cos(a) * s, vy: Math.sin(a) * s, rot: 0 }; });
}
/** one frame of the riot: jitter, move, bounce off the edges of { w, h }, and shove overlapping pairs apart. dt is in frames (1 = 16 ms);
 *  r is the jitter's random source. Returns new bodies; the ones given are untouched. Pure. */
export function step(bodies, bounds, dt = 1, r = Math.random) {
  const W = Math.max(1, +bounds.w || 1), H = Math.max(1, +bounds.h || 1), k = Math.min(2, Math.max(0.05, +dt || 1));
  const out = bodies.map((b) => {
    let vx = b.vx + (r() - 0.5) * JITTER * k, vy = b.vy + (r() - 0.5) * JITTER * k;
    const sp = Math.hypot(vx, vy); if (sp > MAX) { vx *= MAX / sp; vy *= MAX / sp; }
    let x = b.x + vx * k, y = b.y + vy * k;
    if (x < 0) { x = 0; vx = Math.abs(vx) * BOUNCE; } else if (x + b.w > W) { x = Math.max(0, W - b.w); vx = -Math.abs(vx) * BOUNCE; }
    if (y < 0) { y = 0; vy = Math.abs(vy) * BOUNCE; } else if (y + b.h > H) { y = Math.max(0, H - b.h); vy = -Math.abs(vy) * BOUNCE; }
    return { ...b, x, y, vx, vy, rot: b.rot + vx * SPIN * k * 0.2 };
  });
  for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
    const a = out[i], b = out[j];
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox <= 0 || oy <= 0) continue;
    if (ox < oy) { const s = (a.x + a.w / 2 < b.x + b.w / 2 ? -1 : 1) * ox * PUSH; a.x += s; b.x -= s; const t = a.vx; a.vx = b.vx * BOUNCE; b.vx = t * BOUNCE; }
    else { const s = (a.y + a.h / 2 < b.y + b.h / 2 ? -1 : 1) * oy * PUSH; a.y += s; b.y -= s; const t = a.vy; a.vy = b.vy * BOUNCE; b.vy = t * BOUNCE; }
    a.rot = Math.max(-25, Math.min(25, a.rot + (r() - 0.5) * 6)); b.rot = Math.max(-25, Math.min(25, b.rot + (r() - 0.5) * 6));
  }
  return out;
}
/** the transform that draws a body away from its saved spot. Pure. */
export const transformOf = (b) => 'translate(' + Math.round(b.x - b.ox) + 'px, ' + Math.round(b.y - b.oy) + 'px) rotate(' + (Math.round(b.rot * 10) / 10) + 'deg)';

let riot = null; // { bodies, raf, last }
/** the drawn things that can riot: every .thing with an id (figures walk in 3D and are not boxes) */
const boxesOf = (st) => Array.from(st.stage.querySelectorAll(':scope > .thing[data-id]')).map((el) => ({ id: el.dataset.id, x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth || 40, h: el.offsetHeight || 40 }));

/** start it: 'riot', 'still' (reduced motion), 'empty' (nothing to riot), 'already' */
export function start(st) {
  if (riot) return 'already';
  if (stillness()) return 'still';
  const boxes = boxesOf(st);
  if (!boxes.length) return 'empty';
  riot = { bodies: seedBodies(boxes, Date.now() % 100000), raf: 0, last: performance.now() };
  const frame = (now) => {
    if (!riot) return;
    const dt = Math.min(2, Math.max(0.05, (now - riot.last) / 16.7)); riot.last = now;
    riot.bodies = step(riot.bodies, { w: st.stage.clientWidth || 800, h: st.stage.clientHeight || 600 }, dt);
    riot.bodies = riot.bodies.filter((b) => { const el = elOf(st, b.id); if (!el) return false; el.style.transition = 'none'; el.style.transform = transformOf(b); return true; }); // a thing removed mid-riot leaves it
    riot.raf = requestAnimationFrame(frame);
  };
  riot.raf = requestAnimationFrame(frame);
  return 'riot';
}
/** end it: every thing eases back to its saved spot (the stage's own .35 s transform transition); 'calm' or 'none' when there was no riot */
export function end(st) {
  if (!riot) return 'none';
  cancelAnimationFrame(riot.raf);
  for (const b of riot.bodies) { const el = elOf(st, b.id); if (el) { el.style.transition = ''; el.style.transform = ''; } }
  riot = null;
  return 'calm';
}
export const rioting = () => !!riot;

async function run(text, api) {
  const want = riotOf(text);
  if (!want) return 'none';
  const st = api.stage;
  if (want === 'end') { api.say(end(st) === 'calm' ? 'the riot is over · everything eases back to where it was' : 'there is no riot on'); return 'riot'; }
  const r = start(st);
  api.say(r === 'still' ? 'no riot: your system asks for reduced motion' : r === 'empty' ? 'nothing on the stage to riot · put something up first' : r === 'already' ? 'the riot is already on · "end the riot" calms it' : 'riot · say "end the riot" to calm it');
  return 'riot';
}

export default {
  name: 'riot',
  examples: ['start the riot', 'end the riot'],
  nearMisses: ['riot games', 'riot in paris today', 'what causes a riot'],
  match(lower, text) { return !!riotOf(text || lower); },
  run,
  riotOf, step, seedBodies, transformOf,
};
