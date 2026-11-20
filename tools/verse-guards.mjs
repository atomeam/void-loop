// Verse's self-guards (void-live-deploy/lib/verse-guards.js). A guard is one module in tools/guards/<id>.mjs: `export async function run(ctx)`
// that returns { last, ok, note?, paidCents?, minutes? } and may change files through ctx.save (the house lane ships the change as a pull request)
// or queue a heal job through ctx.queueJob (the coder opens the fix). The house lanes call runRides(lane) after their own job.
//   node tools/verse-guards.mjs list
//   node tools/verse-guards.mjs run <id>... [--dry]      one guard now (no file written with --dry)
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { GUARDS, guardsFor, recordOf, changed, blankGuard } from '../void-live-deploy/lib/verse-guards.js';
import { LOOPS } from '../void-live-deploy/lib/house-loops.js';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = (process.env.VOID_SITE || 'https://a-to-mind.com').replace(/\/+$/, '');
const logPath = (id) => join(root, 'void-live-deploy/progress/loops', id + '.json');
const read = (p) => { try { return readFileSync(p, 'utf8'); } catch { return ''; } };

/** a GET that never throws: { status, text, headers }. */
export async function hit(path, { site = SITE, ms = 15000, init = {} } = {}) {
  try {
    const r = await fetch(path.startsWith('http') ? path : site + path, { redirect: 'manual', signal: AbortSignal.timeout(ms), ...init, headers: { 'user-agent': 'Verse-guard', ...(init.headers || {}) } });
    return { status: r.status, text: r.ok ? await r.text() : '', headers: r.headers };
  } catch { return { status: 0, text: '', headers: new Headers() }; }
}
/** a heal job for the coder (the owner-token queue the conductor reads). One open job per target; the queue refuses a second. Never throws. */
export async function queueJob(ask, target, env = process.env, site = SITE) {
  const token = env.VOID_OWNER_TOKEN;
  if (!token) return { queued: false, why: 'no queue key on this runner' };
  try {
    const r = await fetch(site + '/api/queue', { method: 'POST', signal: AbortSignal.timeout(15000), headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json', 'user-agent': 'a2m-guard/1' }, body: JSON.stringify({ ask: String(ask).slice(0, 200), target: String(target).slice(0, 40) }) });
    return { queued: r.status === 200, why: 'queue answered ' + r.status };
  } catch (e) { return { queued: false, why: 'queue unreachable' }; }
}

let pw = null;
/** playwright-core: the repo's own when it is installed, else one copy in a temp folder (a house lane has no node_modules). Null when neither works. */
export async function loadPlaywright() {
  if (pw) return pw;
  try { pw = await import('playwright-core'); return pw; } catch (e) { console.log('guards: playwright-core is not installed here (' + String(e.code || e.message).slice(0, 60) + '), fetching it'); }
  const dir = join(tmpdir(), 'verse-guard-pw');
  try {
    if (!existsSync(join(dir, 'node_modules/playwright-core'))) { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, 'package.json'), '{"private":true}'); const v = JSON.parse(read(join(root, 'package.json'))).dependencies?.['playwright-core'] || 'latest'; const r = spawnSync('npm', ['install', '--no-audit', '--no-fund', '--silent', 'playwright-core@' + v], { cwd: dir, timeout: 120000 }); if (r.status !== 0) return null; }
    pw = await import(pathToFileURL(join(dir, 'node_modules/playwright-core/index.mjs')).href); return pw;
  } catch { return null; }
}
export const CHROME = () => ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'].find((p) => existsSync(p)) || process.env.CHROME_PATH;
/** put one commit back by reverting it on its own helper/ branch (a worktree, so the lane's files are untouched). helper-pr.yml opens the pull request on the push. */
export function revertOnBranch(sha, branch, why, check = () => true, run = (a, o) => spawnSync('git', a, { cwd: root, encoding: 'utf8', timeout: 120000, ...o })) {
  const wt = join(tmpdir(), 'verse-guard-wt-' + branch.replace(/\W+/g, '-'));
  const git = (a, cwd) => run(a, cwd ? { cwd } : {});
  try {
    if (git(['worktree', 'add', '-q', '-B', branch, wt, 'origin/main']).status !== 0) return { pushed: false, why: 'could not make a worktree' };
    const parents = (String(git(['rev-list', '--parents', '-n1', sha], wt).stdout || '').trim().match(/ /g) || []).length + 1;
    const r = git(['-c', 'user.name=verse-guard', '-c', 'user.email=verse-guard@users.noreply.github.com', 'revert', '--no-edit', ...(parents > 2 ? ['-m', '1'] : []), sha], wt);
    if (r.status !== 0) { git(['revert', '--abort'], wt); return { pushed: false, why: 'the revert of ' + sha.slice(0, 8) + ' conflicts' }; }
    if (!check(wt)) return { pushed: false, why: 'the revert would not bring it back' };
    git(['-c', 'user.name=verse-guard', '-c', 'user.email=verse-guard@users.noreply.github.com', 'commit', '--amend', '-q', '-m', String(git(['log', '-1', '--format=%B'], wt).stdout || '').trim(), '-m', 'Verse-auto-revert: ' + why], wt);
    const p = git(['push', '-q', 'origin', 'HEAD:refs/heads/' + branch], wt);
    return p.status === 0 ? { pushed: true, branch } : { pushed: false, why: 'the push to ' + branch + ' was refused' };
  } finally { git(['worktree', 'remove', '--force', wt]); }
}

