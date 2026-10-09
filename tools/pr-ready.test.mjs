// node tools/pr-ready.test.mjs: when a PR is ready to merge (tools/pr-ready.mjs), on made-up GitHub answers.
import { readiness, CR } from './pr-ready.mjs';
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
ok(R({ reviews: [crReview(1)], threads: [thread(1)] }).state === 'stop', 'a CodeRabbit finding with no answer: stop');
ok(R({ reviews: [crReview(1)], threads: [thread(1), reply(1)] }).state === 'merge', 'a CodeRabbit finding answered on its thread: merge');
ok(R({ reviews: [crReview(2)], threads: [thread(1), reply(1)] }).state === 'stop', 'a finding outside any thread: stop until a push fixes it');
ok(R({ threads: [thread(1, { original_commit_id: 'old' })] }).state === 'stop', 'an old thread nobody answered still blocks');
ok(R({ pr: { state: 'closed' } }).state === 'stop' && R({ pr: { merged: true } }).merged, 'closed and merged PRs');
ok(R({ pr: { draft: true } }).draft === true, 'a draft is reported so it can be marked ready');

console.log(bad ? bad + ' failed' : 'pr-ready: all passed');
process.exit(bad ? 1 : 0);
