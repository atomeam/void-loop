// Is a pull request ready to merge? One answer for the two things that merge: .github/workflows/automerge.yml (GitHub merges
// on its own, no session waiting) and tools/merge-when-green.mjs (the same check, polled from a session).
//   readiness(gh, repo, pr) -> { state: 'merge' | 'wait' | 'stop' | 'resolve', why, sha, draft, extra }
// gh(path) is a GET against the GitHub API returning parsed JSON (injected, so tools/pr-ready.test.mjs runs on fakes).
// 'resolve' (2026-10-10): GitHub reports the PR dirty (it conflicts with main). A conflicted PR gets no pull_request runs at all,
//   so a labelled one would sit silently forever; resolveMain below merges main into it for the bot.
// Ship now, test after (Adam, 2026-10-09: nothing waits). Ready means, on the PR's current head: the void-review check
//   passed (Void's own review, seconds: no bugs or risks in the added lines, .github/workflows/void-review.yml) and no check
//   that already finished has failed (test-and-deploy, bench). Nothing else is waited on: not the suite, not the benchmark.
//   The full suite runs on every head of main (verify.yml, verify-main), and a failure there reverts the merge and
//   redeploys.
// Void's review is the main one; every other reviewer is an extra (Adam, 2026-10-09). CodeRabbit is never waited on and
//   never blocks: what it has found on this head is reported in `extra`, and a finding Void missed is a rule to teach
//   code-review.js (domains/void.frontier.md #1), not a reason to hold a merge.
export const CR = 'coderabbitai[bot]';
const OK = ['success', 'skipped', 'neutral'];

export function readiness(gh, repo, pr) {
  const p = gh(`repos/${repo}/pulls/${pr}`);
  if (p.merged) return { state: 'stop', why: 'already merged', merged: true };
  if (p.state !== 'open') return { state: 'stop', why: 'PR is ' + p.state };
  const sha = p.head.sha, base = { sha, draft: !!p.draft };
  if (p.mergeable_state === 'dirty') return { ...base, state: 'resolve', why: 'conflicts with main (a conflicted PR gets no checks, so main is merged in first)', branch: p.head && p.head.ref };
  const latest = (name) => (gh(`repos/${repo}/commits/${sha}/check-runs?check_name=${name}&per_page=100`).check_runs || []).sort((a, b) => b.id - a.id)[0];
  const runs = [latest('test-and-deploy'), latest('bench'), latest('void-review')].filter(Boolean);
  const failed = runs.find((r) => r.status === 'completed' && !OK.includes(r.conclusion) && r.conclusion !== 'cancelled');
  if (failed) return { ...base, state: 'stop', why: `${failed.name} ${failed.conclusion}: ${failed.html_url}` };
  // the one wait: Void's own review, which reports in seconds (a PR from before that check falls back on the suite)
  const gate = runs.find((r) => r.name === 'void-review') || runs.find((r) => r.name === 'test-and-deploy');
  if (!gate || gate.status !== 'completed' || gate.conclusion !== 'success') return { ...base, state: 'wait', why: (gate ? gate.name : 'void-review') + ' not finished' };
  // the extras: whatever CodeRabbit has posted by now is reported, never waited on and never a stop
  const reviews = (gh(`repos/${repo}/pulls/${pr}/reviews?per_page=100`) || []).filter((r) => r.user && r.user.login === CR && r.commit_id === sha);
  const rc = gh(`repos/${repo}/pulls/${pr}/comments?per_page=100`) || [];
  const replied = new Set(rc.filter((c) => c.in_reply_to_id && c.user && c.user.login !== CR).map((c) => c.in_reply_to_id));
  const open = rc.filter((c) => !c.in_reply_to_id && c.user && c.user.login === CR && !replied.has(c.id));
  // findings on this head: each inline one is settled by an answer on its thread; findings with no thread on this head
  // (outside the diff, in the review body) are settled only by a push that fixes them
  const found = reviews.map((r) => +((r.body || '').match(/Actionable comments posted:\s*(\d+)/) || [0, 0])[1]).reduce((a, b) => a + b, 0);
  const threadsHere = rc.filter((c) => !c.in_reply_to_id && c.user && c.user.login === CR && (c.original_commit_id || c.commit_id) === sha).length;
  const extra = found || open.length ? `CodeRabbit (extra): ${Math.max(found, threadsHere)} finding(s) on ${sha.slice(0, 7)}, ${open.length} thread(s) unanswered` : '';
  return { ...base, state: 'merge', why: "Void found no bugs or risks and nothing failed (the suite runs on main after the deploy)", extra };
}

