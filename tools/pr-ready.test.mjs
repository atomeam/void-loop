// node tools/pr-ready.test.mjs: when a PR is ready to merge (tools/pr-ready.mjs), on made-up GitHub answers.
import { readiness, resolveMain, conflictNote, CR, CONFLICT_MARK, ACTIONS_BOT } from './pr-ready.mjs';
let bad = 0;
const ok = (c, msg) => { if (!c) { bad++; console.log('FAIL ' + msg); } };
const SHA = 'abc1234def', T0 = Date.parse('2026-10-09T12:00:00Z');
const run = (name, conclusion = 'success', status = 'completed', id = 1) => ({ id, name, status, conclusion, completed_at: '2026-10-09T12:00:00Z', html_url: 'https://x/' + name });
function fake({ checks = [run('test-and-deploy'), run('void-review')], comments = [], reviews = [], threads = [], pr = {} } = {}) {
  return (path) => {
    if (/\/pulls\/\d+$/.test(path)) return { state: 'open', merged: false, draft: false, head: { sha: SHA }, ...pr };
    const m = path.match(/check_name=([\w-]+)/); if (m) return { check_runs: checks.filter((c) => c.name === m[1]) };
    if (/issues\/\d+\/comments/.test(path)) return comments;
    if (/pulls\/\d+\/reviews/.test(path)) return reviews;
    if (/pulls\/\d+\/comments/.test(path)) return threads;
    throw new Error('unexpected ' + path);
  };
}
const R = (opts) => readiness(fake(opts), 'o/r', 7);
const crReview = (n, at = '2026-10-09T12:01:00Z') => ({ user: { login: CR }, commit_id: SHA, submitted_at: at, body: n ? 'Actionable comments posted: ' + n : 'LGTM' });
const thread = (id, extra) => ({ id, user: { login: CR }, original_commit_id: SHA, body: 'a finding', ...extra });
const reply = (to) => ({ id: 900 + to, in_reply_to_id: to, user: { login: 'atomeam' }, body: 'fixed in the next push' });

ok(R().state === 'merge', 'green CI, clean Void review, quiet CodeRabbit: merge');
ok(R({ checks: [run('test-and-deploy'), run('void-review', 'failure')] }).state === 'stop', "Void's review found a bug: stop");
ok(R({ checks: [run('test-and-deploy'), run('void-review', null, 'in_progress')] }).state === 'wait', "Void's review still running: wait");
ok(R({ checks: [run('test-and-deploy', null, 'in_progress'), run('void-review')] }).state === 'merge', 'suite still running: merge, no wait (it runs again on main)');
ok(R({ checks: [run('void-review')] }).state === 'merge', 'suite not started yet: merge, no wait');
ok(R({ checks: [run('test-and-deploy'), run('void-review'), run('bench', null, 'in_progress')] }).state === 'merge', 'bench still running: merge, no wait');
ok(R({ checks: [] }).state === 'wait', 'no check reported yet: wait for Void\'s review');
ok(R({ checks: [run('test-and-deploy', 'failure'), run('void-review')] }).state === 'stop', 'suite failed: stop');
ok(R({ checks: [run('test-and-deploy'), run('void-review'), run('bench', 'failure')] }).state === 'stop', 'bench failed: stop');
ok(R({ checks: [run('test-and-deploy')] }).state === 'merge', 'a PR from before the void-review check: the suite decides');
ok(R({ checks: [run('test-and-deploy', null, 'in_progress')] }).state === 'wait', 'no void-review check and the suite still running: wait');
ok(R({ checks: [run('test-and-deploy', 'failure', 'completed', 1), run('test-and-deploy', 'success', 'completed', 2), run('void-review')] }).state === 'merge', 'the newest run counts');
// CodeRabbit
// CodeRabbit is never waited on: still reviewing, asked and not posted, or rate-limited all merge on green
ok(R({ comments: [{ user: { login: CR }, body: 'review in progress by coderabbit.ai' }] }).state === 'merge', 'CodeRabbit still reviewing: merge, no wait');
ok(R({ comments: [{ user: { login: 'atomeam' }, body: '@coderabbitai review', created_at: '2026-10-09T12:00:30Z' }] }).state === 'merge', 'a review asked for and not posted yet: merge, no wait');
ok(R({ comments: [{ user: { login: CR }, body: '> [!WARNING]\n> ## Review limit reached' }] }).state === 'merge', 'CodeRabbit rate-limited: merge, no wait');
ok(R({ reviews: [crReview(0)] }).state === 'merge', 'a clean CodeRabbit review: merge');
ok(R({ reviews: [crReview(1)], threads: [thread(1)] }).state === 'merge', 'a CodeRabbit finding with no answer: merge, Void decides');
ok(/1 finding.*1 thread/.test(R({ reviews: [crReview(1)], threads: [thread(1)] }).extra), 'the CodeRabbit finding is reported as an extra');
ok(R({ reviews: [crReview(1)], threads: [thread(1), reply(1)] }).state === 'merge', 'a CodeRabbit finding answered on its thread: merge');
ok(R({ reviews: [crReview(2)], threads: [thread(1), reply(1)] }).state === 'merge', 'a finding outside any thread: merge, reported');
ok(R({ threads: [thread(1, { original_commit_id: 'old' })] }).state === 'merge', 'an old unanswered CodeRabbit thread no longer blocks');
ok(R().extra === '', 'no extra note when CodeRabbit found nothing');
ok(R({ pr: { state: 'closed' } }).state === 'stop' && R({ pr: { merged: true } }).merged, 'closed and merged PRs');
ok(R({ pr: { draft: true } }).draft === true, 'a draft is reported so it can be marked ready');

