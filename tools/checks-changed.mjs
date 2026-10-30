// Which of the fast checks a change needs (tools/checks.mjs --changed; owner, 2026-10-25: six builders share a 4-core box and the 425-check
// pre-push run took 3 to 4 minutes each). A builder runs only the checks that cover what the branch changed; main (verify.yml, deploy.yml)
// still runs everything, so --changed is ignored in CI. A check RUNS when any of these holds:
//   structural  it has no test file of its own (an inline check, a tool run with --check), or it is named in STRUCTURAL: the generated files, the
//               map, the index, the copies, secrets, the ledger, preload, families, the book, ellipsis cuts, the skill listing. Always on.
//   own file    its test file changed.
//   imports     its test file imports a changed file: directly, one level further (a test imports tools/grow.mjs which imports lib/ledger.js),
//               or through the dependency map (void-live-deploy/skills/deps.json, tools/deps.mjs: a changed lib reaches every file that imports it).
//   names       a changed file's basename (without extension) is in the check's name or its test file's name, or its basename with the extension
//               is written in the test (a test that reads skills/chess.js by path, not by import).
//   reaches all void.html, index.html, sw.js, a workflow, package.json, or this runner itself changed: everything runs.
// When git cannot say what changed, everything runs. Over-inclusion is fine; a skipped check that was needed is the bug to report.
import { readFileSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { resolve, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { specifiers } from './deps.mjs';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'void-live-deploy/';

/** the files that reach every check */
export const REACHES_ALL = /^(?:void\.html|package(?:-lock)?\.json|\.github\/workflows\/[^/]+\.ya?ml|tools\/(?:checks|pool|checks-changed)\.mjs)$|(?:^|\/)(?:index\.html|sw\.js)$/;
/** checks with a test file of their own that still run on every change (what they check is shared by every build) */
export const STRUCTURAL = new Set(['map-sync', 'map-coverage', 'skills-index', 'skills-unlisted', 'what-skills', 'ledger-proof', 'growth', 'preload', 'families',
  'guide', 'secret-scan', 'doc-drift-unit', 'untested-unit', 'deps', 'moved-check', 'refresh-tool', 'frontier', 'self-blocks', 'rule-registry', 'misses-snapshot',
  'skill-family', 'checks-changed']);
export const isTestFile = (file) => /\.test\.mjs$|^test_[\w-]+\.mjs$/.test(file || '');
/** a job { name, file } is structural when it has no test file of its own or its name is in STRUCTURAL. Pure. */
export const isStructural = (job) => !job.file || !isTestFile(job.file) || STRUCTURAL.has(job.name);

/** `git status --porcelain` lines as repo paths (a rename gives its new name). Pure. */
export const parsePorcelain = (text) => String(text || '').split('\n').filter((l) => l.length > 3).map((l) => l.slice(3).replace(/^.* -> /, '').trim()).filter(Boolean);
/** the files this branch changed against origin/main plus the uncommitted ones, repo-relative, once each; null when git cannot say. */
export function changedFiles(cwd = root) {
  const git = (a) => spawnSync('git', a, { cwd, encoding: 'utf8' });
  const diff = git(['diff', '--name-only', 'origin/main...HEAD']), status = git(['status', '--porcelain']);
  if (diff.status !== 0 || status.status !== 0) return null;
  return [...new Set([...diff.stdout.split('\n'), ...parsePorcelain(status.stdout)].map((f) => f.trim()).filter(Boolean))];
}

/** read a repo file's text, or null */
export const readRepo = (p) => { try { return existsSync(resolve(root, p)) ? readFileSync(resolve(root, p), 'utf8') : null; } catch (_) { return null; } };
/** deps.json, or null when it cannot be read */
export const readDeps = () => { try { return JSON.parse(readRepo(SITE + 'skills/deps.json')); } catch (_) { return null; } };

/** a specifier in a repo file, as a repo path, or null when it leaves the tree (a package, a URL, node:). Pure. */
export function resolveRepo(from, spec) {
  if (/^(?:https?:)?\/\//.test(spec) || /^(?:node|npm|cloudflare):/.test(spec)) return null;
  const clean = spec.replace(/[?#].*$/, '');
  if (clean.startsWith('/')) return SITE + clean.slice(1); // a site-absolute path, as the page writes them
  if (!clean.startsWith('.')) return null;
  const p = posix.normalize(posix.join(posix.dirname(from), clean));
  return p.startsWith('..') ? null : p;
}
/** the repo files a test imports, directly and `levels` deep (two by default: the test, what it imports, what those import). readText(path) gives a file's text or null. Pure given readText. */
export function testImports(testPath, readText, levels = 2) {
  const seen = new Set(); let frontier = [testPath];
  for (let l = 0; l < levels && frontier.length; l++) {
    const next = [];
    for (const f of frontier) { const t = readText(f); if (t == null) continue; for (const s of specifiers(t)) { const r = resolveRepo(f, s); if (r && !seen.has(r)) { seen.add(r); next.push(r); } } }
    frontier = next;
  }
  return seen;
}
/** the files a change reaches: the changed files and, under void-live-deploy/, every file deps.json says imports them or reaches them. Pure. */
export function reached(changed, deps) {
  const out = new Set(changed);
  for (const f of changed) {
    if (!f.startsWith(SITE)) continue;
    const e = deps && deps.files && deps.files[f.slice(SITE.length)];
    if (e) for (const d of [...(e.importedBy || []), ...(e.reachedBy || [])]) out.add(SITE + d);
  }
  return out;
}
const base = (f) => posix.basename(f), stem = (f) => base(f).replace(/\.[^.]+$/, '').toLowerCase();

/** why a check runs for this change, or '' when nothing it covers changed. Pure given readText. */
export function whyRun(job, changed, { reach, readText }) {
  if (isStructural(job)) return 'structural';
  const file = 'tools/' + job.file;
  if (changed.includes(file)) return 'its test changed';
  const imports = testImports(file, readText);
  const hit = [...reach].find((f) => imports.has(f));
  if (hit) return 'imports ' + hit;
  const name = job.name.toLowerCase(), fname = job.file.toLowerCase(), text = (readText(file) || '').toLowerCase();
  for (const f of changed) { const s = stem(f); if (s && (name.includes(s) || fname.includes(s))) return 'named after ' + base(f); if (text.includes(base(f).toLowerCase())) return 'reads ' + base(f); }
  return '';
}

/**
 * The selection: { run: [jobs], skipped: [jobs], why: { name: reason }, line }. `changed` null (git could not say) or a file that reaches
 * everything runs every job. Pure given readText and deps.
 */
export function select(jobs, changed, { deps = null, readText = readRepo } = {}) {
  const n = jobs.length;
  if (!changed) return { run: jobs, skipped: [], why: {}, line: `--changed: all ${n} checks (git could not say what changed)` };
  const all = changed.find((f) => REACHES_ALL.test(f));
  if (all) return { run: jobs, skipped: [], why: {}, line: `--changed: all ${n} checks (${all} changed: it reaches everything)` };
  const reach = reached(changed, deps), why = {}, run = [], skipped = [];
  for (const j of jobs) { const w = whyRun(j, changed, { reach, readText }); if (w) { why[j.name] = w; run.push(j); } else skipped.push(j); }
  const names = skipped.length && skipped.length <= 12 ? ': ' + skipped.map((j) => j.name).join(', ') : '';
  return { run, skipped, why, line: `--changed: ${run.length} of ${n} checks (${skipped.length} skipped: nothing they cover changed${names})` };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { // node tools/checks-changed.mjs: what changed, as checks.mjs sees it
  const c = changedFiles(); console.log(c ? c.length + ' changed file' + (c.length === 1 ? '' : 's') + ':\n' + c.map((f) => '  ' + f).join('\n') : 'git could not say what changed');
}
