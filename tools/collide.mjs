// Collision predictor (docs/multipliers.md #2): before you start or push, which open PRs already touch the files you will touch, and
// which pairs of open PRs touch the same files. Parallel agents stop finding out at merge time.
//   node tools/collide.mjs                   every pair of open PRs that share a file, busiest files first
//   node tools/collide.mjs --mine [base]     the files this branch changed (vs origin/main) against every open PR
//   node tools/collide.mjs --files a,b       those files against every open PR (ask before you start)
// Reads only (gh api GETs). Exit 0 always: it is advice, not a gate.
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pairs of PRs sharing files, most shared first. prs: [{ number, title, files }]. Pure. */
export function overlaps(prs) {
  const out = [];
  for (let i = 0; i < prs.length; i++) for (let j = i + 1; j < prs.length; j++) {
    const b = new Set(prs[j].files), shared = prs[i].files.filter((f) => b.has(f));
    if (shared.length) out.push({ a: prs[i].number, b: prs[j].number, shared });
  }
  return out.sort((x, y) => y.shared.length - x.shared.length || x.a - y.a);
}
/** Open PRs touching any of these files. Files every PR touches anyway (shared ledgers) are reported but marked. Pure. */
export function against(files, prs, common = COMMON) {
  const mine = new Set(files);
  return prs.map((p) => ({ number: p.number, title: p.title, shared: p.files.filter((f) => mine.has(f)) })).filter((p) => p.shared.length)
    .map((p) => ({ ...p, real: p.shared.filter((f) => !common.includes(f)) })).sort((a, b) => b.real.length - a.real.length);
}
// files nearly every PR appends to: a shared one is usually a clean merge (one line per entry), still worth a pull --rebase
export const COMMON = ['domains/handoff.md', 'tools/checks.mjs', 'void-live-deploy/void.growth.json', 'docs/void-voice.md'];

const gh = (path) => execFileSync('gh', ['api', '--paginate', path, '--jq', '.[]'], { encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n').filter(Boolean).map((l) => JSON.parse(l));
export function openPrs(repo) {
  return gh(`repos/${repo}/pulls?state=open&per_page=100`).map((p) => ({ number: p.number, title: p.title, branch: p.head.ref,
    files: gh(`repos/${repo}/pulls/${p.number}/files?per_page=100`).map((f) => f.filename) }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), repo = process.env.GITHUB_REPOSITORY || 'atomeam/void-loop';
  const prs = openPrs(repo);
  let files = null;
  if (a.includes('--files')) files = a[a.indexOf('--files') + 1].split(',').filter(Boolean);
  if (a.includes('--mine')) { const base = a[a.indexOf('--mine') + 1] || 'origin/main';
    files = execFileSync('git', ['diff', '--name-only', (base.startsWith('--') ? 'origin/main' : base) + '...HEAD'], { encoding: 'utf8' }).split('\n').filter(Boolean); }
  if (files) {
    const hits = against(files, prs);
    if (!hits.length) console.log('clear: no open PR touches ' + files.length + ' file(s)');
    for (const h of hits) console.log((h.real.length ? 'COLLIDES ' : 'shared   ') + '#' + h.number + ' ' + h.title.slice(0, 60) + ': ' + h.shared.join(', '));
  } else {
    const o = overlaps(prs);
    console.log(prs.length + ' open PRs, ' + o.length + ' overlapping pair(s)');
    for (const x of o) console.log('#' + x.a + ' x #' + x.b + ': ' + x.shared.join(', '));
  }
}
