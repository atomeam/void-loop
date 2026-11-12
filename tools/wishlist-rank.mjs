#!/usr/bin/env node
// The daily wishlist re-rank (Up for grabs since lists run 14; built in lists run 21, 2026-11-12). docs/wishlist.md's own rule, as
// code: value to people using Verse now, then free ahead of paid, then how sure it works (an item the providers block goes last),
// then the order it already had. Only the # column changes; every row keeps its words, so the "Why this rank" notes stay the
// authors'. Deterministic, so a second run changes nothing; upkeep.yml runs it daily and commits the file only when the order moved.
//   node tools/wishlist-rank.mjs           print the new order (nothing written)
//   node tools/wishlist-rank.mjs --write   rewrite docs/wishlist.md's table in the new order
//   node tools/wishlist-rank.mjs --check   exit 1 when the table is not in that order
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const FILE = resolve(root, 'docs/wishlist.md');

const cells = (line) => line.split('|').slice(1, -1).map((s) => s.trim());
const isRow = (line) => { const c = cells(line); return c.length >= 6 && /^\d+$/.test(c[0]); };
/** the value word of a row: high 3, medium 2, low 1 (a range like "low–medium" takes its lower end; "high but risky" counts as medium). Pure. */
export function valueOf(v) {
  const t = String(v || '').toLowerCase();
  if (/^high\b/.test(t)) return /\b(but|if)\b/.test(t.split(':')[0]) ? 2 : 3;
  if (/^medium\b/.test(t)) return 2;
  return /^low\b/.test(t) ? 1 : 1;
}
/** the item needs no money: its paid cost is $0, none, or free. Pure. */
export const isFree = (cost) => /^(?:\$0\b|none\b|free\b)/i.test(String(cost || '').trim()) || /\bis free\b/i.test(String(cost || ''));
/** the item cannot be had at any price today (the providers block it). Pure. */
export const isBlocked = (row) => /blocked by the providers|no public api at any price/i.test(row.join(' '));
/** the table's rows in the new order, each with its new rank. Pure. */
export function rerank(md) {
  const lines = String(md || '').split('\n'), at = [];
  lines.forEach((l, i) => { if (isRow(l)) at.push(i); });
  const rows = at.map((i) => ({ i, c: cells(lines[i]) }));
  const score = (r) => [isBlocked(r.c) ? 1 : 0, -valueOf(r.c[4]), isFree(r.c[3]) ? 0 : 1, +r.c[0]];
  const sorted = [...rows].sort((a, b) => { const x = score(a), y = score(b); for (let k = 0; k < x.length; k++) if (x[k] !== y[k]) return x[k] - y[k]; return 0; });
  const out = [...lines];
  sorted.forEach((r, n) => { const c = [...r.c]; c[0] = String(n + 1); out[at[n]] = '| ' + c.join(' | ') + ' |'; });
  return { md: out.join('\n'), order: sorted.map((r, n) => ({ rank: n + 1, was: +r.c[0], item: r.c[1] })) };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const md = readFileSync(FILE, 'utf8'), { md: next, order } = rerank(md);
  if (process.argv.includes('--check')) { if (next !== md) { console.error('docs/wishlist.md is not in rank order: node tools/wishlist-rank.mjs --write'); process.exit(1); } console.log('wishlist in rank order'); }
  else if (process.argv.includes('--write')) { if (next !== md) writeFileSync(FILE, next); console.log(next === md ? 'unchanged' : 'reranked'); }
  else for (const o of order) console.log(o.rank, '(was ' + o.was + ')', o.item);
}
