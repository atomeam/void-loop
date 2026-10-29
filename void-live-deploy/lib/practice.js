/**
 * Practice sessions that say whether they worked (asked by Verse: "Integrate a 'success_rate' metadata update into the practice
 * timer so every session logs how many attempts actually resulted in a successful skill execution", "... whether the skill
 * execution actually met the goal", "... so that Clef's 'yes/no' decision is weighed against the execution quality").
 * A practice timer a plan put up (skills/intent.js) knows its goal. When it reaches 0:00 the timer asks one question, did
 * this session meet the goal, and the answer is logged here per goal in the same shape families.json uses for a skill:
 * { attempts, met, success_rate (0 to 1), last_tested (a day) }. The next plan for that goal weighs Clef's yes/no (a daily
 * practice, so a timer) against that record: a goal whose sessions mostly fell short gets a shorter timer, and the card says why.
 * Kept in this browser only (localStorage), the goal text and counts, nothing else. Pure; tests: tools/practice.test.mjs.
 */
export const KEY = 'void.practice';
export const GOALS_MAX = 40, MIN_SESSIONS = 3, LOW = 0.4, HIGH = 0.8, TIMER_FLOOR = 5;
/** a goal as the key its record is kept under: lower case, one line, at most 80 characters */
export const goalKey = (g) => String(g == null ? '' : g).toLowerCase().replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
const day = (now) => new Date(now).toISOString().slice(0, 10);
/** the log with one more session for the goal (met: true | false); a new object, the oldest goals dropped past GOALS_MAX */
export function record(log, goal, met, now = Date.now()) {
  const k = goalKey(goal);
  const out = {};
  for (const [g, e] of Object.entries(log && typeof log === 'object' ? log : {})) if (e && Number.isInteger(e.attempts) && Number.isInteger(e.met)) out[g] = e;
  if (!k) return out;
  const old = out[k] || { attempts: 0, met: 0 }, attempts = old.attempts + 1, hit = old.met + (met ? 1 : 0);
  delete out[k];
  out[k] = { attempts, met: hit, success_rate: Math.round(hit / attempts * 1000) / 1000, last_tested: day(now) };
  const keys = Object.keys(out);
  for (const g of keys.slice(0, Math.max(0, keys.length - GOALS_MAX))) delete out[g];
  return out;
}
/** the record for a goal, or null */
export const entryOf = (log, goal) => { const e = log && log[goalKey(goal)]; return e && e.attempts > 0 ? e : null; };
/** the words for a record: "2 of 5 sessions met the goal (40%)" */
export const rateWords = (e) => e ? e.met + ' of ' + e.attempts + ' session' + (e.attempts === 1 ? '' : 's') + ' met the goal (' + Math.round(e.met / e.attempts * 100) + '%)' : '';
/**
 * Clef's yes/no (daily: { yes: true | false | null }) and the engine's minutes weighed against how the goal's sessions went.
 * Under MIN_SESSIONS nothing changes. A rate at or under LOW halves the minutes (never under TIMER_FLOOR): the call says "daily
 * practice" but the sessions say it is too long. A rate at or over HIGH keeps them and says so. Returns { minutes, why }.
 */
export function weigh(minutes, daily, entry) {
  if (!minutes || !entry || entry.attempts < MIN_SESSIONS) return { minutes, why: '' };
  const rate = entry.met / entry.attempts;
  if (rate <= LOW) { const m = Math.max(TIMER_FLOOR, Math.round(minutes / 2)); return { minutes: m, why: rateWords(entry) + ', so a shorter timer' }; }
  if (rate >= HIGH) return { minutes, why: rateWords(entry) + ', so the timer stays' };
  return { minutes, why: rateWords(entry) };
}
export function readLog(store) { try { const j = JSON.parse(store.getItem(KEY) || '{}'); return j && typeof j === 'object' ? j : {}; } catch (_) { return {}; } }
export function writeLog(store, log) { try { store.setItem(KEY, JSON.stringify(log)); return true; } catch (_) { return false; } }
