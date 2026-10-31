// A closed pull request settles the queue job it came from (owner, 2026-10-30: close the feedback loop before unattended
// straight-to-site). Merged -> live. Closed without merging -> declined. The link is the `Job: <id>` line tools/finish.mjs writes at
// the end of the PR body, read by tools/job-link.mjs.
//
// Why this exists at all: the will queues its top want every hour, and the guard in lib/will-guard.js keeps a want back only when its
// earlier jobs ended without shipping (TERMINAL: set aside, failed, declined, deferred). Until something wrote declined, an abandoned
// PR left the want on top and the next tick opened the same PR again, for ever.
//
// Three rules that hold this together:
//   - a PR with no `Job:` line is not a job: it settles nothing, writes nothing and exits 0, so a manual or maintenance PR can never
//     fail this Action (owner, 2026-10-30).
//   - one PR is one try. `deferred` (its checks failed) and `declined` (it closed unmerged) are two states of the SAME queue row, so
//     the two together still count once against MAX_TRIES. Nothing here creates a job; it only moves the one the body names.
//   - text is read as CI reads it: \r\n is normalised before any parse, because this checkout is CRLF and CI is not.
//   node tools/will-outcome.mjs --event closed      (the workflow: pull_request closed, the event payload in GITHUB_EVENT_PATH)
//   node tools/will-outcome.mjs --event failed --body-file pr.md --merged
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { jobOfBody, moveJob } from './job-link.mjs';
import { outcomeOf } from '../void-live-deploy/lib/will-guard.js';

export const EVENTS = ['closed', 'failed'];

/** text as CI sees it. Pure. */
export const lf = (t) => String(t == null ? '' : t).replace(/\r\n?/g, '\n');

/** the pull request a webhook payload describes, or null when it describes none. Pure. */
export function prOf(payload) {
  const p = payload && payload.pull_request;
  if (!p || typeof p !== 'object') return null;
  return { number: +p.number || null, merged: p.merged === true, body: lf(p.body), url: String(p.html_url || '') };
}

/**
 * What one closing does to the queue: { state, jobId, why }, or null when the body names no job. `deferred` and `declined` are the
 * same row's state, never a second job, so a PR that failed its checks and was then closed unmerged has used one try, not two. Pure.
 */
export function plan({ event = 'closed', merged = false, body = '' } = {}) {
  const jobId = jobOfBody(lf(body));
  if (!jobId) return null;
  if (event === 'failed') return { state: 'deferred', jobId, why: 'its checks failed, so the want waits instead of being reopened' };
  const state = outcomeOf({ merged: merged === true, closed: true });
  if (!state) return null;
  return { state, jobId, why: state === 'live' ? 'it merged, so the want is built' : 'it closed unmerged, so the want waits instead of coming back on top' };
}

/** the argument line: { event, bodyFile, merged, dry } or { error }. Pure. */
export function parseArgs(argv = []) {
  const opt = (k) => { const i = argv.indexOf(k); return i >= 0 && argv[i + 1] != null ? argv[i + 1] : ''; };
  const event = opt('--event') || 'closed';
  if (!EVENTS.includes(event)) return { error: '--event is closed or failed' };
  return { event, bodyFile: opt('--body-file'), merged: argv.includes('--merged'), dry: argv.includes('--dry') };
}

/** the pull request to settle: from the event payload the runner provides, else from --body-file. */
export function prFrom({ payloadPath = process.env.GITHUB_EVENT_PATH, bodyFile = '' } = {}) {
  if (payloadPath) {
    try { const pr = prOf(JSON.parse(lf(readFileSync(payloadPath, 'utf8')))); if (pr) return pr; } catch (_) { /* no payload: fall through */ }
  }
  if (bodyFile) { try { return { number: null, merged: false, body: lf(readFileSync(bodyFile, 'utf8')), url: '' }; } catch (_) { return null; } }
  return null;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const a = parseArgs(process.argv.slice(2));
  if (a.error) { console.error('will-outcome: ' + a.error); process.exit(2); }
  const pr = prFrom({ bodyFile: a.bodyFile });
  if (!pr) { console.error('will-outcome: no pull request in GITHUB_EVENT_PATH and no --body-file'); process.exit(2); }
  const what = plan({ event: a.event, merged: pr.merged, body: pr.body });
  // a manual or maintenance PR names no job: settle nothing, write nothing, and never fail the Action
  if (!what) { console.log('no Job: line in this pull request: nothing to settle'); process.exit(0); }
  if (a.dry) { console.log('would move job ' + what.jobId + ' -> ' + what.state + ' · ' + what.why); process.exit(0); }
  console.log(await moveJob({ id: what.jobId, state: what.state, label: a.event === 'failed' ? 'checks' : 'PR', url: pr.url }) + ' · ' + what.why);
}
