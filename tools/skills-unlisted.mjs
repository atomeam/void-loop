// A skill file that is not in skills/index.json is never loaded: the page never asks it anything, and its asks fall through to
// the answer engine. A merge once dropped `services` from the index this way and nine pricing asks quietly stopped working,
// while skills-check, which only looks at listed skills, said "clean". This finds skill files (a default export with a name,
// a match function and a run function) that the index does not list. Helper modules (rules, 3D libraries, workers) export no
// such object and are not reported.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// skill files that are deliberately not in the index; say why next to the name
export const RETIRED = [
  'map', // older map card; `place` and `rebuild-map` answer maps now, and nothing loads this file
];

export async function unlistedSkills(dir, retired = RETIRED) {
  const listed = new Set(JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8')));
  const found = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js')).sort((a, b) => a.localeCompare(b))) {
    const n = f.slice(0, -3);
    if (listed.has(n) || retired.includes(n)) continue;
    let d; try { d = (await import(pathToFileURL(resolve(dir, f)).href)).default; } catch (_) { continue; } // a browser-only module that cannot load here is not a skill file we can judge
    if (d && typeof d === 'object' && typeof d.name === 'string' && typeof d.match === 'function' && typeof d.run === 'function') found.push(n);
  }
  return found;
}
