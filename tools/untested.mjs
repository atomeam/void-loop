// Untested-code ratchet (docs/multipliers.md #3): which lib/ and skills/ files no test names, biggest first, and a count that may
// only go down. A test "names" a file when a test file (tools/*.test.mjs, tools/test_*.mjs, tools/*_test.py) mentions its path or
// its import (lib/x.js, skills/x.js). Tells whoever writes tests where to start; Verse asked for tests of its own skills.
//   node tools/untested.mjs            the list, worst first
//   node tools/untested.mjs --check    exit 1 if more files are untested than tools/untested.json allows (lower it when you add tests)
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url)), root = resolve(here, '..'), BASE = resolve(here, 'untested.json');
export const DIRS = ['void-live-deploy/lib', 'void-live-deploy/skills'];

/** Files no test text names, biggest first. files: [{ path, bytes }], tests: [text]. Pure. */
export function untested(files, tests) {
  const all = tests.join('\n');
  return files.filter((f) => { const short = f.path.split('/').slice(-2).join('/'); return !all.includes(short); }).sort((a, b) => b.bytes - a.bytes || a.path.localeCompare(b.path));
}
/** The ratchet: ok while the count is at or under the allowed number; says when the allowance can come down. Pure. */
export const ratchet = (count, allowed) => ({ ok: count <= allowed, lower: count < allowed });

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const files = DIRS.flatMap((d) => readdirSync(resolve(root, d)).filter((n) => n.endsWith('.js')).map((n) => ({ path: d + '/' + n, bytes: statSync(resolve(root, d, n)).size })));
  const tests = readdirSync(here).filter((n) => /\.test\.mjs$|^test_.*\.mjs$|_test\.py$/.test(n)).map((n) => readFileSync(resolve(here, n), 'utf8'));
  const u = untested(files, tests), allowed = JSON.parse(readFileSync(BASE, 'utf8')).allowed;
  if (process.argv.includes('--write')) { writeFileSync(BASE, JSON.stringify({ allowed: u.length }) + '\n'); console.log('allowance set to ' + u.length); process.exit(0); }
  const r = ratchet(u.length, allowed);
  if (process.argv.includes('--check')) {
    console.log(r.ok ? u.length + ' of ' + files.length + ' lib/skills files untested (allowed ' + allowed + ')' + (r.lower ? ': lower it with node tools/untested.mjs --write' : '')
      : u.length + ' untested, allowed ' + allowed + ': new untested file(s), add a test: ' + u.slice(0, 5).map((f) => f.path).join(', '));
    process.exit(r.ok ? 0 : 1);
  }
  for (const f of u) console.log(String(f.bytes).padStart(7) + '  ' + f.path);
  console.log(u.length + ' of ' + files.length + ' untested');
}
