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
  'hosting', // lists run 6, 2026-10-28: its match was a bare regex, not a function, so the router threw on every ask that reached it (and tools/skills-check.mjs failed every skills PR); it also answered any ask with "server" or "domain" and named a rival site on its card. Off the routing order until it is rebuilt to the skill shape (name, match function, run, examples)
  'map', // older map card; `place` and `rebuild-map` answer maps now, and nothing loads this file
];

export async function unlistedSkills(dir, retired = RETIRED) {
  const listed = new Set(JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8')));
  // a family skill (lib/skill-family.js) lists its members: they are loaded through it, so they are not unlisted
  for (const n of [...listed]) { try { const d = (await import(pathToFileURL(resolve(dir, n + '.js')).href)).default; if (d && d.family) for (const p of d.parts || []) listed.add(p); } catch (_) {} }
  const found = [];
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.js')).sort((a, b) => a.localeCompare(b))) {
    const n = f.slice(0, -3);
    if (listed.has(n) || retired.includes(n)) continue;
    let d; try { d = (await import(pathToFileURL(resolve(dir, f)).href)).default; } catch (_) { continue; } // a browser-only module that cannot load here is not a skill file we can judge
    if (d && listed.has(d.name)) continue; // a family member whose file name differs from its name (night-sky.js is nightsky in the time family)
    if (d && typeof d === 'object' && typeof d.name === 'string' && typeof d.match === 'function' && typeof d.run === 'function') found.push(n);
  }
  return found;
}
