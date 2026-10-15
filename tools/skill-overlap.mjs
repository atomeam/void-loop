// Overlapping skills (owner, 2026-10-15: "always look for those merges"): two skills overlap when one's example is also
// accepted by the other's match(). Overlap is the sign two skills should be one family (lib/skill-family.js) or one skill.
// tools/skill-overlap.json is the allowance: the pairs known today. A new pair fails the check, so a new skill that repeats an
// old one is caught when it is made; a merge that removes a pair lowers the allowance (--write).
//   node tools/skill-overlap.mjs            prints every pair, busiest first, and the merge candidates
//   node tools/skill-overlap.mjs --check    exit 1 on a pair the allowance does not list
//   node tools/skill-overlap.mjs --write    rewrite the allowance from today's pairs
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dir = resolve(root, 'void-live-deploy/skills');
const ALLOW = resolve(root, 'tools/skill-overlap.json');

/** every skill at member level (a family's members, each on its own), in routing order */
export async function memberSkills() {
  const out = [];
  for (const n of JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8'))) {
    const d = (await import(pathToFileURL(resolve(dir, n + '.js')).href)).default;
    for (const m of d.family ? d.members : [d]) out.push({ skill: m, family: d.family ? d.name : null });
  }
  return out;
}
/** pairs "a~b" (sorted names) with the examples both accept. Pure. */
export function pairs(list) {
  const out = new Map();
  for (const { skill: a } of list) for (const e of a.examples || []) for (const { skill: b } of list) {
    if (a === b) continue;
    let hit = false; try { hit = !!b.match(e.toLowerCase(), e); } catch (_) {}
    if (!hit) continue;
    const k = [a.name, b.name].sort().join('~');
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(e);
  }
  return out;
}
/** pairs not in the allowance. Pure. */
export const fresh = (found, allowed) => [...found.keys()].filter((k) => !allowed.includes(k)).sort();

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const list = await memberSkills(), found = pairs(list), fam = new Map(list.map((x) => [x.skill.name, x.family]));
  const keys = [...found.keys()].sort();
  if (process.argv.includes('--write')) { writeFileSync(ALLOW, JSON.stringify({ note: 'skill pairs whose examples overlap (tools/skill-overlap.mjs); merge them, never add to this by hand without a reason', pairs: keys }, null, 1) + '\n'); console.log('wrote ' + keys.length + ' pairs'); process.exit(0); }
  const allowed = existsSync(ALLOW) ? JSON.parse(readFileSync(ALLOW, 'utf8')).pairs : [];
  if (process.argv.includes('--check')) {
    const n = fresh(found, allowed);
    if (n.length) { console.log('new overlapping skills (merge them into one family or skill, or narrow the match):'); for (const k of n) console.log('  ' + k + ': ' + found.get(k).slice(0, 3).join(' | ')); process.exit(1); }
    console.log('no new overlapping skills (' + keys.length + ' known pairs)'); process.exit(0);
  }
  for (const k of keys.sort((a, b) => found.get(b).length - found.get(a).length)) {
    const [a, b] = k.split('~'), same = fam.get(a) && fam.get(a) === fam.get(b);
    console.log(`${k}${same ? ' (same family)' : ' (merge candidate)'}: ${found.get(k).length} · ${found.get(k).slice(0, 2).join(' | ')}`);
  }
}