// a PR that conflicts with main: GitHub runs no checks on it, so the bot merges main in first (resolveMain), never by force
ok(R({ pr: { mergeable_state: 'dirty', head: { sha: SHA, ref: 'helper/x' } } }).state === 'resolve', 'dirty: resolve before anything else');
ok(R({ pr: { mergeable_state: 'dirty', head: { sha: SHA, ref: 'helper/x' } } }).branch === 'helper/x', 'the branch to merge main into is named');
ok(R({ pr: { mergeable_state: 'dirty', head: { sha: SHA, ref: 'helper/x' } }, checks: [run('void-review', 'failure')] }).state === 'resolve', 'dirty with a failed check: still resolve (the check ran on a head that is gone)');
ok(R({ pr: { mergeable_state: 'clean' } }).state === 'merge' && R({ pr: { mergeable_state: 'unknown' } }).state === 'merge' && R({ pr: { mergeable_state: 'blocked' } }).state === 'merge', 'clean, unknown or blocked: untouched, the checks decide');
function bot({ mergeMain = 'merged origin/main; resolved tools/bench.json', comments = [] } = {}) {
  const calls = [];
  const runF = (cmd, args, opts = {}) => {
    calls.push([cmd, ...args]);
    if (cmd === 'node' && /merge-main\.mjs$/.test(args[0])) { if (opts.cwd !== '/w/pr-7') throw new Error('merge-main must run in the worktree'); if (mergeMain instanceof Error) throw mergeMain; return mergeMain; }
    if (cmd === 'git' && args[0] === 'rev-parse') return 'feedbead1234\n';
    if (cmd === 'git' && ['push', 'merge'].includes(args[0]) && opts.cwd !== '/w/pr-7') throw new Error(args[0] + ' must run in the worktree');
    return '';
  };
  const ghF = (path) => { if (/issues\/7\/comments/.test(path)) return comments; throw new Error('unexpected ' + path); };
  const out = resolveMain(runF, ghF, { repo: 'o/r', pr: 7, branch: 'helper/x', tools: '/main/tools', dir: '/w/pr-7' });
  return { out, calls, has: (...a) => calls.some((c) => a.every((x) => c.includes(x))) };
}
const conflict = new Error('exit 1'); conflict.stderr = 'conflicts need a person: void.html, tools/x.mjs (merge left in progress)\n';
let b = bot();
ok(b.out.state === 'pushed' && b.out.sha === 'feedbead1234', 'dirty and resolvable: main merged and pushed');
ok(b.has('git', 'worktree', 'add', '--detach', 'origin/helper/x'), 'the branch is checked out detached in its own worktree');
ok(b.has('node', '/main/tools/merge-main.mjs'), "merge-main.mjs runs from main's tools, not the branch's");
ok(b.has('git', 'push', 'origin', 'HEAD:refs/heads/helper/x') && !b.calls.some((c) => c[0] === 'git' && c[1] === 'push' && c.some((x) => /^(-f|--force|--force-with-lease)/.test(x))), 'the merge commit is pushed to the branch, never forced');
ok(b.has('gh', 'workflow', 'run', 'void-review.yml', '--ref', 'helper/x', 'pr=7'), "Void's review is started on the new head (a token push starts no run)");
ok(!b.has('gh', 'api', '-X', 'POST'), 'no comment when it resolved');
ok(b.calls.filter((c) => c[0] === 'git' && c[1] === 'worktree' && c[2] === 'remove').length >= 1, 'the worktree is removed afterwards');
b = bot({ mergeMain: conflict });
ok(b.out.state === 'conflict' && b.out.files.join() === 'void.html,tools/x.mjs', 'dirty with a real conflict: the files are named');
ok(!b.has('git', 'push') && !b.has('gh', 'workflow'), 'nothing pushed, nothing dispatched on a real conflict');
ok(b.has('git', 'merge', '--abort'), 'the half merge is abandoned');
ok(b.has('gh', 'api', '-X', 'POST', 'repos/o/r/issues/7/comments') && b.out.commented, 'one comment on the PR');
ok(conflictNote(['void.html']).startsWith(CONFLICT_MARK) && /`void.html`/.test(conflictNote(['void.html'])) && /merge-main/.test(conflictNote(['void.html'])), 'the comment names the file and the tool');
b = bot({ mergeMain: conflict, comments: [{ id: 5, user: { login: ACTIONS_BOT }, body: conflictNote(['void.html', 'tools/x.mjs']) }] });
ok(b.out.state === 'conflict' && !b.out.commented && !b.has('gh', 'api', '-X', 'POST') && !b.has('gh', 'api', '-X', 'PATCH'), 'the same conflict is not said twice');
b = bot({ mergeMain: conflict, comments: [{ id: 5, user: { login: ACTIONS_BOT }, body: conflictNote(['void.html']) }] });
ok(b.has('gh', 'api', '-X', 'PATCH', 'repos/o/r/issues/comments/5') && !b.has('gh', 'api', '-X', 'POST'), 'a changed set of files updates the one comment');
const boom = new Error('fatal: something else'); boom.stderr = 'fatal: could not read';
b = bot({ mergeMain: boom });
ok(b.out.state === 'failed' && !b.has('git', 'push') && !b.has('gh', 'api', '-X', 'POST'), 'any other failure: reported, nothing pushed, no comment');

console.log(bad ? bad + ' failed' : 'pr-ready: all passed');
process.exit(bad ? 1 : 0);
