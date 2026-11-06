// The stall alarm (2026-11-06: 30 pull requests sat open for a day and nothing said so). The automerge sweep calls stallVerdict()
// at its end. When no pull request merged for 2 hours while a green one waits, the bot opens one GitHub issue (label merge-stall)
// that names the stuck step, and fixes the step itself where it can: a suite gate run that hangs past its own time limit is
// cancelled, so the next sweep queues the suite again. The issue closes by itself when the queue moves again. Pure; no API here.
export const STALL_MS = 2 * 3600e3; // no merge for this long while a green pull request waits = stalled
export const HUNG_MS = 60 * 60e3; // the suite gate job stops itself at 40 minutes (5 prepare + 35 suite): past 60 it hangs
export const LABEL = 'merge-stall';
export const MARK = '<!-- void-merge-stall -->';

const ms = (t) => { const v = Date.parse(t || ''); return Number.isFinite(v) ? v : 0; };
const short = (s) => String(s || '').slice(0, 7);

/** the newest merged_at in a list of closed pull requests, or ''. Pure. */
export function lastMerge(closedPrs) {
  return (closedPrs || []).map((p) => p && p.merged_at).filter(Boolean).sort().pop() || '';
}

/**
 * now: ms. lastMergeAt: ISO. ready: [{ number, createdAt }] (green: review, merge gate and safety-check pass).
 * choice: choose() from suite-gate.mjs, or null. suiteRun: the newest suite gate run { id, status, conclusion, createdAt, url } or null.
 * mainSha, mergeError: the refusal text when the merge was tried and refused.
 * -> { stalled: false } | { stalled: true, key, step, cancel, title, body }
 */
export function stallVerdict({ now, lastMergeAt, ready, choice, suiteRun, mainSha, mergeError }) {
  const since = now - ms(lastMergeAt);
  const waiting = (ready || []).filter((r) => r && now - ms(r.createdAt) > STALL_MS);
  if (!waiting.length || since < STALL_MS) return { stalled: false };
  const action = (choice && choice.action) || 'none', n = choice && choice.pr && choice.pr.number;
  const running = suiteRun && !['completed'].includes(suiteRun.status);
  const age = running ? Math.round((now - ms(suiteRun.createdAt)) / 60e3) : 0;
  let key, step, cancel = null;
  if (mergeError) {
    key = 'refused:' + n;
    step = `GitHub refused the merge of #${n} after its suite passed: ${String(mergeError).replace(/\s+/g, ' ').slice(0, 200)}`;
  } else if (running && age * 60e3 > HUNG_MS) {
    key = 'hung:' + suiteRun.id;
    step = `the suite gate run ${suiteRun.url || suiteRun.id} has run for ${age} minutes (its limit is 40). The bot cancelled it, so the next sweep starts the suite again.`;
    cancel = suiteRun.id;
  } else if (action === 'hold') {
    key = 'hold:' + short(mainSha);
    step = `every green pull request failed the full suite on main ${short(mainSha)}. Main or the suite itself is red: fix that first` + (suiteRun && suiteRun.url ? ` (last suite gate run: ${suiteRun.url})` : '') + '.';
  } else if (action === 'wait') {
    key = 'wait:' + n; // per pull request, not per run: a new run every 40 minutes is not a new step
    step = `a suite gate run is in progress (${age} minutes) for #${n}, but no merge came out of the runs before it. Each run that ends red holds its pull request until the head or main moves.`;
  } else if (action === 'queue') {
    key = 'queue:' + n;
    step = `the suite gate was asked to start for #${n} and no result came back. Check that suite-gate.yml starts (workflow_dispatch, input pr).`;
  } else if (action === 'merge') {
    return { stalled: false }; // the merge happens in this sweep
  } else {
    key = 'none';
    step = 'green pull requests wait, but the suite gate made no choice (the sweep did not reach it).';
  }
  const hours = lastMergeAt ? Math.floor(since / 3600e3) + ' hours' : 'a long time';
  const list = waiting.map((r) => '#' + r.number).slice(0, 20).join(', ');
  const body = `${MARK}\nNo pull request merged for ${hours}` + (lastMergeAt ? ` (last merge ${lastMergeAt})` : '') + `, while ${waiting.length} green pull request${waiting.length === 1 ? '' : 's'} wait: ${list}.\n\nStuck step: ${step}\n\nThe automerge sweep (tools/automerge.mjs, tools/merge-stall.mjs) wrote this. It closes this issue by itself when a pull request merges again.`;
  return { stalled: true, key, step, cancel, title: 'Merges stalled: ' + step.split(/[.:]/)[0].slice(0, 90), body };
}

/** the key of the step an open alarm issue last named, from its body. Pure. */
export function keyOf(body) {
  const m = /<!-- key:([^>]*) -->/.exec(String(body || ''));
  return m ? m[1].trim() : '';
}
export const withKey = (body, key) => body + `\n<!-- key:${key} -->`;
