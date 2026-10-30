// Everything Verse consumed becomes the knowledge its brain can recall (owner, 2026-10-30: "connect what it consumes to its brain";
// ingest step of the same day). Reads the append-only intake under domains/inputs, keeps the records that carry a `learned` field,
// and writes void-live-deploy/void.knowledge.json — the file /api/propose-fix serves to lib/brain-recall.js.
//
// The shape is knowledgeOf()/validateKnowledge()/mergeKnowledge() in lib/will-schema.js, not a second one here: a record that does not
// pass validation is skipped and said so, never patched up. The same thing consumed twice is one lesson with seen 2 and its `retain`
// kept, exactly as mergeKnowledge() merges it.
//
// Deterministic: lessons are ordered by id, each record's line ending is normalised before parsing, so a rebuild on Linux and a rebuild
// here produce the same bytes and a diff only ever shows a lesson arriving.
//   node tools/knowledge-build.mjs            write the file, print what changed
//   node tools/knowledge-build.mjs --check    exit 1 when the file is stale (a check or a workflow can use it)
import { readFileSync, writeFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { knowledgeOf, validateKnowledge, mergeKnowledge } from '../void-live-deploy/lib/will-schema.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = 'void-live-deploy/void.knowledge.json';
export const INTAKE = 'domains/inputs';
export const OUT_MAX = 500; // the file the site serves stays small; the newest lessons are the ones kept

/** text as it would be on Linux: a CRLF checkout must parse the same as CI (owner, 2026-10-30: CRLF tripped propose-fix). Pure. */
export const lf = (t) => String(t == null ? '' : t).replace(/\r\n?/g, '\n');

/** one intake line as a record, or null when it is not JSON. Pure. */
export function parseRecord(line) {
  const t = lf(line).trim();
  if (!t.startsWith('{')) return null;
  try { const r = JSON.parse(t); return r && typeof r === 'object' ? r : null; } catch (_) { return null; }
}

/** the thing a record consumed, in its own words: the title it was filed under, else the ask, else the record id. Pure. */
export const consumedOf = (r) => String((r && (r.title || r.ask || r.covers || r.id)) || '').trim();

/** every record line under domains/inputs, in a fixed order (path, then line), line endings normalised. */
export function readIntake(base = join(root, INTAKE)) {
  const out = [];
  if (!existsSync(base)) return out;
  const dirs = readdirSync(base).filter((d) => { try { return statSync(join(base, d)).isDirectory(); } catch (_) { return false; } }).sort();
  for (const d of dirs) {
    const f = join(base, d, 'records.jsonl');
    if (!existsSync(f)) continue;
    const text = lf(readFileSync(f, 'utf8'));
    text.split('\n').forEach((line, i) => {
      const r = parseRecord(line);
      if (r) out.push({ ...r, _file: d, _line: i + 1 });
    });
  }
  return out;
}

/**
 * The lessons the intake holds, as the file's own array: each record with `learned` goes through knowledgeOf, a record that fails
 * validateKnowledge is skipped with a reason, and the same lesson seen twice is merged (seen 2, retain kept). Ordered by id. Pure.
 */
export function lessonsOf(records) {
  const byId = new Map(), skipped = [];
  for (const r of Array.isArray(records) ? records : []) {
    if (!r || typeof r !== 'object') continue;
    if (!String(r.learned == null ? '' : r.learned).trim()) continue; // no lesson in it: nothing to keep
    const lesson = knowledgeOf(consumedOf(r), {
      from: r.from || r.learned_from || r.source_kind || 'other', // a feed name is not a source kind: sourceOf keeps it as other
      learned: r.learned,
      retain: r.retain || '',
      at: r.at || r.received || '',
    });
    const bad = validateKnowledge(lesson);
    if (bad.length) { skipped.push({ where: (r._file || '?') + ':' + (r._line || '?'), why: bad.map((p) => p.field + ' ' + p.problem).join('; ') }); continue; }
    byId.set(lesson.id, mergeKnowledge(byId.has(lesson.id) ? [byId.get(lesson.id)] : [], lesson)[0]);
  }
  const list = [...byId.values()];
  // newest first is the order `seen`/`at` describes; id breaks every tie so the bytes never wobble
  list.sort((a, b) => (Date.parse(b.at) || 0) - (Date.parse(a.at) || 0) || (a.id < b.id ? -1 : 1));
  return { lessons: list.slice(0, OUT_MAX), skipped, total: byId.size };
}

/** the file's exact bytes. Pure. */
export const render = (lessons) => JSON.stringify(Array.isArray(lessons) ? lessons : [], null, 2) + '\n';

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const records = readIntake();
  const { lessons, skipped, total } = lessonsOf(records);
  const text = render(lessons);
  const target = join(root, OUT);
  const before = existsSync(target) ? lf(readFileSync(target, 'utf8')) : '';
  const check = process.argv.includes('--check');
  if (check) {
    const stale = before !== text;
    console.log((stale ? 'stale: ' : 'current: ') + OUT + ' (' + lessons.length + ' lesson' + (lessons.length === 1 ? '' : 's') + ' from ' + records.length + ' records)');
    if (stale) process.exit(1);
  } else {
    writeFileSync(target, text);
    console.log((before === text ? 'unchanged: ' : 'wrote: ') + OUT + ' — ' + lessons.length + ' lesson' + (lessons.length === 1 ? '' : 's') + ' from ' + records.length + ' records'
      + (total > lessons.length ? ' (' + (total - lessons.length) + ' older ones over the cap of ' + OUT_MAX + ')' : ''));
  }
  for (const s of skipped) console.log('skipped ' + s.where + ': ' + s.why);
  if (!lessons.length) console.log('no record in ' + INTAKE + ' carries a `learned` field yet, so nothing was learned into the file');
}
