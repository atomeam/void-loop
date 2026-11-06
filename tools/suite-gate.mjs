// The merge gate (Atom: main is never down again). A pull request merges only after the full browser suite
// has passed on the tree of that pull request merged with current main. One suite run at a time, and one run tests up to
// BATCH ready pull requests merged together (2026-11-06: one 25-minute run per pull request kept 30 waiting for half a day).
// A green batch merges one pull request after another; a red batch is split in half until the red one runs alone. A suite
// that passed against an older main still counts when every commit since then only writes the incident
// record. A red main is reverted by verify.yml, which files one heal job for the commit it took back.
//   node tools/suite-gate.mjs queue <sha> "<why>"   file that heal job (VOID_OWNER_TOKEN; dry without it)
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const CHECK = 'suite-on-main';
export const BATCH = 8; // pull requests one suite run tests together
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
    const t = line.trim();
    if (t === 'COMMIT' || t.startsWith('COMMIT ')) { // "COMMIT <subject>" with --pretty=format:'COMMIT %s'
      if (cur) commits.push(cur);
      cur = [];
      if (t.length > 7) cur.subject = t.slice(7).trim();
      continue;
    }
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

/** the pull requests one suite run tested together, from the line "batch: #1 #2" in its summary, or []. Pure. */
export function batchOf(check) {
  const out = check && check.output || {};
  const m = /^batch:(.*)$/im.exec(String(out.summary || '') + '\n' + String(out.text || ''));
  if (!m) return [];
  return (m[1].match(/\d+/g) || []).map(Number).filter((n) => n > 0);
}

/** the pull request a squash commit on main came from (GitHub ends its subject with "(#123)"), or 0. Pure. */
export function squashOf(subject) {
  const m = /\(#(\d+)\)\s*$/.exec(String(subject || ''));
  return m ? Number(m[1]) : 0;
}

/** every commit since the tested main only writes the incident record, or is the squash of a pull request in the same batch. Pure. */
export function driftOk(commits, batch) {
  if (!Array.isArray(commits)) return false;
  const mates = new Set(batch || []);
  const incident = (files) => (files || []).every((f) => String(f).startsWith('void-live-deploy/incidents/'));
  return commits.every((files) => incident(files) || (mates.size > 0 && mates.has(squashOf(files && files.subject))));
}

/** the suite passed, and either it merged this main, or only incident commits and squashes of its own batch landed since. Pure. */
export function mayMerge(row, mainSha) {
  const suite = row && row.suite;
  if (!suite || suite.name !== CHECK || suite.status !== 'completed' || suite.conclusion !== 'success') return false;
  const tested = recordedMain(suite);
  if (!tested) return false;
  if (sameSha(tested, mainSha)) return true;
  return driftOk(row.drift, batchOf(suite));
}

/** a finished failure of the suite against this same main (so far: true when the head or main has not moved). Pure. */
function redHere(row, mainSha) {
  const suite = row && row.suite;
  if (!suite || suite.status !== 'completed' || suite.conclusion === 'success' || suite.conclusion === 'skipped' || suite.conclusion === 'cancelled') return false;
  const tested = recordedMain(suite);
  if (!tested) return false;
  return sameSha(tested, mainSha) || codeUnchanged(row.drift);
}

/** the pull request failed the suite alone on this main: do not queue it again until the head or main moves. A red batch of
 * several is not this: the batch is split (batchSize), so one red pull request does not hold the others. Pure. */
export function failedHere(row, mainSha) {
  return redHere(row, mainSha) && batchOf(row.suite).length <= 1;
}

/** how many pull requests the next suite run takes: half of the red batch the first one was in on this main, else BATCH. Pure. */
export function batchSize(row, mainSha) {
  const k = redHere(row, mainSha) ? batchOf(row.suite).length : 0;
  return k > 1 ? Math.ceil(k / 2) : BATCH;
}

/**
 * one action. rows: [{ number, review: 'merge', suite, drift }]. running: a suite is already in progress.
 * -> { pr, batch, action: 'merge'|'queue'|'wait'|'hold', why }. pr is the first of batch. merge: batch is the pull
 * requests the same green run tested, merged in this order. queue: batch is the pull requests the next run tests together.
 */
export function choose(rows, mainSha, running) {
  const ready = (rows || []).filter((r) => r && r.review === 'merge').slice().sort((a, b) => a.number - b.number);
  const open = ready.filter((r) => !failedHere(r, mainSha));
  const fresh = open.find((r) => mayMerge(r, mainSha));
  if (fresh) {
    const run = batchOf(fresh.suite), title = recordedMain(fresh.suite);
    const mates = open.filter((r) => r !== fresh && run.includes(r.number) && recordedMain(r.suite) === title && mayMerge(r, mainSha));
    const batch = [fresh, ...mates];
    return { pr: fresh, batch, action: 'merge', why: 'the full suite passed on top of main ' + String(mainSha || '').slice(0, 7) + (batch.length > 1 ? ` (${batch.length} pull requests in one run)` : '') };
  }
  if (!open.length) return { pr: ready[0] || null, batch: [], action: 'hold', why: ready.length ? 'the ready pull requests failed the suite on this main' : 'no pull request has a green review' };
  if (running) return { pr: open[0], batch: [open[0]], action: 'wait', why: 'one suite is already running; the next pull request waits' };
  const batch = open.slice(0, batchSize(open[0], mainSha));
  return { pr: open[0], batch, action: 'queue', why: 'the full suite has not passed on top of current main' + (batch.length > 1 ? ` (one run for ${batch.length} pull requests)` : '') };
}

/**
 * after a merge, the next pull request to send to the suite (2026-11-06: the next one waited for the hourly sweep, so 30 sat open).
 * Main just moved, so no other suite result counts on it: the oldest other ready pull request goes next. Pure.
 */
export function nextAfterMerge(rows, merged) {
  return nextBatch(rows, merged)[0] || null;
}

/** after a merge, the next suite run: up to BATCH of the other ready pull requests, oldest first. merged: a row, or a list
 * of rows or numbers. Pure. */
export function nextBatch(rows, merged) {
  const done = new Set((Array.isArray(merged) ? merged : [merged]).map((m) => (m && typeof m === 'object' ? m.number : m)));
  return (rows || []).filter((r) => r && r.review === 'merge' && !done.has(r.number)).sort((a, b) => a.number - b.number).slice(0, BATCH);
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
