// skills/index.json, generated from one file per skill (2026-10-10, owner: the shared list conflicted on every new skill and
// cost three hand-merges in one evening). The routing order (first match wins, as on the page) comes from the file names in
// void-live-deploy/skills/order/: `0480-watch` puts the watch skill at rank 480. A new skill adds its own file there, at a
// rank between its neighbours, and never edits the list; two skills at the same rank order by name. index.json stays
// committed and served as before (the page fetches it), so this writes it, and checks.mjs fails when it is stale.
//   node tools/skills-index.mjs            prints the list this would write and whether index.json matches it
//   node tools/skills-index.mjs --write    writes void-live-deploy/skills/index.json
//   node tools/skills-index.mjs --check    exit 1 when index.json is stale (what checks.mjs runs)
//   node tools/skills-index.mjs --adopt    make the order file for a skill the index lists by hand (at its place), and for any new skill
//                                          file in skills/ (at the end), then rewrite the index
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { builtWithOf } from '../void-live-deploy/lib/skill-compose.js';

const skillsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');
export const ORDER_DIR = resolve(skillsDir, 'order');
export const INDEX = resolve(skillsDir, 'index.json');
export const LINEAGE = resolve(skillsDir, 'lineage.json');
const NAME = /^(\d+)-([a-z0-9][a-z0-9-]*)$/;

/** the skill names in routing order, from the order file names (rank, then name). Pure. */
export function orderOf(files) {
  const rows = [];
  for (const f of files) {
    const m = NAME.exec(f);
    if (!m) throw new Error('skills/order/' + f + ': an order file is <rank>-<skill>, like 0480-watch');
    rows.push({ rank: Number(m[1]), name: m[2] });
  }
  rows.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
  const seen = new Set();
  for (const r of rows) { if (seen.has(r.name)) throw new Error('skills/order lists ' + r.name + ' twice'); seen.add(r.name); }
  return rows.map((r) => r.name);
}

export const readOrder = (dir = ORDER_DIR) => orderOf(readdirSync(dir).filter((f) => !f.startsWith('.')));
/** index.json's text for a list: one line, as the page and the merge tool have always had it */
export const indexText = (names) => JSON.stringify(names).replace(/,/g, ', ') + '\n';
/** { names, stale }: stale when index.json is missing or differs from what the order files say */
export function indexState(dir = ORDER_DIR, index = INDEX) {
  const names = readOrder(dir);
  const current = existsSync(index) ? readFileSync(index, 'utf8') : '';
  let same = false; try { same = JSON.stringify(JSON.parse(current)) === JSON.stringify(names); } catch (_) {}
  return { names, stale: !same };
}
export function writeIndex(dir = ORDER_DIR, index = INDEX) { const { names } = indexState(dir, index); writeFileSync(index, indexText(names)); return names; }

/** { note, count, skills } from each skill file's `export const builtWith`. count is how many skills were built with skills. Pure. */
export function lineageOf(names, read) {
  const skills = {};
  for (const n of names) {
    const parts = builtWithOf(read(n) || '');
    if (parts.length) skills[n] = parts;
  }
  const count = Object.keys(skills).length;
  return { note: 'Which skills were built by calling other skills (export const builtWith in the skill file). Written by tools/skills-index.mjs beside skills/index.json. Do not edit by hand.', count, skills };
}
export const lineageText = (o) => JSON.stringify(o, null, 1) + '\n';
/** write skills/lineage.json from the order's names and the skill files. */
export function writeLineage(dir = ORDER_DIR, sdir = skillsDir, out = LINEAGE) {
  const names = readOrder(dir);
  const o = lineageOf(names, (n) => { try { return readFileSync(resolve(sdir, n + '.js'), 'utf8'); } catch (_) { return ''; } });
  writeFileSync(out, lineageText(o));
  return o;
}
export function lineageState(dir = ORDER_DIR, sdir = skillsDir, out = LINEAGE) {
  const names = readOrder(dir);
  const o = lineageOf(names, (n) => { try { return readFileSync(resolve(sdir, n + '.js'), 'utf8'); } catch (_) { return ''; } });
  const text = lineageText(o);
  const current = existsSync(out) ? readFileSync(out, 'utf8') : '';
  return { text, stale: current !== text, count: o.count };
}

