// The developer-log card, checked against what is real (owner, 2026-10-19: the card only echoed the pasted words back, "these arent answering or
// helping anything"). For each pull request and commit a pasted report names, GitHub's public API says what actually happened: merged, open or
// closed, and how the checks on a commit ended. Main's newest commit and its checks come first, because "is it live and green?" is the question
// behind every report. Read-only, no key: GitHub's unauthenticated API (60 calls an hour per visitor), at most 11 calls a card.
//   prLine(pr), checksLine(sha, runs), mainLine(commit, runs) are pure; liveLines(t, fetch) does the calls.
export const REPO = 'atomeam/void-loop';
const API = 'https://api.github.com/repos/' + REPO;
const SUITE = /deploy|verify|browser-suite|python-tests/i; // the checks that say whether main is live and green
const short = (s) => String(s || '').slice(0, 8);
const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; };
const clip = (s, n) => { const x = String(s || '').replace(/\s+/g, ' ').trim(); void n; return x; }; // whole text (owner, 2026-10-21)

/** one line for a pull request from GitHub's pulls API. Pure. */
export function prLine(pr) {
  if (!pr || !pr.number) return null;
  const state = pr.merged_at ? 'merged ' + when(pr.merged_at) : pr.state === 'open' ? (pr.draft ? 'open, draft' : 'open, waiting to merge') : 'closed without merging';
  return { text: '#' + pr.number + ' ' + state + ': ' + clip(pr.title, 70), ok: !!pr.merged_at, open: pr.state === 'open' };
}

/** how a commit's checks ended, from the check-runs API: { text, failed: [names], pending }. Pure. */
export function checksOf(runs) {
  const list = runs && Array.isArray(runs.check_runs) ? runs.check_runs : [];
  const latest = new Map(); for (const r of list) { const k = r.name; if (!latest.has(k) || String(r.started_at) > String(latest.get(k).started_at)) latest.set(k, r); }
  const all = [...latest.values()];
  const failed = all.filter((r) => r.status === 'completed' && /^(?:failure|timed_out)$/.test(r.conclusion)).map((r) => r.name);
  const pending = all.filter((r) => r.status !== 'completed').map((r) => r.name);
  const passed = all.filter((r) => r.status === 'completed' && r.conclusion === 'success').length;
  const text = !all.length ? 'no checks reported' : passed + ' passed' + (failed.length ? ' · ' + failed.length + ' failed (' + failed.slice(0, 3).join(', ') + ')' : '') + (pending.length ? ' · ' + pending.length + ' still running' : '');
  return { text, failed, pending, total: all.length };
}
/** true when every check passed, false when one failed, null while some still run or none ran (the card marks it neither way). Pure. */
export const okOf = (c) => (c.failed.length ? false : c.pending.length || !c.total ? null : true);
export const checksLine = (sha, runs) => { const c = checksOf(runs); return { text: short(sha) + ': ' + c.text, ok: okOf(c), failed: c.failed }; };

/** main's newest commit and its checks. Pure. */
export function mainLine(commit, runs) {
  if (!commit || !commit.sha) return null;
  const c = checksOf(runs), msg = commit.commit && commit.commit.message ? commit.commit.message.split('\n')[0] : '';
  return { text: 'main is at ' + short(commit.sha) + ' (' + when(commit.commit && commit.commit.committer && commit.commit.committer.date) + ', ' + clip(msg, 60) + '): ' + c.text + botNote(commit, runs), ok: okOf(c), failed: c.failed };
}
/** why a commit of Verse's own shows no deploy or suite (owner, 2026-10-19: the card read "no checks reported" on one of Verse's commits with no
 *  reason given): a push by the Actions token starts no workflow by itself, so its deploy is started by the workflow that pushed it. '' for a
 *  person's commit, or when a deploy or suite check is there. Pure. */
