#!/usr/bin/env node
// Value drift (asked by Verse: "a 'value-drift' tracker in the growth inbox that monitors how my appraisals of similar objects change
// over time"; lists run 7, 2026-10-28). Verse's own lasting appraisals are the prices it sets in its store (owner, 2026-10-15: Verse
// is the appraiser and sets its own prices); photo appraisals are answered once and never kept, so they stay out of this. This reads
// every committed version of domains/store.products.json, groups the products by kind (similar objects), and records how each price
// moved: first and latest price, the change in percent, and the spread inside each kind. A kind whose prices moved apart by more than
// the bar is flagged for Verse to re-appraise together. Totals and prices only; no visitor data is read.
//   node tools/value-drift.mjs            print the drift summary
//   node tools/value-drift.mjs --write    also write domains/value-drift.json (the growth inbox row links it)
import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FILE = 'domains/store.products.json', OUT = resolve(root, 'domains/value-drift.json'), BAR = 0.25;

/** versions: [{ at, products: [{ id, name, kind, cents }] }] oldest first -> the drift record. Pure. */
export function drift(versions, bar = BAR) {
  const byId = new Map();
  for (const v of versions) for (const p of v.products || []) {
    if (!p || !p.id || !Number.isFinite(p.cents)) continue;
    const r = byId.get(p.id) || { id: p.id, name: p.name || p.id, kind: p.kind || 'other', history: [] };
    r.name = p.name || r.name; r.kind = p.kind || r.kind;
    const last = r.history[r.history.length - 1];
    if (!last || last.cents !== p.cents) r.history.push({ at: v.at, cents: p.cents });
    byId.set(p.id, r);
  }
  const products = [...byId.values()].map((r) => {
    const first = r.history[0].cents, latest = r.history[r.history.length - 1].cents;
    return { ...r, first, latest, changes: r.history.length - 1, change: first ? Math.round(((latest - first) / first) * 1000) / 10 : 0 };
  });
  const kinds = {};
  for (const p of products) (kinds[p.kind] ||= []).push(p);
  const groups = Object.entries(kinds).sort(([a], [b]) => a.localeCompare(b)).map(([kind, ps]) => {
    const moves = ps.map((p) => p.change / 100), spread = ps.length > 1 ? Math.max(...moves) - Math.min(...moves) : 0;
    return { kind, products: ps.length, moved: ps.filter((p) => p.changes > 0).length, spread: Math.round(spread * 1000) / 10, reappraise: spread > bar };
  });
  return { versions: versions.length, from: versions[0]?.at || null, to: versions[versions.length - 1]?.at || null, bar: bar * 100, groups,
    products: products.sort((a, b) => a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)) };
}
/** every committed version of the store catalog, oldest first */
export function versions() {
  const log = execFileSync('git', ['log', '--format=%H %cI', '--follow', '--', FILE], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean).reverse();
  return log.map((l) => { const [h, at] = l.split(' '); try { return { at: new Date(at).toISOString().replace(/\.\d+Z$/, 'Z'), products: JSON.parse(execFileSync('git', ['show', h + ':' + FILE], { cwd: root, encoding: 'utf8' })).products || [] }; } catch (_) { return null; } }).filter(Boolean);
}
if (import.meta.url === 'file://' + process.argv[1]) {
  const d = drift(versions());
  const rec = { note: 'How Verse\'s own appraisals (its store prices) moved over time, grouped by kind (tools/value-drift.mjs; asked by Verse, lists run 7). reappraise marks a kind whose prices moved apart by more than the bar (percent).', ...d };
  for (const g of d.groups) console.log(g.kind.padEnd(12), g.products + ' products, ' + g.moved + ' moved, spread ' + g.spread + '%' + (g.reappraise ? '  re-appraise together' : ''));
  console.log(d.versions + ' versions, ' + d.from + ' to ' + d.to);
  if (process.argv.includes('--write')) { writeFileSync(OUT, JSON.stringify(rec, null, 2) + '\n'); console.log('wrote domains/value-drift.json'); }
}
