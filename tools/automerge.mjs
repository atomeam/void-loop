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
import { mainVerifyHold, superseded, stuckDecision, loopCovers } from './merge-policy.mjs';
import { fixAge, fixNote, nextStep } from './merge-flow.mjs';
import { chooseChecked, nextBatch, recordedMain, parseLog, CHECK } from './suite-gate.mjs';
import { stallVerdict, lastMerge, keyOf, withKey, STALL_MS, LABEL as STALL_LABEL, MARK as STALL_MARK } from './merge-stall.mjs';

const repo = process.env.REPO || process.env.GITHUB_REPOSITORY || 'atomeam/void-loop', LABEL = 'automerge';

// Stacked PRs cannot use the synchronous merge endpoint; fall back to merge-async and poll its result.
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
const gh = (path, opts = {}) => {
  const key = path + (opts.paginate ? '|p' : '');
  if (/\/check-runs\?/.test(path) && !opts.paginate && seen.has(key)) return seen.get(key);
  const args = ['api', path];
  if (opts.paginate) args.splice(1, 0, '--paginate');
  let v;
  if (opts.paginate) {
    // gh api --paginate emits concatenated JSON arrays; --slurp wraps pages so we can flatten safely
    const raw = run(['api', '--paginate', '--slurp', path]) || '[]';
    try { const pages = JSON.parse(raw); v = Array.isArray(pages) && pages.length && Array.isArray(pages[0]) ? pages.flat() : (Array.isArray(pages) ? pages : []); }
    catch (_) { try { v = JSON.parse(run(['api', '--paginate', path]) || '[]'); } catch { v = []; } }
  } else {
    v = JSON.parse(run(args) || 'null');
  }
  if (/\/check-runs\?/.test(path) && !opts.paginate) seen.set(key, v);
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
    if (wr && (wr.name === 'Suite on main' || wr.name === 'Verse verify')) return '';
    if (wr && wr.pull_requests && wr.pull_requests.length === 1) return String(wr.pull_requests[0].number);
  } catch (_) {}
  return '';
}
// a check run that finished on main (a deploy, a review of main) changes no PR's readiness: nothing to look at
function idleEvent() {
  try {
    const ev = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH || '', 'utf8'));
    const wr = ev.workflow_run;
    // the suite gate runs on main for a batch of pull requests: its result is never idle (2026-11-06: it was, and nothing merged)
    return !!(wr && wr.name !== 'Suite on main' && wr.name !== 'Verse verify' && !(wr.pull_requests || []).length && wr.head_branch === 'main');
  } catch (_) { return false; }
}
const ex = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
const here = dirname(fileURLToPath(import.meta.url));
const safeArg = (s) => String(s || '').replace(/[\r\n"]/g, ' ').slice(0, 160);
const isHttp403 = (e) => /(?:HTTP\s*)?403\b|forbidden|resource not accessible/i.test(String(e && (e.stderr || e.message) || e));
function mergeGateFailure(sha) {
  try {
    const rows = (gh(`repos/${repo}/commits/${sha}/check-runs?per_page=100`).check_runs || [])
      .filter((r) => /^merge-gate(?:\s|$)/i.test(String(r.name || '')))
      .sort((a, b) => b.id - a.id);
    const latest = rows[0];
    return latest && latest.status === 'completed' && latest.conclusion === 'failure' ? latest : null;
  } catch (_) { return null; }
}
function mergePull(p, sha) {
  try {
    return { result: JSON.parse(run(['api', '-X', 'PUT', `repos/${repo}/pulls/${p.number}/merge`, '-f', 'merge_method=squash', '-f', `sha=${sha}`])), async: false };
  } catch (e) {
    if (!isHttp403(e)) throw e;
    return { result: JSON.parse(run(['api', '-X', 'PUT', `repos/${repo}/pulls/${p.number}/merge-async`, '-f', 'merge_method=squash', '-f', `sha=${sha}`])), async: true };
  }
}
function dispatchFix(number, sha, kind, why) {
  try {
    run(['api', '-X', 'POST', `repos/${repo}/issues/${number}/comments`, '--input', '-'], JSON.stringify({ body: fixNote(sha, kind) }));
    run(['workflow', 'run', 'pr-fix.yml', '--repo', repo, '--ref', 'main', '-f', `pr=${number}`, '-f', `mode=${kind}`, '-f', `why=${safeArg(why)}`]);
    console.log(`#${number}: coder started (${kind})`);
  } catch (e) { console.log(`#${number}: could not start the coder: ${String(e.stderr || e.message).slice(0, 200)}`); }
}
const ageOf = (number, sha, kind) => { try { return fixAge(gh(`repos/${repo}/issues/${number}/comments?per_page=100`) || [], sha, kind); } catch (_) { return null; } };
function startMainFix(hint, sha) {
  const short = String(sha || '').slice(0, 7);
  if (!short) return;
  try { const runs = JSON.parse(run(['run', 'list', '--repo', repo, '--workflow', 'pr-fix.yml', '--limit', '20', '--json', 'displayTitle,status'])); if ((Array.isArray(runs) ? runs : []).some((x) => String(x.displayTitle || '').includes(short))) return; } catch (_) {}
  try { run(['workflow', 'run', 'pr-fix.yml', '--repo', repo, '--ref', 'main', '-f', 'mode=main', '-f', 'pr=', '-f', `why=${safeArg('main ' + short + ' ' + (hint || ''))}`]); console.log('main is red: coder started on loop/main-fix-' + short + ' (pull requests still merge)'); }
  catch (e) { console.log('could not start the main fix: ' + String(e.stderr || e.message).slice(0, 200)); }
}

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
// An older loop/* pull request is closed only when this says the newer one, or main, already has its
// changes (2026-11-09: #2598 closed #2569, and hexen.ai's feature note was on neither). A diff that
// cannot be read keeps the older pull request open.
const compared = new Map();
function compareFiles(sha) {
  if (!sha) return null;
  if (compared.has(sha)) return compared.get(sha);
  const v = gh(`repos/${repo}/compare/main...${sha}`);
  // no files array means the compare could not be read (an error, or a diff too big to list). An empty
  // array is a real answer: the branch adds nothing main lacks.
  if (!v || !Array.isArray(v.files)) { compared.set(sha, null); return null; }
  const files = v.files.map((f) => ({ path: f.filename, patch: f.patch || '', truncated: f.patch == null && f.status !== 'unchanged' }));
  compared.set(sha, files);
  return files;
}
function mainTextOf(path) {
  try { return ex('git', ['show', 'HEAD:' + path]); }
  catch (_) { return ''; }
}
function loopCoverage(old, keep) {
  try {
    const older = compareFiles(old && old.head && old.head.sha);
    const newer = compareFiles(keep && keep.head && keep.head.sha);
    if (!older || !newer) return { ok: false, missing: ['(could not read the diff)'], patch: '' };
    const mainText = {};
    for (const f of older) mainText[f.path] = mainTextOf(f.path);
    return loopCovers(older, newer, mainText);
  } catch (_) { return { ok: false, missing: ['(could not read the diff)'], patch: '' }; }
}
const plan = superseded(prs, loopCoverage);
for (const row of plan.close) {
  const body = '<!-- void-superseded -->\nThis `' + row.ref + '` pull request is superseded by #' + row.keep + ', which is newer and already contains its changes (or main does). Closing it so the same bot work is not merged twice.';
  try {
    run(['api', '-X', 'POST', `repos/${repo}/issues/${row.number}/comments`, '--input', '-'], JSON.stringify({ body }));
    run(['api', '-X', 'PATCH', `repos/${repo}/pulls/${row.number}`, '-f', 'state=closed']);
    console.log('closed #' + row.number + ', superseded by #' + row.keep);
  } catch (e) { console.log('#' + row.number + ': could not close the superseded pull request: ' + String(e.stderr || e.message || e).slice(0, 200)); }
}
const CARRY_MARK = '<!-- void-carry -->';
for (const row of plan.carry) {
  const files = row.missing.length ? row.missing.join(', ') : 'its diff';
  const patch = row.patch ? '\n\n```diff\n' + row.patch.slice(0, 4000) + (row.patch.length > 4000 ? '\n…' : '') + '\n```' : '';
  const body = CARRY_MARK + '\nThis `' + row.ref + '` pull request is older than #' + row.keep + ', but neither #' + row.keep + ' nor main contains its changes (' + files + '). It stays open so that work can still merge. Missing delta:' + patch;
  try {
    const comments = gh(`repos/${repo}/issues/${row.number}/comments?per_page=100`) || [];
    if (!comments.some((c) => String(c.body || '').includes(CARRY_MARK))) {
      run(['api', '-X', 'POST', `repos/${repo}/issues/${row.number}/comments`, '--input', '-'], JSON.stringify({ body }));
    }
    console.log('kept #' + row.number + ' open: #' + row.keep + ' does not contain ' + files);
  } catch (e) { console.log('#' + row.number + ': could not record the missing delta: ' + String(e.stderr || e.message || e).slice(0, 200)); }
}
let merged = 0;
const ready = [];
const closed = new Set(plan.close.map((r) => r.number));
// A sweep reads the oldest pull requests first and stops reading after SWEEP_MS, so it always reaches the suite gate inside
// the job's 15 minute limit (automerge.yml), with time left for the safety-check of the batch. The pull requests it did not read wait for the next sweep. (2026-11-06)
const SWEEP_MS = +(process.env.AUTOMERGE_SWEEP_MS || 200e3), sweepStart = Date.now();
if (!one && Array.isArray(prs)) prs.sort((a, b) => a.number - b.number);
for (let p of prs) {
  if (!one && Date.now() - sweepStart > SWEEP_MS) { console.log(`::notice::stopped the reading at #${p && p.number} after ${Math.round(SWEEP_MS / 1000)} s, so the suite gate runs inside the job's time limit. The next sweep reads the rest.`); break; }
  if (limited) { console.log(`::notice::stopped the sweep at #${p && p.number}: ${limited}. The next wake carries on; nothing failed.`); break; }
  if (!one && budget().left < RATE_FLOOR) { console.log(`::notice::stopped the sweep at #${p && p.number}: under ${RATE_FLOOR} API calls left this hour. The next wake carries on.`); break; }
  if (!p || p.state !== 'open' || closed.has(p.number) || p.draft) { if (p && p.draft) console.log(`#${p.number}: draft, left as a draft`); continue; }
  // every PR from this repository is merged automatically (owner, 2026-10-15: "automerge everything always"): a PR nobody
  // labelled gets the label here, so the rest of the loop (and anyone reading the PR) sees the same thing
  // the retired confidence label (lib/v01d-fixes.js WAITS) is not a person: the checks decide, so it becomes automerge
  if ((p.labels || []).some((l) => l.name === WAITS) && !(p.head.repo && p.head.repo.full_name !== repo)) {
    try {
      run(['api', '-X', 'DELETE', `repos/${repo}/issues/${p.number}/labels/${encodeURIComponent(WAITS)}`]);
      run(['api', '-X', 'POST', `repos/${repo}/issues/${p.number}/labels`, '--input', '-'], JSON.stringify({ labels: [LABEL] }));
      console.log(`#${p.number}: retired label cleared; it merges itself`);
    } catch (e) { console.log(`#${p.number}: could not clear the retired label: ${String(e.stderr || e.message || e).slice(0, 160)}`); }
  }
  if (!(p.labels || []).some((l) => l.name === LABEL) && !(p.head.repo && p.head.repo.full_name !== repo)) {
    try { run(['api', '-X', 'POST', `repos/${repo}/issues/${p.number}/labels`, '--input', '-'], JSON.stringify({ labels: [LABEL] })); console.log(`#${p.number}: labelled ${LABEL} (every PR merges by itself)`); } catch (_) {}
  }
  if (p.head.repo && p.head.repo.full_name !== repo) { console.log(`#${p.number}: from a fork, never merged automatically`); continue; }
  // A ready pull request keeps GitHub auto-merge on. This sweep does not turn it off.
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
  const gateFailure = mergeGateFailure(r.sha);
  if (gateFailure) { console.log(`#${p.number}: merge-gate failed, blocked until it is green (${gateFailure.html_url || gateFailure.id})`); continue; }
  if (r.state === 'resolve') {
    const m = resolveMain(ex, gh, { repo, pr: p.number, branch: r.branch, tools: here });
    console.log(`#${p.number}: ` + (m.state === 'pushed' ? `main merged in and pushed as ${m.sha.slice(0, 7)}; Verse's review started on it` : m.state === 'conflict' ? `conflicts need a person in ${m.files.join(', ')}` + (m.commented ? ' (commented on the PR)' : ' (already said on the PR)') : `could not merge main: ${m.why}`));
    if (m.state === 'conflict' && nextStep({ readiness: 'resolve', age: ageOf(p.number, r.sha, 'conflict') }).action === 'fix') dispatchFix(p.number, r.sha, 'conflict', (m.files || []).join(', '));
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
  if (r.state === 'stop') {
    const step = nextStep({ readiness: 'stop', age: ageOf(p.number, r.sha, 'red') });
    if (step.action === 'fix') { dispatchFix(p.number, r.sha, 'red', r.why); continue; }
    if (step.action !== 'merge') continue;
  } else if (r.state !== 'merge') continue;
  ready.push({ number: p.number, review: r.state, p, r });
}
// Merge now. The suite runs on main afterwards (verify.yml). The block below is the old suite wait; it does not run.
let mainSha = '', choice = null, suiteRun = null, mergeError = '';
if (ready.length && !limited) {
  try { mainSha = gh(`repos/${repo}/commits/main`).sha || ''; } catch (e) { console.log('could not read main: ' + String(e.stderr || e.message || e).slice(0, 160)); }
  let verifyHold = { hold: false, heal: false };
  if (mainSha) {
    try {
      const raw = JSON.parse(run(['run', 'list', '--repo', repo, '--workflow', 'verify.yml', '--branch', 'main', '--limit', '40', '--json', 'headSha,status,conclusion,updatedAt,url']));
      const runs = (Array.isArray(raw) ? raw : []).map((row) => ({ ...row, covers: samePrefix(row.headSha, mainSha) || isAncestor(row.headSha, mainSha), committedAt: Date.parse(row.updatedAt) || 0 }));
      verifyHold = mainVerifyHold(runs, mainSha);
    } catch (e) { console.log('could not read Verse verify: ' + String(e.stderr || e.message || e).slice(0, 160)); }
  }
  if (verifyHold.heal) { console.log('rule: ' + verifyHold.rule); console.log('file: ' + verifyHold.file); console.log('fix: ' + verifyHold.hint); startMainFix(verifyHold.hint, verifyHold.sha || mainSha); }
  else if (mainSha) { try { const issues = gh(`repos/${repo}/issues?state=open&labels=watchdog&per_page=5`) || []; const issue = issues.find((i) => !i.pull_request); if (issue) startMainFix(issue.title || 'watchdog', mainSha); } catch (_) {} }
  for (const row of ready) {
    const p = row.p, r = row.r;
    try {
      const m = mergePull(p, r.sha);
      if (m.result.merged) { merged++; console.log(`merged #${p.number} at ${r.sha.slice(0, 7)}`); await markLive(p); }
      else if (m.async) console.log(`#${p.number}: synchronous merge returned 403; merge-async accepted the stacked PR at ${r.sha.slice(0, 7)}`);
    } catch (e) { const msg = String(e.stderr || e.message).slice(0, 300); if (!merged) mergeError = msg; console.log(`#${p.number}: merge refused: ${msg}`); }
  }
  choice = { action: 'merge', pr: ready[0] };
}
if (false && ready.length && !limited) { // void-review: ok (the old suite wait; verify.yml is the suite)
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
      try { drift = parseLog(ex('git', ['log', '--name-only', '--pretty=format:COMMIT %s%nAUTHOR %an', tested + '..' + mainSha])); } catch (_) { drift = null; }
    }
    // the pull request's own files: a green run still counts past the squash of a pull request that shares none of them
    // (tools/suite-gate.mjs, driftOk). More than 100, or unreadable: unknown, and only the older drift rule applies.
    let files = null;
    if (drift && drift.length) {
      try { const list = gh(`repos/${repo}/pulls/${row.number}/files?per_page=100`); if (Array.isArray(list) && list.length < 100) files = list.flatMap((f) => [f.filename, f.previous_filename].filter(Boolean)); } catch (_) { files = null; }
    }
    rows.push({ ...row, suite, drift, files });
  }
  // the safety-check (asked by Verse): the unit tests of the skills and libs a PR changed, run on its head, before the
  // suite starts or the merge. Only on the pull requests the gate chose: on every ready one, the sweep passed its time limit.
  const safetyOk = (row) => {
    const sc = safety(ex, gh, { repo, pr: row.number, sha: row.r.sha });
    console.log(`#${row.number}: safety-check ${sc.state} (${sc.why})`);
    return sc.state !== 'fail';
  };
  const checked = chooseChecked(rows, mainSha, running, safetyOk);
  choice = checked.choice;
  const pick = choice.pr;
  console.log('suite gate: ' + choice.action + (pick ? ' #' + pick.number : '') + ' (' + choice.why + ')');
  // A green suite-on-main check can pass while main is red: suite-diff ignores a check that is just as red on main
  // alone (2026-11-06). That is how #2574 merged at 21:43 UTC and #2590-#2603 at 22:49 UTC on 2026-11-09, onto a main
  // whose Verse verify had already finished red. The newest finished verify that covers this head blocks the merge.
  let verifyHold = { hold: false };
  if (mainSha) {
    try {
      const raw = JSON.parse(run(['run', 'list', '--repo', repo, '--workflow', 'verify.yml', '--branch', 'main', '--limit', '40', '--json', 'headSha,status,conclusion,updatedAt,url']));
      const runs = (Array.isArray(raw) ? raw : []).map((r) => {
        const covers = samePrefix(r.headSha, mainSha) || isAncestor(r.headSha, mainSha);
        let committedAt = Date.parse(r.updatedAt) || 0;
        if (covers && r.headSha) { try { const t = Number(ex('git', ['log', '-1', '--format=%ct', r.headSha])); if (t) committedAt = t * 1000; } catch (_) {} }
        return { ...r, covers, committedAt };
      });
      verifyHold = mainVerifyHold(runs, mainSha);
    } catch (e) { console.log('could not read Verse verify: ' + String(e.stderr || e.message || e).slice(0, 160)); }
  }
  // #2617 held every merge here. That hold is gone: a red main starts a fix above, and this block does not run.
  if (false) {
    console.log('rule: ' + verifyHold.rule);
    console.log('file: ' + verifyHold.file);
    console.log('fix: ' + verifyHold.hint);
  }
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
        const m = mergePull(p, r.sha);
        if (!m.result.merged) break;
        merged++; done.push(row); console.log(`merged #${p.number} at ${r.sha.slice(0, 7)} (suite green on ${String(mainSha).slice(0, 7)})`); await markLive(p);
      } catch (e) { mergeError = String(e.stderr || e.message).slice(0, 300); console.log(`#${p.number}: merge refused: ${mergeError}`); break; }
    }
    // main moved: start the suite for the next ready pull requests now, not at the next hourly sweep (2026-11-06)
    if (done.length) { if (one) sweepAll('main moved'); else startSuite(nextBatch(checked.rows, done), 'on the new main'); }
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
function isAncestor(sha, head) { if (!sha || !head || samePrefix(sha, head)) return false; try { ex('git', ['merge-base', '--is-ancestor', sha, head]); return true; } catch (_) { return false; } }
if (merged) {
  try { run(['workflow', 'run', 'deploy.yml', '--repo', repo, '--ref', 'main', '-f', 'after_merge=true']); console.log('deploy of main started'); }
  catch (e) { console.log('::warning::merged, but could not start the deploy: ' + String(e.stderr || e.message).slice(0, 300)); }
  // and the suite on that head (verify.yml): it no longer waits for the deploy, and a GITHUB_TOKEN merge starts no push workflow
  try { run(['workflow', 'run', 'verify.yml', '--repo', repo, '--ref', 'main']); console.log('suite on main started'); }
  catch (e) { console.log('::warning::merged, but could not start the suite: ' + String(e.stderr || e.message).slice(0, 300)); }
}
