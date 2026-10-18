#!/usr/bin/env node
// The files the repo keeps changing (churn caps for the build loop; void-live-deploy/lib/churn.js decides which are hot).
//   node tools/churn.mjs            print the hot files: changed more than 12 times in 7 days
//   node tools/churn.mjs --json     the same as JSON, for a caller that feeds lib/will-guard.js pickWant
import { execFileSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hotFiles, MAX_CHANGES, WINDOW_DAYS } from '../void-live-deploy/lib/churn.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** the commits of the last `days` days with the files each changed, from git (merges skipped, so a merge does not count its whole branch twice). */
export function commitsSince(days = WINDOW_DAYS, cwd = root) {
  const out = execFileSync('git', ['log', '--no-merges', '--since=' + days + '.days', '--name-only', '--format=@@%cI'], { cwd, encoding: 'utf8', maxBuffer: 64e6 });
  return out.split('@@').slice(1).map((b) => { const [at, ...files] = b.split('\n'); return { at: at.trim(), files: files.map((f) => f.trim()).filter(Boolean) }; });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hot = hotFiles(commitsSince());
  if (process.argv.includes('--json')) console.log(JSON.stringify(hot));
  else console.log(hot.length ? hot.map((h) => String(h.changes).padStart(4) + '  ' + h.file).join('\n') : 'no file changed more than ' + MAX_CHANGES + ' times in ' + WINDOW_DAYS + ' days');
}