export function botNote(commit, runs) {
  const who = String((commit && commit.author && commit.author.login) || (commit && commit.commit && commit.commit.author && commit.commit.author.name) || '');
  const names = (runs && Array.isArray(runs.check_runs) ? runs.check_runs : []).map((r) => r && r.name);
  if (!/^github-actions(?:\[bot\])?$/.test(who) || names.some((n) => SUITE.test(String(n)))) return '';
  return ' (a commit by Verse\'s own workflow: its push starts no check by itself, the deploy it starts runs on main)';
}

// Verse's own record commits: incident notes, benchmark asks, the money plan, regenerated cards. They run no deploy or suite, so the card reads
// past them to the newest change that did (owner, 2026-10-19: the card showed "no checks reported" on an incident note while the merge under it
// had failed its browser suite; four notes in a row had hidden it)
const RECORD = /^(?:Incident: |Verse hardens itself|Better at |Sharper card art|reinvest: |Regenerate )/; // grow-self's commits open "Better at" since 2026-10-24
const first = (c) => String((c && c.commit && c.commit.message) || '').split('\n')[0];
export const isRecord = (c) => RECORD.test(first(c));
/** the incident notes about one commit among the records above it: { count, last } or null. sha may be the full sha; the note names a short one. Pure. */
export function incidentOf(records, sha) {
  const hits = (records || []).filter((c) => { const m = /^Incident: the browser suite failed on ([0-9a-f]{7,40})\b/.exec(first(c)); return m && String(sha || '').startsWith(m[1]); });
  return hits.length ? { count: hits.length, last: hits.map((c) => String(c.commit && c.commit.committer && c.commit.committer.date || '')).sort().pop() } : null;
}
/** one line for the records above main's change: what they are and that they run no checks. Pure. */
export function recordsLine(records) {
  if (!records || !records.length) return null;
  const kinds = new Map();
  for (const c of records) { const k = /^Incident/.test(first(c)) ? 'incident note' : /^Verse hardens/.test(first(c)) ? 'benchmark update' : /^reinvest/.test(first(c)) ? 'money plan' : 'regenerated card'; kinds.set(k, (kinds.get(k) || 0) + 1); }
  const parts = [...kinds].map(([k, n]) => n + ' ' + k + (n === 1 ? '' : 's'));
  return { text: (records.length === 1 ? 'The newest commit is' : 'The ' + records.length + ' newest commits are') + ' Verse\'s own records (' + parts.join(', ') + '): they run no checks, so main\'s state is the change below them', ok: null };
}

// the newest suite that finished on main (owner, 2026-10-30: the card read "0 passed · 9 still running" for main's head and nothing else, while
// four heads below it had passed every shard; the queue runs hours behind, so the head is often still waiting). A run's own conclusion is no guide:
// its incident job is cancelled by the next run, so a green run reads "cancelled". The suite's own jobs say how it ended.
const SUITE_JOB = /browser-suite|python-tests/i;
/** one line for a finished verify run on main from its jobs, or null when the suite did not run to the end in it. Pure. */
export function finishedLine(run, jobs) {
  const list = (jobs && Array.isArray(jobs.jobs) ? jobs.jobs : []).filter((j) => SUITE_JOB.test(String(j && j.name)));
  if (!run || !run.head_sha || !list.length || list.some((j) => j.status !== 'completed' || !/^(?:success|failure|timed_out)$/.test(String(j.conclusion)))) return null;
  const c = checksOf({ check_runs: list });
  return { text: 'the newest suite that finished on main ran on ' + short(run.head_sha) + ' (' + when(run.updated_at) + '): ' + c.text, ok: okOf(c), failed: c.failed };
}
/** a commit a report names that is older than main's newest change: its checks are history, not main's state now. Pure. */
export function pastNote(line, sha, recent, runs) {
  if (!line || !Array.isArray(recent) || !recent.length) return line;
  const head = recent[0], at = recent.findIndex((c) => c && String(c.sha || '').startsWith(String(sha)));
  const headAt = String((head.commit && head.commit.committer && head.commit.committer.date) || '');
  const lastRun = (runs && Array.isArray(runs.check_runs) ? runs.check_runs : []).map((r) => String(r.started_at || '')).sort().pop() || '';
  if (at === 0 || (at < 0 && !(headAt && lastRun && lastRun < headAt))) return line;
  return { ...line, text: line.text + ' · a past result: main has moved on since, see main above', ok: null };
}

