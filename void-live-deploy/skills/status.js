/**
 * status skill — "void status" / "system status" / "is void working": each part of Verse checked on the spot, in this
 * browser (domains/void.assimilate.md, ask "status": each component). Skills: the page's own load check run again
 * (index entries whose module is missing or misshapen are named). This browser: storage (a throwaway value written and
 * removed), 3D (WebGL), the offline layer (service worker), online or not. Outside sources: the open services Verse reads,
 * pinged once each, only now, in parallel, with a 6 s limit, showing up / down and how long each took. The translation
 * service is not pinged: a ping would spend its small daily quota. Verse's own pages: the newest check of every page in the sitemap, opened in headless Chrome after a deploy (/api/selfcheck,
 * lib/selfcheck.js). Verse's own build: the newest checks and deploy on main (GitHub's
 * public API), and the actions Verse took for the owner that failed in the last day (owner-only /api/actions). For the owner, the card
 * opens by itself when a run on main or one of those actions failed (autoOpen). Nothing is sent about you; nothing is kept.
 */
import { cleanLower } from '../lib/ask-text.js';
import { stabilityOf, stabilityHtml } from '../lib/autopsy.js';
import { recovered, loadFailed, keepFailed, keepHealth, successPulse } from '../lib/success-pulse.js';
import { pagesHtml } from '../lib/selfcheck.js';
export const SOURCES = [
  { name: 'Open-Meteo weather', for: 'weather, air quality, UV', url: 'https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0&current=temperature_2m' },
  { name: 'Open-Meteo places', for: 'maps, places, local time', url: 'https://geocoding-api.open-meteo.com/v1/search?count=1&name=Paris' },
  { name: 'Wikipedia', for: 'articles', url: 'https://en.wikipedia.org/api/rest_v1/page/summary/Earth' },
  { name: 'Wiktionary', for: 'definitions', url: 'https://en.wiktionary.org/api/rest_v1/page/definition/void' },
  { name: 'Frankfurter', for: 'currency', url: 'https://api.frankfurter.dev/v1/latest' },
  { name: 'USGS', for: 'earthquakes', url: 'https://earthquake.usgs.gov/fdsnws/event/1/version' },
  { name: 'Nager.Date', for: 'public holidays', url: 'https://date.nager.at/api/v3/AvailableCountries' },
  { name: 'CoinGecko', for: 'crypto prices', url: 'https://api.coingecko.com/api/v3/ping' },
  { name: 'ClinicalTrials.gov', for: 'the longevity trial watch', url: 'https://clinicaltrials.gov/api/v2/version' },
];

