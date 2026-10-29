// Stale-docs checker (docs/multipliers.md #4): repo paths that docs/, AGENTS.md, STANDING.md and the board name in backticks but
// that no longer exist (a Lesson: "three performance tips ... named files that do not exist"). A count that may only go down.
//   node tools/doc-drift.mjs           every stale path, by doc
//   node tools/doc-drift.mjs --check   exit 1 if there are more stale paths than tools/doc-drift.json allows; --write sets it
import { readFileSync, readdirSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..'), BASE = resolve(here, 'doc-drift.json');
const TOPS = ['tools', 'docs', 'domains', 'void-live-deploy', 'lib', 'skills', 'functions', '.github', 'extension', 'email-worker', 'share-worker', 'review', 'automations', 'projects'];

/** Repo paths a doc names in backticks: start with a known top folder (or lib/, skills/, functions/ inside void-live-deploy), end in a
 *  file extension, no globs or placeholders. Pure. */
export function pathsIn(text) {
  const out = new Set();
  for (const m of String(text).matchAll(/`([^`\s]+)`/g)) {
    let p = m[1].replace(/[),.;:]+$/, '').replace(/^\.\//, '').replace(/#.*$/, '').replace(/:\d+$/, '');
    if (/[*<>{}$?\[\]]|\.\.\.|^https?:/.test(p) || !/\.[a-z0-9]{1,5}$/i.test(p) || !p.includes('/')) continue;
    if (!TOPS.includes(p.split('/')[0])) continue;
    out.add(p);
  }
  return [...out];
}
/** Does a named path exist? lib/, skills/ and functions/ may also mean the copy under void-live-deploy. Pure apart from exists. */
export const exists = (p, has) => has(p) || (/^(lib|skills|functions)\//.test(p) && has('void-live-deploy/' + p));

export function docs() {
  const walk = (d) => readdirSync(resolve(root, d)).flatMap((n) => { const p = join(d, n); return statSync(resolve(root, p)).isDirectory() ? walk(p) : /\.md$/.test(n) ? [p] : []; });
  return walk('docs').concat(['AGENTS.md', 'STANDING.md', 'domains/handoff.md'].filter((f) => existsSync(resolve(root, f))));
}
export function stale() {
  const has = (p) => existsSync(resolve(root, p));
  return docs().flatMap((d) => pathsIn(readFileSync(resolve(root, d), 'utf8')).filter((p) => !exists(p, has)).map((p) => ({ doc: d, path: p })));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const s = stale();
  if (process.argv.includes('--write')) { writeFileSync(BASE, JSON.stringify({ allowed: s.length }) + '\n'); console.log('allowance set to ' + s.length); process.exit(0); }
  if (process.argv.includes('--check')) { const allowed = JSON.parse(readFileSync(BASE, 'utf8')).allowed;
    console.log(s.length <= allowed ? s.length + ' stale doc path(s), allowed ' + allowed + (s.length < allowed ? ': lower it with node tools/doc-drift.mjs --write' : '')
      : s.length + ' stale doc paths, allowed ' + allowed + ': a doc names a file that does not exist: ' + s.slice(0, 4).map((x) => x.doc + ' -> ' + x.path).join(', '));
    process.exit(s.length <= allowed ? 0 : 1); }
  for (const x of s) console.log(x.doc + '  ->  ' + x.path);
  console.log(s.length + ' stale path(s)');
}
