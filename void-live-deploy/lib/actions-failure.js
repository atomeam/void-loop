// The GitHub Actions failure reader (asked by Verse: "Automate the extraction of failing job names and error logs from GitHub Actions for
// commit 814032d5." and "Open the GitHub Actions tab for commit 814032d5, identify the four specific failed job names, and extract the last
// 30 lines of the failing step within python-tests."). For any red workflow run, not one hand-picked commit: the failed jobs of the run, the
// step that failed in each, and the last 30 lines of that step's log, with every key, token and password masked by the same redact() the
// automation fixer uses. tools/actions-failure.mjs fetches the run with the job's own GITHUB_TOKEN (actions: read) and writes one file per
// run to void-live-deploy/incidents/actions/; tools/incident-log.mjs assemble folds them into the served incidents.json as "actions", and
// the incident autopsy skill shows them. Pure: data in, data and markup out. No network, no model, no key.
import { redact } from './automation-fix.js';

export const TAIL = 30; // lines of the failing step kept
export const MAX_JOBS = 8; // failed jobs kept per run
export const LINE_MAX = 300; // characters kept per log line
export const KEEP_RUNS = 20; // runs kept in the served incidents.json

const SHA = /^[0-9a-f]{7,40}$/i;
const STAMP = /^﻿?(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z) ?/;
const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
// runner bookkeeping lines that say nothing about the failure
const NOISE = /^##\[(?:endgroup|end-action|add-matcher|remove-matcher)\b/;

