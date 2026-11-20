// Verse's self-guards: jobs Verse runs on its own so a fix made by hand once is never made by hand twice. Pure. The runner is tools/verse-guards.mjs.
// Each guard rides the house lanes (.github/workflows/house-loops.yml, eleven runs a day), so it needs no workflow of its own and no cron of its own.
// A guard that finds nothing writes one line. A guard that finds something fixes it in the same run (a file change the house lane ships as a pull
// request) or queues a heal job for the coder, and says which on its line of "What Verse is doing" (/progress/).
import { backoff, noteResult, costOf } from './house-loops.js';

export const HOUSE_HOURS = Object.freeze([1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21]); // the hours (UTC) the house lanes run
export const GUARDS = Object.freeze([
  { id: 'leaks', name: 'Names on public pages', what: 'Opens public pages, data files and answers signed out and looks for the sites the Tower measures against. A hit is scrubbed or locked to the owner.', minutes: 3, hours: null },
  { id: 'cards', name: 'Card art and copies', what: 'Asks for a spread of cards, checks each has art that matches its subject (no placeholder, no watermark) and that a copied card carries its full text. A bad picture is painted again.', minutes: 8, hours: [3, 9, 15, 21] },
  { id: 'tower', name: 'Tower climb', what: 'Checks the Tower is still moving. A site with no progress for 3 days gives way, and the guard does it itself when the scheduled run did not.', minutes: 1, hours: null },
  { id: 'deploy', name: 'Deploy check', what: 'Reads why a main deploy failed or rolled back and queues the fix for the coder, or says the exact change.', minutes: 1, hours: null },
  { id: 'quality', name: 'Quality engine', what: 'Measures the weakest thing people see (looks, 3D, speed, phone, and whether it is right), ships one fix, re-scores the live page, and keeps the change only if the score rose. It makes new things too, and upgrades itself when its rate of improvement flattens.', minutes: 6, hours: null },
  { id: 'assistant', name: 'Assistant exam', what: 'Puts 20 fixed real questions to the live agent once a day, scores the answers on correctness, usefulness and clarity, logs the score, and puts every weak answer on the build list.', minutes: 3, hours: [13] },
  { id: 'home', name: 'Starfield and heart', what: 'Checks the home page still has the starfield and the corner heart. If a change hides one, the change is put back.', minutes: 1, hours: null },
]);

/** the guards that run when the house lane at `hour` (UTC) runs. Pure. */
export const guardsFor = (hour, guards = GUARDS) => guards.filter((g) => !g.hours || g.hours.includes(hour));
export const scheduleOfGuard = (g) => (g.hours ? 'with the house lanes at ' + g.hours.map((h) => String(h).padStart(2, '0') + ':00').join(', ') + ' UTC' : 'with every house lane run, about every 2 hours');
export const blankGuard = (g) => ({ id: g.id, name: g.name, what: g.what, schedule: scheduleOfGuard(g), status: 'Waiting for its first run.', last: '', cost: costOf(g, { note: 'Not run yet.' }), state: { fails: 0, pauseUntil: 0 } });

/** the record after a run. `result` is { last, ok, note, paidCents, minutes }. Pure. */
export function recordOf(g, prev, result, now, gate = backoff((prev || {}).state, now)) {
  const base = prev && prev.id ? prev : blankGuard(g);
  if (!gate.run) return { ...base, status: gate.status };
  return { ...base, name: g.name, what: g.what, schedule: scheduleOfGuard(g), status: result.ok === false ? 'Could not finish. It tries again at the next run.' : 'Ran.', last: result.last || base.last,
    cost: costOf(g, { minutes: result.minutes != null ? result.minutes : g.minutes, note: result.note, paidCents: result.paidCents }), state: noteResult(base.state, result.ok !== false, now) };
}
/** a record is worth writing when what it says changed. Pure. */
export const changed = (a, b) => !a || !b || a.last !== b.last || a.status !== b.status || JSON.stringify(a.cost) !== JSON.stringify(b.cost) || JSON.stringify(a.state) !== JSON.stringify(b.state);
