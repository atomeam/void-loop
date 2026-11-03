// suite check for system-sketch skill: examples reach it, near misses do not
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const skillPath = resolve(here, '../void-live-deploy/skills/system-sketch.js');
const mod = (await import(pathToFileURL(skillPath).href)).default;

const examples = mod.examples || [];
const near = mod.nearMisses || [];
let ok = true;
for (const e of examples) {
  if (!mod.match(e.toLowerCase(), e)) { console.error('example missed:', e); ok = false; }
}
for (const n of near) {
  if (mod.match(n.toLowerCase(), n)) { console.error('near miss hit:', n); ok = false; }
}
console.log(ok ? 'system-sketch suite check passed' : 'system-sketch suite check failed');
process.exit(ok ? 0 : 1);