/** one change on its own helper branch: `edit(worktree, git)` makes it and returns true when something changed. The push starts helper-pr.yml, which opens the pull request. */
export function editOnBranch(branch, message, edit, run = (a, o) => spawnSync('git', a, { cwd: root, encoding: 'utf8', timeout: 120000, ...o })) {
  const wt = join(tmpdir(), 'verse-guard-wt-' + branch.replace(/\W+/g, '-'));
  const git = (a, cwd) => run(a, cwd ? { cwd } : {});
  const who = ['-c', 'user.name=verse-guard', '-c', 'user.email=verse-guard@users.noreply.github.com'];
  try {
    if (git(['worktree', 'add', '-q', '-B', branch, wt, 'origin/main']).status !== 0) return { pushed: false, why: 'could not make a worktree' };
    if (!edit(wt, (a) => git(a, wt))) return { pushed: false, why: 'nothing to change on current main' };
    if (git(['add', '-A'], wt).status !== 0 || git([...who, 'commit', '-q', '-m', message], wt).status !== 0) return { pushed: false, why: 'could not commit' };
    const p = git(['push', '-q', 'origin', 'HEAD:refs/heads/' + branch], wt);
    return p.status === 0 ? { pushed: true, branch } : { pushed: false, why: 'the push to ' + branch + ' was refused' + (/workflow/i.test(String(p.stderr || '')) ? ' (the token cannot change workflow files)' : '') };
  } finally { git(['worktree', 'remove', '--force', wt]); }
}

export async function loadGuard(id) {
  const f = join(root, 'tools/guards', id + '.mjs');
  return existsSync(f) ? import(pathToFileURL(f).href) : null;
}
/** run the named guards. Each one is fenced: a throw is one failed run on its record, never a failed lane. Returns the lines for the log. */
export async function runGuards(ids, { dry = false, now = Date.now(), load = loadGuard, env = process.env, log = console.log } = {}) {
  const out = [];
  for (const id of ids) {
    const g = GUARDS.find((x) => x.id === id), mod = g && await load(id);
    if (!g || !mod || typeof mod.run !== 'function') { out.push({ id, skipped: true }); continue; }
    const prev = (() => { try { return JSON.parse(read(logPath(id))); } catch { return blankGuard(g); } })();
    const ctx = { root, site: SITE, dry, now, env, hit, loadPlaywright, revertOnBranch, editOnBranch, spawn: (c, a, cwd) => spawnSync(c, a, { cwd, encoding: 'utf8', timeout: 180000, maxBuffer: 64 << 20 }), queueJob: (a, t) => (dry ? Promise.resolve({ queued: false, why: 'dry run' }) : queueJob(a, t, env)), save: (file, text) => { if (!dry) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, text); } }, read, prev };
    let result;
    try { result = await mod.run(ctx); } catch (e) { result = { ok: false, last: prev.last }; log('guard ' + id + ' threw: ' + String((e && e.message) || e).slice(0, 160)); }
    const rec = recordOf(g, prev, result || { ok: false }, now);
    if (result && result.state) rec.state = { ...rec.state, ...result.state }; // a guard's own memory (what it has already handled) rides in the same record
    const wrote = changed(prev, rec);
    if (wrote && !dry) { mkdirSync(dirname(logPath(id)), { recursive: true }); writeFileSync(logPath(id), JSON.stringify(rec) + '\n'); }
    log(rec.name + ': ' + rec.status + ' ' + rec.last + (wrote ? '' : ' (unchanged)'));
    out.push({ id, status: rec.status, last: rec.last, wrote, cost: rec.cost });
  }
  return out;
}
/** called by tools/house-loops.mjs after a lane's own job: the guards that ride this lane's hour. */
export async function runRides(lane, opts = {}) {
  if (process.env.VERSE_GUARDS === 'off') return [];
  const loop = LOOPS.find((l) => l.id === lane);
  return runGuards(guardsFor(loop ? loop.hourUtc : -1).map((g) => g.id), opts);
}

export async function main(argv = process.argv.slice(2)) {
  const [cmd, ...rest] = argv, dry = rest.includes('--dry'), ids = rest.filter((a) => !a.startsWith('--'));
  if (cmd === 'list') { for (const g of GUARDS) console.log(g.id + '\t' + (g.hours ? g.hours.join(',') : 'every lane')); return 0; }
  if (cmd !== 'run' || !ids.length) { console.error('usage: node tools/verse-guards.mjs list | run <id>... [--dry]'); return 2; }
  const res = await runGuards(ids, { dry });
  console.log(JSON.stringify(res));
  return 0;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().then((c) => process.exit(c)).catch((e) => { console.error(String((e && e.message) || e)); process.exit(1); });