/** the failed jobs of a run's jobs listing (GET /actions/runs/{id}/jobs), in the listing's order: a job that failed or timed out. Pure. */
export function failedJobs(jobsJson) {
  const list = Array.isArray(jobsJson) ? jobsJson : jobsJson && Array.isArray(jobsJson.jobs) ? jobsJson.jobs : [];
  return list.filter((j) => j && (j.conclusion === 'failure' || j.conclusion === 'timed_out'))
    .map((j) => ({ id: Number(j.id) || 0, name: String(j.name || '').slice(0, 120), url: /^https:\/\/github\.com\//.test(String(j.html_url || '')) ? String(j.html_url) : '', conclusion: String(j.conclusion), step: failedStep(j) }));
}

/** the step that failed in a job: the first failed step by number (a later "say which job went red" step fails because the first did), or null. Pure. */
export function failedStep(job) {
  const steps = (job && Array.isArray(job.steps) ? job.steps : []).filter((s) => s && (s.conclusion === 'failure' || s.conclusion === 'timed_out'));
  if (!steps.length) return null;
  const s = [...steps].sort((a, b) => (Number(a.number) || 0) - (Number(b.number) || 0))[0];
  return { number: Number(s.number) || 0, name: String(s.name || '').slice(0, 200), started_at: s.started_at || null, completed_at: s.completed_at || null };
}

/** one log line as a person reads it: no timestamp, no colour codes, "##[error]" as "Error: ", secrets masked, at most LINE_MAX characters. Pure. */
export function cleanLine(line) {
  const s = String(line == null ? '' : line).replace(/\r$/, '').replace(STAMP, '').replace(ANSI, '')
    .replace(/^##\[error\]/, 'Error: ').replace(/^##\[warning\]/, 'Warning: ').replace(/^##\[notice\]/, 'Notice: ').replace(/^##\[group\]/, '');
  return redact(s).slice(0, LINE_MAX);
}

/** the lines of a job log, each with the time it was written (a line without a stamp keeps the time of the line before). Pure. */
export function logLines(text) {
  let t = NaN;
  return String(text == null ? '' : text).split('\n').map((raw) => {
    const m = STAMP.exec(raw);
    if (m) t = Date.parse(m[1]);
    return { t, raw };
  });
}

/** the step's own lines: written between its start and its end (whole seconds from the API, so the end second is kept whole), up to and
 *  including its "Process completed with exit code" error (a step that runs later in the same second is left out), else its last error
 *  line, else the window's end; runner bookkeeping dropped. Without step times, the whole log. Pure. */
export function stepLines(logText, step) {
  const start = step && Date.parse(step.started_at), end = step && Date.parse(step.completed_at);
  const timed = Number.isFinite(start) && Number.isFinite(end), body = (l) => l.raw.replace(STAMP, '');
  const win = logLines(logText).filter((l) => !timed || (Number.isFinite(l.t) && l.t >= start && l.t < end + 1000)).filter((l) => !NOISE.test(body(l)));
  let at = win.findIndex((l) => /^##\[error\]Process completed with exit code/.test(body(l)));
  if (at < 0) { for (let k = win.length - 1; k >= 0; k--) if (/^##\[error\]/.test(body(win[k]))) { at = k; break; } }
  return at < 0 ? win : win.slice(0, at + 1);
}

/** the last `n` lines of the failing step (stepLines), cleaned (cleanLine), blank lines at either end dropped. Pure. */
export function stepTail(logText, step, n = TAIL) {
  const keep = Math.max(1, Math.min(200, n | 0)), lines = stepLines(logText, step);
  return lines.slice(Math.max(0, lines.length - keep)).map((l) => cleanLine(l.raw)).filter((x, k, a) => x.trim() || (k > 0 && k < a.length - 1));
}

/** what failed, by name: the lines of the failing step that say a test or check failed ("not ok 10 - ...", "FAIL ...", an error line other
 *  than the exit code), each once, at most `max`. The last lines often end on a summary ("203/207 passed"); these say which. Pure. */
export const FAIL_LINE = /^\s*(?:not ok \d+\b|FAIL\b|\u2716 |AssertionError|Traceback \(most recent call last\)|npm ERR!|Error: (?!Process completed with exit code))/;
export function failLines(logText, step, max = 10) {
  const seen = new Set(), out = [];
  for (const l of stepLines(logText, step)) {
    const c = cleanLine(l.raw);
    if (!FAIL_LINE.test(c) || seen.has(c)) continue;
    // an "Error: <name>" annotation that repeats a FAIL line already kept, or a bare count ("Error: 4"), adds nothing
    if (/^Error: /.test(c)) { const rest = c.slice(7).trim(); if (rest.length < 8 || out.some((o) => o.includes(rest.slice(0, 60)))) continue; }
    seen.add(c); out.push(c);
    if (out.length >= max) break;
  }
  return out;
}

/**
 * One stored record of a red run: when, which commit and workflow, and each failed job with its failing step and the step's last lines.
 * `logs` maps a job id to its log text, or to { error } when the log could not be read (said on the job, never worked around). Pure.
 */
export function entryOf(run, jobsJson, logs = {}) {
  const r = run || {}, sha = String(r.head_sha || '').toLowerCase();
  const jobs = failedJobs(jobsJson).slice(0, MAX_JOBS).map((j) => {
    const log = logs[j.id], base = { name: j.name, id: j.id, url: j.url, conclusion: j.conclusion, step: j.step ? { number: j.step.number, name: j.step.name } : null };
    if (log && typeof log === 'object' && log.error) return { ...base, tail: [], note: 'log not read: ' + String(log.error).slice(0, 120) };
    if (typeof log !== 'string') return { ...base, tail: [], note: 'log not read' };
    return { ...base, fails: failLines(log, j.step), tail: stepTail(log, j.step) };
  });
  return {
    at: String(r.updated_at || r.created_at || new Date().toISOString()), sha: SHA.test(sha) ? sha : '', runId: Number(r.id) || 0,
    run: /^https:\/\/github\.com\//.test(String(r.html_url || '')) ? String(r.html_url) : '', workflow: String(r.name || '').slice(0, 80),
    event: String(r.event || '').slice(0, 40), branch: String(r.head_branch || '').slice(0, 80), conclusion: String(r.conclusion || ''), jobs,
  };
}

/** the well-formed run records of a parsed incidents.json ("actions") or of a list, newest first. Pure. */
export function parseActions(j) {
  const list = Array.isArray(j) ? j : j && Array.isArray(j.actions) ? j.actions : [];
  return list.filter((a) => a && SHA.test(String(a.sha || '')) && Array.isArray(a.jobs) && Number.isFinite(Date.parse(a.at)))
    .map((a) => ({ at: String(a.at), sha: String(a.sha).toLowerCase(), runId: Number(a.runId) || 0, run: /^https:\/\/github\.com\//.test(String(a.run || '')) ? String(a.run) : '', workflow: String(a.workflow || '').slice(0, 80),
      jobs: a.jobs.filter((x) => x && x.name).slice(0, MAX_JOBS).map((x) => ({ name: String(x.name).slice(0, 120), url: /^https:\/\/github\.com\//.test(String(x.url || '')) ? String(x.url) : '',
        step: x.step && x.step.name ? { number: Number(x.step.number) || 0, name: String(x.step.name).slice(0, 200) } : null,
        fails: (Array.isArray(x.fails) ? x.fails : []).slice(0, 10).map((l) => String(l == null ? '' : l).slice(0, LINE_MAX)),
        tail: (Array.isArray(x.tail) ? x.tail : []).slice(-200).map((l) => String(l == null ? '' : l).slice(0, LINE_MAX)), ...(x.note ? { note: String(x.note).slice(0, 140) } : {}) })) }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

/** the records of one commit (a 7 to 40 character prefix), and within them only the jobs named `job` when one is given ("browser-suite" is
 *  every shard of it); all when no sha. `names` keeps every failed job's name of the run either way. Pure. */
export function failuresFor(list, { sha = '', job = '' } = {}) {
  const s = String(sha || '').toLowerCase(), want = String(job || '').toLowerCase().trim();
  return parseActions(list).filter((a) => !s || a.sha.startsWith(s))
    .map((a) => ({ ...a, names: a.jobs.map((x) => x.name), jobs: want ? a.jobs.filter((x) => x.name.toLowerCase() === want || x.name.toLowerCase().startsWith(want + ' ')) : a.jobs }))
    .filter((a) => a.jobs.length);
}

const escHtml = (s) => String(s == null ? '' : s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/**
 * The failed jobs as markup: per red run, the workflow and commit, then each failed job with its failing step and that step's last lines
 * (open when one job is asked for, folded otherwise). Says plainly when nothing is recorded for the commit asked. All text escaped. Pure.
 */
export function actionsHtml(list, esc = escHtml, { sha = '', job = '', runs = 3 } = {}) {
  const found = failuresFor(list, { sha, job }).slice(0, Math.max(1, runs | 0));
  const head = '<div class="vh">Failed GitHub Actions jobs</div>';
  if (!found.length) return head + '<div class="sub" data-actions-empty="1">' + (sha ? 'No failed job recorded for commit ' + esc(String(sha).slice(0, 12)) + (job ? ' named ' + esc(job) : '') + '.' : 'No failed job recorded yet.') + '</div>';
  const n = found.reduce((k, a) => k + a.jobs.length, 0);
  return head + '<div data-actions="' + esc(n) + '">' + found.map((a) => '<div data-actions-run="' + esc(a.runId) + '" style="margin:4px 0 8px"><div><b>' + esc(a.workflow || 'workflow') + '</b> on <code>' + esc(a.sha.slice(0, 8)) + '</code> <span class="sub">' + esc(a.at.slice(0, 16).replace('T', ' ')) + ' UTC'
    + (a.run ? ' · <a href="' + esc(a.run) + '" target="_blank" rel="noopener">the run</a>' : '') + ' · ' + esc(a.names.length) + ' failed job' + (a.names.length === 1 ? '' : 's') + ': ' + a.names.map((x) => esc(x)).join(', ') + '</span></div>'
    + '<ul style="margin:2px 0 0 18px;padding:0">' + a.jobs.map((x) => '<li data-failed-job="' + esc(x.name) + '"><b>' + esc(x.name) + '</b>' + (x.step ? ' <span class="sub">failed at step ' + esc(x.step.number) + ': ' + esc(x.step.name) + '</span>' : ' <span class="sub">no failed step listed</span>')
      + (x.fails.length ? '<div class="sub" data-fail-lines="' + esc(x.fails.length) + '">What failed:</div><ul style="margin:0 0 2px 16px;padding:0">' + x.fails.map((f) => '<li style="white-space:normal;overflow-wrap:anywhere"><code>' + esc(f) + '</code></li>').join('') + '</ul>' : '')
      + (x.tail.length ? '<details' + (job ? ' open' : '') + '><summary class="sub">the last ' + esc(x.tail.length) + ' lines of that step</summary><pre data-step-tail="' + esc(x.tail.length) + '" style="white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;margin:2px 0">' + esc(x.tail.join('\n')) + '</pre></details>'
        : '<div class="sub">' + esc(x.note || 'no log lines kept') + '</div>') + '</li>').join('') + '</ul></div>').join('') + '</div>'
    + '<div class="src">Source: incidents/actions/, written by tools/actions-failure.mjs when a workflow run on main fails (keys and tokens masked)</div>';
}
