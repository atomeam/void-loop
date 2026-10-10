/**
 * ringer-rules — Ringer, the schoolyard marble game, in plain JS (no DOM, no three.js), shared by the card
 * (skills/ringer.js), its 3D ring (skills/mini/ringer.js) and the tests (tools/ringer.test.mjs). Frontier build-order
 * step 5: the behaviour lives here and only here; the card and the miniature pose themselves from the one state.
 * Thirteen marbles stand in a cross in the middle of a chalk ring scratched in the dirt. You knuckle down at the edge and
 * flick your shooter: knock a marble clean out of the ring and it is yours. Your shooter stays where it stopped while it
 * stays in the ring and you keep knocking marbles out; otherwise it goes back to the edge. Clear the ring in as few shots
 * as you can. Real sizes in metres: a 16 mm marble, a 19 mm shooter, a schoolyard ring 0.56 m across.
 *   create(seed) -> state                aim(s, angle) / aimAt(s, x, y) / setPower(s, p) -> s
 *   pull(s, x, y) -> s (drag to flick)   flick(s) -> s (rolling)   step(s, dt) -> s (back to 'aim' once everything has stopped)
 *   settle(s) -> s (steps until it stops, for tests and a hidden board)      summary(s) -> text
 */
export const RING = 0.28, MARBLE = 0.008, SHOOTER = 0.0095, GAP = 0.04, COUNT = 13;
export const DECEL = 1.4;        // rolling on packed dirt slows a marble by about 1.4 m/s every second
export const RESTITUTION = 0.9;  // glass on glass gives back most of the energy
export const SPEED_MIN = 0.3, SPEED_MAX = 1.6, STOP = 0.004, H = 1 / 480;
export const FAR = RING + 0.1;   // a marble rolling this far from the middle is caught (it stays on the dirt) and stops

const mass = (r) => r * r * r;   // same glass: mass goes with the volume
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/** A new game: 13 marbles in a cross, the shooter at the edge facing the middle. The seed gives each marble its look. */
export function create(seed = 1) {
  const marbles = [{ id: 0, r: SHOOTER, x: 0, y: -(RING + SHOOTER), vx: 0, vy: 0, out: false, shooter: true }];
  const spots = [[0, 0]];
  for (let k = 1; k <= 3; k++) spots.push([k, 0], [-k, 0], [0, k], [0, -k]);
  spots.forEach(([i, j], n) => marbles.push({ id: n + 1, r: MARBLE, x: i * GAP, y: j * GAP, vx: 0, vy: 0, out: false, shooter: false }));
  return { v: 1, seed: seed >>> 0, ring: RING, marbles, angle: Math.PI / 2, power: 0.6, phase: 'aim', shots: 0, out: 0, shotOut: 0, over: false, t: 0, last: null };
}

const shooterOf = (s) => s.marbles[0];
export const inRing = (m) => Math.hypot(m.x, m.y) <= RING - m.r; // wholly inside the chalk line
export const left = (s) => s.marbles.filter((m) => !m.shooter && !m.out).length;
export const moving = (s) => s.marbles.some((m) => m.vx || m.vy);

export function aim(s, angle) { return s.phase !== 'aim' || s.over ? s : { ...s, angle: Math.atan2(Math.sin(angle), Math.cos(angle)) }; }
/** Aim the shooter at a point on the ground (metres, ring centre at 0,0). */
export function aimAt(s, x, y) { const sh = shooterOf(s); return (x === sh.x && y === sh.y) ? s : aim(s, Math.atan2(y - sh.y, x - sh.x)); }
export function setPower(s, p) { return s.phase !== 'aim' || s.over ? s : { ...s, power: clamp(+p || 0, 0, 1) }; }
export const speedFor = (power) => SPEED_MIN + (SPEED_MAX - SPEED_MIN) * clamp(power, 0, 1);

// Drag to flick (the 3D ring): press the shooter, pull back like a knuckle flick, let go. The shot goes opposite the pull,
// and its power grows with the pull up to PULL_MAX; a pull shorter than PULL_MIN is not a shot (a tap, or a change of mind).
export const PULL_MAX = 0.12, PULL_MIN = 0.008;
/** Aim and power from where the pointer is while pulling back (x, y on the ground, metres). */
export function pull(s, x, y) {
  if (s.phase !== 'aim' || s.over) return s;
  const sh = shooterOf(s), dx = sh.x - x, dy = sh.y - y, len = Math.hypot(dx, dy);
  if (len < 1e-9) return s;
  return { ...s, angle: Math.atan2(dy, dx), power: clamp(len / PULL_MAX, 0, 1) };
}
export const pullLength = (s, x, y) => { const sh = shooterOf(s); return Math.hypot(sh.x - x, sh.y - y); };
// Where the shooter would stop if it met nothing: rolling friction takes v^2 / (2 DECEL), and a marble that reaches FAR from
// the middle is caught there. The aim line is drawn this long, so what it shows is what the dirt will do. Pure.
export function reach(s) {
  const sh = shooterOf(s), ux = Math.cos(s.angle), uy = Math.sin(s.angle), v = speedFor(s.power), free = (v * v) / (2 * DECEL);
  const b = sh.x * ux + sh.y * uy, c = sh.x * sh.x + sh.y * sh.y - FAR * FAR, disc = b * b - c;
  const toFar = disc >= 0 ? -b + Math.sqrt(disc) : Infinity, d = Math.max(0, Math.min(free, toFar));
  return { x: sh.x + ux * d, y: sh.y + uy * d, d };
}

