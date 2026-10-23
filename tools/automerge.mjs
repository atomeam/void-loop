// Merge on GitHub's side, so no session has to sit and watch a PR (.github/workflows/automerge.yml runs this on every CI
// finish, every review and every answer to one). It looks at each open PR from this repository (every one is labelled "automerge" by this script; owner 2026-10-15: "automerge everything always"; or the one PR given),
// asks tools/pr-ready.mjs whether it is ready, and merges the ready ones. A merge made with the workflow's own token does
// not start the push-to-main workflows, so it starts both itself: the deploy (deploy.yml, after_merge=true: it deploys at
// once) and the full suite on that head (verify.yml, which reverts what broke it if it fails). A PR GitHub reports dirty (it conflicts with main)
// gets no pull_request runs at all, so the bot merges main into it first (resolveMain in pr-ready.mjs: tools/merge-main.mjs from
// main's checkout, the merge commit pushed to the branch, never forced, Verse's review dispatched on the new head); a conflict
// outside the append-only records comes back as one comment on the PR naming the files.
//   node tools/automerge.mjs                 every open PR labelled automerge (in the workflow)
//   node tools/automerge.mjs 205             just that one
//   node tools/automerge.mjs 205 --label     from a session: add the label and go (GitHub merges it when it is ready)
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readiness, resolveMain } from './pr-ready.mjs';
import { safety } from './skill-safety.mjs';
import { jobOfBody, moveJob } from './job-link.mjs';

const repo = process.env.REPO || process.env.GITHUB_REPOSITORY || 'atomeam/void-loop', LABEL = 'automerge';
const one = process.argv.slice(2).find((a) => /^\d+$/.test(a));
const run = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input });
const gh = (path) => JSON.parse(run(['api', path]) || 'null');
const ex = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const here = dirname(fileURLToPath(import.meta.url));

// the build-queue job a merged PR names on its last line (`Job: <id>`, tools/job-link.mjs) goes live (asked by Verse); the PR list and
// the single-PR read both carry `body`. Needs VOID_OWNER_TOKEN in the step's env; without it the line says so. Never stops the loop.
async function markLive(p) {
  try {
    const id = jobOfBody(p && p.body);
    if (id) console.log(`#${p.number}: ${await moveJob({ id, state: 'live', label: 'live', url: p.html_url })}`);
  } catch (e) { console.log(`#${p.number}: job not marked live: ${String(e && e.message || e).slice(0, 200)}`); }
}

if (process.argv.includes('--label')) {
  if (!one) { console.error('usage: node tools/automerge.mjs <pr> --label'); process.exit(2); }
  run(['api', '-X', 'POST', `repos/${repo}/issues/${one}/labels`, '--input', '-'], JSON.stringify({ labels: [LABEL] }));
  console.log(`#${one} labelled ${LABEL}: GitHub merges it as soon as Verse's review is clean; the suite runs on main after the deploy`);
  process.exit(0);
}

const prs = one ? [gh(`repos/${repo}/pulls/${one}`)] : gh(`repos/${repo}/pulls?state=open&per_page=100`);
let merged = 0;
for (let p of prs) {
  if (!p || p.state !== 'open') continue;
  // every PR from this repository is merged automatically (owner, 2026-10-15: "automerge everything always"): a PR nobody
  // labelled gets the label here, so the rest of the loop (and anyone reading the PR) sees the same thing
  if (!(p.labels || []).some((l) => l.name === LABEL) && !(p.head.repo && p.head.repo.full_name !== repo)) {
    try { run(['api', '-X', 'POST', `repos/${repo}/issues/${p.number}/labels`, '--input', '-'], JSON.stringify({ labels: [LABEL] })); console.log(`#${p.number}: labelled ${LABEL} (every PR merges by itself)`); } catch (_) {}
  }
  if (p.head.repo && p.head.repo.full_name !== repo) { console.log(`#${p.number}: from a fork, never merged automatically`); continue; }
  // GitHub works out whether a PR is mergeable only when asked; the first answer after a push is "unknown", so ask once more
  if (p.mergeable_state === 'unknown') { try { execFileSync('sleep', ['4']); p = gh(`repos/${repo}/pulls/${p.number}`) || p; } catch (_) {} }
  const r = readiness(gh, repo, p.number);
  console.log(`#${p.number}: ${r.state} (${r.why})` + (r.extra ? ' · ' + r.extra : ''));
  if (r.state === 'resolve') {
    const m = resolveMain(ex, gh, { repo, pr: p.number, branch: r.branch, tools: here });
    console.log(`#${p.number}: ` + (m.state === 'pushed' ? `main merged in and pushed as ${m.sha.slice(0, 7)}; Verse's review started on it` : m.state === 'conflict' ? `conflicts need a person in ${m.files.join(', ')}` + (m.commented ? ' (commented on the PR)' : ' (already said on the PR)') : `could not merge main: ${m.why}`));
    continue;
  }
  if (r.state === 'wait' && r.noReview && r.branch) {
    try { run(['workflow', 'run', 'void-review.yml', '--repo', repo, '--ref', r.branch, '-f', `pr=${p.number}`]); console.log(`#${p.number}: no review had started on ${r.sha.slice(0, 7)}; Verse's review dispatched`); }
    catch (e) { console.log(`#${p.number}: could not start Verse's review: ${String(e.stderr || e.message).slice(0, 200)}`); }
    continue;
  }
  if (r.state !== 'merge') continue;
  // the safety-check (asked by Verse): the unit tests of the skills and libs this PR changed, run on its head, before the merge
  const sc = safety(ex, gh, { repo, pr: p.number, sha: r.sha });
  console.log(`#${p.number}: safety-check ${sc.state} (${sc.why})`);
  if (sc.state === 'fail') continue;
  try {
    if (r.draft) run(['pr', 'ready', String(p.number), '--repo', repo]);
    const m = JSON.parse(run(['api', '-X', 'PUT', `repos/${repo}/pulls/${p.number}/merge`, '-f', 'merge_method=merge', '-f', `sha=${r.sha}`]));
    if (m.merged) { merged++; console.log(`merged #${p.number} at ${r.sha.slice(0, 7)}`); await markLive(p); }
  } catch (e) { console.log(`#${p.number}: merge refused: ${String(e.stderr || e.message).slice(0, 300)}`); }
}
if (merged) {
  try { run(['workflow', 'run', 'deploy.yml', '--repo', repo, '--ref', 'main', '-f', 'after_merge=true']); console.log('deploy of main started'); }
  catch (e) { console.log('::warning::merged, but could not start the deploy: ' + String(e.stderr || e.message).slice(0, 300)); }
  // and the suite on that head (verify.yml): it no longer waits for the deploy, and a GITHUB_TOKEN merge starts no push workflow
  try { run(['workflow', 'run', 'verify.yml', '--repo', repo, '--ref', 'main']); console.log('suite on main started'); }
  catch (e) { console.log('::warning::merged, but could not start the suite: ' + String(e.stderr || e.message).slice(0, 300)); }
}