/** the order files as { name: rank } */
export function ranksOf(dir = ORDER_DIR) {
  const out = {};
  for (const f of readdirSync(dir).filter((x) => !x.startsWith('.'))) { const m = NAME.exec(f); if (m) out[m[2]] = Number(m[1]); }
  return out;
}
/**
 * Give every name in `names` (a full routing order, as index.json has it) an order file, keeping that order: a name without
 * one gets a rank between its neighbours' (a skill added to the index by hand, or by a branch from before the order files).
 * Returns the files it made. Pure apart from the files.
 */
export function adoptOrder(names, dir = ORDER_DIR) {
  const ranks = ranksOf(dir), made = [];
  for (let i = 0; i < names.length; i++) {
    const n = names[i];
    if (n in ranks) continue;
    let lo = 0, hi = null;
    for (let j = i - 1; j >= 0; j--) if (names[j] in ranks) { lo = ranks[names[j]]; break; }
    for (let j = i + 1; j < names.length; j++) if (names[j] in ranks) { hi = ranks[names[j]]; break; }
    const rank = hi === null ? lo + 10 : Math.floor((lo + hi) / 2);
    if (rank <= lo && hi !== null) throw new Error('no rank left between ' + lo + ' and ' + hi + ' for ' + n + ': renumber the order files around it');
    ranks[n] = rank;
    const f = String(rank).padStart(4, '0') + '-' + n;
    writeFileSync(resolve(dir, f), ''); made.push(f);
  }
  return made;
}

