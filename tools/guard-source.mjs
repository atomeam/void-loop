// Fails fast, in about a second, when a script no longer parses (a bad merge, a re-encoded file).
// Run before the full suite: a broken tools/test_void.mjs once made every deploy and ship-helper run die with no useful message.
//   node tools/guard-source.mjs      lists each file that does not parse, with the line, and the adjacent near-duplicate lines
//                                    (the usual sign of a merge that re-encoded a file); exit 1 if any
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const walk = (d, out = []) => {
  for (const n of readdirSync(d)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(mjs|js)$/.test(n)) out.push(p);
  }
  return out;
};
const dirs = ['tools', 'domains', 'void-live-deploy/skills', 'void-live-deploy/lib', 'void-live-deploy/functions'];
const files = dirs.flatMap((d) => { try { return walk(resolve(root, d)); } catch (_) { return []; } });

const parses = (file) => {
  const src = readFileSync(file, 'utf8');
  const r = spawnSync(process.execPath, ['--check', '--input-type=module', '-'], { input: src, encoding: 'utf8' });
  if (r.status === 0) return null;
  const m = /\[stdin\]:(\d+)|:(\d+)\n/.exec(r.stderr || '');
  return { line: m ? Number(m[1] || m[2]) : 0, msg: ((r.stderr || '').split('\n').find((l) => /Error/.test(l)) || '').trim() };
};
const twins = (file) => {
  const L = readFileSync(file, 'utf8').split('\n'), out = [];
  for (let i = 0; i < L.length - 1; i++) if (L[i].length > 40 && L[i] !== L[i + 1] && L[i].slice(0, 40) === L[i + 1].slice(0, 40)) out.push(i + 1);
  return out;
};

let bad = 0;
for (const f of files) {
  const e = parses(f);
  if (!e) continue;
  bad++;
  const t = twins(f);
  console.log(`FAIL ${relative(root, f)}:${e.line} ${e.msg}${t.length ? `  (near-duplicate lines at ${t.slice(0, 8).join(', ')}: a merge may have re-encoded this file)` : ''}`);
}
console.log(bad ? `${bad} file(s) do not parse` : `${files.length} scripts parse`);
process.exit(bad ? 1 : 0);
