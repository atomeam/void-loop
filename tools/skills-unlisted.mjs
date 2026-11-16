// A skill file that is not in skills/index.json is never loaded: the page never asks it anything, and its asks fall through to
// the answer engine. A merge once dropped `services` from the index this way and nine pricing asks quietly stopped working,
// while skills-check, which only looks at listed skills, said "clean". This finds skill files (a default export with a name,
// a match function and a run function) that the index does not list. Helper modules (rules, 3D libraries, workers) export no
// such object and are not reported.
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readOrder, OFF } from './skills-index.mjs';

// One retirement policy for discovery and --adopt: an intentionally kept-out draft must not
// disappear from this check only to be resurrected by the next automatic adoption.
export const RETIRED = Object.keys(OFF);

export async function unlistedSkills(dir, retired = RETIRED) {
  const orderDir = resolve(dir, 'order');
  // the order files are the source; index.json is the copy the deploy rewrites, so a skill with an order file is listed
  const listed = new Set(existsSync(orderDir) ? readOrder(orderDir) : JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8')));
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