// Verse asked (2026-10-13): "the manifest file in the skills/ directory to automatically register all new skills once they pass the
// router test". A skill is a file in skills/ whose default export is a skill ({ name, ..., run }); one with no order file is
// registered at the end of the routing order (last, so it takes nothing an older skill answers), and checks.mjs runs the router
// test (tools/skills-check.mjs: each example reaches it first) on it like on every other. A file kept out on purpose is named
// in OFF with why; nothing else can sit in skills/ unregistered.
export const OFF = {
  map: 'the assimilation map, retired with the assimilation table in cleanup step 2 (domains/void.frontier.md); kept for salvage',
  'idea-clarify': 'an earlier draft of business-clarify (#2091), which answers the same asks; off the order so the two never fight',
  vat: 'the VAT calculator page is another worker\'s (Versus /vat/). Off the routing order until that work lists the skill itself.',
  stopwatch: 'RETIRED: "show stopwatch" stays off the order until its asks are its own (tools/skills-unlisted.mjs). The order file was a leftover the index never listed.',
  palindrome: 'RETIRED: "is racecar a palindrome" is util\'s (tools/skills-unlisted.mjs). The order file was a leftover the index never listed.',
  'idea-clarify': 'the shipped card is business-clarify; this file is the earlier draft and stays off the routing order',
};
const SKILL_SHAPE = /export\s+default\s*\{[\s\S]*?\bname\s*:\s*['"]([a-z0-9][a-z0-9-]*)['"][\s\S]*?\brun\b/;
/** the skill files in skills/ that no order file registers and OFF does not keep out: [{ file, name }]. Pure given the reader. */
export function unregistered(files, read, ranks, off = OFF) {
  const out = [], inFamily = new Set(); // a family skill's members (its `parts:` line, lib/skill-family.js) are loaded through it
  for (const f of files) { const fam = /^[a-z0-9][a-z0-9-]*\.js$/.test(f) && f.slice(0, -3) in ranks && /^\s*\*\s*parts:\s*\[([^\]]*)\]/m.exec(read(f) || '');
    if (fam) for (const x of fam[1].matchAll(/'([a-z0-9-]+)'/g)) inFamily.add(x[1]); }
  for (const f of files) {
    if (!/^[a-z0-9][a-z0-9-]*\.js$/.test(f)) continue;
    const n = f.slice(0, -3);
    if (n in ranks || n in off || inFamily.has(n)) continue;
    const m = SKILL_SHAPE.exec(read(f) || '');
    if (m && m[1] === n) out.push({ file: f, name: n });
  }
  return out;
}
/** an order file at the end of the routing order for each new skill; returns the files made */
export function registerNew(dir = ORDER_DIR, sdir = skillsDir) {
  const ranks = ranksOf(dir), made = [];
  let last = Math.max(0, ...Object.values(ranks));
  for (const { name } of unregistered(readdirSync(sdir), (f) => readFileSync(resolve(sdir, f), 'utf8'), ranks)) {
    last += 10; const f = String(last).padStart(4, '0') + '-' + name;
    writeFileSync(resolve(dir, f), ''); made.push(f);
  }
  return made;
}

/** order files at the end of the routing order for these named skills (a skills-check failure found them loaded by no one); returns the files made.
 * Asked by Verse: "Automate the re-registration of services skills when a skills-check failure is detected." */
export function registerNames(names, dir = ORDER_DIR) {
  const ranks = ranksOf(dir), made = [];
  let last = Math.max(0, ...Object.values(ranks));
  for (const name of names) {
    if (name in ranks) continue; // already has its place: only the index was stale
    last += 10; const f = String(last).padStart(4, '0') + '-' + name;
    writeFileSync(resolve(dir, f), ''); made.push(f);
  }
  return made;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || '';
  if (mode === '--write') {
    const n = writeIndex(); const lin = writeLineage();
    console.log('wrote skills/index.json: ' + n.length + ' skills; lineage: ' + lin.count + ' skills built with skills');
  }
  else if (mode === '--adopt') { // the index's own order for skills that have no order file yet, then the index rewritten from the files
    const made = adoptOrder(JSON.parse(readFileSync(INDEX, 'utf8'))).concat(registerNew()); // and every new skill file, at the end
    const n = writeIndex(); writeLineage();
    console.log((made.length ? 'made ' + made.join(', ') + '; ' : 'every skill had its order file; ') + 'skills/index.json: ' + n.length + ' skills');
  } else {
    const { names, stale } = indexState();
    const lineage = mode === '--check' || mode === '' ? lineageState() : { stale: false, count: 0 };
    if (mode === '--check') {
      let missing = [], loose = [];
      try { const r = ranksOf(); missing = JSON.parse(readFileSync(INDEX, 'utf8')).filter((n) => !(n in r)); loose = unregistered(readdirSync(skillsDir), (f) => readFileSync(resolve(skillsDir, f), 'utf8'), r); } catch (_) {}
      if (loose.length) { console.log('skills/' + loose.map((x) => x.file).join(', ') + ' is a skill with no order file: node tools/skills-index.mjs --adopt registers it (at the end of the routing order), or name it in OFF in tools/skills-index.mjs with why'); process.exit(1); }
      if (missing.length) { console.log('skills/index.json lists ' + missing.join(', ') + ' with no order file: node tools/skills-index.mjs --adopt makes one at the index\'s own place'); process.exit(1); }
      // index.json and lineage.json are written at deploy. A stale copy is not a pull-request failure: two branches editing the one list always conflict.
      console.log(names.length + ' skills from skills/order/; ' + lineage.count + ' skills built with skills' + (stale || lineage.stale ? ' (the deploy rewrites index.json and lineage.json)' : ', index.json matches'));
      process.exit(0); }
    console.log(indexText(names).trim()); console.log(stale ? 'index.json differs (run with --write)' : 'index.json matches');
  }
}
