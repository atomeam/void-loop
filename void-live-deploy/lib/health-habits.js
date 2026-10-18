// Health and habits (owner's list, 2026-10-18, items 131 to 140, tools pack 6): water cups, stretch timer, mood in one tap, sleep hours,
// a step note, a meds checkbox day, a weekly habit grid with streaks, a fasting window timer and an opt-in posture nudge. All device-local
// notes and timers: nothing is sent anywhere and none of it is medical advice. Pure. Run: node --test tools/health-habits.test.mjs

export const TYPE_LABEL = { water: 'Water cups', stretch: 'Stretch timer', mood: 'Mood', sleep: 'Sleep hours', steps: 'Step note', meds: 'Meds today', habitgrid: 'Habit grid', fasting: 'Fasting window', posture: 'Posture nudge' };
export const KEEP_DAYS = 120;
export const MOODS = [{ face: '😞', word: 'awful' }, { face: '😕', word: 'low' }, { face: '😐', word: 'okay' }, { face: '🙂', word: 'good' }, { face: '😄', word: 'great' }];
export const STRETCHES = ['Neck: ear to shoulder, each side', 'Shoulders: roll back slowly', 'Wrists: circles and a gentle bend', 'Back: seated twist, each side', 'Hips: figure-four, each side', 'Calves: heel drop or wall push', 'Stand tall and reach overhead'];
export const POSTURE_TIP = 'Sit tall, drop your shoulders, unclench your jaw, look at something far away.';

const pad = (n) => String(n).padStart(2, '0');
const dayNum = (key) => { const [y, m, d] = key.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };
const keyOf = (n) => { const d = new Date(n * 86400000); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); };
/** the last `n` day keys ending on `today`, oldest first. Pure. */
export function lastDays(today, n = 7) { const t = dayNum(today); return Array.from({ length: n }, (_, i) => keyOf(t - (n - 1 - i))); }
/** a short weekday letter pair for a day key ("Mo"). Pure. */
export const weekdayOf = (key) => ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'][new Date(dayNum(key) * 86400000).getUTCDay()];

/** a days map with only the newest KEEP_DAYS keys. Pure. */
export function prune(map) {
  const keys = Object.keys(map || {}).sort();
  const out = {};
  for (const k of keys.slice(-KEEP_DAYS)) out[k] = map[k];
  return out;
}

/** tap cup `i` (0-based) of a day's count: it fills up to that cup; tapping the top filled cup empties it. Pure. */
export function tapCup(count, i, goal) {
  const c = Math.max(0, Math.min(goal, +count || 0));
  return c === i + 1 ? i : Math.min(goal, i + 1);
}

/** consecutive days up to today (or up to yesterday while today is still open) that are in `days`. Pure. */
export function streakOf(days, today) {
  const set = new Set(days || []);
  let n = dayNum(today), c = 0;
  if (!set.has(today)) n -= 1;
  while (set.has(keyOf(n))) { c++; n -= 1; }
  return c;
}
/** a day toggled in a sorted list (newest KEEP_DAYS kept). Pure. */
export function toggleDay(days, day, force) {
  const set = new Set(days || []), want = force === undefined ? !set.has(day) : !!force;
  if (want) set.add(day); else set.delete(day);
  return [...set].sort().slice(-KEEP_DAYS);
}

/** average of the logged values among the last 7 days, to one decimal, or null. Pure. */
export function weekAverage(map, today) {
  const vals = lastDays(today, 7).map((d) => (map || {})[d]).filter((v) => Number.isFinite(+v) && v !== '' && v !== null && v !== undefined).map(Number);
  return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null;
}
/** a number from a text box clamped into [lo, hi], or null when it is not a number. Pure. */
export function clampNum(v, lo, hi) { const s = String(v).trim(); if (s === '' || !Number.isFinite(+s)) return null; return Math.min(hi, Math.max(lo, +s)); }

