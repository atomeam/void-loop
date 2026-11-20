// Two Tower follow-ups the conductor's tick does on its own (2026-11-20; they were done by hand): the held-out exam's streak, read from
// void-live-deploy/tower.heldout.json (the house lanes write it, tools/guards/assistant.mjs) and kept in the conductor's record for the
// owner's loop list (GET /api/loops, /progress/); and the compounding pass (tools/tower-compound.mjs, .github/workflows/tower-compound.yml)
// started once whenever Tower moves to a new target, so every site that counted is measured again before the new one is built.
import { STREAK } from './heldout-exam.mjs';

/** the streak report from the held-out file: where the streak stands, what it needs, the last runs in plain words. Pure. */
export function examOf(file, keep = 5) {
  if (!file || typeof file !== 'object') return null;
  const runs = (Array.isArray(file.runs) ? file.runs : []).slice(-keep).map((r) => ({ at: r.at || null, overall: r.overall ?? null, beat: r.beat ?? null,
    said: r.beat === true ? 'beat the reference' : r.beat === false ? 'did not beat the reference' : 'not judged (too few answers judged)' }));
  const streak = file.streak || 0, last = runs[runs.length - 1] || null;
  return { streak, need: STREAK, done: streak >= STREAK, last, runs, line: 'Held-out exam: ' + streak + ' of ' + STREAK + ' wins in a row' + (last ? '; last run ' + (last.overall ?? '?') + ', ' + last.said : '') + '.' };
}

/** true when Tower is on a target it was not on at the last tick (and there was a last tick). Pure. */
export const newTarget = (before, target) => !!(before && target && target.id && target.id !== before);
