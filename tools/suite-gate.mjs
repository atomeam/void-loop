// The merge gate (Atom: main is never down again). A pull request merges only after the full browser suite
// has passed on the tree of that pull request merged with current main. One suite run at a time, and one run tests up to
// BATCH ready pull requests merged together (2026-11-06: one 25-minute run per pull request kept 30 waiting for half a day).
// A green batch merges one pull request after another; a red batch is split in half until the red one runs alone, also
// when main moved meanwhile (2026-11-06: main took a hand merge about every 30 minutes, so a red batch of 8 went back
// whole on each new main and never split, and the bot merged nothing). A suite
// that passed against an older main still counts when every commit since then only writes the incident
// record, a bot record, the squash of a pull request in the same run, or the squash of another pull request that shares no
// file with this one and leaves the suite's own harness alone (2026-11-06: 8 pull requests landed on main during one
// 45-minute green run, so the run never counted and the bot merged nothing). A red main is reverted by verify.yml, which files
// one heal job for the commit it took back.
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
    if (t === 'COMMIT' || t.startsWith('COMMIT ')) { // "COMMIT <subject>" with --pretty=format:'COMMIT %s%nAUTHOR %an'
      if (cur) commits.push(cur);
      cur = [];
      if (t.length > 7) cur.subject = t.slice(7).trim();
      continue;
    }
    if (cur && !cur.length && cur.author === undefined && t.startsWith('AUTHOR ')) { cur.author = t.slice(7).trim(); continue; }
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

/** the bot that writes Verse's records straight to main (tower evidence, site tests, exams, findings, treasury). */
export const RECORD_BOT = 'github-actions[bot]';
const DATA = /\.(json|jsonl|md|txt|log|csv|xml|png|jpe?g|webp|gif|ico)$/i; // records and the screenshots and icons they cite
const NOT_DATA = /^(\.github\/|void-live-deploy\/(lib|skills)\/)|(^|\/)(package(-lock)?\.json|wrangler\.(json|jsonc|toml))$/;

/** a commit the record bot wrote straight to main that only changes data files (no code, page, workflow or skill file),
 * and that is not the squash of a pull request. About 7 land an hour (2026-11-06: 127 of 173 bot commits in a day), and a
 * suite run takes about 30 minutes, so without this a green run almost never found main unmoved. Pure. */
export function botRecord(files) {
  if (!files || files.author !== RECORD_BOT || squashOf(files.subject) || !files.length) return false;
  return files.every((f) => DATA.test(String(f)) && !NOT_DATA.test(String(f)));
}

// the files that make the suite itself: the two workflows that run it and the void-test action, the browser suites, the checks the action runs
// first, and the dependencies. A pull request that changes one of them changes what "the suite passed" means.
const HARNESS = /^(\.github\/actions\/|\.github\/workflows\/(suite-gate|verify)\.yml$|tools\/(test_void|test_sky|guard-source|fringe|suite-diff|suite-gate)\.mjs$)|(^|\/)(package(-lock)?\.json|wrangler\.(json|jsonc|toml))$/;
export const MAX_FOREIGN = 40; // squashes of other pull requests a green run may look past (2026-11-06: 14 landed in the hour of one run)

/** the squash of a pull request outside the batch that shares no file with this pull request (own: its changed files) and
 * leaves the suite harness alone. Unknown files on either side: false. Pure. */
export function foreignSquash(files, own) {
  if (!files || !squashOf(files.subject) || !files.length || !Array.isArray(own) || !own.length) return false;
  const mine = new Set(own.map(String));
  return files.every((f) => !mine.has(String(f)) && !HARNESS.test(String(f)));
}

/** every commit since the tested main only writes the incident record or another bot record, is the squash of a pull
 * request in the same batch, or (own given: the pull request's changed files) the squash of an unrelated pull request, at most
 * MAX_FOREIGN of those. verify.yml still runs the whole suite on main after the merge and reverts a commit that breaks it. Pure. */
export function driftOk(commits, batch, own) {
  if (!Array.isArray(commits)) return false;
  const mates = new Set(batch || []);
  const incident = (files) => (files || []).every((f) => String(f).startsWith('void-live-deploy/incidents/'));
  let foreign = 0;
  return commits.every((files) => {
    if (incident(files) || botRecord(files) || (mates.size > 0 && mates.has(squashOf(files && files.subject)))) return true;
    return foreignSquash(files, own) && ++foreign <= MAX_FOREIGN;
  });
}

/** the suite passed, and either it merged this main, or only the drift driftOk allows landed since (row.files: the pull
 * request's changed files, or null when unknown). Pure. */
