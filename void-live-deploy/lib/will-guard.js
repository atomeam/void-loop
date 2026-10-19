// The guard on Verse's own build loop (the frontier's "absorb and connect every repo": a guard on Verse's own build loop, no re-proposing a failed job).
// The will runs every hour and queues its top want unless a will job is open. A job nobody touched in 3 days is set aside, and the same want, still on top,
// was queued again the next hour, and again: a want the builders keep not taking, or whose job failed, came back for ever. Now a want whose earlier jobs
// ended set aside or failed MAX_TRIES times within WINDOW_DAYS waits: the will queues the next want instead, and says which it skipped. The want stays in
// Verse's will (it still wants it); it is only not queued again until the window has passed. Pure: the history is read by functions/api/will.js.

import { namedHot, MAX_CHANGES, WINDOW_DAYS as CHURN_DAYS } from './churn.js';

// The writer's shape (tools/will.py sends it). A POST without it comes from an old checkout (2026-10-19: a writer from before
// 2026-10-11 kept putting back a built zorbleflux want, a finished plan item and a private folder path cut mid-word): refused, nothing stored.
export const WILL_SCHEMA = 2;
/** a want's words with any local file path taken out ("C:\\Users\\…", "projects\\aether: apps\\back", "/home/…", "~/…"). Pure. */
export const noPaths = (t) => String(t == null ? '' : t)
  .replace(/\b[A-Za-z]:\\[^\s)]*/g, '').replace(/\b[\w.-]+(?:\\[\w.-]*)+:?/g, '').replace(/(^|\s)(?:~|\/home|\/Users|\/root)\/\S*/g, '$1')
  .replace(/\(\s*\)/g, '').replace(/\((?![^(]*\))\s*/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.;:)])/g, '$1').trim(); // a bracket the path opened and never closed goes too
/** whether a candidate is a miss that a live skill already answers: its quoted subject ("handle "zorbleflux"") is a skill name. Pure. */
export function coveredByName(title, names) {
  const m = /["'“‘]([^"'”’]{2,60})["'”’]/.exec(String(title || ''));
  if (!m || !names || !names.size) return false;
  const words = m[1].toLowerCase().trim().split(/\s+/);
  return names.has(words.join('-')) || (words.length === 1 && names.has(words[0]));
}

export const MAX_TRIES = 2;     // a want whose jobs ended set aside or failed this many times waits
export const WINDOW_DAYS = 14;  // ... counting the ones that ended this recently
/** the queue target a want's job has: 'will:' and the title as a short slug. */
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
export const targetOf = (title) => 'will:' + slug(title);

/** how many of the rows ({ target, state }) are earlier jobs of this want that were set aside or failed. Pure. */
export const triesOf = (rows, title) => (Array.isArray(rows) ? rows : []).filter((r) => r && r.target === targetOf(title) && /^(?:set aside|failed)$/.test(String(r.state))).length;

/** the first want that has not used up its tries, and the wants above it that were skipped: { want, skipped: [{ title, tries }] }; want is null when every want waits. Pure. */
export function pickWant(wants, rows, max = MAX_TRIES, hot = []) {
  const skipped = [];
  for (const w of Array.isArray(wants) ? wants : []) {
    const tries = triesOf(rows, w && w.title), churn = namedHot((w && w.title) + ' ' + ((w && w.why) || ''), hot);
    if (tries >= max) skipped.push({ title: String(w.title), tries });
    else if (churn.length) skipped.push({ title: String(w.title), tries, churn }); // names a file that is changing too fast
    else return { want: w || null, skipped };
  }
  return { want: null, skipped };
}

/** what the queued job's note says about the wants skipped for it ('' when none). Pure. */
export function skippedNote(skipped) {
  const l = Array.isArray(skipped) ? skipped : [], hot = l.filter((x) => x.churn && x.churn.length), tried = l.length - hot.length;
  const part = (n, why) => n + ' want' + (n === 1 ? '' : 's') + ' above it waits: ' + why;
  return (tried ? ' · ' + part(tried, 'its jobs were set aside or failed ' + MAX_TRIES + ' times in ' + WINDOW_DAYS + ' days') : '')
    + (hot.length ? ' · ' + part(hot.length, 'it names ' + [...new Set(hot.flatMap((x) => x.churn))].slice(0, 3).join(', ') + ', changed more than ' + MAX_CHANGES + ' times in ' + CHURN_DAYS + ' days') : '');
}

/** the earliest time a job's end still counts, as an ISO string. Pure. */
export const sinceOf = (now = Date.now()) => new Date(now - WINDOW_DAYS * 864e5).toISOString();
