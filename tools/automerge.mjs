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
import { eligible, superseded, stuckDecision } from './merge-policy.mjs';

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

// GitHub will not auto-merge until the repository allows it. The token often cannot change that setting; say so and carry on.
try {
  run(['api', '-X', 'PATCH', `repos/${repo}`, '-F', 'allow_auto_merge=true', '-F', 'allow_squash_merge=true']);
  console.log('allow_auto_merge is on');
} catch (e) { console.log('allow_auto_merge: ' + String(e.stderr || e.message || e).slice(0, 240)); }

const prs = one ? [gh(`repos/${repo}/pulls/${one}`)] : gh(`repos/${repo}/pulls?state=open&per_page=100`);
const stuck = process.env.STUCK === '1', STUCK_MARK = '<!-- void-stuck -->';
function noteStuck(p, why) {
  if (!stuck || stuckDecision(p, [], Date.now()).action === 'young') return;
  const body = STUCK_MARK + '\nThis pull request has been open for more than 6 hours. Blocker: ' + why + '. A conflict is settled with `node tools/merge-main.mjs` on the branch; a red check is fixed on the branch. It merges by itself once that is green.';
  try {
    const comments = gh(`repos/${repo}/issues/${p.number}/comments?per_page=100`) || [];
    const mine = comments.find((c) => c.user && c.user.login === 'github-actions[bot]' && String(c.body || '').startsWith(STUCK_MARK));
    if (!mine) run(['api', '-X', 'POST', `repos/${repo}/issues/${p.number}/comments`, '--input', '-'], JSON.stringify({ body }));
    else if (mine.body !== body) run(['api', '-X', 'PATCH', `repos/${repo}/issues/comments/${mine.id}`, '--input', '-'], JSON.stringify({ body }));
    console.log(`#${p.number}: stuck, said why (${why})`);
  } catch (e) { console.log(`#${p.number}: could not comment: ${String(e.stderr || e.message || e).slice(0, 160)}`); }
}
for (const row of superseded(prs)) {
  const body = '<!-- void-superseded -->\nThis `' + row.ref + '` pull request is superseded by #' + row.keep + ', which is newer. Closing it so the same bot work is not merged twice.';
  try {
    run(['api', '-X', 'POST', `repos/${repo}/issues/${row.number}/comments`, '--input', '-'], JSON.stringify({ body }));
    run(['api', '-X', 'PATCH', `repos/${repo}/pulls/${row.number}`, '-f', 'state=closed']);
    console.log('closed #' + row.number + ', superseded by #' + row.keep);
  } catch (e) { console.log('#' + row.number + ': could not close the superseded pull request: ' + String(e.stderr || e.message || e).slice(0, 200)); }
}
let merged = 0;
const closed = new Set(superseded(prs).map((r) => r.number));
for (let p of prs) {
  if (!p || p.state !== 'open' || closed.has(p.number)) continue;
  // every PR from this repository is merged automatically (owner, 2026-10-15: "automerge everything always"): a PR nobody
  // labelled gets the label here, so the rest of the loop (and anyone reading the PR) sees the same thing
  // an old "waits for owner" label is not a person: the checks decide, so it becomes automerge
  if ((p.labels || []).some((l) => l.name === 'waits for owner') && !(p.head.repo && p.head.repo.full_name !== repo)) {
    try {
      run(['api', '-X', 'DELETE', `repos/${repo}/issues/${p.number}/labels/${encodeURIComponent('waits for owner')}`]);
      run(['api', '-X', 'POST', `repos/${repo}/issues/${p.number}/labels`, '--input', '-'], JSON.stringify({ labels: [LABEL] }));
      if (p.draft) run(['pr', 'ready', String(p.number), '--repo', repo]);
      console.log(`#${p.number}: was waiting for a person; it merges itself now`);
    } catch (e) { console.log(`#${p.number}: could not clear waits for owner: ${String(e.stderr || e.message || e).slice(0, 160)}`); }
  }
  if (!(p.labels || []).some((l) => l.name === LABEL) && !(p.head.repo && p.head.repo.full_name !== repo)) {
    try { run(['api', '-X', 'POST', `repos/${repo}/issues/${p.number}/labels`, '--input', '-'], JSON.stringify({ labels: [LABEL] })); console.log(`#${p.number}: labelled ${LABEL} (every PR merges by itself)`); } catch (_) {}
  }
  if (p.head.repo && p.head.repo.full_name !== repo) { console.log(`#${p.number}: from a fork, never merged automatically`); continue; }
  // behind main, and the update is clean: GitHub merges main in. A conflict comes back as dirty and is settled below.
  if (p.mergeable_state === 'behind') {
    try { run(['api', '-X', 'PUT', `repos/${repo}/pulls/${p.number}/update-branch`, '-f', `expected_head_sha=${p.head.sha}`]); console.log(`#${p.number}: brought up to date with main`); }
    catch (e) { console.log(`#${p.number}: update-branch: ${String(e.stderr || e.message || e).slice(0, 200)}`); }
    continue;
  }
  // GitHub works out whether a PR is mergeable only when asked; the first answer after a push is "unknown", so ask once more
  if (p.mergeable_state === 'unknown') { try { execFileSync('sleep', ['4']); p = gh(`repos/${repo}/pulls/${p.number}`) || p; } catch (_) {} }
  const r = readiness(gh, repo, p.number);
  console.log(`#${p.number}: ${r.state} (${r.why})` + (r.extra ? ' · ' + r.extra : ''));
  if (r.state === 'resolve') {
    const m = resolveMain(ex, gh, { repo, pr: p.number, branch: r.branch, tools: here });
    console.log(`#${p.number}: ` + (m.state === 'pushed' ? `main merged in and pushed as ${m.sha.slice(0, 7)}; Verse's review started on it` : m.state === 'conflict' ? `conflicts need a person in ${m.files.join(', ')}` + (m.commented ? ' (commented on the PR)' : ' (already said on the PR)') : `could not merge main: ${m.why}`));
    if (m.state === 'conflict') noteStuck(p, 'it conflicts with main in ' + m.files.join(', '));
    continue;
  }
  if (r.state === 'wait' && r.noReview && r.branch) {
    try { run(['workflow', 'run', 'void-review.yml', '--repo', repo, '--ref', r.branch, '-f', `pr=${p.number}`]); console.log(`#${p.number}: no review had started on ${r.sha.slice(0, 7)}; Verse's review dispatched`); }
    catch (e) { console.log(`#${p.number}: could not start Verse's review: ${String(e.stderr || e.message).slice(0, 200)}`); }
    continue;
  }
  if (r.state === 'stop') noteStuck(p, r.why);
  if (r.state !== 'merge') continue;
  // the merge gate tests the result of merging main. Missing on this head: start it and wait (a token push starts no pull_request run).
  // A repository that does not have the workflow yet (this file's first merge) is told so, and the older rule stands.
  try {
    const gate = (gh(`repos/${repo}/commits/${r.sha}/check-runs?check_name=merge-gate&per_page=20`).check_runs || []).sort((a, b) => b.id - a.id)[0];
    if (!gate && r.branch) {
      try { run(['workflow', 'run', 'merge-gate.yml', '--repo', repo, '--ref', r.branch, '-f', `pr=${p.number}`]); console.log(`#${p.number}: merge gate started on ${r.sha.slice(0, 7)}`); continue; }
      catch (e) { console.log(`#${p.number}: no merge gate on this repository yet (${String(e.stderr || e.message || e).slice(0, 120)}); merging on Verse's review`); }
    } else if (gate && (gate.status !== 'completed' || gate.conclusion !== 'success')) {
      console.log(`#${p.number}: merge gate ${gate.status} ${gate.conclusion || ''}`); continue;
    }
  } catch (e) { console.log(`#${p.number}: could not read the merge gate: ${String(e.stderr || e.message || e).slice(0, 160)}`); }
  // the safety-check (asked by Verse): the unit tests of the skills and libs this PR changed, run on its head, before the merge
  const sc = safety(ex, gh, { repo, pr: p.number, sha: r.sha });
  console.log(`#${p.number}: safety-check ${sc.state} (${sc.why})`);
  if (sc.state === 'fail') continue;
  try {
    if (r.draft) run(['pr', 'ready', String(p.number), '--repo', repo]);
    // Arm GitHub's own auto-merge (squash) so a green pull request does not sit with autoMergeRequest null.
    // When the arm takes, GitHub merges as soon as its required checks pass; the PUT below is the same merge if the arm cannot.
    let armed = false;
    if (eligible(p, repo) && p.node_id && !p.auto_merge) {
      try {
        const q = 'mutation($id:ID!){enablePullRequestAutoMerge(input:{pullRequestId:$id,mergeMethod:SQUASH}){pullRequest{autoMergeRequest{enabledAt mergeMethod}}}}';
        const out = run(['api', 'graphql', '-f', 'query=' + q, '-f', 'id=' + p.node_id]);
        armed = /enabledAt/.test(out);
        console.log(`#${p.number}: auto-merge armed (squash)` + (armed ? '' : ' (no confirmation)'));
      } catch (e) { console.log(`#${p.number}: auto-merge not armed: ${String(e.stderr || e.message || e).slice(0, 240)}`); }
    }
    if (armed) continue;
    const m = JSON.parse(run(['api', '-X', 'PUT', `repos/${repo}/pulls/${p.number}/merge`, '-f', 'merge_method=squash', '-f', `sha=${r.sha}`]));
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
