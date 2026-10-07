// Merge a PR once CI ("test-and-deploy", and "bench" when present) passes on its current head, so a run never sits waiting on CI: start this in
// the background right after pushing and go do the next thing. If the head moves (a new push), it follows the new
// head; if CI fails it stops and says so; if the PR closes it stops. A CodeRabbit review still running (or asked for in the last 10 min) gets up to 10 min after
// green; actionable CodeRabbit findings on the head stop it with exit 3. Uses the gh available in the session.
//   node tools/merge-when-green.mjs 85            poll every 30 s, up to 40 min
import { execFileSync } from 'node:child_process';

const pr = process.argv[2], repo = process.env.REPO || 'atomeam/void-loop';
if (!/^\d+$/.test(pr || '')) { console.error('usage: node tools/merge-when-green.mjs <pr-number>'); process.exit(2); }
const gh = (...a) => JSON.parse(execFileSync('gh', ['api', ...a], { encoding: 'utf8' }) || 'null');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const end = Date.now() + 40 * 60e3;
// started right after a push, wait until GitHub shows that push as the PR head (the local HEAD), so an older head's CI or review is never acted on
const want = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (_) { return ''; } })();
let seenWant = false;
let greenAt = 0;
while (Date.now() < end) {
  const p = gh(`repos/${repo}/pulls/${pr}`);
  if (p.merged) { console.log(`#${pr} is already merged`); process.exit(0); }
  if (p.state !== 'open') { console.log(`#${pr} is ${p.state}; nothing to merge`); process.exit(1); }
  // test-and-deploy, and the parallel "bench" job when the workflow has one: the newest run of each must pass
  if (want && !seenWant) { if (p.head.sha !== want && Date.now() < end - 35 * 60e3) { await wait(10e3); continue; } seenWant = true; }
  const sha = p.head.sha, latest = (name) => gh(`repos/${repo}/commits/${sha}/check-runs?check_name=${name}`).check_runs.sort((a, b) => b.id - a.id)[0];
  const runs = [latest('test-and-deploy'), latest('bench')].filter(Boolean);
  const failed = runs.find((r) => r.status === 'completed' && r.conclusion !== 'success' && r.conclusion !== 'cancelled');
  if (failed) { console.log(`#${pr} ${failed.name} ${failed.conclusion} on ${sha.slice(0, 7)}: ${failed.html_url}`); process.exit(1); }
  if (runs.length && runs[0].name === 'test-and-deploy' && runs.every((r) => r.status === 'completed' && r.conclusion === 'success')) {
    // CodeRabbit is a bonus, never a gate: but a review already under way gets up to 10 min after green, so its findings land
    // on an open PR; a review of this head with actionable findings stops the merge so they get fixed first
    greenAt = greenAt || Date.now();
    const all = gh(`repos/${repo}/issues/${pr}/comments?per_page=100`), cr = all.filter((c) => c.user && c.user.login === 'coderabbitai[bot]');
    const reviews = gh(`repos/${repo}/pulls/${pr}/reviews?per_page=100`).filter((r) => r.user && r.user.login === 'coderabbitai[bot]' && r.commit_id === sha);
    // a review asked for (an "@coderabbitai review" comment) and not yet posted on this head counts as under way too: CodeRabbit
    // takes a few minutes to say it has started, and in that gap this used to merge before it looked (#141)
    const asked = all.filter((c) => c.user && c.user.login !== 'coderabbitai[bot]' && /@coderabbitai\s+(?:full\s+)?review\b/i.test(c.body || '')).map((c) => Date.parse(c.created_at));
    const lastAsk = asked.length ? Math.max(...asked) : 0, answered = reviews.some((r) => Date.parse(r.submitted_at) >= lastAsk);
    const busy = cr.some((c) => /review in progress by coderabbit|Currently processing new changes/.test(c.body || '')) || (lastAsk && !answered && Date.now() - lastAsk < 10 * 60e3);
    if (busy && Date.now() - greenAt < 10 * 60e3) { await wait(30e3); continue; }
    const found = reviews.map((r) => +((r.body || '').match(/Actionable comments posted:\s*(\d+)/) || [0, 0])[1]).reduce((a, b) => a + b, 0);
    // a push may not have reached the PR yet: if the head moved since this loop read it, look again instead of stopping on the old head
    if (found && gh(`repos/${repo}/pulls/${pr}`).head.sha !== sha) { await wait(10e3); continue; }
    if (found) { console.log(`#${pr} CI green, but CodeRabbit left ${found} finding(s) on ${sha.slice(0, 7)}: fix them, push, and run this again`); process.exit(3); }
    // a CodeRabbit thread nobody has answered blocks the merge, whichever commit it was left on (a later push does not answer it)
    const rc = gh(`repos/${repo}/pulls/${pr}/comments?per_page=100`), replied = new Set(rc.filter((c) => c.in_reply_to_id && c.user && c.user.login !== 'coderabbitai[bot]').map((c) => c.in_reply_to_id));
    const open = rc.filter((c) => !c.in_reply_to_id && c.user && c.user.login === 'coderabbitai[bot]' && !replied.has(c.id));
    if (open.length) { console.log(`#${pr} CI green, but ${open.length} CodeRabbit thread(s) have no answer yet: fix or reply on each, push, and run this again`); process.exit(3); }
    if (p.draft) execFileSync('gh', ['api', '-X', 'POST', `repos/${repo}/pulls/${pr}/ccr/ready_for_review`], { encoding: 'utf8' });
    const m = gh('-X', 'PUT', `repos/${repo}/pulls/${pr}/merge`, '-f', 'merge_method=merge', '-f', `sha=${sha}`);
    console.log(m.merged ? `merged #${pr} at ${sha.slice(0, 7)} (CI green)` : `merge refused: ${m.message}`);
    process.exit(m.merged ? 0 : 1);
  }
  await wait(30e3);
}
console.log(`#${pr}: CI still not finished after 40 min`); process.exit(1);
