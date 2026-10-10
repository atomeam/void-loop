// skills/index.json, generated from one file per skill (2026-10-10, owner: the shared list conflicted on every new skill and
// cost three hand-merges in one evening). The routing order (first match wins, as on the page) comes from the file names in
// void-live-deploy/skills/order/: `0480-watch` puts the watch skill at rank 480. A new skill adds its own file there, at a
// rank between its neighbours, and never edits the list; two skills at the same rank order by name. index.json stays
// committed and served as before (the page fetches it), so this writes it, and checks.mjs fails when it is stale.
//   node tools/skills-index.mjs            prints the list this would write and whether index.json matches it
//   node tools/skills-index.mjs --write    writes void-live-deploy/skills/index.json
//   node tools/skills-index.mjs --check    exit 1 when index.json is stale (what checks.mjs runs)
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

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || '';
  if (mode === '--write') { const n = writeIndex(); console.log('wrote skills/index.json: ' + n.length + ' skills'); }
  else {
    const { names, stale } = indexState();
    if (mode === '--check') { console.log(stale ? 'skills/index.json is stale: node tools/skills-index.mjs --write (the order files in skills/order/ are the source)' : names.length + ' skills, index.json matches skills/order/'); process.exit(stale ? 1 : 0); }
    console.log(indexText(names).trim()); console.log(stale ? 'index.json differs (run with --write)' : 'index.json matches');
  }
}
