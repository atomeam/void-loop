#!/usr/bin/env node
// Is V01D getting better? The daily measure (lib/better.js): five parts from the repo's own evidence, one score, a trend.
//   node tools/better.mjs            print today's measure and the trend
//   node tools/better.mjs --write    the same, and append today's row to void-live-deploy/void.better.json (the growth card reads it)
//   node tools/better.mjs --json     the row and the comparison as JSON
// .github/workflows/better.yml runs --write once a day and commits the file. Nothing here reads the network or a secret, and
// the file carries counts only (never an ask's words).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { measure, rowOf, withRow, compare, asksOf, PARTS } from '../void-live-deploy/lib/better.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const P = (f) => resolve(root, f);
export const OUT = P('void-live-deploy/void.better.json');
const json = (f, d) => { try { return JSON.parse(readFileSync(P(f), 'utf8')); } catch { return d; } };

/** today's row from the repo's files, and the rows with it on the end */
export function today(now = Date.now()) {
  const facts = measure({
    ledger: json('void-live-deploy/void.growth.json', []),
    families: json('void-live-deploy/skills/families.json', null),
    asks: asksOf(existsSync(P('domains/void.voice.md')) ? readFileSync(P('domains/void.voice.md'), 'utf8') : ''),
    decisions: json('domains/void.decisions.json', {}),
    bench: json('tools/bench.misses.json', null),
    now,
  });
  const row = rowOf(facts, new Date(now).toISOString());
  const rows = withRow(json('void-live-deploy/void.better.json', []), row);
  return { row, rows, trend: compare(rows) };
}

/** the measure in words, one line a part */
export function lines({ row, trend }) {
  const f = row.facts, p = row.parts;
  const d = (n, what) => (n === null ? '' : ' (' + (n > 0 ? 'up ' + n : n < 0 ? 'down ' + -n : 'level') + ' ' + what + ')');
  return [
    `better: ${row.score ?? '—'} of 100${d(trend.day, 'since yesterday')}${d(trend.week, 'on the week')}; weakest: ${trend.weakest || '—'}`,
    `  self      ${p.self ?? '—'}   ${f.owner} of this week's ${f.week} ledger lines cite the owner`,
    `  asks      ${p.asks ?? '—'}   ${f.askedBuilt} of my asks built in 14 days, median ${f.medianLagDays ?? '—'} days from ask to ship; ${f.open} open, the oldest ${f.oldestOpenDays} days`,
    `  friction  ${p.friction ?? '—'}   ${f.failing} failing, ${f.unsure} barely checked, of ${f.skills} skills`,
    `  bench     ${p.bench ?? '—'}   ${f.benchScore ?? '—'} of ${f.benchTotal ?? '—'} everyday asks right on main`,
    `  probes    ${p.probes ?? '—'}   ${f.probeFixes} fixes this week from my own probes`,
  ];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const t = today();
  if (process.argv.includes('--json')) console.log(JSON.stringify({ row: t.row, trend: t.trend, parts: PARTS }, null, 1));
  else console.log(lines(t).join('\n'));
  if (process.argv.includes('--write')) { writeFileSync(OUT, JSON.stringify(t.rows, null, 1) + '\n'); console.log(`wrote ${t.rows.length} row(s) to void-live-deploy/void.better.json`); }
}
