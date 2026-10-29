/**
 * stopwatch: the arithmetic of a stopwatch and a countdown timer (the tower's online-stopwatch.com floor). Time is kept as the moment a
 * run started and the time banked before it, never as a ticking counter, so a tab in the background, a slow machine or a reload never makes
 * it drift: elapsed = banked + (now - startedAt). Pure. Tests: tools/stopwatch.test.mjs.
 */

/** "1:02:03.45", "2:03.45", "0:03.45" (hundredths shown; hours only when there are some). Pure. */
export function clock(ms, { hundredths = true } = {}) {
  const t = Math.max(0, Math.floor(ms)), h = Math.floor(t / 3600000), m = Math.floor((t % 3600000) / 60000), s = Math.floor((t % 60000) / 1000), cs = Math.floor((t % 1000) / 10);
  const two = (n) => String(n).padStart(2, '0');
  return (h ? h + ':' + two(m) : String(m)) + ':' + two(s) + (hundredths ? '.' + two(cs) : '');
}

/** a stopwatch's state after an action at `now`: { startedAt (or null), banked, laps: [ms of each lap's end, from the start] }. Pure. */
export const fresh = () => ({ startedAt: null, banked: 0, laps: [] });
export const elapsed = (s, now) => s.banked + (s.startedAt === null ? 0 : now - s.startedAt);
export function act(s, what, now) {
  if (what === 'start') return s.startedAt === null ? { ...s, startedAt: now } : s;
  if (what === 'stop') return s.startedAt === null ? s : { ...s, startedAt: null, banked: elapsed(s, now) };
  if (what === 'toggle') return act(s, s.startedAt === null ? 'start' : 'stop', now);
  if (what === 'lap') return s.startedAt === null ? s : { ...s, laps: [...s.laps, elapsed(s, now)] };
  if (what === 'reset') return fresh();
  return s;
}

/** the laps as rows, newest first: { n, split (this lap), total, delta (against the previous lap, or null), fastest, slowest }. Pure. */
export function lapRows(laps) {
  const splits = laps.map((t, i) => t - (i ? laps[i - 1] : 0));
  const min = splits.length > 1 ? Math.min(...splits) : null, max = splits.length > 1 ? Math.max(...splits) : null;
  return splits.map((split, i) => ({ n: i + 1, split, total: laps[i], delta: i ? split - splits[i - 1] : null, fastest: split === min, slowest: split === max })).reverse();
}

/** the stage timer's ask for a countdown of `ms` ("set a timer for 10 minutes", "set a timer for 90 seconds"), whole seconds from 1 s
 *  to 24 h; '' for anything else. skills/timer.js reads it back to the same length (tools/toolkit.test.mjs). Pure. */
export function timerAsk(ms) {
  if (!Number.isInteger(ms) || ms < 1000 || ms > 86400000 || ms % 1000) return '';
  return 'set a timer for ' + (ms % 60000 ? ms / 1000 + ' seconds' : ms / 60000 + (ms === 60000 ? ' minute' : ' minutes'));
}

/** a duration typed or put in a link, in ms, or null: "10m", "1h30m", "90s", "1:30", "01:02:03", "25", "10 minutes", "1.5 h". A bare number is minutes. Pure. */
export function parseDuration(text) {
  const t = String(text || '').trim().toLowerCase(); if (!t) return null;
  if (/^\d{1,3}(?::\d{1,2}){1,2}$/.test(t)) { const p = t.split(':').map(Number); if (p.slice(1).some((x) => x > 59)) return null; return (p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1]) * 1000; }
  if (/^\d+(?:\.\d+)?$/.test(t)) return Math.round(Number(t) * 60000);
  const re = /(\d+(?:\.\d+)?)\s*(h|hr|hrs|hours?|m|min|mins|minutes?|s|sec|secs|seconds?)(?![a-z])/g; let ms = 0, any = false, m;
  while ((m = re.exec(t))) { any = true; ms += Number(m[1]) * (/^h/.test(m[2]) ? 3600000 : /^m/.test(m[2]) ? 60000 : 1000); }
  if (!any || t.replace(re, '').replace(/\band\b|,|\s+/g, '') !== '') return null;
  return Math.round(ms);
}

