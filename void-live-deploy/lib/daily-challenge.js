// The daily challenge: one scored run a day of today's Debris Field round (the same round for everyone on a UTC day, lib/studio-play.js
// daySeed), a streak of days in a row, and a line to send a friend ("beat 1200 on the daily challenge"). Kept on this device only. Pure but load/save.
export const KEY = 'a2m.void.daily.v1';
const pad = (n) => String(n).padStart(2, '0');
/** 'YYYY-MM-DD' for the UTC day, the day the round's seed is drawn for. Pure. */
export const dayKey = (d = new Date()) => d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate());
/** the UTC day before `day`. Pure. */
export function dayBefore(day) { const t = Date.parse(day + 'T12:00:00Z'); return Number.isFinite(t) ? dayKey(new Date(t - 864e5)) : ''; }
const blank = () => ({ last: '', streak: 0, best: 0, scores: {} });
/** a state read back from storage, whatever was there. Pure. */
export function clean(x) {
  const s = blank();
  if (!x || typeof x !== 'object') return s;
  if (/^\d{4}-\d\d-\d\d$/.test(x.last)) s.last = x.last;
  s.streak = Math.max(0, Math.floor(+x.streak) || 0); s.best = Math.max(0, Math.floor(+x.best) || 0);
  if (x.scores && typeof x.scores === 'object') for (const [k, v] of Object.entries(x.scores)) if (/^\d{4}-\d\d-\d\d$/.test(k) && Number.isFinite(+v)) s.scores[k] = Math.max(0, Math.floor(+v));
  return s;
}
/** today's score, or null before today's run. Pure. */
export const todayScore = (s, day) => (s && s.scores && day in s.scores ? s.scores[day] : null);
/** the streak as it stands on `day`: kept through yesterday, gone after a missed day. Pure. */
export function streakOn(s, day) { return s && (s.last === day || s.last === dayBefore(day)) ? s.streak : 0; }
/** the state after today's one run. A second run on the same day changes nothing. Pure. */
export function record(state, day, score) {
  const s = clean(state);
  if (day in s.scores) return s;
  const n = Math.max(0, Math.floor(+score) || 0);
  s.streak = s.last === dayBefore(day) ? s.streak + 1 : 1;
  s.last = day; s.best = Math.max(s.best, n); s.scores[day] = n;
  const keep = Object.keys(s.scores).sort().slice(-30); s.scores = Object.fromEntries(keep.map((k) => [k, s.scores[k]]));
  return s;
}
/** the ask a friend's link runs: "beat 1200 on the daily challenge". Pure. */
export const beatAsk = (score) => 'beat ' + Math.max(0, Math.floor(+score) || 0) + ' on the daily challenge';
/** the link and the words for "I scored X today". Pure. */
export function shareOf(score, streak, origin = 'https://a-to-mind.com') {
  const url = origin + '/?q=' + encodeURIComponent(beatAsk(score));
  const text = 'I scored ' + Math.max(0, Math.floor(+score) || 0) + ' on today’s Verse challenge' + (streak > 1 ? ', ' + streak + ' days in a row' : '') + '. Beat me:';
  return { url, text };
}
/** { friend } for a daily-challenge ask (friend is a number or null), or null when the ask is something else. Pure. */
export function askOf(text) {
  const t = String(text || '').toLowerCase().trim().replace(/[.!?]+$/, '').replace(/\s+/g, ' ').replace(/’/g, "'");
  const b = t.match(/^(?:can you |try to |i bet you can'?t )?beat (\d{1,7}) (?:on|in|at) (?:the |today'?s )?(?:daily|verse) (?:challenge|round)$/);
  if (b) return { friend: Number(b[1]) };
  if (/^(?:(?:let'?s |i want to |can i )?(?:play|start|open|do|try) )?(?:the |today'?s |a )?(?:daily (?:verse )?challenge|daily debris field|daily round|challenge of the day|today'?s (?:verse )?challenge)(?: today)?$/.test(t)) return { friend: null };
  return null;
}
/** hours (rounded up) until the next UTC day. Pure. */
export function hoursLeft(now = new Date()) { const next = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1); return Math.max(1, Math.ceil((next - now.getTime()) / 36e5)); }
export function load(store = globalThis.localStorage) { try { return clean(JSON.parse(store.getItem(KEY) || 'null')); } catch (_) { return blank(); } }
export function save(s, store = globalThis.localStorage) { try { store.setItem(KEY, JSON.stringify(clean(s))); } catch (_) {} }
