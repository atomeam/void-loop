// Pull requests that would sit forever without a person (owner, 2026-11-20: "lots of prs built up, its not automatic like it should be").
// Two jobs, both run by tools/automerge.mjs on every wake, before it looks at readiness:
// 1. Approve the workflow runs GitHub held for approval. A pull request Verse opens with the workflow's own token is authored by
//    github-actions[bot], and this repository's "approve first-time contributors" setting holds every pull_request run on it as
//    action_required: no review, no merge gate, no deploy check ever ran (539 held runs by 2026-11-20). Only runs on the head of an
//    open pull request from this repository (never a fork) are approved.
// 2. Close what has been red for too long. A pull request older than EXPIRE_HOURS whose head has not moved for QUIET_HOURS, and which
//    still has a failed check or a conflict with main, has had its fix attempts (pr-fix.yml starts on every red review and gate):
//    it is closed with one comment that names the blocker. The branch stays, so reopening it retries. Drafts and green ones stay.
//   node tools/pr-tidy.mjs            from a session: the same tidy, printed
export const EXPIRE_HOURS = +(process.env.PR_EXPIRE_HOURS || 48), QUIET_HOURS = +(process.env.PR_QUIET_HOURS || 24);
export const MARK = '<!-- void-expired -->';
const GREEN = new Set(['success', 'neutral', 'skipped', 'cancelled']);

/** The held runs to approve: action_required, on the head sha of an open pull request from this repository. Pure. */
export function approvable(runs, prs, repo) {
  const heads = new Set((prs || []).filter((p) => p && p.state === 'open' && (!p.head?.repo || p.head.repo.full_name === repo)).map((p) => p.head?.sha).filter(Boolean));
  return (runs || []).filter((r) => r && r.conclusion === 'action_required' && heads.has(r.head_sha) && (!r.head_repository || r.head_repository.full_name === repo)).map((r) => r.id);
}

/** Whether to close a stuck pull request. `checks` are the head's check runs; `lastCommitAt` the head commit's date (ms). Pure. */
export function expireDecision(pr, { checks = [], lastCommitAt = 0, now = Date.now() } = {}) {
  if (!pr || pr.state !== 'open' || pr.draft) return { close: false, why: 'not an open ready pull request' };
  const age = (now - Date.parse(pr.created_at || '')) / 36e5, quiet = (now - (Number(lastCommitAt) || now)) / 36e5;
  if (!(age >= EXPIRE_HOURS)) return { close: false, why: 'younger than ' + EXPIRE_HOURS + ' hours' };
  if (!(quiet >= QUIET_HOURS)) return { close: false, why: 'its head moved in the last ' + QUIET_HOURS + ' hours (a fix is in progress)' };
  const latest = new Map();
  for (const c of checks || []) { if (!c || !c.name) continue; const was = latest.get(c.name); if (!was || c.id > was.id) latest.set(c.name, c); }
  const bad = [...latest.values()].filter((c) => c.status === 'completed' && !GREEN.has(c.conclusion)).map((c) => c.name + ' ' + c.conclusion);
  if (pr.mergeable_state === 'dirty') bad.unshift('a conflict with main');
  if (!bad.length) return { close: false, why: 'nothing is red' };
  return { close: true, why: bad.slice(0, 3).join(', ') };
}

export const expireNote = (why, days) => MARK + '\nClosed by Verse: this pull request stayed blocked for ' + days + ' days after Verse\'s fix attempts (' + why + '), and nothing changed on it for a day. Its branch is kept: reopen it to try again, or the loop that made it opens a fresh one.';

/** Runs both jobs. gh(path) reads JSON, run(args) calls gh. Never throws: a failure is one line in the log. */
export function tidy({ gh, run, repo, prs, one = '', log = console.log, now = Date.now() }) {
  const open = (prs || []).filter((p) => p && p.state === 'open');
  let approved = 0;
  try {
    // one small read per open head: the repository-wide list of held runs is megabytes (539 runs on 2026-11-20) and overflows the reader
    const shas = open.map((p) => p.head?.sha).filter(Boolean);
    for (const sha of shas) {
      const page = gh(`repos/${repo}/actions/runs?status=action_required&per_page=100&head_sha=${sha}`) || {};
      for (const id of approvable(page.workflow_runs || [], open, repo)) {
        try { run(['api', '-X', 'POST', `repos/${repo}/actions/runs/${id}/approve`]); approved++; }
        catch (e) { log('could not approve held run ' + id + ': ' + String(e.stderr || e.message || e).slice(0, 160)); break; }
      }
    }
    if (approved) log('approved ' + approved + ' held workflow run(s) on open pull requests');
  } catch (e) { log('held runs: ' + String(e.stderr || e.message || e).slice(0, 160)); }
  if (one) return { approved, closed: [] };
  const closed = [];
  for (const p of open) {
    try {
      if ((now - Date.parse(p.created_at || '')) / 36e5 < EXPIRE_HOURS || p.draft) continue;
      const full = gh(`repos/${repo}/pulls/${p.number}`) || p;
      const commit = gh(`repos/${repo}/commits/${full.head.sha}`) || {};
      const checks = (gh(`repos/${repo}/commits/${full.head.sha}/check-runs?per_page=100`) || {}).check_runs || [];
      const d = expireDecision(full, { checks, lastCommitAt: Date.parse(commit.commit?.committer?.date || '') || 0, now });
      if (!d.close) continue;
      const days = Math.floor((now - Date.parse(full.created_at)) / 864e5);
      run(['api', '-X', 'POST', `repos/${repo}/issues/${p.number}/comments`, '--input', '-'], JSON.stringify({ body: expireNote(d.why, days) }));
      run(['api', '-X', 'PATCH', `repos/${repo}/pulls/${p.number}`, '-f', 'state=closed']);
      closed.push(p.number);
      log('closed #' + p.number + ': blocked ' + days + ' days (' + d.why + ')');
    } catch (e) { log('#' + p.number + ': expiry not checked: ' + String(e.stderr || e.message || e).slice(0, 160)); }
  }
  return { approved, closed };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const { execFileSync } = await import('node:child_process');
  const repo = process.env.REPO || 'atomeam/void-loop';
  const run = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });
  const gh = (path) => JSON.parse(run(['api', path]) || 'null');
  tidy({ gh, run, repo, prs: gh(`repos/${repo}/pulls?state=open&per_page=100`) });
}