/** a countdown's state: { endsAt (or null), left (ms banked while paused), total }. Pure. */
export const timer = (total) => ({ endsAt: null, left: total, total });
export const remaining = (c, now) => Math.max(0, c.endsAt === null ? c.left : c.endsAt - now);
export function tact(c, what, now) {
  if (what === 'start') return c.endsAt === null && c.left > 0 ? { ...c, endsAt: now + c.left } : c;
  if (what === 'pause') return c.endsAt === null ? c : { ...c, endsAt: null, left: remaining(c, now) };
  if (what === 'toggle') return tact(c, c.endsAt === null ? 'start' : 'pause', now);
  if (what === 'reset') return timer(c.total);
  return c;
}

/**
 * An interval timer (work and rest rounds, in sets), as the steps it walks through: [{ kind: 'prep'|'work'|'rest'|'setrest', ms, round, set }].
 * No rest after the last round of a set (the set rest, or the end, follows); no set rest after the last set. Pure.
 */
export function intervalSteps({ prep = 0, work = 20000, rest = 10000, rounds = 8, sets = 1, setRest = 0 } = {}) {
  const out = [], n = Math.max(1, Math.min(99, Math.round(rounds) || 1)), k = Math.max(1, Math.min(20, Math.round(sets) || 1));
  if (prep > 0) out.push({ kind: 'prep', ms: prep, round: 0, set: 1 });
  for (let s = 1; s <= k; s++) {
    for (let r = 1; r <= n; r++) {
      if (work > 0) out.push({ kind: 'work', ms: work, round: r, set: s });
      if (rest > 0 && r < n) out.push({ kind: 'rest', ms: rest, round: r, set: s });
    }
    if (setRest > 0 && s < k) out.push({ kind: 'setrest', ms: setRest, round: n, set: s });
  }
  return out;
}
/** where an interval run is `t` ms in: { i (step index, steps.length when done), step, left (ms of this step), total, totalLeft, done }. Pure. */
export function intervalAt(steps, t) {
  const total = steps.reduce((a, s) => a + s.ms, 0); let at = Math.max(0, t);
  for (let i = 0; i < steps.length; i++) { if (at < steps[i].ms) return { i, step: steps[i], left: steps[i].ms - at, total, totalLeft: total - Math.max(0, t), done: false }; at -= steps[i].ms; }
  return { i: steps.length, step: null, left: 0, total, totalLeft: 0, done: true };
}

/**
 * A chess clock: two players' time, Fischer increment, a turn that runs as a timestamp. { left: [ms, ms], turn (0, 1 or null), since, paused
 * (the side to resume, or null), moves: [n, n], base, inc, flag (the side that ran out, or null) }. Pure.
 */
export const chess = (base, inc = 0) => ({ left: [base, base], turn: null, since: null, paused: null, moves: [0, 0], base, inc, flag: null });
/** each side's time left at `now` (the side to move counts down). Pure. */
export const chessLeft = (c, now) => c.left.map((ms, i) => Math.max(0, i === c.turn && c.since !== null ? ms - (now - c.since) : ms));
/** the clock after a side ends its turn (taps its own clock) at `now`: the other side's time starts; the first tap starts the game. Pure. */
export function chessTap(c, side, now) {
  if (c.flag !== null || c.paused !== null) return c;
  if (c.turn === null) return { ...c, turn: 1 - side, since: now }; // the first tap: the side that tapped waits, the other moves
  if (c.turn !== side) return c;
  const used = now - c.since, left = c.left.slice(), moves = c.moves.slice();
  if (used >= left[side]) { left[side] = 0; return { ...c, left, turn: null, since: null, flag: side }; }
  left[side] = left[side] - used + c.inc; moves[side]++;
  return { ...c, left, moves, turn: 1 - side, since: now };
}
/** pause (banks the running side) or resume. Pure. */
export function chessPause(c, now) {
  if (c.flag !== null) return c;
  if (c.paused !== null) return { ...c, turn: c.paused, since: now, paused: null };
  if (c.turn === null) return c;
  const left = chessLeft(c, now); return { ...c, left, turn: null, since: null, paused: c.turn };
}
/** the clock with a flag set when the side to move has run out at `now`. Pure. */
export function chessFlag(c, now) {
  if (c.turn === null || c.flag !== null) return c;
  const left = chessLeft(c, now); return left[c.turn] > 0 ? c : { ...c, left, turn: null, since: null, flag: c.turn };
}
