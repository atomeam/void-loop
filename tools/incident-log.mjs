// Incidents (asked by Verse, four times: "an automatic trigger that creates an 'incident' skill entry whenever a 3D suite check
// fails"): every red browser suite on main becomes one entry in void-live-deploy/incidents.json, written by verify.yml right
// after the suite fails (the commit tested, the run, the checks that failed). skills/incident.js answers "what broke lately" from
// that file and offers the blameless brief prefilled with the first failed check. The file is public like the repo: check names,
// shas and run links only, never a visitor's words (the suite's asks are its own).
//   node tools/incident-log.mjs record <sha> <run-url> <test-output.txt>   append one entry (verify.yml); nothing when no FAIL line
//   node tools/incident-log.mjs record <sha> <run-url> <test-output.txt> <shards>   the same, with the shards that failed ("2,4")
//   node tools/incident-log.mjs pass <sha> <run-url> <shards>               the shards that passed on <sha> ("1,3"): an open incident on an
//                                                                           earlier commit of <sha> closes once every shard it failed has passed
//   node tools/incident-log.mjs resolve <sha> <run-url>                    close every open incident after a green suite on main: closedAt, closedBy, minutes
//   node tools/incident-log.mjs list                                       print the entries, newest first
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = resolve(root, 'void-live-deploy/incidents.json');
export const KEEP = 30;
/** the browser suite's shards (verify.yml browser-suite matrix): an incident recorded before the shards were kept waits for all of them */
export const SHARDS = [1, 2, 3, 4];
/** the shard numbers in a list or a "2,4" string, each once, in order; anything else left out. Pure. */
export function shardsOf(v) {
  const a = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[\s,]+/);
  return [...new Set(a.map((x) => Number(x)).filter((n) => SHARDS.includes(n)))].sort((x, y) => x - y);
}

/** the names of the failed checks in a suite's output ("FAIL <name>  -> <what it got>"), each once, in order. Pure. */
export function parseFails(text) {
  const seen = new Set(), out = [];
  for (const line of String(text || '').split('\n')) {
    const m = /^FAIL (.+?)(?:\s+->\s.*)?$/.exec(line.replace(/\r$/, ''));
    if (!m) continue;
    const name = m[1].trim();
    if (name && !seen.has(name)) { seen.add(name); out.push(name); }
  }
  return out;
}

/** the repo paths one commit changed (first parent, so a merge shows what it brought), safe path characters only, at most 15. Never throws. */
export function touchedBy(sha, cwd = root) {
  if (!/^[0-9a-f]{7,40}$/.test(String(sha || ''))) return [];
  try {
    const out = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', '-m', '--first-parent', sha], { cwd, encoding: 'utf8', timeout: 20e3, stdio: ['ignore', 'pipe', 'ignore'] });
    return out.split('\n').map((x) => x.trim()).filter((x) => /^[\w./@-]{1,120}$/.test(x)).slice(0, 15);
  } catch (_) { return []; }
}

