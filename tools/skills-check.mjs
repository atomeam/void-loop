// Every skill in void-live-deploy/skills/index.json, in its routing order: each of its examples must reach it first,
// and none of its near misses may. The same rule tools/test_void.mjs enforces, runnable on its own in a second.
//   node tools/skills-check.mjs      prints "all N skills clean" or each collision, exit 1 on any
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');
const names = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8'));
const mods = [];
for (const n of names) mods.push((await import(pathToFileURL(resolve(dir, n + '.js')).href)).default);
const first = (a) => { const k = mods.find((s) => s.match(a.toLowerCase(), a)); return k ? k.name : null; };
const bad = [];
for (const m of mods) {
  for (const e of m.examples || []) if (first(e) !== m.name) bad.push(`${m.name}: "${e}" -> ${first(e)}`);
  for (const e of m.nearMisses || []) if (first(e) === m.name) bad.push(`${m.name}: near miss "${e}" taken`);
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`all ${mods.length} skills clean`);
