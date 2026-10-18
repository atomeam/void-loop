// arcade-ghost: play against your own best run (asked by Verse: "Create a 'Ghost' playback feature for Pong and Snake to allow users to
// play against their own best scores."). Pure and DOM-free; the cards (skills/pong.js, skills/snake.js) record each game, keep the best
// one in this browser only (localStorage, never sent anywhere) and replay it as a faint ghost beside the live game.
//   Pong:  a run is { game:'pong', you, void, dur, ys:[paddle y every PONG_DT s] }; the best has the widest margin, then the shortest game.
//   Snake: a run is { game:'snake', len, path:[[x,y] of the head each tick], lens:[length each tick] }; the best is the longest.
export const PONG_DT = 0.05, MAX = 3000, KEY = 'void-ghost-';

/** records a Pong paddle: tick(dt, y) each frame while the game runs, run(s) when it ends. */
export function pongRecorder() {
  const r = { t: 0, next: 0, ys: [] };
  return {
    tick(dt, y) { r.t += dt; while (r.next <= r.t && r.ys.length < MAX) { r.ys.push(Math.round(y * 10) / 10); r.next += PONG_DT; } },
    run(s) { return { game: 'pong', you: s.you.score, void: s.void.score, dur: Math.round(r.t * 10) / 10, ys: r.ys.slice() }; },
  };
}
/** a Snake recorder: tick(s) after each game tick. */
export function snakeRecorder() {
  const r = { path: [], lens: [] };
  return {
    tick(s) { if (r.path.length >= MAX) return; const h = s.you.body[0]; r.path.push([h[0], h[1]]); r.lens.push(s.you.body.length); },
    run(s) { return { game: 'snake', len: s.you.body.length, path: r.path.slice(), lens: r.lens.slice() }; },
  };
}

const margin = (r) => r.you - r.void;
/** true when run a beats run b (b may be null). Pong: wider margin, then more points, then a shorter game. Snake: longer. */
export function better(a, b) {
  if (!valid(a)) return false; if (!valid(b)) return true;
  if (a.game === 'snake') return a.len > b.len || (a.len === b.len && a.path.length < b.path.length);
  return margin(a) > margin(b) || (margin(a) === margin(b) && (a.you > b.you || (a.you === b.you && a.dur < b.dur)));
}
export function valid(r) {
  if (!r || typeof r !== 'object') return false;
  if (r.game === 'pong') return Number.isFinite(r.you) && Number.isFinite(r.void) && Array.isArray(r.ys) && r.ys.length > 0 && r.ys.length <= MAX && r.ys.every((y) => typeof y === 'number' && Number.isFinite(y));
  if (r.game === 'snake') return Number.isFinite(r.len) && Array.isArray(r.path) && r.path.length > 0 && r.path.length <= MAX && r.path.every((p) => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite)) && Array.isArray(r.lens) && r.lens.length === r.path.length;
  return false;
}
/** the ghost paddle's y at game time t seconds (the last sample once the run is over). */
export function pongGhostY(run, t) {
  const i = Math.max(0, t) / PONG_DT, a = Math.min(run.ys.length - 1, Math.floor(i)), b = Math.min(run.ys.length - 1, a + 1), f = i - Math.floor(i);
  return run.ys[a] + (run.ys[b] - run.ys[a]) * (a === b ? 0 : f);
}
/** the ghost snake after `ticks` ticks: its body, head first (the run's own last position once it is over). */
export function snakeGhostBody(run, ticks) {
  const i = Math.max(0, Math.min(run.path.length - 1, ticks)), n = run.lens[i];
  return run.path.slice(Math.max(0, i - n + 1), i + 1).reverse();
}
/** one line for the card: what the ghost is. */
export function words(run) {
  if (!valid(run)) return 'No ghost yet: finish a game and your best run becomes the ghost.';
  return run.game === 'snake' ? 'Ghost: your best run, ' + run.len + ' long' : 'Ghost: your best game, ' + run.you + '-' + run.void;
}

const store = () => { try { return globalThis.localStorage || null; } catch (e) { return null; } };
export function load(game, st = store()) {
  try { const r = JSON.parse(st.getItem(KEY + game)); return valid(r) && r.game === game ? r : null; } catch (e) { return null; }
}
/** keeps the run if it beats the saved best; returns { run, beat } (beat: it is a new best). */
export function submit(run, st = store()) {
  const cur = load(run.game, st);
  if (!better(run, cur)) return { run: cur, beat: false };
  try { st.setItem(KEY + run.game, JSON.stringify(run)); } catch (e) { return { run: cur, beat: false }; }
  return { run, beat: true };
}