const CLEAN = cleanLower; // shared: lib/ask-text.js
const ASK_RE = /^(?:(?:show(?:\s+me)?|check|run|what(?:'s|\s+is))\s+(?:the\s+)?)?(?:(?:void|verse)(?:'s)?\s+(?:status|health|health\s+check)|(?:system|service)\s+status|status(?:\s+(?:page|check|of\s+(?:verse|void)))?|health\s+check|self[\s-]?check|diagnostics)$|^(?:is\s+(?:verse|void)\s+(?:working|up|down|ok|okay|broken)|are\s+(?:the\s+)?(?:skills|sources)\s+(?:working|up|down)|check\s+(?:void|yourself|the\s+sources))$/;
export function statusOf(text) { return ASK_RE.test(CLEAN(text)); }

// News about Verse's own systems, pasted in (a weak answer the site tester queued, 2026-10-15: a pasted note that a new routine runs
// every few hours and empties the lists got back only a list of run times). A long statement, not a question, that names one of
// Verse's own parts and a change to it is news about Verse: it answers the substance first, in its own voice, and does any time math
// only as an aside.
const PART_RE = /\b(routines?|automations?|workflows?|cron|deploy(?:s|ment)?|tester|site tester|queues?|lists?|board|skills?|store|films?|pipeline|loop|reviewer|code review|builders?|agents?)\b/;
const SELF_RE = /\b(v01d|void|verse|your|yourself)\b|^(?:update|heads up|fyi|news|status update|new)\b/;
const CHANGE_RE = /\b(new|now|runs?|running|added|ships?|shipped|starts?|started|clears?|cleans?|empties|merged?|turned on|switched|every \d+|each (?:hour|day|night))\b/;
export function newsOf(text) {
  const t = CLEAN(text), words = t.split(/\s+/).filter(Boolean).length;
  if (words < 8 || /^(what|how|why|when|where|who|which|can|could|should|is|are|do|does)\b/.test(t) || /\?\s*$/.test(String(text))) return false;
  return PART_RE.test(t) && SELF_RE.test(t) && CHANGE_RE.test(t);
}
/** What the news means for Verse: { part, take, aside } (aside: run times when it says every N hours from a time). Pure. */
export function takeOf(text) {
  const t = CLEAN(text), part = (t.match(PART_RE) || ['system'])[1] || 'system';
  const take = [];
  if (/\b(clears?|cleans?|empties|empty|reset)\b/.test(t)) take.push('nothing piles up between runs, so what I show you stays current, but anything left half-done gets cleared too; I should finish or save work before the next run');
  if (/\bevery \d+ (?:hours?|minutes?)|each (?:hour|day|night)|hourly|nightly|daily\b/.test(t)) take.push('it runs on a clock rather than waiting for a person, which is the automated-company way I am built to work');
  if (/\b(new|added|ships?|shipped|turned on)\b/.test(t)) take.push('it is a new part of me, so I will watch its first runs and say if it misbehaves');
  if (!take.length) take.push('it changes how my ' + part + ' behaves; I will keep it in mind when I answer about it');
  let aside = '';
  const m = t.match(/every (\d+) hours?\b.*?\b(\d{1,2}):(\d{2})\s*(am|pm)?/);
  if (m) { const step = +m[1]; let h = +m[2] % 12 + (m[4] === 'pm' ? 12 : 0); if (!m[4] && +m[2] >= 12) h = +m[2];
    if (step > 0 && step <= 24) { const times = []; for (let x = h; times.length < Math.floor(24 / step); x = (x + step) % 24) times.push(((x % 12) || 12) + ':' + m[3] + (x < 12 ? ' AM' : ' PM'));
      aside = 'That is ' + times.length + ' runs a day: ' + times.join(', ') + '.'; } }
  return { part, take, aside };
}

// the network's own time for a URL, from the browser's resource timing: the clock around the fetch also counts the moments the page was busy drawing the card
// (2026-10-30: five sources read 1121 to 1125 ms on one card, the time the page was busy, not the sources' own), so it is used only when there is no entry
const netMs = (url) => { try { const e = performance.getEntriesByName(url, 'resource'), x = e[e.length - 1]; return x && x.responseEnd > x.startTime ? x.responseEnd - x.startTime : null; } catch (_) { return null; } };
/** Ping one source: { name, for, ok, ms, note }. A CORS block, a timeout and a network error all read as unreachable. ms is the network's time when the browser gives it. */
export async function ping(src, fetchFn = (u, o) => fetch(u, o), ms = 6000, now = () => performance.now(), timing = netMs) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null, t = ctl && setTimeout(() => ctl.abort(), ms), t0 = now();
  try {
    const r = await fetchFn(src.url, ctl ? { signal: ctl.signal, cache: 'no-store' } : { cache: 'no-store' }), wall = now() - t0;
    if (r.arrayBuffer) await r.arrayBuffer().catch(() => null); // the timing entry is written when the body is in
    const net = timing(src.url);
    return { name: src.name, for: src.for, ok: !!r.ok, ms: Math.round(net != null && net <= wall + 50 ? net : wall), note: r.ok ? '' : 'answered HTTP ' + r.status };
  } catch (e) {
    const timedOut = e && e.name === 'AbortError';
    return { name: src.name, for: src.for, ok: false, ms: Math.round(now() - t0), note: timedOut ? 'no answer in ' + ms / 1000 + ' s' : 'could not be reached from this browser' };
  } finally { if (t) clearTimeout(t); }
}

/** The skills: the index, each module imported again (the browser hands back the loaded copy) and its shape checked. */
export async function checkSkills(fetchFn = (u) => fetch(u), importFn = (n) => import('/skills/' + n + '.js')) {
  let index;
  try { const r = await fetchFn('/skills/index.json'); if (!r.ok) throw new Error('HTTP ' + r.status); index = await r.json(); if (!Array.isArray(index)) throw new Error('not a list'); }
  catch (e) { return { total: 0, ok: 0, missing: [], error: 'the skills index could not be read (' + ((e && e.message) || e) + ')' }; }
  const mods = await Promise.all(index.map((n) => importFn(n).catch(() => null)));
  const missing = index.filter((n, i) => { const s = mods[i] && mods[i].default; return !(s && s.name && s.match && s.run); });
  return { total: index.length, ok: index.length - missing.length, missing, error: null };
}

