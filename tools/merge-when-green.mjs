// Merge a PR once it is ready (tools/pr-ready.mjs: Void's review check found no bugs or risks on its current head, nothing
// that finished failed; the suite runs on main after the deploy; CodeRabbit is an extra and never blocks). Most PRs no longer need this: label them "automerge" (or run
// `node tools/automerge.mjs <pr> --label`) and .github/workflows/automerge.yml merges them on GitHub, with no session waiting.
// This is the same check polled from a session, for when you want to see the merge happen. If the head moves (a new push),
// it follows the new head; a failed check or Void's review stops it (exit 1); if the PR closes it stops.
// CodeRabbit is never waited on or re-asked when rate-limited. Uses the gh available in the session.
//   node tools/merge-when-green.mjs 85            poll every 30 s, up to 40 min
import { execFileSync } from 'node:child_process';
import { readiness } from './pr-ready.mjs';

const pr = process.argv[2], repo = process.env.REPO || 'atomeam/void-loop';
if (!/^\d+$/.test(pr || '')) { console.error('usage: node tools/merge-when-green.mjs <pr-number>'); process.exit(2); }
const gh = (...a) => JSON.parse(execFileSync('gh', ['api', ...a], { encoding: 'utf8' }) || 'null');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const end = Date.now() + 40 * 60e3;
// started right after a push, wait until GitHub shows that push as the PR head (the local HEAD), so an older head's CI or review is never acted on
const want = (() => { try { return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch (_) { return ''; } })();
let seenWant = false;
while (Date.now() < end) {
  if (want && !seenWant) { if (gh(`repos/${repo}/pulls/${pr}`).head.sha !== want && Date.now() < end - 35 * 60e3) { await wait(10e3); continue; } seenWant = true; }
  const r = readiness((path) => gh(path), repo, pr);
  if (r.merged) { console.log(`#${pr} is already merged`); process.exit(0); }
  if (r.state === 'stop') {
    // a push may not have reached the PR yet: if the head moved since, look again instead of stopping on the old head
    if (r.sha && gh(`repos/${repo}/pulls/${pr}`).head.sha !== r.sha) { await wait(10e3); continue; }
    console.log(`#${pr} ${r.why}`); process.exit(1);
  }
  if (r.state === 'merge') {
    if (r.draft) execFileSync('gh', ['api', '-X', 'POST', `repos/${repo}/pulls/${pr}/ccr/ready_for_review`], { encoding: 'utf8' });
    const m = gh('-X', 'PUT', `repos/${repo}/pulls/${pr}/merge`, '-f', 'merge_method=merge', '-f', `sha=${r.sha}`);
    console.log(m.merged ? `merged #${pr} at ${r.sha.slice(0, 7)} (Void's review clean)` : `merge refused: ${m.message}`);
    process.exit(m.merged ? 0 : 1);
  }
  await wait(30e3);
}
console.log(`#${pr}: still not ready after 40 min`); process.exit(1);