/** one entry from a failed suite; null when nothing failed (a run that died before the suite is not an incident of the suite). Pure. */
export function incidentOf({ sha, run, output, at = new Date().toISOString(), suite = 'browser suite on main', touched = [], shards = [] }) {
  const checks = parseFails(output);
  if (!checks.length) return null;
  const failed = shardsOf(shards); // which shards went red, so a later green run of those shards can close it (passShards)
  return { at, sha: String(sha || '').slice(0, 40), run: /^https:\/\/github\.com\//.test(String(run || '')) ? run : '', suite, checks: checks.slice(0, 20), touched: (Array.isArray(touched) ? touched : []).slice(0, 15), ...(failed.length ? { shards: failed } : {}) };
}

/** the list with one more entry at the front, the newest KEEP kept. The same sha is never written twice: a second record for it
 *  (another shard, a re-run) adds its checks to the first entry instead of replacing them. Pure. */
export function addIncident(list, inc, keep = KEEP) {
  const all = Array.isArray(list) ? list : [], prev = all.find((x) => x && x.sha === inc.sha);
  const rest = all.filter((x) => x && x.sha !== inc.sha);
  const shards = prev ? shardsOf([...(prev.shards || []), ...(inc.shards || [])]) : [];
  const merged = prev ? { ...inc, checks: [...new Set([...(prev.checks || []), ...inc.checks])].slice(0, 20), ...(shards.length ? { shards } : {}) } : inc;
  return [merged, ...rest].slice(0, keep);
}

/** the list with every open incident closed by a green suite: those that began at or before `at` get closedAt, closedBy (the sha that passed), closedRun and the minutes they lasted. An incident already closed is left as it was. Pure. */
export function closeOpen(list, { sha, run, at = new Date().toISOString() } = {}) {
  const end = Date.parse(at);
  return (Array.isArray(list) ? list : []).map((i) => {
    if (!i || i.closedAt || !Number.isFinite(end) || !(Date.parse(i.at) <= end)) return i;
    return { ...i, closedAt: at, closedBy: String(sha || '').slice(0, 40), closedRun: /^https:\/\/github\.com\//.test(String(run || '')) ? run : '', minutes: Math.max(0, Math.round((end - Date.parse(i.at)) / 60e3)) };
  });
}

/**
 * the list after the shards `shards` passed on commit `sha`. The suite runs as four shards, each queued on its own (verify.yml), and on a busy
 * main they almost never all finish on one commit: from 25 to 29 October not one run had all four green, so closeOpen never ran and every
 * incident stayed open after it was fixed. A shard that passes on a later commit has run every check it holds, so an open incident on an
 * earlier commit (isEarlier(its sha), a git ancestor) counts that shard as passed again; once each shard it failed (all four for an entry
 * recorded before the shards were kept) has passed, it closes as closeOpen would. The commit itself and a later one are left alone. Pure.
 */
export function passShards(list, { sha, run, at = new Date().toISOString(), shards = [], isEarlier = () => false } = {}) {
  const ok = shardsOf(shards), end = Date.parse(at), by = String(sha || '').slice(0, 40);
  if (!ok.length || !Number.isFinite(end)) return Array.isArray(list) ? list : [];
  return (Array.isArray(list) ? list : []).map((i) => {
    if (!i || i.closedAt || !i.sha || by.startsWith(String(i.sha)) || String(i.sha).startsWith(by) || !(Date.parse(i.at) <= end) || !isEarlier(i.sha)) return i;
    const need = shardsOf(i.shards).length ? shardsOf(i.shards) : SHARDS, passed = shardsOf([...(i.passed || []), ...ok.filter((n) => need.includes(n))]);
    if (need.some((n) => !passed.includes(n))) return passed.length === shardsOf(i.passed).length ? i : { ...i, passed };
    return { ...i, passed, closedAt: at, closedBy: by, closedRun: /^https:\/\/github\.com\//.test(String(run || '')) ? run : '', minutes: Math.max(0, Math.round((end - Date.parse(i.at)) / 60e3)) };
  });
}

/** whether commit `older` is an earlier commit of `sha` on its history (git merge-base --is-ancestor). Never throws: false when unsure. */
export function isAncestor(older, sha, cwd = root) {
  if (!/^[0-9a-f]{7,40}$/.test(String(older || '')) || !/^[0-9a-f]{7,40}$/.test(String(sha || ''))) return false;
  try { execFileSync('git', ['merge-base', '--is-ancestor', older, sha], { cwd, timeout: 20e3, stdio: 'ignore' }); return true; } catch (_) { return false; }
}

/** how many incidents are open (not closed by a green suite). Pure. */
export const openCount = (list) => (Array.isArray(list) ? list : []).filter((i) => i && !i.closedAt).length;

export function readLog(file = OUT) { try { return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')).incidents || [] : []; } catch (_) { return []; } }

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, sha, run, file, failedShards] = process.argv.slice(2);
  if (cmd === 'record') {
    const inc = incidentOf({ sha, run, output: file && existsSync(file) ? readFileSync(file, 'utf8') : '', touched: touchedBy(sha), shards: failedShards });
    if (!inc) { console.log('incident-log: no FAIL line, nothing recorded'); process.exit(0); }
    const list = addIncident(readLog(), inc);
    writeFileSync(OUT, JSON.stringify({ note: 'Every red browser suite on main, newest first (tools/incident-log.mjs, written by verify.yml; asked by Verse). Check names and shas only.', incidents: list }, null, 1) + '\n');
    console.log('incident-log: recorded ' + inc.checks.length + ' failed check(s) for ' + inc.sha.slice(0, 7) + ' (' + list.length + ' kept)');
  } else if (cmd === 'resolve') { // after a green suite on main: close the incidents still open
    const before = readLog(), list = closeOpen(before, { sha, run });
    const n = openCount(before) - openCount(list);
    if (!n) { console.log('incident-log: nothing open to close'); process.exit(0); }
    writeFileSync(OUT, JSON.stringify({ note: 'Every red browser suite on main, newest first, with the green suite that closed it (tools/incident-log.mjs; asked by Verse). Check names and shas only.', incidents: list }, null, 1) + '\n');
    console.log('incident-log: closed ' + n + ' incident(s) at ' + String(sha || '').slice(0, 7));
  } else if (cmd === 'pass') { // shards that passed on <sha> (the third argument, "1,3"): close what they fixed on earlier commits
    const before = readLog(), list = passShards(before, { sha, run, shards: file, isEarlier: (older) => isAncestor(older, sha) });
    const n = openCount(before) - openCount(list);
    if (JSON.stringify(before) === JSON.stringify(list)) { console.log('incident-log: shard(s) ' + shardsOf(file).join(',') + ' passed at ' + String(sha || '').slice(0, 7) + ', nothing open to mark'); process.exit(0); }
    writeFileSync(OUT, JSON.stringify({ note: 'Every red browser suite on main, newest first, with the green shards that closed it (tools/incident-log.mjs; asked by Verse). Check names and shas only.', incidents: list }, null, 1) + '\n');
    console.log('incident-log: shard(s) ' + shardsOf(file).join(',') + ' passed at ' + String(sha || '').slice(0, 7) + ', ' + n + ' incident(s) closed');
  } else if (cmd === 'backfill') {
    const list = readLog().map((i) => (Array.isArray(i.touched) ? i : { ...i, touched: touchedBy(i.sha) }));
    writeFileSync(OUT, JSON.stringify({ note: 'Every red browser suite on main, newest first (tools/incident-log.mjs, written by verify.yml; asked by Verse). Check names, shas and the paths the commit changed only.', incidents: list }, null, 1) + '\n');
    console.log('incident-log: backfilled ' + list.filter((i) => i.touched.length).length + ' of ' + list.length);
  } else if (cmd === 'list') {
    for (const i of readLog()) console.log(i.at + ' ' + i.sha.slice(0, 7) + (i.closedAt ? ' closed after ' + i.minutes + ' min' : ' OPEN') + ' ' + i.checks.length + ' failed: ' + i.checks.map((c) => c.slice(0, 60)).join(' | '));
  } else { console.error('usage: node tools/incident-log.mjs record <sha> <run-url> <test-output.txt> [shards] | pass <sha> <run-url> <shards> | resolve <sha> <run-url> | backfill | list'); process.exit(2); }
}
