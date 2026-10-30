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
//   decisions  what Verse decided to do next, read from its will (/api/will: its top want, the site it is assimilating, its last run) and
//              its team (/api/team: jobs waiting, agents here). A new top want is an action in the log ('decided'); a will run that failed
//              twice or more without shipping, and jobs that wait with no agent here, are breaks (kinds 'will' and 'team')
// Pure: no fetch, no DOM, no storage (lib/brain-host.js reads, lib/brain-mind.js keeps). Check names and pull request numbers only.

export const WATCH_MS = 15 * 60 * 1000, PR_OLD_H = 3, MAX_LOG = 40, MAX_CHECKS = 3;
const KINDS = ['ci', 'prs', 'issues', 'will', 'team'], LOGGED = ['watch', 'recovered', 'decided'];
/** the skills that answer for each kind of break (names in skills/index.json), for the brain's attention. */
export const ANSWERS = { ci: ['status', 'incident'], prs: ['merges'], issues: ['merges'], will: ['wants', 'tower'], team: ['team-chat'] };
export const WILL_TRIES = 2;

/** a fresh watch. */
export const createWatch = () => ({ seen: {}, log: [], seq: 0, at: 0, reads: 0, next: null });

const s = (x, n = 120) => String(x == null ? '' : x).slice(0, n);
const gh = (u) => (/^https:\/\/github\.com\/atomeam\/void-loop\//.test(u || '') ? s(u, 200) : '');

/** what was read, as observations: [{ key, kind, ok, what, why, url }]. rows: the status card's build rows (buildState, with causesOf
 *  checks); prs: open pull requests [{ number, created_at, html_url }]; issues: open issues [{ number, html_url, pull_request }]
 *  (GitHub lists pull requests as issues too: those are left out). A part that could not be read is left out, never called ok. Pure. */
export function observe({ rows = null, prs = null, issues = null, will = null, team = null } = {}, at = Date.now()) {
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
  const run = will && will.lastRun && typeof will.lastRun === 'object' ? will.lastRun : null;
  if (run && run.title) {
    const tries = Math.max(0, Math.round(+run.tries || 0)), stuck = !run.shipped && tries >= WILL_TRIES && run.state !== 'done';
    out.push({ key: 'will', kind: 'will', ok: !stuck, what: stuck ? 'Verse\'s will is stuck on "' + s(run.title, 70) + '"' : 'Verse\'s will ' + (run.shipped ? 'shipped "' : 'is on "') + s(run.title, 70) + '"',
      why: stuck ? tries + ' tries, nothing shipped' + (run.why ? '; the last said: ' + s(run.why, 140) : '') : run.shipped ? 'its last run shipped' : 'fewer than ' + WILL_TRIES + ' tries so far', url: gh(run.pr) });
  }
  if (team && Number.isFinite(+team.waiting) && Array.isArray(team.members)) {
    const n = Math.max(0, Math.round(+team.waiting)), here = team.members.filter((m) => m && m.state === 'here').length, stuck = n > 0 && !here;
    out.push({ key: 'team', kind: 'team', ok: !stuck, what: stuck ? n + ' job' + (n === 1 ? '' : 's') + ' wait on the team and no agent is here' : n + ' job' + (n === 1 ? '' : 's') + ' waiting, ' + here + ' agent' + (here === 1 ? '' : 's') + ' here',
      why: stuck ? team.members.length + ' agent' + (team.members.length === 1 ? ' is' : 's are') + ' on the team, all away' : 'the team is taking jobs', url: '' });
  }
  return out;
}

/** what Verse decided to do next, from its will: { want, because, site, tower } or null. Pure. */
export function decisionOf(will) {
  if (!will || typeof will !== 'object') return null;
  const w = Array.isArray(will.wants) ? will.wants.find((x) => x && x.title) : null, t = will.lap && will.lap.tower;
  const site = t && typeof t.line === 'string' ? (t.line.match(/now ([a-z0-9.-]+\.[a-z]{2,})/i) || [])[1] || '' : '';
  if (!w && !site) return null;
  return { want: w ? s(w.title, 120) : '', because: w ? s(w.because || w.evidence, 160) : '', site: s(site, 60), tower: t ? s(t.line, 160) : '' };
}

/** take what Verse decided: a new top want (or a new site) is an action in the log. Returns the action, or null when nothing changed. */
export function decide(W, d, at = Date.now()) {
  if (!d) return null;
  const was = W.next, same = was && was.want === d.want && was.site === d.site;
  W.next = { ...d, at };
  if (same) return null;
  const what = d.want ? 'Verse decided next: "' + d.want + '"' : 'Verse is assimilating ' + d.site;
  const why = (d.because ? d.because : 'its will chose it') + (d.tower ? '; ' + d.tower : '');
  return log(W, { kind: 'decided', what, why, url: '', key: 'will' }, at);
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
export const watchOf = (W) => ({ seen: W.seen, log: W.log.slice(-MAX_LOG), seq: W.seq, at: W.at, reads: W.reads, next: W.next || null });
/** put a kept watch back; wrong shapes are ignored. */
export function loadWatch(W, k) {
  if (!k || typeof k !== 'object' || !k.seen || typeof k.seen !== 'object') return false;
  const n = (x) => (Number.isFinite(x) && x >= 0 ? Math.round(x) : 0), seen = {};
  for (const [key, v] of Object.entries(k.seen).slice(0, 12)) if (v && typeof v === 'object' && KINDS.includes(v.kind)) seen[s(key, 40)] = { ok: !!v.ok, kind: v.kind, what: s(v.what), why: s(v.why, 200), url: gh(v.url), at: n(v.at) };
  W.seen = seen; W.seq = n(k.seq); W.at = n(k.at); W.reads = n(k.reads);
  const d = k.next && typeof k.next === 'object' ? k.next : null;
  W.next = d ? { want: s(d.want, 120), because: s(d.because, 160), site: s(d.site, 60), tower: s(d.tower, 160), at: n(d.at) } : null;
  W.log = (Array.isArray(k.log) ? k.log : []).filter((a) => a && typeof a.id === 'string' && LOGGED.includes(a.kind)).slice(-MAX_LOG)
    .map((a) => ({ id: s(a.id, 12), at: n(a.at), kind: a.kind, ask: '', cands: [], pick: s(a.pick, 40), first: '', what: s(a.what), why: s(a.why, 200), url: gh(a.url), outcome: a.outcome === 'seen' ? 'seen' : null }));
  return true;
}
