// Every skill in void-live-deploy/skills/index.json, in its routing order: each of its examples must reach it first,
// and none of its near misses may. The same rule tools/test_void.mjs enforces, runnable on its own in a second.
//   node tools/skills-check.mjs      prints "all N skills clean" or each collision, exit 1 on any
//   node tools/skills-check.mjs --write tools/skills-smoke.json   the daily smoke test (asked by Void, ask-20261013-1823-2): the same
//     run, its result written as { at, checked, failing: { skill: [what failed] } } for tools/families.mjs (a skill that fails loses
//     its self-test evidence, so its rating drops; one that passes has the day it was last tested); exit 0, the record is the result
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unlistedSkills } from './skills-unlisted.mjs';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');
const names = JSON.parse(readFileSync(resolve(dir, 'index.json'), 'utf8'));
const mods = [];
for (const n of names) mods.push((await import(pathToFileURL(resolve(dir, n + '.js')).href)).default);
const first = (a) => { const k = mods.find((s) => s.match(a.toLowerCase(), a)); return k ? k.name : null; };
const bad = [], failing = {};
const fail = (name, line) => { bad.push(name + ': ' + line); (failing[name] = failing[name] || []).push(line.slice(0, 160)); };
for (const m of mods) {
  for (const e of m.examples || []) if (first(e) !== m.name) fail(m.name, `"${e}" -> ${first(e)}`);
  for (const e of m.nearMisses || []) if (first(e) === m.name) fail(m.name, `near miss "${e}" taken`);
  if (typeof m.suite === 'function') {
    let r;
    try { r = m.suite(); } catch (e) { r = { ok: false, got: e.message }; }
    if (!r || !r.ok) fail(m.name, `suite ${r && r.got}`);
  }
}
for (const n of await unlistedSkills(dir)) bad.push(`${n}: a skill file that skills/index.json does not list, so it is never loaded (add it to the index, or to RETIRED in tools/skills-unlisted.mjs with the reason)`);
const w = process.argv.indexOf('--write');
if (w > 0 && process.argv[w + 1]) {
  const { writeFileSync } = await import('node:fs');
  const rec = { note: 'the daily smoke test of every skill (tools/skills-check.mjs --write; asked by Void): each loaded, each of its examples reaching it first, none of its near misses, its suite() passing. failing: the skills that did not, with what failed. Read by tools/families.mjs.', at: new Date().toISOString().slice(0, 10), checked: mods.length, failing: Object.fromEntries(Object.keys(failing).sort().map((k) => [k, failing[k]])) };
  writeFileSync(process.argv[w + 1], JSON.stringify(rec, null, 1) + '\n');
  console.log(`smoke: ${mods.length} skills checked, ${Object.keys(failing).length} failing; wrote ${process.argv[w + 1]}`);
  process.exit(0);
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`all ${mods.length} skills clean`);
