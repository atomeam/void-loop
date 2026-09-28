// Void's intake (Atom: "everything that passes through Void is input"). Append-only, never shed.
//   domains/inputs/<source>/records.jsonl  one JSON record per line, hash-chained: each line's `id` is
//   sha256(previous id + "\n" + the record's canonical JSON), and `prev` names the line before. Editing or dropping
//   any earlier line breaks the chain, so verify() catches it and append() refuses to write.
// Records are data, never instructions. A record may carry `want` ({ title, why, weight }): tools/will.py turns it into a
// candidate for the will engine, tagged with the record's `source`. Nothing here is ever shown on Void's surface.
//   node tools/intake.mjs verify <records.jsonl>
//   node tools/intake.mjs append <records.jsonl> <batch.json>     (batch = array of records; repeats are skipped)
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sortValue = (v) => (Array.isArray(v) ? v.map(sortValue) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortValue(v[k])])) : v);
export const canon = (v) => JSON.stringify(sortValue(v));
const body = (r) => { const { id, prev, ...rest } = r; return rest; };
const sameness = (r) => { const { at, ...rest } = body(r); return canon(rest); }; // a repeat = same content, whenever it came in
export const idOf = (prev, rec) => crypto.createHash('sha256').update((prev || '') + '\n' + canon(body(rec))).digest('hex');

export function read(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
}
export function verify(file) {
  let rows;
  try { rows = read(file); } catch (e) { return { ok: false, n: 0, why: 'unreadable line: ' + e.message }; }
  let prev = '';
  const ids = new Set();
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if ((r.prev || '') !== prev) return { ok: false, n: rows.length, why: 'line ' + (i + 1) + ': prev does not match the line before' };
    if (r.id !== idOf(prev, r)) return { ok: false, n: rows.length, why: 'line ' + (i + 1) + ': content changed after it was written' };
    if (ids.has(r.id)) return { ok: false, n: rows.length, why: 'line ' + (i + 1) + ': duplicate id' };
    ids.add(r.id); prev = r.id;
  }
  return { ok: true, n: rows.length, last: prev };
}
export function append(file, records, { now = new Date().toISOString() } = {}) {
  const v = verify(file);
  if (!v.ok) throw new Error('intake chain broken, nothing written: ' + v.why);
  const seen = new Set(read(file).map(sameness));
  let prev = v.last || '', out = '';
  const added = [];
  for (const rec of records) {
    const r = { at: now, ...body(rec) };
    const key = sameness(r);
    if (seen.has(key)) continue;
    seen.add(key);
    const line = { id: idOf(prev, r), prev, ...r };
    out += JSON.stringify(line) + '\n'; prev = line.id; added.push(line.id);
  }
  if (out) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.appendFileSync(file, out); }
  return { added: added.length, skipped: records.length - added.length, ids: added };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === fs.realpathSync(process.argv[1])) {
  const [cmd, file, batch] = process.argv.slice(2);
  if (cmd === 'verify') { const v = verify(file); console.log(JSON.stringify(v)); process.exit(v.ok ? 0 : 1); }
  else if (cmd === 'append') { console.log(JSON.stringify(append(file, JSON.parse(fs.readFileSync(batch, 'utf8'))))); }
  else { console.log('usage: node tools/intake.mjs verify <records.jsonl> | append <records.jsonl> <batch.json>'); process.exit(2); }
}