export function mayMerge(row, mainSha) {
  const suite = row && row.suite;
  if (!suite || suite.name !== CHECK || suite.status !== 'completed' || suite.conclusion !== 'success') return false;
  const tested = recordedMain(suite);
  if (!tested) return false;
  if (sameSha(tested, mainSha)) return true;
  return driftOk(row.drift, batchOf(suite), row.files);
}

/** the newest suite run on this head finished red, against any main (the check sits on the head, so a new push clears it). Pure. */
function redBefore(row) {
  const suite = row && row.suite;
  if (!suite || suite.status !== 'completed' || suite.conclusion === 'success' || suite.conclusion === 'skipped' || suite.conclusion === 'cancelled') return false;
  return !!recordedMain(suite);
}

/** a finished failure of the suite against this same main (so far: true when the head or main has not moved). Pure. */
function redHere(row, mainSha) {
  return redBefore(row) && (sameSha(recordedMain(row.suite), mainSha) || codeUnchanged(row.drift));
}

/** red alone last time, on an older main: tried again, but after every pull request that has not failed alone. Pure. */
function redAlone(row) {
  return redBefore(row) && batchOf(row.suite).length <= 1;
}

/** the pull request failed the suite alone on this main: do not queue it again until the head or main moves. A red batch of
 * several is not this: the batch is split (batchSize), so one red pull request does not hold the others. Pure. */
export function failedHere(row, mainSha) {
  return redHere(row, mainSha) && batchOf(row.suite).length <= 1;
}

/** how many pull requests the next suite run takes: half of the red batch the first one was in (on any main: the same heads
 * went red together, and a smaller run only costs time), 1 after a red run alone, else BATCH. Pure. */
export function batchSize(row, mainSha) {
  const k = redBefore(row) ? Math.max(1, batchOf(row.suite).length) : 0;
  return k ? Math.ceil(k / 2) : BATCH;
}

/**
 * one action. rows: [{ number, review: 'merge', suite, drift }]. running: a suite is already in progress.
 * -> { pr, batch, action: 'merge'|'queue'|'wait'|'hold', why }. pr is the first of batch. merge: batch is the pull
 * requests the same green run tested, merged in this order. queue: batch is the pull requests the next run tests together.
 */
export function choose(rows, mainSha, running) {
  const ready = (rows || []).filter((r) => r && r.review === 'merge').slice().sort((a, b) => a.number - b.number);
  const open = ready.filter((r) => !failedHere(r, mainSha)).sort((a, b) => redAlone(a) - redAlone(b) || a.number - b.number);
  const fresh = open.find((r) => mayMerge(r, mainSha));
  if (fresh) {
    const run = batchOf(fresh.suite), title = recordedMain(fresh.suite);
    const mates = open.filter((r) => r !== fresh && run.includes(r.number) && recordedMain(r.suite) === title && mayMerge(r, mainSha));
    const batch = [fresh, ...mates];
    return { pr: fresh, batch, action: 'merge', why: 'the full suite passed on top of main ' + String(mainSha || '').slice(0, 7) + (batch.length > 1 ? ` (${batch.length} pull requests in one run)` : '') };
  }
  if (!open.length) return { pr: ready[0] || null, batch: [], action: 'hold', why: ready.length ? 'the ready pull requests failed the suite on this main' : 'no pull request has a green review' };
  if (running) return { pr: open[0], batch: [open[0]], action: 'wait', why: 'one suite is already running; the next pull request waits' };
  const pool = redAlone(open[0]) ? open : open.filter((r) => !redAlone(r)); // one that went red alone never rides in a batch
  const batch = pool.slice(0, batchSize(open[0], mainSha));
  return { pr: open[0], batch, action: 'queue', why: 'the full suite has not passed on top of current main' + (batch.length > 1 ? ` (one run for ${batch.length} pull requests)` : '') };
}

// The safety-check (tools/skill-safety.mjs) runs node --test on a pull request's head: seconds each, so a sweep that ran it
// on every ready pull request passed the 5 minute job limit and never reached the suite gate (2026-11-06, no gate run from
// 08:57 on). It runs here on the batch the gate chose only. A pull request that fails it leaves the rows, and the gate
// chooses again from the rest. check(row) returns true when the row may go on.
export function chooseChecked(rows, mainSha, running, check) {
  let left = (rows || []).slice();
  const passed = new Set();
  for (let round = 0; round <= (rows || []).length; round++) {
    const choice = choose(left, mainSha, running);
    const todo = choice.action === 'merge' || choice.action === 'queue' ? (choice.batch && choice.batch.length ? choice.batch : [choice.pr]).filter(Boolean) : [];
    const failed = todo.filter((r) => !passed.has(r) && !(check(r) && passed.add(r)));
    if (!failed.length) return { choice, rows: left };
    left = left.filter((r) => !failed.includes(r));
  }
  return { choice: choose(left, mainSha, running), rows: left };
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
