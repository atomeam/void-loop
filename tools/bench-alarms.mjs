// The Bench icon's numbers (asked by Void, 2026-10-16: "a functional 'Bench' icon on the stage that counts active false alarms").
// A false alarm is a finding Verse's review raised that a person read at its commit and found wrong (tools/review-noise.json,
// verdict "false"); "active" is every one still on record. Writes void-live-deploy/bench-alarms.json, which skills/bench.js reads:
// the count, the alarms (file, line, why), the review findings not read yet, and the everyday bench's last score (bench.misses.json).
// The deploy runs it (deploy.yml); the file holds no asks, only file names and the reasons already in the public repo.
//   node tools/bench-alarms.mjs           write the file        node tools/bench-alarms.mjs --check    exit 1 when it is stale
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clip = (s, n) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, n);

/** the file's content from the checked findings and the bench's last run. Pure. */
export function buildAlarms(noise, misses) {
  const rows = Array.isArray(noise) ? noise : [];
  const alarms = rows.filter((r) => r && r.verdict === 'false').map((r) => ({ file: clip(r.file, 120), line: +r.line || 0, why: clip(r.why, 200) }));
  const real = rows.filter((r) => r && r.verdict === 'real').length, unread = rows.filter((r) => r && !r.verdict).length;
  const bench = misses && Number.isFinite(misses.score) ? { score: misses.score, total: misses.total, missed: Array.isArray(misses.misses) ? misses.misses.length : misses.total - misses.score, at: clip(misses.at, 30) } : null;
  return { note: 'Written by tools/bench-alarms.mjs from tools/review-noise.json and tools/bench.misses.json (asked by Void). Files and reasons only.', falseAlarms: alarms.length, real, unread, alarms, ...(bench ? { bench } : {}) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const read = (f) => { try { return JSON.parse(readFileSync(resolve(root, f), 'utf8')); } catch (_) { return null; } };
  const out = resolve(root, 'void-live-deploy/bench-alarms.json'), text = JSON.stringify(buildAlarms(read('tools/review-noise.json'), read('tools/bench.misses.json')), null, 1) + '\n';
  if (process.argv.includes('--check')) { const same = existsSync(out) && readFileSync(out, 'utf8') === text; console.log(same ? 'bench-alarms.json up to date' : 'bench-alarms.json is stale: run node tools/bench-alarms.mjs'); process.exit(same ? 0 : 1); }
  writeFileSync(out, text); console.log('bench-alarms.json: ' + JSON.parse(text).falseAlarms + ' false alarms');
}
