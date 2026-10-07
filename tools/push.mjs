// Push the current branch and make sure it landed: retries on a network or GitHub error (2s, 4s, 8s, 16s, 32s) and checks
// that the remote branch really points at this commit, since a 500 from GitHub can leave the old head in place.
//   node tools/push.mjs            push the current branch to origin
// Exits 0 once origin has HEAD, 1 if it never does (the last error is printed).
import { execFileSync } from 'node:child_process';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const branch = git('rev-parse', '--abbrev-ref', 'HEAD'), head = git('rev-parse', 'HEAD');
if (branch === 'HEAD') { console.error('push: not on a branch (detached HEAD)'); process.exit(1); }
const landed = () => { try { return git('ls-remote', 'origin', 'refs/heads/' + branch).startsWith(head); } catch (_) { return false; } };
let last = '';
for (const wait of [0, 2, 4, 8, 16, 32]) {
  if (wait) { console.error(`push: retrying in ${wait}s`); await new Promise((r) => setTimeout(r, wait * 1000)); }
  try { git('push', '-u', 'origin', branch); } catch (e) { last = String(e.stderr || e.message).split('\n').filter((l) => /error|rejected|fatal/i.test(l)).join(' ').slice(0, 300); }
  if (landed()) { console.log(`pushed ${branch} at ${head.slice(0, 7)}`); process.exit(0); }
}
console.error(`push: origin never got ${head.slice(0, 7)}${last ? ': ' + last : ''}`);
process.exit(1);
