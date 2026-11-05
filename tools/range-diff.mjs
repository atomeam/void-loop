// The real diff between two commits, and whether the earlier commit's failed jobs are still failed.
//   node tools/range-diff.mjs 2e272df9 5fa7a921
//   node tools/range-diff.mjs <earlier> <later> --repo owner/name
import { spawnSync } from 'node:child_process';
import { failuresFor } from '../void-live-deploy/lib/actions-log.js';
import { nameOnly, assertionLines, addressed, codeFiles } from '../void-live-deploy/lib/range-diff.js';

const args = process.argv.slice(2);
const repoFlag = args.indexOf('--repo');
const repo = repoFlag >= 0 ? args[repoFlag + 1] : 'atomeam/void-loop';
const shas = args.filter((a) => a !== '--repo' && a !== repo);
const [earlier, later] = shas;
if (!earlier || !later) {
  console.error('usage: node tools/range-diff.mjs <earlier-sha> <later-sha> [--repo owner/name]');
  process.exit(2);
}
const diff = spawnSync('git', ['diff', '--name-only', earlier, later], { encoding: 'utf8' });
if (diff.status !== 0) {
  console.error(diff.stderr || 'git diff failed');
  process.exit(1);
}
const files = nameOnly(diff.stdout);
const before = await failuresFor(earlier, { repo, logs: true, tail: 40 });
const after = await failuresFor(later, { repo, logs: true, tail: 40 });
if (before.error || after.error) {
  console.error(before.error || after.error);
  process.exit(1);
}
const jobs = addressed(before.names, after.names);
const assertions = assertionLines((before.jobs || []).map((j) => (j.tail || []).join('\n')).join('\n'));
const code = codeFiles(files);
console.log('files changed (' + files.length + '):');
for (const f of files) console.log('  ' + f);
console.log('code files in the diff: ' + (code.length ? code.join(', ') : 'none'));
console.log('failed jobs at ' + earlier + ': ' + jobs.before.length + (jobs.before.length ? ' (' + jobs.before.join(', ') + ')' : ''));
console.log('failed jobs at ' + later + ': ' + jobs.after.length + (jobs.after.length ? ' (' + jobs.after.join(', ') + ')' : ''));
console.log('still failing: ' + (jobs.still.length ? jobs.still.join(', ') : 'none'));
console.log('not failing on the later commit: ' + (jobs.gone.length ? jobs.gone.join(', ') : 'none'));
console.log('assertion lines from the earlier logs (' + assertions.length + '):');
for (const line of assertions) console.log('  ' + line);
