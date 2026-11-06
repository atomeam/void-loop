// The merge gate (Atom: main is never down again). A pull request merges only after the full browser suite
// has passed on the tree of that pull request merged with current main. One pull request at a time. A suite
// that passed against an older main still counts when every commit since then only writes the incident
// record. A red main is reverted by verify.yml, which files one heal job for the commit it took back.
//   node tools/suite-gate.mjs queue <sha> "<why>"   file that heal job (VOID_OWNER_TOKEN; dry without it)
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const CHECK = 'suite-on-main';
const SITE = process.env.VOID_SITE || 'https://a-to-mind.com';

/** the main SHA a suite-on-main check names in its title ("main:<sha>"), or ''. Pure. */
export function recordedMain(check) {
  const title = check && check.output && check.output.title || '';
  const m = /^main:([0-9a-f]{7,40})$/i.exec(String(title).trim());
  return m ? m[1].toLowerCase() : '';
}

const sameSha = (a, b) => {
  const x = String(a || '').toLowerCase(), y = String(b || '').toLowerCase();
  return !!(x && y && (x === y || x.startsWith(y) || y.startsWith(x)));
};

/** git log --name-only --pretty=format:COMMIT -> [files per commit]. Pure. */
export function parseLog(text) {
  const commits = [];
  let cur = null;
  for (const line of String(text || '').split('\n')) {
    if (line.trim() === 'COMMIT') { if (cur) commits.push(cur); cur = []; continue; }
    if (cur && line.trim()) cur.push(line.trim());
  }
  if (cur) commits.push(cur);
  return commits;
}

/** true when every commit since the tested main only touches the incident record. Pure. */
export function codeUnchanged(commits) {
  if (!Array.isArray(commits)) return false;
  return commits.every((files) => (files || []).every((f) => String(f).startsWith('void-live-deploy/incidents/')));
}

/** the suite passed, and either it merged this main or only incident commits landed since. Pure. */
export function mayMerge(row, mainSha) {
  const suite = row && row.suite;
  if (!suite || suite.name !== CHECK || suite.status !== 'completed' || suite.conclusion !== 'success') return false;
  const tested = recordedMain(suite);
  if (!tested) return false;
  if (sameSha(tested, mainSha)) return true;
  return codeUnchanged(row.drift);
}

/** a finished failure of the suite against this same main: do not queue it again until the head or main moves. Pure. */
export function failedHere(row, mainSha) {
  const suite = row && row.suite;
  if (!suite || suite.status !== 'completed' || suite.conclusion === 'success' || suite.conclusion === 'skipped' || suite.conclusion === 'cancelled') return false;
  const tested = recordedMain(suite);
  if (!tested) return false;
  return sameSha(tested, mainSha) || codeUnchanged(row.drift);
}

/**
 * one pull request, one action. rows: [{ number, review: 'merge', suite, drift }].
 * running: a suite is already in progress. -> { pr, action: 'merge'|'queue'|'wait'|'hold', why }
 */
export function choose(rows, mainSha, running) {
  const ready = (rows || []).filter((r) => r && r.review === 'merge').slice().sort((a, b) => a.number - b.number);
  const open = ready.filter((r) => !failedHere(r, mainSha));
  const fresh = open.find((r) => mayMerge(r, mainSha));
  if (fresh) return { pr: fresh, action: 'merge', why: 'the full suite passed on top of main ' + String(mainSha || '').slice(0, 7) };
  if (!open.length) return { pr: ready[0] || null, action: 'hold', why: ready.length ? 'the ready pull requests failed the suite on this main' : 'no pull request has a green review' };
  if (running) return { pr: open[0], action: 'wait', why: 'one suite is already running; the next pull request waits' };
  return { pr: open[0], action: 'queue', why: 'the full suite has not passed on top of current main' };
}

/**
 * after a merge, the next pull request to send to the suite (2026-11-06: the next one waited for the hourly sweep, so 30 sat open).
 * Main just moved, so no other suite result counts on it: the oldest other ready pull request goes next. Pure.
 */
export function nextAfterMerge(rows, merged) {
  const n = merged && merged.number;
  return (rows || []).filter((r) => r && r.review === 'merge' && r.number !== n).sort((a, b) => a.number - b.number)[0] || null;
}

/** the heal job filed when a commit is reverted off main. Pure. */
export function fixJob(sha, why) {
  const id = String(sha || '').replace(/[^0-9a-f]/gi, '').slice(0, 7) || 'unknown';
  const reason = String(why || 'the browser suite failed').replace(/\s+/g, ' ').trim().slice(0, 160);
  return {
    target: ('heal:suite-' + id).slice(0, 40),
    ask: ('Main went red after ' + id + ' (' + reason + '). Fix those checks at their root. Do not skip a check.').slice(0, 300),
  };
}

async function queue(sha, why) {
  const job = fixJob(sha, why);
  const tok = process.env.VOID_OWNER_TOKEN;
  if (!tok) { console.log('would queue (no VOID_OWNER_TOKEN here) ' + job.target + ': ' + job.ask); return 0; }
  const res = await fetch(SITE + '/api/queue', {
    method: 'POST',
    headers: { authorization: 'Bearer ' + tok, 'content-type': 'application/json', 'user-agent': 'a2m-suite-gate/1.0' },
    body: JSON.stringify(job),
  }); // void-review: ok (one heal job for the commit verify.yml just reverted; the queue keeps one open job per target)
  console.log(res.ok ? 'queued ' + job.target : 'could not queue ' + job.target + ': HTTP ' + res.status);
  return res.ok ? 0 : 1;
}

async function main(argv) {
  const [cmd, sha, ...rest] = argv.slice(2);
  if (cmd === 'queue') return queue(sha, rest.join(' '));
  console.error('usage: node tools/suite-gate.mjs queue <sha> "<why>"');
  return 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exit(await main(process.argv));