// The bot merges main into a conflicted PR (automerge.yml, for PRs labelled automerge from this repository only).
//   resolveMain(run, gh, { repo, pr, branch, tools, dir }) -> { state: 'pushed', sha } | { state: 'conflict', files } | { state: 'failed', why }
// run(cmd, args, opts) executes a command and returns its stdout (throws with .stderr); gh(path) GETs JSON; both injected for the test.
// tools is main's tools folder: merge-main.mjs is always run from main's checkout, never from the branch (a PR cannot make the bot
// run its own copy). The branch is checked out detached in its own worktree, main merged with tools/merge-main.mjs (the
// append-only records settle by keeping both sides), and the merge commit pushed to the branch: never a force-push, so a branch
// that moved in the meantime refuses the push and the next wake tries again. A push made with the workflow's token starts no
// pull_request run, so Void's review is dispatched on the new head by hand (void-review.yml workflow_dispatch, input pr); its
// finish wakes automerge.yml, which then merges the PR. A conflict outside the append-only files comes back as one comment on
// the PR naming the files (the same comment is never posted twice), and the bot tries again whenever main moves.
export const CONFLICT_MARK = '<!-- void-automerge: conflict -->', ACTIONS_BOT = 'github-actions[bot]';
export function conflictNote(files) {
  return CONFLICT_MARK + '\nVoid automerge: this PR conflicts with main in ' + files.map((f) => '`' + f + '`').join(', ') + ', and GitHub runs no checks on a conflicted PR. '
    + 'The bot merges main into labelled PRs itself and settles the append-only records (tools/merge-main.mjs), but these files need a person: '
    + 'run `node tools/merge-main.mjs` on the branch, resolve them, push. It tries again whenever main moves.';
}
export function resolveMain(run, gh, { repo, pr, branch, tools, dir }) {
  if (!branch) return { state: 'failed', why: 'no head branch' };
  const git = (args, cwd) => run('git', args, cwd ? { cwd } : {});
  dir = dir || `${process.env.RUNNER_TEMP || '/tmp'}/void-pr-${pr}`;
  const drop = () => { try { git(['worktree', 'remove', '--force', dir]); } catch (_) {} };
  try {
    git(['fetch', '-q', 'origin', branch, 'main']);
    drop();
    git(['worktree', 'add', '--detach', dir, `origin/${branch}`]);
    try { run('node', [tools + '/merge-main.mjs'], { cwd: dir }); }
    catch (e) {
      const m = String(e.stderr || e.message || '').match(/conflicts need a person: ([^(\n]+)/);
      try { git(['merge', '--abort'], dir); } catch (_) {}
      if (!m) return { state: 'failed', why: 'merge-main: ' + String(e.stderr || e.message).slice(0, 300) };
      const files = m[1].split(',').map((s) => s.trim()).filter(Boolean);
      const body = conflictNote(files);
      const mine = (gh(`repos/${repo}/issues/${pr}/comments?per_page=100`) || []).find((c) => c.user && c.user.login === ACTIONS_BOT && String(c.body || '').startsWith(CONFLICT_MARK));
      if (!mine) run('gh', ['api', '-X', 'POST', `repos/${repo}/issues/${pr}/comments`, '-f', 'body=' + body]);
      else if (mine.body !== body) run('gh', ['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${mine.id}`, '-f', 'body=' + body]);
      return { state: 'conflict', files, commented: !mine || mine.body !== body };
    }
    const sha = git(['rev-parse', 'HEAD'], dir).trim();
    git(['push', 'origin', `HEAD:refs/heads/${branch}`], dir);
    run('gh', ['workflow', 'run', 'void-review.yml', '--repo', repo, '--ref', branch, '-f', `pr=${pr}`]);
    return { state: 'pushed', sha };
  } catch (e) { return { state: 'failed', why: String(e.stderr || e.message).slice(0, 300) }; }
  finally { drop(); }
}
