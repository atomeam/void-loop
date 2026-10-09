// Is a pull request ready to merge? One answer for the two things that merge: .github/workflows/automerge.yml (GitHub merges
// on its own, no session waiting) and tools/merge-when-green.mjs (the same check, polled from a session).
//   readiness(gh, repo, pr, { now, greenSince }) -> { state: 'merge' | 'wait' | 'stop', why, sha, draft }
// gh(path) is a GET against the GitHub API returning parsed JSON (injected, so tools/pr-ready.test.mjs runs on fakes).
// Ready means, on the PR's current head:
//   test-and-deploy passed (and bench, when that job ran); the void-review check passed (Void's own review, the first one:
//   no bugs or risks in the added lines, .github/workflows/void-review.yml); and CodeRabbit is settled: no review of this
//   head still running (it gets up to 10 min after green), no actionable findings on this head, no CodeRabbit thread
//   without an answer. CodeRabbit stays a reviewer whose findings get fixed or answered; it is just not waited on forever.
export const CR = 'coderabbitai[bot]';
export const CR_GRACE_MS = 10 * 60e3;
const OK = ['success', 'skipped', 'neutral'];

export function readiness(gh, repo, pr, { now = Date.now(), greenSince = 0 } = {}) {
  const p = gh(`repos/${repo}/pulls/${pr}`);
  if (p.merged) return { state: 'stop', why: 'already merged', merged: true };
  if (p.state !== 'open') return { state: 'stop', why: 'PR is ' + p.state };
  const sha = p.head.sha, base = { sha, draft: !!p.draft };
  const latest = (name) => (gh(`repos/${repo}/commits/${sha}/check-runs?check_name=${name}&per_page=100`).check_runs || []).sort((a, b) => b.id - a.id)[0];
  const runs = [latest('test-and-deploy'), latest('bench'), latest('void-review')].filter(Boolean);
  const failed = runs.find((r) => r.status === 'completed' && !OK.includes(r.conclusion) && r.conclusion !== 'cancelled');
  if (failed) return { ...base, state: 'stop', why: `${failed.name} ${failed.conclusion}: ${failed.html_url}` };
  const td = runs.find((r) => r.name === 'test-and-deploy');
  if (!td || td.status !== 'completed' || td.conclusion !== 'success') return { ...base, state: 'wait', why: 'test-and-deploy not finished' };
  const pending = runs.find((r) => r.status !== 'completed' || r.conclusion === 'cancelled');
  if (pending) return { ...base, state: 'wait', why: pending.name + ' not finished' };
  // green: CodeRabbit gets its say
  const green = greenSince || Date.parse(td.completed_at) || now;
  const comments = gh(`repos/${repo}/issues/${pr}/comments?per_page=100`) || [], cr = comments.filter((c) => c.user && c.user.login === CR);
  const reviews = (gh(`repos/${repo}/pulls/${pr}/reviews?per_page=100`) || []).filter((r) => r.user && r.user.login === CR && r.commit_id === sha);
  // a review asked for ("@coderabbitai review") and not yet posted counts as under way: it takes minutes to say it started (#141)
  const asked = comments.filter((c) => c.user && c.user.login !== CR && /@coderabbitai\s+(?:full\s+)?review\b/i.test(c.body || '')).map((c) => Date.parse(c.created_at));
  const lastAsk = asked.length ? Math.max(...asked) : 0, answered = reviews.some((r) => Date.parse(r.submitted_at) >= lastAsk);
  const busy = cr.some((c) => /review in progress by coderabbit|Currently processing new changes/.test(c.body || '')) || (lastAsk && !answered);
  if (busy && now - green < CR_GRACE_MS) return { ...base, state: 'wait', why: 'CodeRabbit is still reviewing', retryAt: green + CR_GRACE_MS };
  const rc = gh(`repos/${repo}/pulls/${pr}/comments?per_page=100`) || [];
  const replied = new Set(rc.filter((c) => c.in_reply_to_id && c.user && c.user.login !== CR).map((c) => c.in_reply_to_id));
  const open = rc.filter((c) => !c.in_reply_to_id && c.user && c.user.login === CR && !replied.has(c.id));
  // findings on this head: each inline one is settled by an answer on its thread; findings with no thread on this head
  // (outside the diff, in the review body) are settled only by a push that fixes them
  const found = reviews.map((r) => +((r.body || '').match(/Actionable comments posted:\s*(\d+)/) || [0, 0])[1]).reduce((a, b) => a + b, 0);
  const threadsHere = rc.filter((c) => !c.in_reply_to_id && c.user && c.user.login === CR && (c.original_commit_id || c.commit_id) === sha).length;
  if (found > threadsHere) return { ...base, state: 'stop', why: `CodeRabbit left ${found} finding(s) on ${sha.slice(0, 7)}, ${found - threadsHere} outside any thread: fix them and push` };
  if (open.length) return { ...base, state: 'stop', why: `${open.length} CodeRabbit thread(s) have no answer yet: fix or reply on each` };
  return { ...base, state: 'merge', why: 'CI green, Void found no bugs or risks, CodeRabbit settled' };
}
