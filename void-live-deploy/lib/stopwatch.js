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
