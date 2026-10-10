// Which commit verify-main should revert when the full suite goes red on main (deploy.yml).
// Reverting the commit that was just tested is wrong when the failing check was already red before it: on 2026-10-09
// #215 broke the rack check, its revert conflicted, and the next red run reverted #217, which had nothing to do with it.
// So each red run names its failing checks as annotations, and the next red run walks back along main's first parents
// to the commit where each failing check first went red. When the record is unclear, it reports instead of guessing.
// Since every merge gets its own verify run (deploy.yml, one concurrency group per head), two red suites can finish at the
// same time, so before a revert the tool checks the target is still live on main (on its first-parent line and not already
// reverted) and that the failed checks are still red on main's newest verified head; otherwise it reports.
//   node tools/revert-target.mjs --annotate test-output.txt      prints the ::error annotations naming the failed checks
//   node tools/revert-target.mjs --pick <sha> test-output.txt    prints {"action":"revert"|"report","sha","why"} as JSON
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const TITLE = 'verify-main failed check';
export const COUNT_TITLE = 'verify-main failed checks';
const MAX_NAMES = 9; // GitHub keeps 10 error annotations per step: up to 9 names plus the count
const NAME_LEN = 160;

/** The names of the failed checks in test_void.mjs output ("FAIL <name>  -> <got>"). Pure. */
export function failingChecks(text) {
  const out = [];
  for (const line of String(text || '').split(/\r?\n/)) {
    const m = /^FAIL (.+?)(?:\s{2}->.*)?$/.exec(line);
    if (m) out.push(m[1].trim().slice(0, NAME_LEN));
  }
  return [...new Set(out)];
}

const esc = (s) => String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A');
/** The workflow command lines that record the failed checks on this job. Pure. */
export function annotations(names) {
  const lines = names.slice(0, MAX_NAMES).map((n) => '::error title=' + TITLE + '::' + esc(n));
  lines.push('::error title=' + COUNT_TITLE + '::' + names.length);
  return lines;
}

/** A job's annotations back to { names, complete }: complete when every failed check was named. Pure. */
export function namesFrom(annos) {
  const names = annos.filter((a) => a.title === TITLE).map((a) => a.message);
  const count = annos.find((a) => a.title === COUNT_TITLE);
  return { names, complete: !!count && Number(count.message) === names.length };
}

/**
 * Pick what to revert. Pure.
 *   tested:  the commit verify-main just tested and found red
 *   failing: the names of its failed checks ([] when the failure was outside the named browser checks)
 *   history: main's earlier commits along first parents, newest first, each
 *            { sha, state: 'pass' | 'fail' | 'unknown', failing: string[] | null }
 *            (unknown = never verified: superseded, cancelled, an auto-revert; failing null = red, names not recorded)
 * For each failed check, walk back: unknown commits stay suspects, a pass ends the walk (the check went red after it),
 * a red commit that also failed this check moves the blame to it, a red commit with other failures ends the walk.
 */
export function pickRevert({ tested, failing, history }) {
  const checks = failing.length ? failing : [null]; // null: an unnamed failure, matched only by an unnamed one
  const verdicts = checks.map((check) => {
    let suspects = [tested];
    for (const h of history) {
      if (h.state === 'unknown') { suspects.push(h.sha); continue; }
      if (h.state === 'pass') return { check, suspects };
      if (!h.failing) return { check, unclear: h.sha + ' was red before it too, and its failed checks were not recorded' };
      const already = check === null ? h.failing.length === 0 : h.failing.includes(check);
      if (!already) return { check, suspects };
      suspects = [h.sha];
    }
    return { check, unclear: 'no verified commit on main before ' + suspects[suspects.length - 1] };
  });
  const label = (v) => (v.check === null ? 'the suite (outside the named checks)' : '"' + v.check + '"');
  // a check that went red exactly at the tested commit: the tested commit broke it
  const fresh = verdicts.find((v) => v.suspects && v.suspects.length === 1 && v.suspects[0] === tested);
  if (fresh) return { action: 'revert', sha: tested, why: label(fresh) + ' went red at this commit' };
  const unclear = verdicts.find((v) => v.unclear);
  if (unclear) return { action: 'report', why: label(unclear) + ': ' + unclear.unclear };
  const many = verdicts.find((v) => v.suspects.length > 1);
  if (many) return { action: 'report', why: label(many) + ' went red somewhere in ' + many.suspects.join(', ') + ' (the ones in between were never verified)' };
  const shas = [...new Set(verdicts.map((v) => v.suspects[0]))];
  if (shas.length > 1) return { action: 'report', why: 'the failed checks went red at different commits: ' + verdicts.map((v) => label(v) + ' at ' + v.suspects[0]).join('; ') };
  return { action: 'revert', sha: shas[0], why: verdicts.map(label).join(', ') + ' already failed at ' + shas[0] + ', where it first went red; ' + tested + ' did not break it' };
}

/**
 * Is the revert target still live on main? Pure.
 *   target: the sha to revert; mainLine: main's first-parent shas, newest first; body(sha): the commit message
 *   -> { live: true } | { live: false, why }   (gone from main's line, or a newer commit carries Void-auto-revert: <target>)
 */
