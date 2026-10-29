#!/usr/bin/env node
// The files the repo keeps changing (churn caps for the build loop; void-live-deploy/lib/churn.js decides which are hot).
//   node tools/churn.mjs            print the hot files: changed more than 12 times in 7 days
//   node tools/churn.mjs --json     the same as JSON
//   node tools/churn.mjs --write    write void-live-deploy/churn.json ({ at, max, days, hot }), which functions/api/will.js reads and hands to pickWant
//   node tools/churn.mjs --check    exit 1 when churn.json's hot list is not what git says now (the time it was written is not compared)
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hotFiles, MAX_CHANGES, WINDOW_DAYS, SWEEP_FILES } from '../void-live-deploy/lib/churn.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** the commits of the last `days` days with the files each changed, from git (merges skipped, so a merge does not count its whole branch twice). */
export function commitsSince(days = WINDOW_DAYS, cwd = root) {
  const out = execFileSync('git', ['log', '--no-merges', '--since=' + days + '.days', '--name-only', '--format=@@%cI'], { cwd, encoding: 'utf8', maxBuffer: 64e6 });
  return out.split('@@').slice(1).map((b) => { const [at, ...files] = b.split('\n'); return { at: at.trim(), files: files.map((f) => f.trim()).filter(Boolean) }; });
}
/** what churn.json holds for this hot list. Pure. */
export const churnJson = (hot, at = new Date().toISOString()) => ({ at, max: MAX_CHANGES, days: WINDOW_DAYS, sweep: SWEEP_FILES, hot });
export const OUT = resolve(root, 'void-live-deploy/churn.json');
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hot = hotFiles(commitsSince()), argv = process.argv;
  if (argv.includes('--write')) { writeFileSync(OUT, JSON.stringify(churnJson(hot), null, 1) + '\n'); console.log('churn.json: ' + hot.length + ' hot file' + (hot.length === 1 ? '' : 's')); }
  else if (argv.includes('--check')) {
    let had = null; try { had = JSON.parse(readFileSync(OUT, 'utf8')).hot; } catch (_) { had = null; }
    if (JSON.stringify(had) !== JSON.stringify(hot)) { console.log('churn.json is stale (run node tools/churn.mjs --write)'); process.exit(1); }
    console.log('churn.json is current: ' + hot.length + ' hot');
  }
  else if (argv.includes('--json')) console.log(JSON.stringify(hot));
  else console.log(hot.length ? hot.map((h) => String(h.changes).padStart(4) + '  ' + h.file).join('\n') : 'no file changed more than ' + MAX_CHANGES + ' times in ' + WINDOW_DAYS + ' days');
}
