// Merge on GitHub's side, so no session has to sit and watch a PR (.github/workflows/automerge.yml runs this on every CI
// finish, every review and every answer to one). It looks at each open PR from this repository (every one is labelled "automerge" by this script; owner 2026-10-15: "automerge everything always"; or the one PR given),
// asks tools/pr-ready.mjs whether Verse's review is clean, then tools/suite-gate.mjs: one pull request, and only after the
// full browser suite passed on that pull request merged with current main (suite-gate.yml). A merge made with the workflow's own token does
// not start the push-to-main workflows, so it starts both itself: the deploy (deploy.yml, after_merge=true: it deploys at
// once) and the full suite on that head (verify.yml, which reverts what broke it and files a heal job). A PR GitHub reports dirty (it conflicts with main)
// gets no pull_request runs at all, so the bot merges main into it first (resolveMain in pr-ready.mjs: tools/merge-main.mjs from
// main's checkout, the merge commit pushed to the branch, never forced, Verse's review dispatched on the new head); a conflict
// outside the append-only records comes back as one comment on the PR naming the files.
//   node tools/automerge.mjs                 every open PR labelled automerge (in the workflow)
//   node tools/automerge.mjs 205             just that one
//   node tools/automerge.mjs 205 --label     from a session: add the label and go (GitHub merges it when it is ready)
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readiness, resolveMain } from './pr-ready.mjs';
import { WAITS } from '../void-live-deploy/lib/v01d-fixes.js';
import { safety } from './skill-safety.mjs';
import { jobOfBody, moveJob } from './job-link.mjs';
import { eligible, superseded, stuckDecision } from './merge-policy.mjs';
import { choose, nextBatch, recordedMain, parseLog, CHECK } from './suite-gate.mjs';
import { stallVerdict, lastMerge, keyOf, withKey, STALL_MS, LABEL as STALL_LABEL, MARK as STALL_MARK } from './merge-stall.mjs';

const repo = process.env.REPO || process.env.GITHUB_REPOSITORY || 'atomeam/void-loop', LABEL = 'automerge';
// The API budget (2026-11-04). Every workflow in this repository shares one GITHUB_TOKEN quota (1,000 REST calls an hour). A sweep
// reads ~8 endpoints per open PR, and this bot woke on every CI finish, comment and review: 77 sweeps in 40 minutes over 20 PRs spent
// the hour's quota, and then every automerge, helper PR and dispatch failed with "API rate limit exceeded for installation" (403).
// So: an event about one PR looks at that PR only (scope.mjs below; the hourly run and a bare dispatch still sweep all), the check
// runs of a head are read once (not once per check name), and the quota is read first (GET /rate_limit costs nothing): under the
// floor the run says when it resets and exits 0, and a 403 mid-sweep stops the sweep the same way. The next wake (an event, or the
// hourly run) tries again, so a rate limit is a wait, never a red run and never a lost merge.
export const RATE_FLOOR = +(process.env.AUTOMERGE_RATE_FLOOR || 120);
export const isRateLimit = (e) => /rate limit exceeded|secondary rate limit|abuse detection/i.test(String((e && (e.stderr || e.message)) || e));
let limited = '';
const one = process.argv.slice(2).find((a) => /^\d+$/.test(a)) || scopedPr();
const runRaw = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, stdio: ['pipe', 'pipe', 'pipe'] });
const run = (args, input) => {
  try { return runRaw(args, input); }
  catch (e) { if (isRateLimit(e)) limited = limited || String(e.stderr || e.message).split('\n')[0].slice(0, 160); throw e; }
};
// the check runs of one head are read once per run (readiness and the merge gate below both ask)
const seen = new Map();
const gh = (path) => {
  if (/\/check-runs\?/.test(path) && seen.has(path)) return seen.get(path);
  const v = JSON.parse(run(['api', path]) || 'null');
  if (/\/check-runs\?/.test(path)) seen.set(path, v);
  return v;
};
function budget() {
  try { const c = JSON.parse(runRaw(['api', 'rate_limit'])).resources.core; return { left: c.remaining, reset: new Date(c.reset * 1000).toISOString() }; }
  catch (_) { return { left: Infinity, reset: '' }; }
}
function stopForQuota(why) {
  console.log(`::notice::automerge paused: ${why}. Nothing failed; the next wake (an event, or the hourly run) carries on.`);
  process.exit(0);
}
// the PR an event is about (pull_request, pull_request_review, a dispatch with input pr, a check run on a PR's branch); '' = sweep all
function scopedPr() {
  if (process.argv.includes('--all')) return '';
  try {
    const ev = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH || '', 'utf8'));
    if (ev.pull_request && ev.pull_request.number) return String(ev.pull_request.number);
    if (ev.inputs && /^\d+$/.test(String(ev.inputs.pr || ''))) return String(ev.inputs.pr);
    const wr = ev.workflow_run;
    // a suite gate result changes which pull request goes next: sweep, so the green one merges or the next one is queued now
    if (wr && wr.name === 'Suite on main') return '';
    if (wr && wr.pull_requests && wr.pull_requests.length === 1) return String(wr.pull_requests[0].number);
  } catch (_) {}
  return '';
}
// a check run that finished on main (a deploy, a review of main) changes no PR's readiness: nothing to look at
function idleEvent() {
  try {
    const ev = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH || '', 'utf8'));
    const wr = ev.workflow_run;
    return !!(wr && !(wr.pull_requests || []).length && wr.head_branch === 'main');
  } catch (_) { return false; }
}
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

