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

// 2026-11-03 (owner: "make it into a more functional usable brain"): the intake held no `learned` field anywhere, so the file was `[]` and the
// recall in front of propose-fix had nothing to say. Two records Verse already writes are lessons in plain fact: each skill's newest live check
// (findings/<skill>/*.json, written by the finding runs) and each site Versus took on (assimilated.json). They become records here, in the
// intake's own shape, and go through the same knowledgeOf/validateKnowledge as every other lesson.
export const FINDINGS = 'findings';
export const SITES = 'void-live-deploy/assimilated.json';
/** the statuses that taught something (a site "read, no page family fits it" taught only that no floor does its job) */
export const SITE_TAUGHT = /^(assimilated|surpassed|built, then discarded|walled|could not be read)$/;
const day = (at) => String(at || '').slice(0, 10);
const short = (v, n = 140) => { const t = typeof v === 'string' ? v : JSON.stringify(v); return !t ? '' : t.length > n ? t.slice(0, n - 1) + '…' : t; };

/** one live check as an intake record, or null. Pure. */
export function findingRecord(f, dir = '') {
  if (!f || typeof f !== 'object' || !f.at) return null;
  const skill = f.skill || dir, what = f.service || f.url || '';
  const codes = Array.isArray(f.pages) ? f.pages.map((p) => p && p.status).filter((x) => x != null) : [];
  const ok = f.ok === true || (f.ok == null && codes.length > 0 && codes.every((c) => c >= 200 && c < 400)) || (f.ok == null && Array.isArray(f.tools) && f.tools.length > 0);
  const bits = [];
  if (f.ask) bits.push('asked "' + short(f.ask, 90) + '"');
  if (codes.length) bits.push(codes.length + ' pages answered ' + [...new Set(codes)].join('/'));
  if (Array.isArray(f.tools)) bits.push(f.tools.length + ' tools listed');
  if (f.answer) bits.push('answer ' + short(f.answer, 110));
  if (f.why) bits.push('why: ' + short(f.why, 60));
  if (f.error) bits.push('error: ' + short(f.error, 80));
  return { title: 'live check: ' + skill + (what ? ' (' + short(what, 70) + ')' : ''), from: 'page', at: f.at,
    learned: day(f.at) + ': ' + (ok ? 'worked' : 'did not work') + (bits.length ? '; ' + bits.join('; ') : ''),
    retain: skill + ' depends on ' + (what || 'a live service') + '; its newest live check (' + day(f.at) + ') ' + (ok ? 'worked' : 'did not work' + (f.why ? ' (' + short(f.why, 40) + ')' : '')) };
}

/** each skill's newest finding (file names are times, so the last sorted name is the newest). */
export function readFindings(base = join(root, FINDINGS)) {
  const out = [];
  if (!existsSync(base)) return out;
  for (const d of readdirSync(base).sort()) {
    let files = []; try { files = readdirSync(join(base, d)).filter((f) => f.endsWith('.json')).sort(); } catch (_) { continue; }
    if (!files.length) continue;
    try { const r = findingRecord(JSON.parse(lf(readFileSync(join(base, d, files[files.length - 1]), 'utf8'))), d); if (r) out.push({ ...r, _file: FINDINGS + '/' + d, _line: 1 }); } catch (_) { /* not JSON: skipped */ }
  }
  return out;
}

/** each site Versus took on, as an intake record, or null when it taught nothing. Pure. */
export function siteRecord(s) {
  if (!s || !s.site || !SITE_TAUGHT.test(String(s.status || ''))) return null;
  const why = [s.why, s.learned].filter(Boolean).join('; ');
  return { title: s.site, from: 'page', at: s.at || '', learned: s.site + ' ' + s.status + (why ? ': ' + short(why, 170) : '') + (s.page ? '; Verse\'s page ' + s.page : ''),
    retain: s.site + ' was ' + s.status + (s.page ? ' by ' + s.page : '') };
}
export function readSites(file = join(root, SITES)) {
  try { return (JSON.parse(lf(readFileSync(file, 'utf8'))).sites || []).map(siteRecord).filter(Boolean).map((r, i) => ({ ...r, _file: SITES, _line: i + 1 })); } catch (_) { return []; }
}

/** the file's exact bytes. Pure. */
export const render = (lessons) => JSON.stringify(Array.isArray(lessons) ? lessons : [], null, 2) + '\n';

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const records = [...readIntake(), ...readFindings(), ...readSites()];
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
  if (!lessons.length) console.log('no record in ' + INTAKE + ', ' + FINDINGS + '/ or ' + SITES + ' carries a lesson yet, so nothing was learned into the file');
}
