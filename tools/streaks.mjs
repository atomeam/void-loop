// Streaks (asked by Verse: "automate the promotion of 'tested' skills to 'checked' status once they have survived 50 consecutive
// successful executions without an error trace in the Status card"). Each daily smoke run (tools/skills-check.mjs --write) really
// executes every skill's examples, near misses and suite(); a skill that passes adds one to its streak, one that fails goes back to
// zero (that failure is its error trace). tools/families.mjs lifts a skill that is only 'tested' to 'checked' at STREAK_PROMOTE in a
// row; it never lifts a skill past 'checked', and a failing day drops the rating at once because the streak is gone.
//   tools/skills-streak.json  { at: 'YYYY-MM-DD', streaks: { skill: n } }
import { readFileSync } from 'node:fs';
export const STREAK_PROMOTE = 50;

/** the next streaks from the last ones and one run. A run for the same day again is not counted twice. Pure. */
export function bump(prev, { names, failing, at }) {
  const p = prev && typeof prev === 'object' ? prev : {}, old = p.streaks && typeof p.streaks === 'object' ? p.streaks : {};
  const same = p.at === at, streaks = {};
  for (const n of names) {
    const was = Math.max(0, Math.floor(Number(old[n]) || 0));
    streaks[n] = failing && Object.prototype.hasOwnProperty.call(failing, n) ? 0 : same ? was : was + 1;
  }
  return { at, streaks };
}
/** what the file says now: { skill: n }. Pure apart from the read. */
export function streaksOf(read = (p) => readFileSync(p, 'utf8'), file = 'tools/skills-streak.json') {
  try { const j = JSON.parse(read(file)); return j && j.streaks && typeof j.streaks === 'object' ? j.streaks : {}; } catch (_) { return {}; }
}
/** 'tested' becomes 'checked' on a full streak; every other tier stays. Pure. */
export function promote(tier, streak) { return tier === 'tested' && Number(streak) >= STREAK_PROMOTE ? 'checked' : tier; }