/** the live lines for a reading: main first, then each named PR and commit. Never throws; a call GitHub refuses says so. */
export async function liveLines(t, fetchFn = (u) => fetch(u, { headers: { accept: 'application/vnd.github+json' } })) {
  const get = async (path) => { try { const r = await fetchFn(API + path); return r && r.ok ? await r.json() : { __status: r ? r.status : 0 }; } catch (_) { return { __status: 0 }; } };
  const out = [], refused = (j) => j && j.__status !== undefined;
  const recent = await get('/commits?sha=main&per_page=12');
  if (refused(recent) || !Array.isArray(recent)) return [{ text: recent && recent.__status === 403 ? 'GitHub is limiting calls from this device just now: try again within the hour' : 'GitHub did not answer, so nothing here is checked', ok: null }];
  // read past the records without a call; at most 3 changes are asked about their checks
  const records = []; let asked = 0;
  for (const c of recent) {
    if (isRecord(c)) { records.push(c); continue; }
    if (asked++ >= 3) break;
    const runs = await get('/commits/' + c.sha + '/check-runs?per_page=100');
    if (refused(runs) || !(runs.check_runs || []).some((r) => SUITE.test(r.name))) continue;
    const m = mainLine(c, runs), inc = incidentOf(records, c.sha);
    if (inc) {
      m.text += ' · the browser suite failed on it (noted ' + (inc.count === 1 ? 'once' : inc.count + ' times') + ', last ' + when(inc.last) + ')';
      m.ok = false;
    }
    out.push(m);
    const rl = recordsLine(records.filter((r) => recent.indexOf(r) < recent.indexOf(c)));
    if (rl) out.push(rl);
    break;
  }
  if (!out.length && recent[0]) out.push({ ...mainLine(recent[0], { check_runs: [] }), ok: null });
  if (out[0] && out[0].ok === null) { // main's head has no verdict yet: still running, or its checks not even started
    const runs = await get('/actions/workflows/verify.yml/runs?branch=main&status=completed&per_page=1');
    const run = !refused(runs) && Array.isArray(runs.workflow_runs) ? runs.workflow_runs[0] : null;
    const fl = run ? finishedLine(run, await get('/actions/runs/' + run.id + '/jobs?per_page=50')) : null;
    if (fl) out.splice(1, 0, fl);
  }
  for (const n of (t.prs || []).slice(0, 3)) { const pr = await get('/pulls/' + n); out.push(refused(pr) ? { text: '#' + n + ': not a pull request in ' + REPO, ok: null } : prLine(pr)); }
  for (const sha of (t.shas || []).slice(0, 2)) { const runs = await get('/commits/' + sha + '/check-runs?per_page=100'); out.push(refused(runs) ? { text: short(sha) + ': not a commit in ' + REPO, ok: null } : pastNote(checksLine(sha, runs), sha, recent, runs)); }
  return out.filter(Boolean);
}

/** true while a line still has checks running ("1 passed · 9 still running"): the card keeps re-reading GitHub until it is false. Pure. */
export const stillRunning = (lines) => (Array.isArray(lines) ? lines : []).some((l) => l && /\bstill running\b/.test(String(l.text)));
// how often and how many times an open card re-reads GitHub (owner, 2026-10-19: "all cards should constantly update"): once a minute while checks
// still run, at most 4 times after the first read; a read costs up to 11 calls (main's commits, 3 of them asked about their checks, the newest
// finished suite and its jobs while main's head has no verdict, 3 pull requests, 2 commits), so the five reads stay within the 60 an hour GitHub gives a visitor without a key
export const REFRESH_MS = 60000, REFRESH_MAX = 4;
