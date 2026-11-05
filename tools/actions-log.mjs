// Print the failed GitHub Actions jobs for a commit. Any commit, not one hard-coded sha.
//   node tools/actions-log.mjs <sha>
//   node tools/actions-log.mjs <sha> --repo owner/name
import { failuresFor } from '../void-live-deploy/lib/actions-log.js';

const sha = process.argv[2];
const repoFlag = process.argv.indexOf('--repo');
const repo = repoFlag >= 0 ? process.argv[repoFlag + 1] : 'atomeam/void-loop';
if (!sha || sha.startsWith('--')) {
  console.error('usage: node tools/actions-log.mjs <sha> [--repo owner/name]');
  process.exit(2);
}
const report = await failuresFor(sha, { repo, logs: true, tail: 30 });
if (report.error) {
  console.error(report.error);
  process.exit(1);
}
console.log(report.count + ' failed' + (report.names.length ? ': ' + report.names.join(', ') : ''));
for (const j of report.jobs) {
  console.log('- ' + j.name + (j.step ? ' (step: ' + j.step + ')' : '') + ' [' + j.conclusion + ']');
  for (const line of j.tail) console.log('  ' + line);
}
if (report.count !== report.names.length) {
  console.error('count ' + report.count + ' does not match ' + report.names.length + ' names');
  process.exit(1);
}
