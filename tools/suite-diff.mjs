// The suite gate's verdict when a shard is red (suite-gate.yml). A batch of pull requests used to need every check green on
// top of current main, so while main itself was red, every batch failed and nothing merged by itself (2026-11-06: the run for
// #2425 failed on the same 10 checks main's own verify run failed on 923ce15, and each of the 60 merges before it was made by
// hand). Now a red shard runs again on main alone, in the same job: a check the pull requests turned red fails the batch; a
// check that is just as red on main without them does not hold it. Nothing is skipped or retried away: both runs are the full
// shard, main's red still reverts and files its heal job through verify.yml, and every inherited red check is named.
//   node tools/suite-diff.mjs <pull-requests-output> <main-output>   exit 0 = no new red check, 1 = new red (or no verdict)
import { readFileSync, appendFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// a run that stopped early ran only part of the shard: its red list cannot be compared
const BROKEN = /^(suite ran to the end|the page hangs|suite budget:|check timeout:)/i;

/** a check's name as the comparison sees it: no detail after "  ->", no healed note, numbers as #. Pure. */
export function norm(name) {
  return String(name || '')
    .split('  -> ')[0]
    .replace(/\s+\(healed on a second run alone\)\s*$/, '')
    .replace(/\d+/g, '#')
    .replace(/\s+/g, ' ')
    .trim();
}

/** tools/test_void.mjs output -> { finished, broken, fails: Map(norm -> first full name) }. Pure. */
export function readRun(text) {
  const fails = new Map();
  let finished = false, broken = false;
  for (const raw of String(text || '').split('\n')) {
    const line = raw.replace(/^\d{4}-\d\d-\d\dT[\d:.]+Z\s/, '').trimEnd(); // a log copied from the runner keeps its time stamps
    if (/^\d+\/\d+ passed\b/.test(line)) finished = true;
    if (!line.startsWith('FAIL ')) continue;
    const name = line.slice(5);
    const key = norm(name);
    if (!key) continue;
    if (BROKEN.test(key)) broken = true;
    if (!fails.has(key)) fails.set(key, name.split('  -> ')[0].trim());
  }
  return { finished, broken, fails };
}

/**
 * pr: the shard on main with the pull requests merged in; main: the same shard on main alone. -> { ok, why, fresh, inherited }.
 * fresh: checks red with the pull requests and green (or not reached) on main. inherited: red on both. Pure.
 */
export function verdict(pr, main) {
  const out = (ok, why, fresh = [], inherited = []) => ({ ok, why, fresh, inherited });
  if (!pr || !pr.finished) return out(false, 'the suite did not finish with the pull requests merged in');
  if (pr.broken) return out(false, 'the suite stopped early with the pull requests merged in, so part of the shard never ran');
  if (!pr.fails.size) return out(true, 'every check passed');
  if (!main || !main.finished) return out(false, 'the same shard on main alone did not finish, so there is nothing to compare with');
  const fresh = [], inherited = [];
  for (const [key, name] of pr.fails) (main.fails.has(key) ? inherited : fresh).push(name);
  if (fresh.length) return out(false, `${fresh.length} check(s) red with the pull requests and not on main alone`, fresh, inherited);
  return out(true, `no new red check: the ${inherited.length} red here are just as red on main without these pull requests`, fresh, inherited);
}

/** the step summary. Pure. */
export function summary(v, shard = '') {
  const lines = [`### Shard ${shard || ''}: ${v.ok ? 'passes' : 'fails'} (${v.why})`];
  if (v.fresh.length) lines.push('', 'Red with the pull requests, not on main alone:', ...v.fresh.map((n) => '- ' + n.slice(0, 200)));
  if (v.inherited.length) lines.push('', 'Already red on main without them (verify.yml reverts and files the heal job):', ...v.inherited.map((n) => '- ' + n.slice(0, 200)));
  return lines.join('\n') + '\n';
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [prFile, mainFile] = process.argv.slice(2);
  const read = (f) => (f && existsSync(f) ? readFileSync(f, 'utf8') : '');
  const v = verdict(readRun(read(prFile)), mainFile && existsSync(mainFile) ? readRun(read(mainFile)) : null);
  const text = summary(v, process.env.VOID_SHARD || '');
  console.log(text);
  if (process.env.GITHUB_STEP_SUMMARY) { try { appendFileSync(process.env.GITHUB_STEP_SUMMARY, text); } catch (_) {} }
  process.exit(v.ok ? 0 : 1);
}
