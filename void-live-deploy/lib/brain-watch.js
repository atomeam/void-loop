// brain-watch, Verse Brain watches Verse's own health (owner, 2026-10-30: "give the brain more to do and more power in the site").
// Every 15 minutes while a Verse page with the brain is visible, the host reads what anyone can read about Verse's build: the newest
// checks and deploy on main and the live check after it (GitHub's public API, read the same way as the status card, skills/status.js),
// the red checks written down in /incidents.json, and the open pull requests and issues of the repository. This file turns what was
// read into observations and keeps them in the brain's working memory:
//   breaks     a run on main that failed, a deploy that failed, a pull request open longer than 3 hours, an open issue (the owner's
//              goal is 0 open pull requests and 0 open issues, main green)
//   actions    a new break, and the end of one, is an action in the brain's log with what it saw and why it counts; the owner can mark
//              a break seen, and take the mark back (dismiss, undismiss)
//   attention  while a break stands the brain attends to the skills that answer for it (status, incident, merges), so an ask that more
//              than one skill can answer leans toward them (lib/brain-route.js attention)
// Pure: no fetch, no DOM, no storage (lib/brain-host.js reads, lib/brain-mind.js keeps). Check names and pull request numbers only.

export const WATCH_MS = 15 * 60 * 1000, PR_OLD_H = 3, MAX_LOG = 40, MAX_CHECKS = 3;
const KINDS = ['ci', 'prs', 'issues'];
/** the skills that answer for each kind of break (names in skills/index.json), for the brain's attention. */
export const ANSWERS = { ci: ['status', 'incident'], prs: ['merges'], issues: ['merges'] };

/** a fresh watch. */
export const createWatch = () => ({ seen: {}, log: [], seq: 0, at: 0, reads: 0 });

const s = (x, n = 120) => String(x == null ? '' : x).slice(0, n);
const gh = (u) => (/^https:\/\/github\.com\/atomeam\/void-loop\//.test(u || '') ? s(u, 200) : '');

/** what was read, as observations: [{ key, kind, ok, what, why, url }]. rows: the status card's build rows (buildState, with causesOf
 *  checks); prs: open pull requests [{ number, created_at, html_url }]; issues: open issues [{ number, html_url, pull_request }]
 *  (GitHub lists pull requests as issues too: those are left out). A part that could not be read is left out, never called ok. Pure. */
export function observe({ rows = null, prs = null, issues = null } = {}, at = Date.now()) {
  const out = [];
  for (const r of Array.isArray(rows) ? rows : []) {
    if (!r || !r.file || (r.state !== 'failed' && r.state !== 'passed' && !(r.state === 'running' && r.last))) continue;
    const state = r.state === 'running' ? r.last.state : r.state, sha = s(r.state === 'running' ? r.last.sha : r.sha, 7);
    if (state !== 'failed' && state !== 'passed') continue;
    const checks = (r.checks || []).map((c) => s(c, 80)).slice(0, MAX_CHECKS);
    out.push({ key: 'ci:' + s(r.file, 40), kind: 'ci', ok: state === 'passed', what: s(r.name, 40) + (state === 'passed' ? ' passed' : ' failed') + (sha ? ' on ' + sha : ''),
      why: state === 'passed' ? 'main is green for this run' : checks.length ? 'failing: ' + checks.join('; ') : 'a red run on main stops what comes after it', url: gh(state === 'running' ? r.last.url : r.url) });
  }
  if (Array.isArray(prs)) {
    const old = prs.filter((p) => p && Number.isFinite(Date.parse(p.created_at)) && at - Date.parse(p.created_at) > PR_OLD_H * 3600e3)
      .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at));
    const h = old.length ? Math.floor((at - Date.parse(old[0].created_at)) / 3600e3) : 0;
    out.push({ key: 'prs', kind: 'prs', ok: !old.length, what: old.length ? old.length + ' pull request' + (old.length > 1 ? 's' : '') + ' open longer than ' + PR_OLD_H + ' hours' : prs.length + ' pull request' + (prs.length === 1 ? '' : 's') + ' open, none older than ' + PR_OLD_H + ' hours',
      why: old.length ? 'the oldest, #' + Number(old[0].number) + ', has waited ' + h + ' hours; the goal is 0 open' : 'auto-merge is keeping up', url: old.length ? gh(old[0].html_url) : '' });
  }
  if (Array.isArray(issues)) {
    const open = issues.filter((i) => i && !i.pull_request);
    out.push({ key: 'issues', kind: 'issues', ok: !open.length, what: open.length ? open.length + ' open issue' + (open.length > 1 ? 's' : '') : 'no open issues',
      why: open.length ? 'the newest is #' + Number(open[0].number) + '; the goal is 0 open' : 'the goal of 0 open issues holds', url: open.length ? gh(open[0].html_url) : '' });
  }
  return out;
}

