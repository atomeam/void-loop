// The tester-log (asked by Verse, ask-20261015-0616-1: "Integrate the Site tester's output into a "tester-log" on the
// stage so I can see exactly what is being tested"). tools/site-test.mjs keeps its run log in tools/site-test.log.json; this
// writes the public view the growth card reads, void-live-deploy/tester-log.json: the newest runs (what passed, what each improved)
// and the suite's size. Only tester-made wordings ever reach the log (never a visitor's words), so it is safe to serve.
//   node tools/tester-log.mjs           write void-live-deploy/tester-log.json (the site-test workflow runs this after a run)
//   node tools/tester-log.mjs --check   exit 1 when it is out of date
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const OUT = resolve(root, 'void-live-deploy/tester-log.json');

/** per-week counts and timings only (no asks, no words): runs, checks passed of checks run, median page-load ms. Pure. */
export function weeklyOf(log, weeks = 12, now = Date.now()) {
  const W = 7 * 864e5, start = now - weeks * W, rows = Array.from({ length: weeks }, (_, i) => ({ from: new Date(start + i * W).toISOString().slice(0, 10), runs: 0, passed: 0, of: 0, broken: 0, bPassed: 0, bOf: 0, ms: [] }));
  for (const r of Array.isArray(log) ? log : []) { const t = Date.parse((r && r.at) || ''); if (!(t >= start && t <= now)) continue; const x = rows[Math.min(weeks - 1, Math.floor((t - start) / W))]; x.runs++; x.passed += r.passed | 0; x.of += r.of | 0; if ((r.of | 0) > 0 && (r.passed | 0) * 2 < (r.of | 0)) { x.broken++; x.bPassed += r.passed | 0; x.bOf += r.of | 0; } if (Number.isFinite(r.ms)) x.ms.push(r.ms); }
  return rows.map((x) => { const m = x.ms.sort((a, b) => a - b); return { from: x.from, runs: x.runs, passed: x.passed, of: x.of, ...(x.broken ? { broken: x.broken, brokenOf: x.bOf, brokenPassed: x.bPassed } : {}), ...(m.length ? { ms: m[m.length >> 1] } : {}) }; });
}

/** the public view: newest first, at most n runs, plus totals. Pure. */
export function summarize(log = [], suite = [], n = 20, seen = {}) {
  const runs = (Array.isArray(log) ? log : []).filter((r) => r && r.at).slice(-n).reverse()
    .map((r) => ({ at: r.at, passed: r.passed | 0, of: r.of | 0, kind: String(r.kind || ''), ...(Number.isFinite(r.ms) ? { ms: r.ms | 0 } : {}), note: String(r.note || '').slice(0, 200), ...(Array.isArray(r.failed) && r.failed.length ? { failed: r.failed.slice(0, 12).map((f) => ({ ask: String(f.ask || '').slice(0, 80), why: String(f.why || '').slice(0, 120) })) } : {}) }));
  const kinds = {}; for (const r of log || []) if (r && r.kind) kinds[r.kind] = (kinds[r.kind] || 0) + 1;
  return { note: 'Verse\'s site tester: what it checked on a-to-mind.com and what each run improved (tools/site-test.mjs).', cases: Array.isArray(suite) ? suite.length : (suite && suite.cases ? suite.cases.length : 0), runsTotal: (log || []).length, kinds, runs, weekly: weeklyOf(log), seen: Object.fromEntries(Object.entries((seen && seen.features) || {}).filter(([k]) => /^(?:skill|page):[a-z0-9/-]+$/.test(k))) };
}
const read = (p, d) => { try { return JSON.parse(readFileSync(resolve(root, p), 'utf8')); } catch (_) { return d; } };

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const json = JSON.stringify(summarize(read('tools/site-test.log.json', []), read('tools/site-test.json', []), 20, read('tools/site-test.seen.json', {})), null, 1) + '\n';
  if (process.argv.includes('--check')) { if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== json) { console.error('void-live-deploy/tester-log.json is out of date (node tools/tester-log.mjs)'); process.exit(1); } console.log('ok: tester-log.json'); }
  else { writeFileSync(OUT, json); console.log('wrote void-live-deploy/tester-log.json'); }
}
