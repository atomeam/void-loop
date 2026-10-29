// Every skill in void-live-deploy/skills/index.json, in its routing order: each of its examples must reach it first,
// and none of its near misses may. The same rule tools/test_void.mjs enforces, runnable on its own in a second.
//   node tools/skills-check.mjs      prints "all N skills clean" or each collision, exit 1 on any
//   node tools/skills-check.mjs --register   first re-register any skill file the index does not list (order file at the end, index rewritten)
//   node tools/skills-check.mjs --write tools/skills-smoke.json   the daily smoke test (asked by Verse, ask-20261013-1823-2): the same
//     run, its result written as { at, checked, failing: { skill: [what failed] } } for tools/families.mjs (a skill that fails loses
//     its self-test evidence, so its rating drops; one that passes has the day it was last tested); exit 0, the record is the result
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { unlistedSkills } from './skills-unlisted.mjs';
import { registerNames, writeIndex } from './skills-index.mjs';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');
// --register (asked by Verse: "Automate the re-registration of services skills when a skills-check failure is detected"): a skill file the
// index does not list (a merge once dropped `services` this way and nine pricing asks stopped working) is registered again, at the end of
// the routing order, and the index is rewritten, before the check runs; what it did is printed. Nothing is removed or reordered.
let reregistered = [];
if (process.argv.includes('--register')) {
  const loose = await unlistedSkills(dir);
  if (loose.length) { reregistered = registerNames(loose); writeIndex(); console.log('re-registered ' + loose.join(', ') + ' (order file ' + reregistered.join(', ') + '; skills/index.json rewritten)'); }
}
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
  // clean runs in a row per skill (asked by Verse: "a 'skill-stability' metric ... consecutive successful runs"): one count, kept by tools/streaks.mjs in
  // skills-streak.json (a pass adds one, a failure is its error trace and resets it) and copied into this record
  const { bump } = await import('./streaks.mjs'), sf = resolve(dirname(process.argv[w + 1]), 'skills-streak.json'), today = new Date().toISOString().slice(0, 10);
  let prevStreak = null; try { prevStreak = JSON.parse(readFileSync(sf, 'utf8')); } catch (_) {}
  const next = bump(prevStreak, { names: mods.map((m) => m.name), failing, at: today }), streak = next.streaks;
  const rec = { note: 'the daily smoke test of every skill (tools/skills-check.mjs --write; asked by Verse): each loaded, each of its examples reaching it first, none of its near misses, its suite() passing. failing: the skills that did not, with what failed. Read by tools/families.mjs.', at: today, checked: mods.length, streak, failing: Object.fromEntries(Object.keys(failing).sort().map((k) => [k, failing[k]])) };
  writeFileSync(process.argv[w + 1], JSON.stringify(rec, null, 1) + '\n');
  writeFileSync(sf, JSON.stringify(next, null, 1) + '\n');
  console.log(`smoke: ${mods.length} skills checked, ${Object.keys(failing).length} failing; wrote ${process.argv[w + 1]}`);
  process.exit(0);
}
if (bad.length) { console.error(bad.join('\n')); process.exit(1); }
console.log(`all ${mods.length} skills clean`);