/** This browser: storage, WebGL, the offline layer, online. Each { name, ok, note }. */
export function checkBrowser(w = typeof window !== 'undefined' ? window : {}) {
  const out = [];
  let store = false; try { const k = 'a2m.void.status.probe'; w.localStorage.setItem(k, '1'); store = w.localStorage.getItem(k) === '1'; w.localStorage.removeItem(k); } catch (_) {}
  out.push({ name: 'Storage in this browser', ok: store, note: store ? 'kept things, logs and drafts can be saved here' : 'blocked or full: kept things and logs will not survive a reload' });
  let gl = false; try { const c = w.document.createElement('canvas'), x = c.getContext('webgl2') || c.getContext('webgl'); gl = !!x; if (x && x.getExtension('WEBGL_lose_context')) x.getExtension('WEBGL_lose_context').loseContext(); } catch (_) {}
  out.push({ name: '3D', ok: gl, note: gl ? 'WebGL is available for the 3D miniatures and figures' : 'no WebGL: cards show their flat look instead' });
  const sw = !!(w.navigator && w.navigator.serviceWorker && w.navigator.serviceWorker.controller);
  out.push({ name: 'Works offline', ok: sw, note: sw ? 'the offline layer is active' : 'not yet: it starts after the first full visit over https' });
  const online = !(w.navigator && w.navigator.onLine === false);
  out.push({ name: 'Online', ok: online, note: online ? 'this browser reports a connection' : 'this browser reports no connection' });
  return out;
}

