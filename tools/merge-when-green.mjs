// Merge a PR once CI ("test-and-deploy") passes on its current head, so a run never sits waiting on CI: start this in
// the background right after pushing and go do the next thing. If the head moves (a new push), it follows the new
// head; if CI fails it stops and says so; if the PR closes it stops. Uses the gh available in the session.
//   node tools/merge-when-green.mjs 85            poll every 30 s, up to 40 min
import { execFileSync } from 'node:child_process';

const pr = process.argv[2], repo = process.env.REPO || 'atomeam/void-loop';
if (!/^\d+$/.test(pr || '')) { console.error('usage: node tools/merge-when-green.mjs <pr-number>'); process.exit(2); }
const gh = (...a) => JSON.parse(execFileSync('gh', ['api', ...a], { encoding: 'utf8' }) || 'null');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const end = Date.now() + 40 * 60e3;
while (Date.now() < end) {
  const p = gh(`repos/${repo}/pulls/${pr}`);
  if (p.merged) { console.log(`#${pr} is already merged`); process.exit(0); }
  if (p.state !== 'open') { console.log(`#${pr} is ${p.state}; nothing to merge`); process.exit(1); }
  const sha = p.head.sha, runs = gh(`repos/${repo}/commits/${sha}/check-runs?check_name=test-and-deploy`).check_runs;
  const run = runs.sort((a, b) => b.id - a.id)[0];
  if (run && run.status === 'completed') {
    if (run.conclusion !== 'success') { console.log(`#${pr} CI ${run.conclusion} on ${sha.slice(0, 7)}: ${run.html_url}`); process.exit(1); }
    if (p.draft) execFileSync('gh', ['api', '-X', 'POST', `repos/${repo}/pulls/${pr}/ccr/ready_for_review`], { encoding: 'utf8' });
    const m = gh('-X', 'PUT', `repos/${repo}/pulls/${pr}/merge`, '-f', 'merge_method=merge', '-f', `sha=${sha}`);
    console.log(m.merged ? `merged #${pr} at ${sha.slice(0, 7)} (CI green)` : `merge refused: ${m.message}`);
    process.exit(m.merged ? 0 : 1);
  }
  await wait(30e3);
}
console.log(`#${pr}: CI still not finished after 40 min`); process.exit(1);