/** Flick the shooter along the aim at the chosen power. */
export function flick(s) {
  if (s.phase !== 'aim' || s.over) return s;
  const v = speedFor(s.power), marbles = s.marbles.map((m) => ({ ...m }));
  marbles[0].vx = Math.cos(s.angle) * v; marbles[0].vy = Math.sin(s.angle) * v;
  return { ...s, marbles, phase: 'rolling', shots: s.shots + 1, shotOut: 0, last: { angle: s.angle, power: s.power } };
}

function roll(m, h) {
  const sp = Math.hypot(m.vx, m.vy);
  if (!sp) return;
  const ns = sp - DECEL * h;
  if (ns <= STOP) { m.vx = 0; m.vy = 0; return; }
  m.vx *= ns / sp; m.vy *= ns / sp;
  m.x += m.vx * h; m.y += m.vy * h;
  if (Math.hypot(m.x, m.y) > FAR) { m.vx = 0; m.vy = 0; }
}

// two marbles touching and closing: an impulse along the line between their centres (momentum kept, energy lost only to
// the restitution), then push them apart so they never sink into each other
function collide(a, b) {
  const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
  if (!d || d >= min) return false;
  const nx = dx / d, ny = dy / d, ma = mass(a.r), mb = mass(b.r);
  const closing = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (closing > 0) {
    const j = (1 + RESTITUTION) * closing / (1 / ma + 1 / mb);
    a.vx -= (j / ma) * nx; a.vy -= (j / ma) * ny; b.vx += (j / mb) * nx; b.vy += (j / mb) * ny;
  }
  const push = (min - d) / 2;
  a.x -= nx * push; a.y -= ny * push; b.x += nx * push; b.y += ny * push;
  return true;
}

function substep(marbles, h) {
  for (const m of marbles) roll(m, h);
  for (let i = 0; i < marbles.length; i++) for (let j = i + 1; j < marbles.length; j++) collide(marbles[i], marbles[j]);
}

/** Advance the game by dt seconds. When everything has stopped, the shot is scored and the shooter is placed. */
export function step(s, dt) {
  if (s.phase !== 'rolling') return s;
  const marbles = s.marbles.map((m) => ({ ...m }));
  let left = clamp(dt, 0, 0.1), out = s.out, shotOut = s.shotOut;
  while (left > 1e-9) { const h = Math.min(H, left); substep(marbles, h); left -= h; }
  for (const m of marbles) if (!m.shooter && !m.out && Math.hypot(m.x, m.y) > RING + m.r) { m.out = true; out++; shotOut++; } // wholly over the line
  const next = { ...s, marbles, out, shotOut, t: s.t + dt };
  if (marbles.some((m) => m.vx || m.vy)) return next;
  // everything has stopped: keep the shooter where it lies if it stayed in and knocked one out, else back to the edge
  const sh = marbles[0], d = Math.hypot(sh.x, sh.y) || 1;
  if (!(inRing(sh) && shotOut > 0)) { const k = (RING + sh.r) / d; sh.x *= k; sh.y *= k; }
  const over = out >= COUNT;
  return { ...next, phase: 'aim', over, angle: Math.atan2(-sh.y, -sh.x) }; // face the middle again
}

/** Step until everything stops (at most `limit` seconds). */
export function settle(s, limit = 30) { let n = s; for (let t = 0; n.phase === 'rolling' && t < limit; t += 1 / 60) n = step(n, 1 / 60); return n; }

// A new game that keeps the best score: the fewest shots that cleared a ring so far (the game's own record, nothing else). Pure.
export function newGame(s, seed) {
  const was = s && Number.isFinite(s.best) ? s.best : null, now = s && s.over ? s.shots : null;
  const best = was == null ? now : now == null ? was : Math.min(was, now);
  return { ...create(seed), best };
}
const plural = (n) => n + ' shot' + (n === 1 ? '' : 's');
export function summary(s) {
  const best = Number.isFinite(s.best) ? s.best : null;
  if (s.over) return 'Ring cleared: all ' + COUNT + ' marbles in ' + plural(s.shots) + (best == null ? '' : s.shots < best ? ' · a new best (it was ' + best + ')' : s.shots === best ? ' · equals your best' : ' · your best is ' + best);
  if (s.phase === 'rolling') return 'Rolling…';
  const got = s.out + ' of ' + COUNT + ' knocked out · ' + s.shots + ' shot' + (s.shots === 1 ? '' : 's');
  if (!s.shots) return 'Tap where to aim, set the power, then Flick' + (best == null ? '' : ' · best clear: ' + plural(best));
  const inside = inRing(shooterOf(s)) && s.shotOut > 0;
  return got + (s.shotOut ? ' · that one got ' + s.shotOut : ' · missed') + (inside ? ' · shoot again from where it stopped' : '');
}
