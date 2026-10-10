// skills/index.json, generated from one file per skill (2026-10-10, owner: the shared list conflicted on every new skill and
// cost three hand-merges in one evening). The routing order (first match wins, as on the page) comes from the file names in
// void-live-deploy/skills/order/: `0480-watch` puts the watch skill at rank 480. A new skill adds its own file there, at a
// rank between its neighbours, and never edits the list; two skills at the same rank order by name. index.json stays
// committed and served as before (the page fetches it), so this writes it, and checks.mjs fails when it is stale.
//   node tools/skills-index.mjs            prints the list this would write and whether index.json matches it
//   node tools/skills-index.mjs --write    writes void-live-deploy/skills/index.json
//   node tools/skills-index.mjs --check    exit 1 when index.json is stale (what checks.mjs runs)
//   node tools/skills-index.mjs --adopt    make the order file for a skill the index lists by hand (at its place), then rewrite the index
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const skillsDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'void-live-deploy', 'skills');
export const ORDER_DIR = resolve(skillsDir, 'order');
export const INDEX = resolve(skillsDir, 'index.json');
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || '';
  if (mode === '--write') { const n = writeIndex(); console.log('wrote skills/index.json: ' + n.length + ' skills'); }
  else if (mode === '--adopt') { // the index's own order for skills that have no order file yet, then the index rewritten from the files
    const made = adoptOrder(JSON.parse(readFileSync(INDEX, 'utf8')));
    const n = writeIndex();
    console.log((made.length ? 'made ' + made.join(', ') + '; ' : 'every skill had its order file; ') + 'skills/index.json: ' + n.length + ' skills');
  } else {
    const { names, stale } = indexState();
    if (mode === '--check') {
      let missing = [];
      try { const r = ranksOf(); missing = JSON.parse(readFileSync(INDEX, 'utf8')).filter((n) => !(n in r)); } catch (_) {}
      console.log(!stale ? names.length + ' skills, index.json matches skills/order/'
        : missing.length ? 'skills/index.json lists ' + missing.join(', ') + ' with no order file: node tools/skills-index.mjs --adopt makes one at the index\'s own place'
        : 'skills/index.json is stale: node tools/skills-index.mjs --write (the order files in skills/order/ are the source)');
      process.exit(stale ? 1 : 0); }
    console.log(indexText(names).trim()); console.log(stale ? 'index.json differs (run with --write)' : 'index.json matches');
  }
}