export function stillLive(target, mainLine, body) {
  if (!mainLine.includes(target)) return { live: false, why: target + ' is not on main\'s first-parent line any more' };
  for (const s of mainLine) {
    if (s === target) break;
    const m = /^Void-auto-revert:\s*(\S+)/m.exec(body(s) || '');
    if (m && (m[1] === target || target.startsWith(m[1]) || m[1].startsWith(target))) return { live: false, why: target + ' is already reverted on main (' + s.slice(0, 7) + ')' };
  }
  return { live: true };
}

/**
 * Are the failed checks still red on main's newest verified head? Pure.
 *   checks: the tested run's failed checks ([] = outside the named checks); latest: verifiedState of main's newest head
 *   with a finished suite (null = none newer than the tested run, whose word then stands)
 *   -> { red: true } | { red: false, why }
 */
export function stillRed(checks, latest) {
  if (!latest || latest.state === 'unknown') return { red: true };
  if (latest.state === 'pass') return { red: false, why: 'main\'s newest verified head ' + latest.sha.slice(0, 7) + ' passed the suite' };
  if (!latest.failing) return { red: true }; // red, names not recorded: nothing says it healed
  const still = (checks.length ? checks : [null]).every((c) => (c === null ? latest.failing.length === 0 : latest.failing.includes(c)));
  return still ? { red: true } : { red: false, why: 'main\'s newest verified head ' + latest.sha.slice(0, 7) + ' no longer fails ' + (checks.length ? checks.map((c) => '"' + c + '"').join(', ') : 'the suite the same way') };
}

const run = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'] });
const gh = (path) => JSON.parse(run('gh', ['api', path]));

/** What verify-main found on one commit of main, from the deploy runs of that commit. */
export function verifiedState(sha, repo, api = gh, body = (s) => run('git', ['log', '-1', '--format=%B', s])) {
  if (/^Void-auto-revert:/m.test(body(sha))) return { sha, state: 'unknown', failing: null }; // reverts are not re-tested
  const runs = (api('repos/' + repo + '/actions/runs?head_sha=' + sha + '&per_page=20').workflow_runs || [])
    .filter((r) => r.name === 'Void deploy' && r.event !== 'pull_request');
  for (const r of runs) {
    const job = (api('repos/' + repo + '/actions/runs/' + r.id + '/jobs').jobs || []).find((j) => j.name === 'verify-main');
    if (!job || job.status !== 'completed') continue;
    if (job.conclusion === 'success') return { sha, state: 'pass', failing: [] };
    if (job.conclusion === 'failure') {
      const { names, complete } = namesFrom(api('repos/' + repo + '/check-runs/' + job.id + '/annotations?per_page=50'));
      return { sha, state: 'fail', failing: complete ? names : null };
    }
  }
  return { sha, state: 'unknown', failing: null };
}

/** main's earlier commits along first parents, newest first, with what verify-main found on each. */
export function historyOf(tested, repo, depth = 15, api = gh) {
  const shas = run('git', ['rev-list', '--first-parent', '--max-count=' + (depth + 1), tested]).trim().split('\n').slice(1);
  return shas.map((s) => verifiedState(s, repo, api));
}

/** main's newest head with a finished suite (pass or fail), walking first parents from origin/main; null when none */
export function newestVerified(repo, mainLine, api = gh, body) {
  for (const s of mainLine) { const v = verifiedState(s, repo, api, body); if (v.state !== 'unknown') return v; }
  return null;
}

/** the pick, then the two liveness checks against main as it is now (fetched); a target that is not live is reported */
export function pickLive({ tested, failing, history, mainLine, body, repo, api = gh }) {
  const pick = pickRevert({ tested, failing, history });
  if (pick.action !== 'revert') return pick;
  const live = stillLive(pick.sha, mainLine, body);
  if (!live.live) return { action: 'report', sha: pick.sha, why: pick.why + '; but ' + live.why };
  const red = stillRed(failing, newestVerified(repo, mainLine, api, body));
  if (!red.red) return { action: 'report', sha: pick.sha, why: pick.why + '; but ' + red.why };
  return pick;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [mode, a, b] = process.argv.slice(2);
  if (mode === '--annotate') { for (const l of annotations(failingChecks(readFileSync(a, 'utf8')))) console.log(l); }
  else if (mode === '--pick') {
    const repo = process.env.GITHUB_REPOSITORY || 'atomeam/void-loop';
    const tested = run('git', ['rev-parse', a]).trim();
    try { run('git', ['fetch', '-q', 'origin', 'main']); } catch (_) {}
    const mainLine = run('git', ['rev-list', '--first-parent', '--max-count=60', 'origin/main']).trim().split('\n').filter(Boolean);
    const body = (s) => run('git', ['log', '-1', '--format=%B', s]);
    console.log(JSON.stringify(pickLive({ tested, failing: failingChecks(readFileSync(b, 'utf8')), history: historyOf(tested, repo), mainLine, body, repo })));
  } else { console.error('usage: node tools/revert-target.mjs --annotate <test-output> | --pick <sha> <test-output>'); process.exit(2); }
}
