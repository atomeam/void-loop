import { execFileSync, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixTask, isTowerPath } from './merge-flow.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const repo = process.env.REPO || process.env.GITHUB_REPOSITORY || 'atomeam/void-loop';
const sh = (cmd, args) => execFileSync(cmd, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 << 20, timeout: 20 * 60e3 });
const git = (args) => sh('git', args);
const quiet = (args) => { try { return git(args); } catch (e) { return e.stdout || ''; } };

function coder(task) {
  try { console.log(String(sh(process.execPath, ['tools/verse-coder.mjs', '--max-turns', '8', '--repo', root, '--task', task])).slice(0, 400)); }
  catch (e) { console.log('coder: ' + String(e.stdout || e.stderr || e.message).slice(0, 400)); }
}
function towerBack() {
  const names = (quiet(['diff', '--name-only']) + '\n' + quiet(['diff', '--name-only', '--diff-filter=U'])).split('\n').map((s) => s.trim()).filter(isTowerPath);
  for (const f of [...new Set(names)]) { try { git(['checkout', '--ours', '--', f]); } catch (_) { try { git(['checkout', 'HEAD', '--', f]); } catch (_) {} } }
}
function conflicted() {
  const files = quiet(['diff', '--name-only', '--diff-filter=U']).split('\n').map((s) => s.trim()).filter(Boolean);
  if (!files.length) return false;
  try { git(['grep', '-l', '-e', '^<<<<<<< ', '--', ...files]); return true; } catch (e) { return e.status !== 1; }
}
function ship(ref, message) {
  towerBack();
  if (conflicted()) { console.log('still conflicted; not pushing'); return false; }
  if (!quiet(['status', '--porcelain']).trim()) { console.log('nothing to commit'); return false; }
  git(['add', '-A']); git(['commit', '-m', message]); git(['push', 'origin', 'HEAD:refs/heads/' + ref]);
  return true;
}
const checks = (ref, pr) => { try { sh(process.execPath, ['tools/loop-checks.mjs', '--ref', ref, '--repo', repo, '--from', 'pr-fix', ...(pr ? ['--pr', pr] : [])]); } catch (e) { console.log(String(e.stderr || e.message).slice(0, 160)); } };
const mode = process.env.MODE || 'main', why = String(process.env.WHY || '').replace(/\s+/g, ' ').slice(0, 400), pr = String(process.env.PR || '').trim();
try {
  if (mode === 'probe') {
    const { status } = spawnSync(process.execPath, ['tools/brain-probe.mjs'], { cwd: root, stdio: 'inherit', timeout: 120000 });
    process.exit(status == null ? 1 : status);
  }
  if (mode === 'main') {
    const sha = git(['rev-parse', 'HEAD']).trim(), branch = 'loop/main-fix-' + sha.slice(0, 7);
    const open = JSON.parse(sh('gh', ['pr', 'list', '--repo', repo, '--head', branch, '--state', 'open', '--json', 'number']) || '[]');
    if (open.length) { console.log('main fix already open #' + open[0].number); process.exit(0); }
    git(['checkout', '-B', branch]); coder(fixTask(mode, why));
    if (!ship(branch, 'Verse fixes main ' + sha.slice(0, 7))) process.exit(0);
    console.log(sh('gh', ['pr', 'create', '--repo', repo, '--base', 'main', '--head', branch, '--label', 'automerge', '--title', 'Verse fixes main ' + sha.slice(0, 7), '--body', 'Verse fixes main ' + sha.slice(0, 7) + ' because verify or the watchdog says it is failing. Automerge merges this.\n\n' + why]));
    checks(branch, '');
  } else {
    if (!/^\d+$/.test(pr)) { console.error('pr-fix: set PR'); process.exit(2); }
    const ref = sh('gh', ['pr', 'view', pr, '--repo', repo, '--json', 'headRefName', '-q', '.headRefName']).trim();
    git(['fetch', 'origin', ref, 'main']); git(['checkout', '-B', ref, 'origin/' + ref]);
    if (mode === 'conflict') { try { sh(process.execPath, ['tools/merge-main.mjs']); } catch (e) { console.log(String(e.stderr || e.message).slice(0, 200)); } }
    if (mode === 'red' || conflicted() || quiet(['diff', '--name-only', '--diff-filter=U']).trim()) coder(fixTask(mode, why));
    if (ship(ref, 'Verse fixes #' + pr)) { checks(ref, pr); console.log('pushed ' + ref); }
  }
} catch (e) { console.error(String(e.stderr || e.message || e).slice(0, 400)); process.exit(1); }
