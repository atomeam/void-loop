// The developer-log card, checked against what is real (owner, 2026-10-19: the card only echoed the pasted words back, "these arent answering or
// helping anything"). For each pull request and commit a pasted report names, GitHub's public API says what actually happened: merged, open or
// closed, and how the checks on a commit ended. Main's newest commit and its checks come first, because "is it live and green?" is the question
// behind every report. Read-only, no key: GitHub's unauthenticated API (60 calls an hour per visitor), at most 8 calls a card.
//   prLine(pr), checksLine(sha, runs), mainLine(commit, runs) are pure; liveLines(t, fetch) does the calls.
export const REPO = 'atomeam/void-loop';
const API = 'https://api.github.com/repos/' + REPO;
const SUITE = /deploy|verify|browser-suite|python-tests/i; // the checks that say whether main is live and green
const short = (s) => String(s || '').slice(0, 8);
const when = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; };
const clip = (s, n) => { const x = String(s || '').replace(/\s+/g, ' ').trim(); return x.length <= n ? x : x.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };

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
  return { text: 'main is at ' + short(commit.sha) + ' (' + when(commit.commit && commit.commit.committer && commit.commit.committer.date) + ', ' + clip(msg, 60) + '): ' + c.text, ok: okOf(c), failed: c.failed };
}

/** the live lines for a reading: main first, then each named PR and commit. Never throws; a call GitHub refuses says so. */
export async function liveLines(t, fetchFn = (u) => fetch(u, { headers: { accept: 'application/vnd.github+json' } })) {
  const get = async (path) => { try { const r = await fetchFn(API + path); return r && r.ok ? await r.json() : { __status: r ? r.status : 0 }; } catch (_) { return { __status: 0 }; } };
  const out = [], refused = (j) => j && j.__status !== undefined;
  const recent = await get('/commits?sha=main&per_page=6');
  if (refused(recent) || !Array.isArray(recent)) return [{ text: recent && recent.__status === 403 ? 'GitHub is limiting calls from this device just now: try again within the hour' : 'GitHub did not answer, so nothing here is checked', ok: null }];
  // the bots' own record commits (an incident line, a raised floor) run no deploy or suite: main's state is its newest commit that ran them
  for (const c of recent.slice(0, 4)) {
    const runs = await get('/commits/' + c.sha + '/check-runs?per_page=100');
    if (!refused(runs) && (runs.check_runs || []).some((r) => SUITE.test(r.name))) { out.push(mainLine(c, runs)); break; }
  }
  if (!out.length && recent[0]) out.push({ ...mainLine(recent[0], { check_runs: [] }), ok: null });
  for (const n of (t.prs || []).slice(0, 3)) { const pr = await get('/pulls/' + n); out.push(refused(pr) ? { text: '#' + n + ': not a pull request in ' + REPO, ok: null } : prLine(pr)); }
  for (const sha of (t.shas || []).slice(0, 2)) { const runs = await get('/commits/' + sha + '/check-runs?per_page=100'); out.push(refused(runs) ? { text: short(sha) + ': not a commit in ' + REPO, ok: null } : checksLine(sha, runs)); }
  return out.filter(Boolean);
}