/** take observations into the watch: a part that turns from ok (or unknown) to a break, or from a break to ok, is an action in the log.
 *  Returns { news: the actions logged now, breaks: the breaks that stand }. */
export function takeIn(W, obs, at = Date.now()) {
  const news = [];
  for (const o of obs || []) {
    if (!o || !o.key || !KINDS.includes(o.kind)) continue;
    const was = W.seen[o.key];
    if (!o.ok && (!was || was.ok || was.what !== o.what)) news.push(log(W, { kind: 'watch', what: o.what, why: o.why, url: o.url, key: o.key }, at));
    else if (o.ok && was && !was.ok) news.push(log(W, { kind: 'recovered', what: o.what, why: 'it was ' + was.what + '; ' + o.why, url: o.url, key: o.key }, at));
    W.seen[o.key] = { ok: !!o.ok, kind: o.kind, what: s(o.what), why: s(o.why, 200), url: o.url || '', at };
  }
  W.at = at; W.reads++;
  return { news, breaks: breaksOf(W) };
}
function log(W, a, at) {
  const e = { id: 'w' + (++W.seq), at, kind: a.kind, ask: '', cands: [], pick: s(a.key, 40), first: '', what: s(a.what), why: s(a.why, 200), url: a.url || '', outcome: null };
  W.log.push(e); if (W.log.length > MAX_LOG) W.log.splice(0, W.log.length - MAX_LOG);
  return { ...e };
}

/** the breaks that stand now, the ones not marked seen first. */
export function breaksOf(W) {
  const seenMark = (k) => { const a = [...W.log].reverse().find((x) => x.pick === k && x.kind === 'watch'); return !!(a && a.outcome === 'seen'); };
  return Object.entries(W.seen).filter(([, v]) => !v.ok).map(([key, v]) => ({ key, ...v, marked: seenMark(key) })).sort((a, b) => a.marked - b.marked);
}

/** the skills the brain attends to while breaks stand (none once every break is marked seen). */
export const focusOf = (W) => [...new Set(breaksOf(W).filter((b) => !b.marked).flatMap((b) => ANSWERS[b.kind] || []))];

/** the owner saw break action `id` (Mark seen on /brain/): it stops pulling the brain's attention. Returns true when it changed. */
export function dismiss(W, id) { const a = W.log.find((x) => x.id === id); if (!a || a.kind !== 'watch' || a.outcome) return false; a.outcome = 'seen'; return true; }
/** take the mark back. */
export function undismiss(W, id) { const a = W.log.find((x) => x.id === id); if (!a || a.outcome !== 'seen') return false; a.outcome = null; return true; }

/** is it time to read again? */
export const due = (W, at = Date.now()) => !W.at || at - W.at >= WATCH_MS;

/** what to keep on this device. */
export const watchOf = (W) => ({ seen: W.seen, log: W.log.slice(-MAX_LOG), seq: W.seq, at: W.at, reads: W.reads });
/** put a kept watch back; wrong shapes are ignored. */
export function loadWatch(W, k) {
  if (!k || typeof k !== 'object' || !k.seen || typeof k.seen !== 'object') return false;
  const n = (x) => (Number.isFinite(x) && x >= 0 ? Math.round(x) : 0), seen = {};
  for (const [key, v] of Object.entries(k.seen).slice(0, 12)) if (v && typeof v === 'object' && KINDS.includes(v.kind)) seen[s(key, 40)] = { ok: !!v.ok, kind: v.kind, what: s(v.what), why: s(v.why, 200), url: gh(v.url), at: n(v.at) };
  W.seen = seen; W.seq = n(k.seq); W.at = n(k.at); W.reads = n(k.reads);
  W.log = (Array.isArray(k.log) ? k.log : []).filter((a) => a && typeof a.id === 'string' && (a.kind === 'watch' || a.kind === 'recovered')).slice(-MAX_LOG)
    .map((a) => ({ id: s(a.id, 12), at: n(a.at), kind: a.kind, ask: '', cands: [], pick: s(a.pick, 40), first: '', what: s(a.what), why: s(a.why, 200), url: gh(a.url), outcome: a.outcome === 'seen' ? 'seen' : null }));
  return true;
}