if (!one && idleEvent()) { console.log('a run on main finished: no pull request changed, nothing to look at (the hourly run sweeps)'); process.exit(0); }
{ const b = budget(); if (b.left < RATE_FLOOR) stopForQuota(`${b.left} API calls left this hour (floor ${RATE_FLOOR}), the quota resets at ${b.reset}`); }
console.log(one ? `looking at #${one} only (the event is about it)` : 'sweeping every open pull request');

// GitHub will not auto-merge until the repository allows it. The token often cannot change that setting; say so and carry on.
// Once per sweep, not on every event: it is the same setting each time.
if (!one) try {
  run(['api', '-X', 'PATCH', `repos/${repo}`, '-F', 'allow_auto_merge=true', '-F', 'allow_squash_merge=true']);
  console.log('allow_auto_merge is on');
} catch (e) { console.log('allow_auto_merge: ' + String(e.stderr || e.message || e).slice(0, 240)); }

let prs;
try { prs = one ? [gh(`repos/${repo}/pulls/${one}`)] : gh(`repos/${repo}/pulls?state=open&per_page=100`); }
catch (e) { if (limited) stopForQuota(limited); throw e; }
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
const ready = [];
const closed = new Set(superseded(prs).map((r) => r.number));
for (let p of prs) {
  if (limited) { console.log(`::notice::stopped the sweep at #${p && p.number}: ${limited}. The next wake carries on; nothing failed.`); break; }
  if (!one && budget().left < RATE_FLOOR) { console.log(`::notice::stopped the sweep at #${p && p.number}: under ${RATE_FLOOR} API calls left this hour. The next wake carries on.`); break; }
  if (!p || p.state !== 'open' || closed.has(p.number)) continue;
  // every PR from this repository is merged automatically (owner, 2026-10-15: "automerge everything always"): a PR nobody
  // labelled gets the label here, so the rest of the loop (and anyone reading the PR) sees the same thing
  // the retired confidence label (lib/v01d-fixes.js WAITS) is not a person: the checks decide, so it becomes automerge
  if ((p.labels || []).some((l) => l.name === WAITS) && !(p.head.repo && p.head.repo.full_name !== repo)) {
    try {
      run(['api', '-X', 'DELETE', `repos/${repo}/issues/${p.number}/labels/${encodeURIComponent(WAITS)}`]);
      run(['api', '-X', 'POST', `repos/${repo}/issues/${p.number}/labels`, '--input', '-'], JSON.stringify({ labels: [LABEL] }));
      if (p.draft) run(['pr', 'ready', String(p.number), '--repo', repo]);
      console.log(`#${p.number}: was waiting for a person; it merges itself now`);
    } catch (e) { console.log(`#${p.number}: could not clear the retired label: ${String(e.stderr || e.message || e).slice(0, 160)}`); }
  }
  if (!(p.labels || []).some((l) => l.name === LABEL) && !(p.head.repo && p.head.repo.full_name !== repo)) {
    try { run(['api', '-X', 'POST', `repos/${repo}/issues/${p.number}/labels`, '--input', '-'], JSON.stringify({ labels: [LABEL] })); console.log(`#${p.number}: labelled ${LABEL} (every PR merges by itself)`); } catch (_) {}
  }
  if (p.head.repo && p.head.repo.full_name !== repo) { console.log(`#${p.number}: from a fork, never merged automatically`); continue; }
  // GitHub's own auto-merge would land the pull request on whatever main is now, without the suite. The bot merges, one at a time, after the suite.
  if (p.auto_merge && p.node_id) {
    try { run(['api', 'graphql', '-f', 'query=mutation($id:ID!){disablePullRequestAutoMerge(input:{pullRequestId:$id}){clientMutationId}}', '-f', 'id=' + p.node_id]); console.log(`#${p.number}: GitHub auto-merge disarmed until the suite passes on current main`); }
    catch (e) { console.log(`#${p.number}: could not disarm auto-merge: ${String(e.stderr || e.message || e).slice(0, 120)}`); }
  }
  // behind main, and the update is clean: GitHub merges main in. A conflict comes back as dirty and is settled below.
  if (p.mergeable_state === 'behind') {
    try { run(['api', '-X', 'PUT', `repos/${repo}/pulls/${p.number}/update-branch`, '-f', `expected_head_sha=${p.head.sha}`]); console.log(`#${p.number}: brought up to date with main`); }
    catch (e) { console.log(`#${p.number}: update-branch: ${String(e.stderr || e.message || e).slice(0, 200)}`); }
    continue;
  }
  // GitHub works out whether a PR is mergeable only when asked; the first answer after a push is "unknown", so ask once more
  if (p.mergeable_state === 'unknown') { try { execFileSync('sleep', ['4']); p = gh(`repos/${repo}/pulls/${p.number}`) || p; } catch (_) {} }
  let r;
  try { r = readiness(gh, repo, p.number); }
  catch (e) { if (limited) continue; console.log(`#${p.number}: could not read its state: ${String(e.stderr || e.message || e).slice(0, 200)}`); continue; }
  console.log(`#${p.number}: ${r.state} (${r.why})` + (r.extra ? ' · ' + r.extra : ''));
  if (r.state === 'resolve') {
    const m = resolveMain(ex, gh, { repo, pr: p.number, branch: r.branch, tools: here });
    console.log(`#${p.number}: ` + (m.state === 'pushed' ? `main merged in and pushed as ${m.sha.slice(0, 7)}; Verse's review started on it` : m.state === 'conflict' ? `conflicts need a person in ${m.files.join(', ')}` + (m.commented ? ' (commented on the PR)' : ' (already said on the PR)') : `could not merge main: ${m.why}`));
    if (m.state === 'conflict') noteStuck(p, 'it conflicts with main in ' + m.files.join(', '));
    continue;
  }
  if (r.state === 'wait' && r.noReview && r.branch) {
    // opened with the workflow token: the pull_request runs exist and do not start. Start the same checks (not automerge: this is that sweep).
    try {
      ex(process.execPath, [here + '/loop-checks.mjs', '--pr', String(p.number), '--ref', r.branch, '--repo', repo, '--from', 'automerge']);
      console.log(`#${p.number}: no review had started on ${r.sha.slice(0, 7)}; the pull-request checks were started`);
    } catch (e) { console.log(`#${p.number}: could not start the pull-request checks: ${String(e.stderr || e.message).slice(0, 200)}`); }
    continue;
  }
  if (r.state === 'stop') noteStuck(p, r.why);
  if (r.state !== 'merge') continue;
  // the merge gate tests the result of merging main. Missing on this head: start it and wait (a token push starts no pull_request run).
  // A repository that does not have the workflow yet (this file's first merge) is told so, and the older rule stands.
  try {
    const gate = (gh(`repos/${repo}/commits/${r.sha}/check-runs?per_page=100`).check_runs || []).filter((c) => c.name === 'merge-gate').sort((a, b) => b.id - a.id)[0];
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
  ready.push({ number: p.number, review: 'merge', p, r });
}
// One pull request, and only after the full suite passed on top of current main (tools/suite-gate.mjs).
let mainSha = '', choice = null, suiteRun = null, mergeError = '';
if (ready.length && !limited) {
  let running = false;
  try { mainSha = gh(`repos/${repo}/commits/main`).sha || ''; } catch (e) { console.log('could not read main: ' + String(e.stderr || e.message || e).slice(0, 160)); }
  try {
    const runs = JSON.parse(run(['run', 'list', '--repo', repo, '--workflow', 'suite-gate.yml', '--limit', '8', '--json', 'databaseId,status,conclusion,createdAt,url']));
    const list = Array.isArray(runs) ? runs : [];
    running = list.some((x) => ['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(x.status));
    const x = list.find((y) => y.status !== 'completed') || list[0];
    if (x) suiteRun = { id: x.databaseId, status: x.status, conclusion: x.conclusion, createdAt: x.createdAt, url: x.url };
  } catch (e) { console.log('could not read the suite queue: ' + String(e.stderr || e.message || e).slice(0, 160)); }
  const rows = [];
  for (const row of ready) {
    let suite = null, drift = null;
    try {
      const runs = (gh(`repos/${repo}/commits/${row.r.sha}/check-runs?per_page=100`).check_runs || []).filter((c) => c.name === CHECK);
      suite = runs.sort((a, b) => b.id - a.id)[0] || null;
    } catch (_) {}
    const tested = recordedMain(suite);
    if (tested && mainSha && !samePrefix(tested, mainSha)) {
      try { drift = parseLog(ex('git', ['log', '--name-only', '--pretty=format:COMMIT %s', tested + '..' + mainSha])); } catch (_) { drift = null; }
    }
    rows.push({ ...row, suite, drift });
  }
  choice = choose(rows, mainSha, running);
  const pick = choice.pr;
  console.log('suite gate: ' + choice.action + (pick ? ' #' + pick.number : '') + ' (' + choice.why + ')');
  // one suite run for the whole batch, dispatched from main: the workflow on main reads a list of pull requests (2026-11-06)
  const startSuite = (batch, where) => {
    const list = (batch || []).map((x) => x.number).filter(Boolean);
    if (!list.length) return;
    try { run(['workflow', 'run', 'suite-gate.yml', '--repo', repo, '--ref', 'main', '-f', `pr=${list.join(',')}`]); console.log(`#${list.join(', #')}: full suite started ${where}`); }
    catch (e) { console.log(`#${list.join(', #')}: could not start the suite: ${String(e.stderr || e.message || e).slice(0, 200)}`); }
  };
  // a run scoped to one pull request sees only that one: a batch built here holds one pull request, and the scoped runs
  // (one per event) outnumber the sweeps, so the queue moved one at a time (2026-11-06). A scoped run starts a full sweep
  // instead, and the sweep builds the batch from every ready pull request.
  const sweepAll = (why) => {
    try { run(['workflow', 'run', 'automerge.yml', '--repo', repo, '--ref', 'main']); console.log('full sweep started: ' + why); }
    catch (e) { console.log('could not start a full sweep: ' + String(e.stderr || e.message || e).slice(0, 200)); }
  };
  if (choice.action === 'queue' && pick) {
    if (one) sweepAll(`#${pick.number} is ready; the sweep puts it in a batch with the other ready pull requests`);
    else startSuite(choice.batch && choice.batch.length ? choice.batch : [pick], 'on top of ' + String(mainSha).slice(0, 7));
  }
  if (choice.action === 'merge' && pick) {
    // the pull requests one green run tested, merged one after another; the first refusal stops the rest (they wait for the next run)
    const done = [];
    for (const row of (choice.batch && choice.batch.length ? choice.batch : [pick])) {
      const p = row.p, r = row.r;
      try {
        if (r.draft) run(['pr', 'ready', String(p.number), '--repo', repo]);
        if (eligible(p, repo) && p.auto_merge) {
          try { run(['api', 'graphql', '-f', 'query=mutation($id:ID!){disablePullRequestAutoMerge(input:{pullRequestId:$id}){clientMutationId}}', '-f', 'id=' + p.node_id]); } catch (_) {}
        }
        const m = JSON.parse(run(['api', '-X', 'PUT', `repos/${repo}/pulls/${p.number}/merge`, '-f', 'merge_method=squash', '-f', `sha=${r.sha}`]));
        if (!m.merged) break;
        merged++; done.push(row); console.log(`merged #${p.number} at ${r.sha.slice(0, 7)} (suite green on ${String(mainSha).slice(0, 7)})`); await markLive(p);
      } catch (e) { mergeError = String(e.stderr || e.message).slice(0, 300); console.log(`#${p.number}: merge refused: ${mergeError}`); break; }
    }
    // main moved: start the suite for the next ready pull requests now, not at the next hourly sweep (2026-11-06)
    if (done.length) { if (one) sweepAll('main moved'); else startSuite(nextBatch(rows, done), 'on the new main'); }
  }
}
// The stall alarm (tools/merge-stall.mjs): in a sweep, no merge for 2 hours while a green pull request waits opens one issue
// that names the stuck step; a hung suite gate run is cancelled. The issue closes when a pull request merges again. Never fails the run.
if (!one && !limited) {
  try {
    const recent = merged ? new Date().toISOString() : lastMerge(gh(`repos/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=30`));
    const v = stallVerdict({ now: Date.now(), lastMergeAt: recent, ready: ready.map((x) => ({ number: x.number, createdAt: x.p.created_at })), choice, suiteRun, mainSha, mergeError });
    const issue = (gh(`repos/${repo}/issues?state=open&labels=${STALL_LABEL}&per_page=5`) || []).find((i) => !i.pull_request && String(i.body || '').startsWith(STALL_MARK));
    if (v.stalled) {
      if (v.cancel) {
        try { run(['api', '-X', 'POST', `repos/${repo}/actions/runs/${v.cancel}/cancel`]); console.log(`stall: cancelled the hung suite gate run ${v.cancel}`); }
        catch (e) { console.log(`stall: could not cancel run ${v.cancel}: ${String(e.stderr || e.message || e).slice(0, 160)}`); }
      }
      const body = withKey(v.body, v.key);
      if (!issue) {
        const made = JSON.parse(run(['api', '-X', 'POST', `repos/${repo}/issues`, '--input', '-'], JSON.stringify({ title: v.title, body, labels: [STALL_LABEL] })));
        console.log(`::warning::merges stalled: ${v.step} (issue #${made.number})`);
      } else if (keyOf(issue.body) !== v.key) {
        run(['api', '-X', 'PATCH', `repos/${repo}/issues/${issue.number}`, '--input', '-'], JSON.stringify({ title: v.title, body }));
        run(['api', '-X', 'POST', `repos/${repo}/issues/${issue.number}/comments`, '--input', '-'], JSON.stringify({ body: 'The stuck step changed: ' + v.step }));
        console.log(`::warning::merges stalled, new step: ${v.step} (issue #${issue.number})`);
      } else console.log(`merges stalled, same step as issue #${issue.number}: ${v.step}`);
    } else if (issue && recent && Date.now() - Date.parse(recent) < STALL_MS) {
      run(['api', '-X', 'POST', `repos/${repo}/issues/${issue.number}/comments`, '--input', '-'], JSON.stringify({ body: `The queue moves again: a pull request merged at ${recent}. Closing.` }));
      run(['api', '-X', 'PATCH', `repos/${repo}/issues/${issue.number}`, '-f', 'state=closed', '-f', 'state_reason=completed']);
      console.log(`stall over: closed issue #${issue.number}`);
    }
  } catch (e) { console.log('stall alarm: ' + String(e.stderr || e.message || e).slice(0, 200)); }
}
function samePrefix(a, b) { const x = String(a).toLowerCase(), y = String(b).toLowerCase(); return x === y || x.startsWith(y) || y.startsWith(x); }
if (merged) {
  try { run(['workflow', 'run', 'deploy.yml', '--repo', repo, '--ref', 'main', '-f', 'after_merge=true']); console.log('deploy of main started'); }
  catch (e) { console.log('::warning::merged, but could not start the deploy: ' + String(e.stderr || e.message).slice(0, 300)); }
  // and the suite on that head (verify.yml): it no longer waits for the deploy, and a GITHUB_TOKEN merge starts no push workflow
  try { run(['workflow', 'run', 'verify.yml', '--repo', repo, '--ref', 'main']); console.log('suite on main started'); }
  catch (e) { console.log('::warning::merged, but could not start the suite: ' + String(e.stderr || e.message).slice(0, 300)); }
}
