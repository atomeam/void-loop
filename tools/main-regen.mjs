// Main regenerates its own cards (owner, 2026-11-20: Verse handles a red main by itself). A skill file can reach main without its
// routing-order file (a helper PR's skill check adopts it only in a scratch checkout), so skills/index.json, the families, the book and
// the shared indexes go stale and every structural check is red until someone runs the generators by hand. tools/automerge.mjs runs
// this on each full sweep, in a scratch worktree of main: it adopts every unlisted skill (tools/skills-index.mjs --adopt), files a skill
// with no family into the family whose skills share the most name words with it, regenerates the committed cards (tools/refresh.mjs,
// the similar-skills index, the page preloads), and when anything changed opens one helper/main-regen-<sha> pull request labelled
// automerge. Never while one is open. Never throws.
//   node tools/main-regen.mjs            regenerate in this checkout and list what changed (writes files, commits nothing)
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const BRANCH = 'helper/main-regen-';
export const STEPS = 'index,deps,families,guide,what,seo,parity,tower-plan';
const words = (s) => String(s).toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);

/** the family a new skill joins: most shared name words with the family's skills, ties to the earlier family, none to 'self'. Pure. */
export function familyFor(name, families) {
  const mine = new Set(words(name));
  let best = null, score = 0;
  for (const f of families || []) {
    let s = 0;
    for (const k of f.skills || []) for (const w of words(k)) if (mine.has(w)) s++;
    if (s > score) { best = f.id; score = s; }
  }
  return best || 'self';
}

/** tools/families.mjs with `name` appended to family `id`'s skills list (one family per line there). Pure; unchanged when not found. */
export function fileInto(src, id, name) {
  const lines = String(src).split('\n');
  const i = lines.findIndex((l) => l.startsWith("  { id: '" + id + "',"));
  if (i < 0 || lines[i].includes("'" + name + "'")) return src;
  lines[i] = lines[i].replace(/'\] \},?$/, (m) => "', '" + name + m);
  return lines.join('\n');
}

/** the skills tools/families.mjs names as having no family. Pure. */
export const unfiled = (out) => { const m = /skills with no family[^:]*:\s*([^\n]+)/.exec(String(out)); return m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : []; };

const node = (root, args) => spawnSync(process.execPath, args, { cwd: root, encoding: 'utf8', timeout: 180000, maxBuffer: 50e6 });

/** regenerate in `root`; returns the changed paths */
export async function regen(root, log = console.log) {
  node(root, ['tools/skills-index.mjs', '--adopt']);
  const fam = node(root, ['tools/families.mjs']);
  const lost = unfiled((fam.stdout || '') + (fam.stderr || ''));
  if (lost.length) {
    const { FAMILIES } = await import(resolve(root, 'tools/families.mjs') + '?t=' + Date.now());
    let src = readFileSync(resolve(root, 'tools/families.mjs'), 'utf8');
    for (const n of lost) { const id = familyFor(n, FAMILIES); src = fileInto(src, id, n); log('filed ' + n + ' into family ' + id); }
    writeFileSync(resolve(root, 'tools/families.mjs'), src);
  }
  node(root, ['tools/refresh.mjs', '--keep-going', '--only', STEPS]);
  node(root, ['tools/similar-index.mjs']);
  node(root, ['tools/preload.mjs']);
  return execFileSync('git', ['status', '--porcelain'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean).map((l) => l.slice(3));
}

/** from tools/automerge.mjs: one regen pull request when main's cards are stale. gh(path) reads JSON, run(args) calls gh. */
export async function openRegenPr({ gh, run, repo, prs, log = console.log, root = resolve(here, '..') }) {
  try {
    if ((prs || []).some((p) => p && p.state === 'open' && String(p.head?.ref || '').startsWith(BRANCH))) return null;
    const sha = execFileSync('git', ['rev-parse', 'origin/main'], { cwd: root, encoding: 'utf8' }).trim(), dir = resolve(root, '..', 'main-regen');
    rmSync(dir, { recursive: true, force: true });
    execFileSync('git', ['worktree', 'add', '-q', '--detach', dir, sha], { cwd: root });
    try {
      try { execFileSync('ln', ['-s', resolve(root, 'node_modules'), resolve(dir, 'node_modules')]); } catch (_) {}
      const changed = (await regen(dir, log)).filter((p) => p !== 'node_modules');
      if (!changed.length) { log('main regen: every generated card is current'); return null; }
      const branch = BRANCH + sha.slice(0, 7);
      // the node_modules link is ignored, and naming it in a pathspec makes git add fail (the 2026-11-20 sweep), so it goes first
      rmSync(resolve(dir, 'node_modules'), { force: true });
      execFileSync('git', ['add', '-A'], { cwd: dir });
      execFileSync('git', ['commit', '-q', '-m', 'Main regenerates its cards: unlisted skills adopted, generated files current'], { cwd: dir });
      execFileSync('git', ['push', '-q', 'origin', 'HEAD:refs/heads/' + branch], { cwd: dir });
      const body = 'Verse regenerated what main had stale (tools/main-regen.mjs): ' + changed.length + ' file(s).\n\n' + changed.slice(0, 40).map((p) => '- `' + p + '`').join('\n');
      const pr = JSON.parse(run(['api', '-X', 'POST', `repos/${repo}/pulls`, '--input', '-'], JSON.stringify({ title: 'Main regenerates its cards (' + sha.slice(0, 7) + ')', head: branch, base: 'main', body })));
      run(['api', '-X', 'POST', `repos/${repo}/issues/${pr.number}/labels`, '--input', '-'], JSON.stringify({ labels: ['automerge'] }));
      try { run(['workflow', 'run', 'automerge.yml', '--repo', repo, '--ref', 'main', '-f', 'pr=' + pr.number]); } catch (_) {}
      log('main regen: opened #' + pr.number + ' (' + changed.length + ' files)');
      return pr.number;
    } finally { try { execFileSync('git', ['worktree', 'remove', '--force', dir], { cwd: root }); } catch (_) {} }
  } catch (e) { log('main regen: ' + String(e.stderr || e.message || e).slice(0, 200)); return null; }
}

if (import.meta.url === 'file://' + process.argv[1]) {
  const changed = await regen(resolve(here, '..'));
  console.log(changed.length ? changed.join('\n') : 'every generated card is current');
}