// Verse's own build (Verse asked, 2026-10-11/12, five times: "a system where a blocked deployment or failed action generates a 'status'
// card automatically"; "make the results of verify-main visible to me as a status card"): the newest run on main of the checks and
// of the deploy, from GitHub's public API (the repository is public; no key, 60 reads an hour per address). The owner chose
// (2026-10-13) that the card opens by itself only for the owner: visitors keep the blank stage (autoOpen below).
export const REPO = 'atomeam/void-loop';
export const BUILD = [{ name: 'Checks on main', file: 'verify.yml' }, { name: 'Deploy', file: 'deploy.yml' }];
// The live check (mcp-live.yml): after every main deploy a real MCP client calls Verse's tools at a-to-mind.com. It is the one record
// that a commit answers on the live domain, so it is the only evidence for "verified live"; it is read with the build, not shown as a row.
export const LIVE = { name: 'MCP live', file: 'mcp-live.yml' };
// Every commit the card reports stands at exactly one of these, on evidence only (2026-10-29): implemented (not on main), merged (on
// main: every run read here is), deploy running (a deploy of that commit has started), deployed (a deploy of that commit passed),
// verified live (deployed, and the live check passed on that same commit). A newer deploy is not taken to carry an older commit: the
// card says only what a run of that exact commit shows, so it can read lower than the truth but never higher.
export const STAGES = ['implemented', 'merged', 'deploy running', 'deployed', 'verified live'];
const sha7 = (x) => String(x || '').slice(0, 7);
const stateOf = (run) => run.status !== 'completed' ? 'running' : run.conclusion === 'success' ? 'passed' : run.conclusion === 'skipped' || run.conclusion === 'cancelled' ? 'unknown' : 'failed';
const ghUrl = (u) => (/^https:\/\/github\.com\//.test(u || '') ? u : null);
/** the stage of one commit from the runs read: { onMain, deploys, lives } (each run { sha, state }). Pure. */
export function stageOf(sha, { onMain = true, deploys = [], lives = [] } = {}) {
  if (!onMain) return 'implemented';
  const same = (r) => !!(r && sha && r.sha && r.sha === sha7(sha));
  const deployed = deploys.some((r) => same(r) && r.state === 'passed');
  if (deployed && lives.some((r) => same(r) && r.state === 'passed')) return 'verified live';
  if (deployed) return 'deployed';
  if (deploys.some((r) => same(r) && r.state === 'running')) return 'deploy running';
  return 'merged';
}
export async function buildRun(wf, fetchFn = (u, o) => fetch(u, o)) {
  try {
    const r = await fetchFn('https://api.github.com/repos/' + REPO + '/actions/workflows/' + wf.file + '/runs?branch=main&per_page=10&exclude_pull_requests=true', { headers: { accept: 'application/vnd.github+json' } });
    if (!r.ok) return { ...wf, state: 'unknown', note: 'GitHub answered HTTP ' + r.status, runs: [] };
    const all = ((await r.json()).workflow_runs || []).filter(Boolean), run = all[0];
    if (!run) return { ...wf, state: 'unknown', note: 'no run on main yet', runs: [] };
    const state = stateOf(run), runs = all.map((x) => ({ sha: sha7(x.head_sha), state: stateOf(x) }));
    // the newest run is still going (or was cancelled): the last one that finished says how main stands, so the card never shows a run without an outcome
    const done = state === 'passed' || state === 'failed' ? null : all.find((x) => stateOf(x) === 'passed' || stateOf(x) === 'failed');
    const last = done ? { state: stateOf(done), sha: sha7(done.head_sha), at: String(done.created_at || '').slice(0, 16).replace('T', ' ') + ' UTC', url: ghUrl(done.html_url) } : null;
    return { ...wf, state, sha: sha7(run.head_sha), note: (state === 'failed' ? 'failed (' + run.conclusion + ')' : state === 'running' ? 'running now' : state === 'passed' ? 'passed' : run.conclusion) + ' on ' + sha7(run.head_sha) + ' · ' + String(run.created_at || '').slice(0, 16).replace('T', ' ') + ' UTC', url: ghUrl(run.html_url), last, runs };
  } catch (_) { return { ...wf, state: 'unknown', note: 'GitHub could not be reached from this browser', runs: [] }; }
}
/** the build rows, each with the stage of its commit (and of the last finished run's commit) from the deploys and the live checks read. Pure. */
export function withStages(rows, live) {
  const deploys = ((rows || []).find((r) => r.file === 'deploy.yml') || {}).runs || [], lives = (live && live.runs) || [];
  const at = (sha) => (sha ? stageOf(sha, { deploys, lives }) : null);
  return (rows || []).map((r) => ({ ...r, stage: at(r.sha), ...(r.last ? { last: { ...r.last, stage: at(r.last.sha) } } : {}) }));
}
export const buildState = async (fetchFn) => { const [rows, live] = await Promise.all([Promise.all(BUILD.map((w) => buildRun(w, fetchFn))), buildRun(LIVE, fetchFn)]); return withStages(rows, live); };
// the root cause (asked by Verse: "a 'Root Cause' field in the Status card that automatically pulls the error trace from the failed
// action", and twice before: the failure linked to its log): a red check on main is written down with the checks that failed
// (void-live-deploy/incidents.json, verify.yml), so the card can say which ones, not only that something failed. Pure except the fetch.
export function causesOf(rows, incidents) {
  const list = Array.isArray(incidents) ? incidents : (incidents && incidents.incidents) || [];
  return (rows || []).map((r) => {
    if (r.state !== 'failed' || !r.sha) return r;
    const hit = list.find((i) => i && String(i.sha || '').startsWith(r.sha)) || null;
    return hit && Array.isArray(hit.checks) && hit.checks.length ? { ...r, checks: hit.checks.map((c) => String(c).slice(0, 160)).slice(0, 5), suite: hit.suite || '' } : r;
  });
}
// the suggested fix and the recovery (asked by Verse: "a 'suggested fix' snippet directly in the owner's status card failure trigger",
// and twice "a 'recovery' button that triggers a rebuild attempt using the most relevant skill from my 'Verse itself' family"). A red
// check names its own section ("appraise: ..."); the fix snippet is the two commands that find and then ship the repair, for that
// section only. The recovery queues one job for the builder naming the check and the Verse-itself skill that fits it best.
export const SELF_SKILLS = ['v01d-fixes', 'rebuild-map', 'guide', 'growth', 'merges', 'goal', 'intent', 'different', 'memory', 'watch', 'status', 'incident', 'actions', 'automations', 'proposal', 'services', 'store', 'share', 'invite', 'family-health', 'deps', 'fringe-to-skill'];
const sectionOf = (check) => String(check || '').split(/[:;]/)[0].replace(/["'`\u201c\u201d]/g, '').replace(/\s+/g, ' ').trim().split(' ').slice(0, 4).join(' ');
/** { words, cmd, ship }: the commands that reproduce and then ship the repair of one failed check. Pure. */
export function fixOf(check) {
  const t = String(check || ''), timeout = /^check timeout/i.test(t), words = timeout ? '' : sectionOf(t);
  if (!words) return { words: '', cmd: 'VOID_TRACE=1 node tools/heavy.mjs node tools/test_void.mjs --only core', ship: 'node tools/finish.mjs fix "what the timeout was" --test "core"', note: 'a stall: the trace names the check that hung' };
  return { words, cmd: 'node tools/heavy.mjs node tools/test_void.mjs --only "' + words + '"', ship: 'node tools/finish.mjs fix "repair ' + words + '" --test "' + words + '"', note: '' };
}
/** the skill of Verse's own family that fits these failed checks best: the most name words found in them; v01d-fixes when none. Pure. */
export function recoverSkill(checks, pool = SELF_SKILLS) {
  const t = (Array.isArray(checks) ? checks.join(' ') : String(checks || '')).toLowerCase();
  let best = 'v01d-fixes', top = 0;
  for (const n of pool) { const hits = n.split('-').filter((w) => w.length > 2 && new RegExp('\\b' + w.replace(/s$/, '')).test(t)).length; if (hits > top) { best = n; top = hits; } }
  return best;
}
/** the job the recovery button queues (the queue keeps 200 characters of the ask). Pure. */
export function recoverJob(row) {
  const checks = (row && row.checks) || [], skill = recoverSkill(checks), f = fixOf(checks[0] || '');
  return { skill, ask: ('recover main (status card): rebuild with the ' + skill + ' skill; failing ' + (f.words || 'a stall') + (row && row.sha ? ' on ' + row.sha : '')).slice(0, 200), target: 'next' };
}
/** POST the recovery job to the owner's build queue. Owner key only; returns { ok, why, skill }. */
export async function recover(row, fetchFn = (u, o) => fetch(u, o), key = ownerKey()) {
  if (!key) return { ok: false, why: 'only the owner can start a rebuild' };
  const job = recoverJob(row);
  try {
    const r = await fetchFn('/api/queue', { method: 'POST', headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json' }, body: JSON.stringify({ ask: job.ask, target: job.target }) });
    return r.ok ? { ok: true, skill: job.skill, why: 'queued for the builder with the ' + job.skill + ' skill' } : { ok: false, skill: job.skill, why: 'the queue answered HTTP ' + r.status };
  } catch (_) { return { ok: false, skill: job.skill, why: 'the queue could not be reached' }; }
}
export async function withCauses(rows, fetchFn = (u, o) => fetch(u, o)) {
  if (!buildFailed(rows)) return rows;
  try { const r = await fetchFn('/incidents.json', { cache: 'no-cache' }); return r.ok ? causesOf(rows, await r.json()) : rows; } catch (_) { return rows; }
}
export const buildFailed = (rows) => Array.isArray(rows) && rows.some((r) => r.state === 'failed');
// once a page load, for the owner only: the build is read, and the status card opens when a run on main failed. Read at most once
// in ten minutes per tab (sessionStorage), so reloads don't spend the public API's hourly allowance.
const SEEN = 'a2m.void.status.build.v1';
export async function autoOpen(open, { fetchFn, store = typeof sessionStorage !== 'undefined' ? sessionStorage : null, now = Date.now() } = {}) {
  let rows = null;
  try { const c = JSON.parse((store && store.getItem(SEEN)) || 'null'); if (c && now - c.at < 600000) rows = c.rows; } catch (_) {}
  if (!rows) { rows = await buildState(fetchFn); try { store && store.setItem(SEEN, JSON.stringify({ at: now, rows })); } catch (_) {} }
  if (buildFailed(rows)) { await open(); return true; }
  const sup = await supportState(fetchFn); // a paying user waiting on an answer opens the card too
  if (sup && sup.open) { await open(); return true; }
  const acts = await failedActions(fetchFn, undefined, now); // an action Verse took for the owner that failed (the other half of Verse's ask)
  if (acts && acts.length) { await open(); return true; }
  if (ownerKey()) { const pg = await pagesState(fetchFn); if (pg && pg.serious) { await open(); return true; } } // a page of Verse's own that is broken (lib/selfcheck.js)
  return false;
}

// Actions Verse took on the owner's behalf that failed in the last day (lib/actions.js records every one in D1; GET /api/actions is
// owner-only). Verse asked five times for "a blocked deployment or failed action" to open a status card by itself: the build half
// is buildState above, this is the action half. A visitor has no key and gets null; so does a browser that is offline.
// A record that ended `deferred` (a site answered 429 and Verse waits as it asked, lib/watch.js) is not a failure: it is never counted
// in "failed in the last day" and never opens the card; the card names those in one muted line of their own (statusHtml's waiting).
export const ACTION_WINDOW_MS = 86400000;
const actionRow = (a) => ({ id: a.id, kind: a.kind, ref: a.ref || '', error: a.error || 'failed', said: a.result || '', at: String(a.finished || a.started || '').slice(0, 16).replace('T', ' ') });
/** the owner's actions of the last day that failed, and those that wait to try again: { failed, waiting }, or null for a visitor */
export async function recentActions(fetchFn = (u, o) => fetch(u, o), key = ownerKey(), now = Date.now()) {
  if (!key) return null;
  try {
    const r = await fetchFn('/api/actions?limit=50', { headers: { authorization: 'Bearer ' + key } }); if (!r.ok) return null;
    const day = ((await r.json()).actions || []).filter((a) => a && now - Date.parse(a.finished || a.started || 0) < ACTION_WINDOW_MS);
    return { failed: day.filter((a) => a.state === 'failed').slice(0, 8).map(actionRow), waiting: day.filter((a) => a.state === 'deferred').slice(0, 8).map(actionRow) };
  } catch (_) { return null; }
}
export async function failedActions(fetchFn, key = ownerKey(), now = Date.now()) { const a = await recentActions(fetchFn, key, now); return a && a.failed; }

// Paying users who said "it broke" (functions/api/support.js): the open reports, read with the owner's key. A visitor has no key and
// sees nothing; the owner sees each report and answers it from the card's link (POST /api/support { action: 'answer' }).
const OWNER_KEY = 'a2m.void.owner.v1';
const ownerKey = () => { try { return localStorage.getItem(OWNER_KEY) || ''; } catch (_) { return ''; } };
export async function supportState(fetchFn = (u, o) => fetch(u, o), key = ownerKey()) {
  if (!key) return null;
  try { const r = await fetchFn('/api/support', { headers: { authorization: 'Bearer ' + key } }); if (!r.ok) return null; const j = await r.json(); return { open: Number(j.open) || 0, tickets: (j.tickets || []).filter((t) => t.status === 'open').slice(0, 5) }; } catch (_) { return null; }
}

// Verse's own pages, opened in headless Chrome after each deploy (tools/self-check.mjs, lib/selfcheck.js): the newest report, public.
export async function pagesState(fetchFn = (u, o) => fetch(u, o)) {
  // undefined (the section is left out) when the report could not be read; null when there is no report yet
  try { const r = await fetchFn('/api/selfcheck', { cache: 'no-cache' }); if (!r.ok) return undefined; return (await r.json()).report || null; } catch (_) { return undefined; }
}

const dot = (ok) => '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:' + (ok ? '#3fbf6a' : '#e0584a') + '"></span>';
export function statusHtml(esc, skills, browser, sources, at, build, support, actions, stability, waiting, pages) {
  const row = (ok, name, note, ms) => '<tr><td style="padding:3px 10px 3px 0;white-space:nowrap">' + dot(ok) + esc(name) + '</td><td style="color:#8a8a92;padding:3px 0">' + esc(note) + (ms != null ? ' · ' + ms + ' ms' : '') + '</td></tr>';
  const up = sources ? sources.filter((s) => s.ok).length : 0;
  return '<h2>Verse status</h2><div class="sub">checked just now, from this browser' + (at ? ' · ' + esc(at) : '') + '</div>'
    + '<table style="border-collapse:collapse;margin:8px 0">'
    + row(!skills.error && !skills.missing.length, 'Skills', skills.error || (skills.ok + ' of ' + skills.total + ' load' + (skills.missing.length ? '; not loading: ' + skills.missing.join(', ') : '')))
    + browser.map((b) => row(b.ok, b.name, b.note)).join('') + '</table>'
    + '<h3 style="margin:12px 0 4px;font-size:15px">Outside sources' + (sources ? ' · ' + up + ' of ' + sources.length + ' answering' : '') + '</h3>'
    + (sources ? '<table style="border-collapse:collapse">' + sources.map((s) => row(s.ok, s.name, 'for ' + s.for + (s.note ? ' · ' + s.note : ''), s.ok ? s.ms : null)).join('') + '</table>'
      : '<p style="color:#8a8a92">Not checked: this browser is offline.</p>')
    + (stability ? stabilityHtml(stability, esc) : '')
    + (pages !== undefined ? pagesHtml(pages, esc) : '')
    + (build ? '<h3 style="margin:12px 0 4px;font-size:15px">Verse’s own build' + (buildFailed(build) ? ' · <span style="color:#e0584a">something on main failed</span>' : '') + '</h3><table style="border-collapse:collapse">'
      + build.map((b) => '<tr><td style="padding:3px 10px 3px 0;white-space:nowrap">' + (b.state === 'running' || b.state === 'unknown' ? '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px;background:#8a8a92"></span>' : dot(b.state === 'passed')) + esc(b.name) + '</td><td style="color:#8a8a92;padding:3px 0">' + esc(b.note) + (b.stage && b.state !== 'running' ? ' · <b class="status-stage">' + esc(b.stage) + '</b>' : '') + (b.url ? ' · <a href="' + esc(b.url) + '" target="_blank" rel="noopener">the run</a>' : '')
        + (b.last ? '<br><span class="status-last">' + dot(b.last.state === 'passed') + 'last finished: ' + esc(b.last.state) + ' on ' + esc(b.last.sha) + ' · ' + esc(b.last.at) + (b.last.stage ? ' · <b class="status-stage">' + esc(b.last.stage) + '</b>' : '') + (b.last.url ? ' · <a href="' + esc(b.last.url) + '" target="_blank" rel="noopener">that run</a>' : '') + '</span>' : '') + '</td></tr>'
        + (b.checks && b.checks.length ? '<tr class="status-cause"><td></td><td style="color:#e0584a;padding:0 0 6px"><b>What failed:</b> ' + b.checks.map(esc).join(' · ') + '<span style="color:#8a8a92"> · ' + (b.suite ? esc(b.suite) + '; ' : '') + 'verify.yml takes the breaking commit back by itself when it can name it, else the run says which commits to look at</span>'
          + '<div class="status-fix" style="margin-top:6px"><b>Suggested fix:</b> <code style="user-select:all">' + esc(fixOf(b.checks[0]).cmd) + '</code><br><span style="color:#8a8a92">then</span> <code style="user-select:all">' + esc(fixOf(b.checks[0]).ship) + '</code>' + (fixOf(b.checks[0]).note ? ' <span style="color:#8a8a92">(' + esc(fixOf(b.checks[0]).note) + ')</span>' : '')
          + '<div style="margin-top:6px"><button type="button" data-recover="' + esc(b.sha || '') + '">Recover: queue a rebuild with ' + esc(recoverSkill(b.checks)) + '</button> <span data-recover-said style="color:#8a8a92"></span></div></div></td></tr>' : '')).join('') + '</table>' : '')
    + (support ? '<h3 style="margin:12px 0 4px;font-size:15px">Paying users who said it broke · ' + (support.open ? '<span style="color:#e0584a">' + support.open + ' waiting on you</span>' : 'none waiting') + '</h3>'
      + support.tickets.map((t) => '<p style="margin:4px 0"><b>' + esc(t.id) + '</b> · ' + esc(t.where) + ' · ' + esc(String(t.at).slice(0, 16).replace('T', ' ')) + '<br>' + esc(t.what) + '</p>').join('')
      + (support.open ? '<p style="color:#8a8a92;margin:4px 0">Answer one: POST /api/support { action: "answer", id, answer } with your key; the reporter reads it with theirs.</p>' : '') : '')
    + (actions ? '<h3 style="margin:12px 0 4px;font-size:15px">Actions Verse took for you · ' + (actions.length ? '<span style="color:#e0584a">' + actions.length + ' failed in the last day</span>' : 'none failed in the last day') + '</h3>'
      + actions.map((a) => '<p style="margin:4px 0">' + dot(false) + '<b>' + esc(a.kind) + '</b>' + (a.ref ? ' · ' + esc(a.ref) : '') + ' · ' + esc(a.at) + '<br><span style="color:#8a8a92">' + esc(a.error) + '</span></p>').join('')
      + (waiting && waiting.length ? '<p class="status-waiting" style="color:#8a8a92;margin:4px 0">◷ ' + waiting.length + ' rate limited, not failed: a site asked Verse to slow down, and it waits before trying again · ' + waiting.slice(0, 3).map((a) => esc(a.kind) + (a.ref ? ' · ' + esc(a.ref) : '') + ' · ' + esc(a.at)).join('; ') + '</p>' : '')
      + (actions.length ? '<p style="color:#8a8a92;margin:4px 0">Each one is a record in Verse’s action log (lib/actions.js); ask “what did you do today” for the whole list.</p>' : '') : '')
    + '<div class="src">Each source was asked once, now, because you asked; the translation service is not pinged, to save its daily quota. Nothing about you is sent or kept.</div>';
}

async function run(text, api) {
  if (!statusOf(text) && newsOf(text)) {
    const { showPage, esc } = api, n = takeOf(text);
    showPage((p) => { p.innerHTML = '<h2>News about me</h2><div class="sub">about my ' + esc(n.part) + '</div><p>Thanks for telling me. My take: ' + n.take.map(esc).join('; ') + '.</p>' + (n.aside ? '<div class="sub">' + esc(n.aside) + '</div>' : ''); });
    return 'self-news';
  }
  if (!statusOf(text)) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = '<h2>Verse status</h2><div class="sub">checking…</div>'; });
  const browser = checkBrowser(), online = browser.find((b) => b.name === 'Online').ok;
  const [skills, sources, build, support, recent, pages] = await Promise.all([checkSkills(), online ? Promise.all(SOURCES.map((s) => ping(s))) : Promise.resolve(null), online ? buildState().then((rows) => withCauses(rows)) : Promise.resolve(null), online ? supportState() : Promise.resolve(null), online ? recentActions() : Promise.resolve(null), online ? pagesState() : Promise.resolve(undefined)]);
  const actions = recent && recent.failed, waiting = recent && recent.waiting;
  const at = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
  const stability = online ? await fetch('/incidents.json', { cache: 'no-cache' }).then((r) => r.ok ? r.json() : null).then((j) => j ? stabilityOf(j) : null).catch(() => null) : null;
  el.innerHTML = statusHtml(esc, skills, browser, sources, at, build, support, actions, stability, waiting, pages);
  // a Success Pulse (asked by Verse): something that failed at the last check and is fine now (a skill that did not load and does)
  const checked = [...(skills.missing || []).map((n) => 'skill:' + n), ...(sources || []).map((x) => 'source:' + x.name), ...(build || []).map((b) => 'build:' + b.name), ...(actions || []).map((x) => 'action:' + x.kind), ...((pages && pages.pages) || []).map((x) => 'page:' + x.path)];
  const failing = [...(skills.missing || []).map((n) => 'skill:' + n), ...(sources || []).filter((x) => !x.ok).map((x) => 'source:' + x.name), ...(build || []).filter((b) => b.state !== 'passed' && b.state !== 'running' && b.state !== 'unknown').map((b) => 'build:' + b.name), ...(actions || []).map((x) => 'action:' + x.kind), ...((pages && pages.pages) || []).filter((x) => x.problems.some((q) => ['status', 'script', 'request', 'empty', 'link'].includes(q.kind))).map((x) => 'page:' + x.path)];
  const back = recovered(loadFailed(), failing, [...checked, ...(skills.error ? [] : (loadFailed().filter((n) => n.startsWith('skill:'))))]);
  keepFailed(failing); keepHealth(failing.length, checked.length + (skills.error ? 0 : 1)); // the book's parchment reads this (lib/tome.js parchmentFilter)
  if (back.length) { successPulse(); api.say('working again: ' + back.map((n) => n.replace(/^[a-z]+:/, '')).slice(0, 3).join(', ')); }
  el.querySelectorAll('[data-recover]').forEach((btn) => btn.addEventListener('click', async () => {
    const row = (build || []).find((b) => b.state === 'failed' && (b.sha || '') === btn.getAttribute('data-recover')) || { checks: [] }, said = el.querySelector('[data-recover-said]');
    btn.disabled = true; const r = await recover(row); if (said) said.textContent = r.why; btn.disabled = false;
  }));
  return 'status';
}

export default {
  name: 'status',
  examples: ['void status', 'system status', 'is void working', 'status', 'health check', 'are the sources up'],
  nearMisses: ['what is my status', 'status of my order', 'relationship status', 'flight status', 'status quo', 'check the weather'],
  statusOf,
  newsOf,
  match(lower, text) { return statusOf(text) || newsOf(text); },
  run,
};
