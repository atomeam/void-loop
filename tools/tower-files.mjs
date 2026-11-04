// One file per Versus floor, so two gate runs that measured different floors do not rewrite the same
// tower.evidence.json lines. The aggregate the site fetches is written at deploy (assemble). A floor
// file is { id, rows } and wins over the same floor in the aggregate.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const AGGREGATE = join(root, 'void-live-deploy/tower.evidence.json');
export const DIR = join(root, 'void-live-deploy/tower-evidence');

/** a stable file name for a floor id. Pure. */
export function fileOf(id) {
  const slug = String(id).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'floor';
  const hash = createHash('sha256').update(String(id)).digest('hex').slice(0, 8);
  return slug + '-' + hash + '.json';
}

/** floor ids whose rows differ. Pure. */
export function changedFloors(before, after) {
  const a = (before && before.floors) || {}, b = (after && after.floors) || {};
  return Object.keys(b).filter((id) => JSON.stringify(a[id] || null) !== JSON.stringify(b[id] || null));
}

/** write one file per changed floor. Returns the paths written. */
export function writeFloors(after, before, dir = DIR) {
  mkdirSync(dir, { recursive: true });
  const wrote = [];
  for (const id of changedFloors(before, after)) {
    const path = join(dir, fileOf(id));
    writeFileSync(path, JSON.stringify({ id, rows: after.floors[id] }, null, 1) + '\n');
    wrote.push(path);
  }
  return wrote;
}

/** the aggregate with each floor file laid over it (the file wins). Pure given the parsed files. */
export function overlay(base, files) {
  const out = { ...(base || {}), floors: { ...((base && base.floors) || {}) } };
  for (const f of files || []) {
    if (!f || !f.id) continue;
    out.floors[f.id] = f.rows || {};
  }
  return out;
}

export function readFloorDir(dir = DIR) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const name of readdirSync(dir)) {
    if (!name.endsWith('.json')) continue;
    try { out.push(JSON.parse(readFileSync(join(dir, name), 'utf8'))); } catch (_) { /* a torn write is skipped; the aggregate keeps that floor */ }
  }
  return out;
}

function readAggregate(file = AGGREGATE) {
  try { return existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : { floors: {} }; } catch (_) { return { floors: {} }; }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const cmd = process.argv[2] || 'assemble';
  if (cmd === 'split') {
    // the working tree holds the run's aggregate; HEAD holds main's. Write only the floors that moved.
    let before = { floors: {} };
    try { before = JSON.parse(execFileSync('git', ['show', 'HEAD:void-live-deploy/tower.evidence.json'], { encoding: 'utf8' })); } catch (_) {}
    const after = readAggregate();
    const wrote = writeFloors(after, before);
    console.log('tower-files: ' + wrote.length + ' floor file(s)');
  } else if (cmd === 'assemble') {
    const data = overlay(readAggregate(), readFloorDir());
    writeFileSync(AGGREGATE, JSON.stringify(data, null, 1) + '\n');
    console.log('tower-files: assembled ' + Object.keys(data.floors).length + ' floors');
  } else { console.error('usage: node tools/tower-files.mjs split|assemble'); process.exit(2); }
}