// ---- timers ----
/** "1:05:09" / "12:03" for a span of milliseconds. Pure. */
export function clock(ms) {
  const s = Math.max(0, Math.floor(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  return h ? h + ':' + pad(m) + ':' + pad(x) : m + ':' + pad(x);
}
/** the fast's state at `now` (ms): { elapsed, remaining, pct, done, endsAt }; null with no start. Pure. */
export function fastState(start, now, hours) {
  if (!start || !(hours > 0)) return null;
  const total = hours * 3600000, elapsed = Math.max(0, now - start);
  return { elapsed, remaining: Math.max(0, total - elapsed), pct: Math.min(100, Math.round((elapsed / total) * 100)), done: elapsed >= total, endsAt: start + total };
}
/** the stretch routine for `secs` per stretch (default 30, 5 to 120). Pure. */
export function stretchPlan(secs) { const s = Math.max(5, Math.min(120, Math.round(+secs || 30))); return STRETCHES.map((name) => ({ name, secs: s })); }
/** where the routine is after `elapsedSec`: { index, left, done }. Pure. */
export function stretchAt(plan, elapsedSec) {
  let t = Math.max(0, elapsedSec);
  for (let i = 0; i < plan.length; i++) { if (t < plan[i].secs) return { index: i, left: Math.ceil(plan[i].secs - t), done: false }; t -= plan[i].secs; }
  return { index: plan.length - 1, left: 0, done: true };
}
/** has a nudge come due? Pure. */
export const nudgeDue = (nextAt, now) => !!nextAt && now >= nextAt;

// ---- the ask ----
const LEAD = '^(?:please\\s+)?(?:(?:make|build|create|show|start|give|open|set\\s+up|get)\\s+(?:me\\s+)?)?(?:an?\\s+|my\\s+|the\\s+)?';
const TAIL = '(?:\\s+please)?$';
const clean = (s) => String(s || '').replace(/\s+/g, ' ').replace(/^[\s,;:.\-]+|[\s,;:.]+$/g, '').slice(0, 30);
const splitNames = (s) => [...new Set(String(s || '').split(/\s*(?:,|;|\band\b|&|\+|\n|⏎)\s*/i).map(clean).filter(Boolean))];

/** a health-habits ask as a thing's props: { type, ... }, or null. Pure. */
export function parseHealthAsk(raw) {
  const t = String(raw == null ? '' : raw).trim().replace(/[.!]+$/, '');
  if (!t || t.length > 300) return null;
  let m = new RegExp(LEAD + '(?:water(?:\\s+cups?)?\\s+(?:tracker|log|counter)|water\\s+cups?)(?:\\s*(?:of|for|:)?\\s*(\\d{1,2})\\s*(?:cups?|glasses))?' + TAIL, 'i').exec(t)
    || new RegExp('^(?:please\\s+)?track\\s+my\\s+water(?:\\s+(?:intake|cups))?(?:\\s*:?\\s*(\\d{1,2})\\s*(?:cups?|glasses))?' + TAIL, 'i').exec(t);
  if (m) return { type: 'water', goal: Math.max(1, Math.min(16, +m[1] || 8)), days: {} };
  m = new RegExp(LEAD + 'stretch(?:ing)?(?:\\s+break)?\\s+timer(?:\\s+(?:of\\s+|with\\s+)?(\\d{1,3})\\s*(?:s|sec|secs|seconds?)(?:\\s+each)?)?' + TAIL, 'i').exec(t);
  if (m) return { type: 'stretch', secs: Math.max(5, Math.min(120, +m[1] || 30)) };
  if (new RegExp(LEAD + 'mood(?:\\s+(?:tracker|log|check-?in|one-?tap|tap))+' + TAIL, 'i').test(t) || /^(?:please\s+)?(?:log|track)\s+my\s+mood$/i.test(t)) return { type: 'mood', days: {} };
  if (new RegExp(LEAD + 'sleep\\s+(?:hours\\s+)?(?:log|tracker)' + TAIL, 'i').test(t) || /^(?:please\s+)?(?:log|track)\s+my\s+sleep(?:\s+hours)?$/i.test(t)) return { type: 'sleep', days: {} };
  if (new RegExp(LEAD + 'steps?(?:\\s+count)?\\s+(?:note|log)s?' + TAIL, 'i').test(t) || /^(?:please\s+)?(?:log|note)\s+my\s+steps$/i.test(t)) return { type: 'steps', days: {} };
  m = new RegExp(LEAD + '(?:daily\\s+)?(?:meds?|medication|medicine|pills?)\\s+(?:checkbox(?:es)?|checklist|check-?off)(?:\\s+(?:for\\s+the\\s+day|for\\s+today|day))?(?:\\s*:\\s*(.+))?' + TAIL, 'i').exec(t)
    || new RegExp(LEAD + 'meds?\\s+(?:for\\s+)?(?:the\\s+)?day(?:\\s*:\\s*(.+))?' + TAIL, 'i').exec(t);
  if (m) return { type: 'meds', items: splitNames(m[1]).slice(0, 12).map((x, i) => ({ id: 'm' + i + Math.random().toString(36).slice(2, 6), text: x })), taken: {} };
  m = new RegExp(LEAD + '(?:weekly\\s+)?habit\\s+(?:grid|streaks?(?:\\s+(?:tracker|grid))?)(?:\\s*(?:for|of|:)\\s*(.+))?' + TAIL, 'i').exec(t);
  if (m) return { type: 'habitgrid', habits: splitNames(m[1]).slice(0, 10).map((name) => ({ name, days: [] })) };
  m = new RegExp(LEAD + '(?:(?:intermittent\\s+)?fasting\\s+window(?:\\s+(?:timer|clock))?|(?:intermittent\\s+)?fasting\\s+(?:timer|clock)|fast\\s+timer)(?:\\s+(?:of\\s+|for\\s+)?(?:(\\d{1,2})\\s*[:/]\\s*\\d{1,2}|(\\d{1,2})\\s*(?:hours?|hrs?|h)))?' + TAIL, 'i').exec(t);
  if (m) return { type: 'fasting', hours: Math.max(1, Math.min(48, +(m[1] || m[2]) || 16)), start: 0 };
  m = new RegExp(LEAD + 'posture\\s+(?:break\\s+)?(?:nudge|reminder|check)s?(?:\\s+every\\s+(\\d{1,3})\\s*(seconds?|secs?|s|minutes?|mins?|m)\\b)?' + TAIL, 'i').exec(t);
  if (m) { const n = +m[1] || 30, sec = /^s/i.test(m[2] || ''); return { type: 'posture', everySec: sec ? Math.max(3, n) : Math.max(1, Math.min(240, n)) * 60, on: false }; }
  return null;
}
