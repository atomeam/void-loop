#!/usr/bin/env node
// The GitHub Actions failure reader (asked by Verse: "Automate the extraction of failing job names and error logs from GitHub Actions for
// commit 814032d5."). For a red workflow run, or every red run of one commit: the failed jobs, the step that failed in each and the last
// 30 lines of that step's log (void-live-deploy/lib/actions-failure.js, keys and tokens masked), one file per run in
// void-live-deploy/incidents/actions/<run id>.json, beside the incident entries. actions-failures.yml runs it when a workflow run on main
// fails, with the job's own GITHUB_TOKEN (actions: read). Reads GitHub's REST API through `gh api`; a log GitHub refuses (expired, no
// access) is recorded as not read, never fetched another way.
//   node tools/actions-failure.mjs record --run <run id>   the failed jobs of one run
//   node tools/actions-failure.mjs record --sha <sha>      every failed run of one commit (any 7 to 40 character prefix)
//   node tools/actions-failure.mjs list [<sha>]            what is recorded, newest first
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { entryOf, parseActions, failuresFor, KEEP_RUNS } from '../void-live-deploy/lib/actions-failure.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const DIR = resolve(root, 'void-live-deploy/incidents/actions');
const REPO = /^[\w.-]+\/[\w.-]+$/.test(String(process.env.GITHUB_REPOSITORY || '')) ? process.env.GITHUB_REPOSITORY : 'atomeam/void-loop';

/** GET a REST path with gh; text, or { error } with the first line gh printed (an HTTP 403 or 410 for a log, say). Never throws. */
export function ghGet(path, run = execFileSync) {
  try { return run('gh', ['api', path], { encoding: 'utf8', timeout: 60e3, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch (e) { return { error: (String(e && e.stderr || e && e.message || 'gh api failed').split('\n').find((x) => x.trim()) || 'gh api failed').slice(0, 160) }; }
}
const json = (x) => { if (typeof x !== 'string') return null; try { return JSON.parse(x); } catch (_) { return null; } };

/** one run's record: the run, its jobs, and the log of each failed job; null when the run cannot be read or no job failed. */
export function readRun(id, get = ghGet) {
  if (!/^\d{1,20}$/.test(String(id))) return null;
  const run = json(get(`repos/${REPO}/actions/runs/${id}`)), jobs = json(get(`repos/${REPO}/actions/runs/${id}/jobs?per_page=100&filter=latest`));
  if (!run || !jobs) return null;
  const draft = entryOf(run, jobs);
  if (!draft.jobs.length) return null;
  const logs = {};
  for (const j of draft.jobs) logs[j.id] = get(`repos/${REPO}/actions/jobs/${j.id}/logs`);
  return entryOf(run, jobs, logs);
}

/** the ids of the failed runs of one commit (the sha is first made whole through the commits API). */
export function failedRunsOf(sha, get = ghGet) {
  if (!/^[0-9a-f]{7,40}$/i.test(String(sha || ''))) return [];
  const c = json(get(`repos/${REPO}/commits/${sha}`)), full = c && c.sha;
  if (!full) return [];
  const runs = json(get(`repos/${REPO}/actions/runs?head_sha=${full}&per_page=100`));
  return ((runs && runs.workflow_runs) || []).filter((r) => r && (r.conclusion === 'failure' || r.conclusion === 'timed_out')).map((r) => r.id);
}

export function readAll(dir = DIR) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try { out.push(JSON.parse(readFileSync(resolve(dir, name), 'utf8'))); } catch (_) { /* a torn file is skipped */ }
  }
  return out;
}
/** the run records the site serves: newest first, the newest KEEP_RUNS. */
export const readActions = (dir = DIR, keep = KEEP_RUNS) => parseActions(readAll(dir)).slice(0, keep);

export function writeEntry(entry, dir = DIR) {
  mkdirSync(dir, { recursive: true });
  const path = resolve(dir, String(Number(entry.runId) || 0) + '.json');
  writeFileSync(path, JSON.stringify(entry, null, 1) + '\n');
  return path;
}

const say = (e) => e.workflow + ' on ' + e.sha.slice(0, 8) + ': ' + e.jobs.map((j) => j.name + (j.step ? ' (step ' + j.step.number + ': ' + j.step.name + ')' : '') + (j.note ? ' [' + j.note + ']' : ' [' + j.tail.length + ' lines]')).join('; ');

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, flag, value] = process.argv.slice(2);
  if (cmd === 'record' && (flag === '--run' || flag === '--sha')) {
    const ids = flag === '--run' ? [value] : failedRunsOf(value);
    if (!ids.length) { console.log('actions-failure: no failed run found for ' + String(value || '').slice(0, 40)); process.exit(0); }
    let n = 0;
    for (const id of ids) {
      const e = readRun(id);
      if (!e) { console.log('actions-failure: run ' + id + ': no failed job (or the run could not be read)'); continue; }
      writeEntry(e); n++;
      console.log('actions-failure: ' + say(e));
    }
    console.log('actions-failure: ' + n + ' run(s) recorded in void-live-deploy/incidents/actions/');
  } else if (cmd === 'list') {
    for (const e of failuresFor(readAll(), { sha: flag || '' })) console.log(e.at + ' ' + say(e));
  } else { console.error('usage: node tools/actions-failure.mjs record --run <run id> | record --sha <sha> | list [<sha>]'); process.exit(2); }
}
