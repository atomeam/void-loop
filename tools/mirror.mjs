// Continuity (frontier "metabolism"): once a week, copy the non-secret knowledge of this repo to a second git host, so a lost account or a
// banned repo does not take what Void learned with it. Only an allowlist is ever copied (skills, the growth ledger, docs, domains, the two
// standing documents), only files git tracks, and a file that looks like it holds a secret, is binary or is large is left out and named in the
// manifest. Fail closed: the same masking the site applies to everything it logs (lib/automation-fix.js redact) must leave a file unchanged.
// The remote gets a normal commit on top of its own history (never a force push); with MIRROR_URL unset it says so and exits 0.
//   node tools/mirror.mjs --dry     build the snapshot, print what would go and what was left out; no network
//   node tools/mirror.mjs           MIRROR_URL (https git URL) and MIRROR_TOKEN (its access token) from the environment
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { redact } from '../void-live-deploy/lib/automation-fix.js';

export const ALLOW = ['STANDING.md', 'AGENTS.md', 'docs/', 'domains/', 'void-live-deploy/skills/', 'void-live-deploy/void.growth.json'];
export const MAX_BYTES = 1024 * 1024;
const NEVER = /(^|\/)(\.env[^/]*|[^/]*\.(pem|key|p12|pfx)|id_(rsa|ed25519)[^/]*|node_modules\/.*)$/i;

export const allowed = (path) => !NEVER.test(path) && ALLOW.some((a) => (a.endsWith('/') ? path.startsWith(a) : path === a));

// files: tracked paths; read(path) → Buffer. Returns what goes and what is left out, with the reason.
export function plan(files, read) {
  const include = [], skipped = [];
  for (const path of files) {
    if (!allowed(path)) continue;
    let buf; try { buf = read(path); } catch (_) { skipped.push({ path, why: 'unreadable' }); continue; }
    if (buf.length > MAX_BYTES) { skipped.push({ path, why: 'larger than 1 MB' }); continue; }
    if (buf.includes(0)) { skipped.push({ path, why: 'binary' }); continue; }
    const text = buf.toString('utf8');
    if (redact(text) !== text) { skipped.push({ path, why: 'looks like it holds a secret or key' }); continue; }
    include.push(path);
  }
  return { include, skipped };
}

const git = (args, cwd, env = {}) => execFileSync('git', args, { cwd, env: { ...process.env, ...env }, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
const scrub = (s, ...secrets) => secrets.filter(Boolean).reduce((t, x) => t.split(x).join('***'), String(s));

export async function main(argv = process.argv.slice(2), env = process.env, root = process.cwd()) {
  const dry = argv.includes('--dry');
  if (!dry && !env.MIRROR_URL) { console.log('mirror: not configured (MIRROR_URL is not set); nothing copied'); return { skipped: 'not configured' }; }
  if (!dry && !/^https:\/\/[^\s@]+$/.test(env.MIRROR_URL)) { console.log('mirror: MIRROR_URL must be an https git URL without credentials; nothing copied'); return { skipped: 'bad url' }; }
  const files = git(['ls-files', '-z'], root).split('\0').filter(Boolean);
  const { include, skipped } = plan(files, (p) => readFileSync(join(root, p)));
  const sha = git(['rev-parse', 'HEAD'], root).trim();
  console.log('mirror: ' + include.length + ' files from ' + sha.slice(0, 7) + ', ' + skipped.length + ' left out' + (skipped.length ? ':' : ''));
  for (const s of skipped) console.log('  left out ' + s.path + ' (' + s.why + ')');
  if (dry) return { include, skipped };

  const work = mkdtempSync(join(tmpdir(), 'mirror-')), url = env.MIRROR_URL, auth = env.MIRROR_TOKEN ? ['-c', 'http.extraHeader=Authorization: Basic ' + Buffer.from('x-access-token:' + env.MIRROR_TOKEN).toString('base64')] : [];
  try {
    try { git([...auth, 'clone', '--depth', '1', url, work], tmpdir()); } catch (e) { git(['init', '-q', work], tmpdir()); git(['remote', 'add', 'origin', url], work); } // an empty remote has nothing to clone
    for (const name of readdirSync(work)) if (name !== '.git' && name !== 'MIRROR.json') rmSync(join(work, name), { recursive: true, force: true });
    for (const p of include) { mkdirSync(dirname(join(work, p)), { recursive: true }); copyFileSync(join(root, p), join(work, p)); }
    git(['add', '-A'], work);
    if (!git(['status', '--porcelain'], work).trim()) { console.log('mirror: nothing changed since the last copy'); return { include, skipped, pushed: false }; } // the manifest is only rewritten with a real change, so a quiet week makes no commit
    writeFileSync(join(work, 'MIRROR.json'), JSON.stringify({ source: 'atomeam/void-loop', sha, at: new Date().toISOString(), files: include.length, leftOut: skipped }, null, 2) + '\n');
    git(['add', '-A'], work);
    git(['-c', 'user.name=Void mirror', '-c', 'user.email=mirror@a-to-mind.com', 'commit', '-q', '-m', 'Mirror of non-secret knowledge from ' + sha.slice(0, 7)], work);
    git([...auth, 'push', 'origin', 'HEAD'], work); // a normal push: a remote that moved on its own is reported, never overwritten
    console.log('mirror: pushed ' + include.length + ' files');
    return { include, skipped, pushed: true };
  } catch (e) {
    console.log('mirror: failed: ' + scrub(e.stderr || e.message, env.MIRROR_TOKEN, env.MIRROR_URL).slice(0, 300));
    return { error: true };
  } finally { rmSync(work, { recursive: true, force: true }); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
