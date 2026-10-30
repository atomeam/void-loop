// Versus by size (owner, 2026-10-26): rank every tower site by real traffic from the Tranco top-million list, so "easiest first, giants last" comes
// from data. Writes void-live-deploy/tower.rank.json ({ list, ranks: { <floor id>: rank|null }, domains, order }), only our rivals (~170 rows), the
// same file for the same list (no clock in it). A hand override for edge cases (a tiny but data-heavy site) lives in domains/tower.order.json.
//   node tools/tower-rank.mjs                 fetch the latest Tranco list and write the file (the monthly workflow does this on a runner)
//   node tools/tower-rank.mjs --file top.csv  read a local copy of the list instead of fetching (rank,domain per line)
//   node tools/tower-rank.mjs --next [n]      the next n (10) floors Verse has not surpassed, smallest site first (reads the committed files)
// Tranco: https://tranco-list.eu, Le Pochat et al., "Tranco: A Research-Oriented Top Sites Ranking Hardened Against Manipulation", NDSS 2019.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FLOORS, tower } from '../void-live-deploy/lib/tower.js';
import { regDomain, bySize, sizeOf, nextUnsurpassed, rankLabel } from '../void-live-deploy/lib/tower-rank.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'void-live-deploy', 'tower.rank.json'), ORDER = path.join(ROOT, 'domains', 'tower.order.json'), EVID = path.join(ROOT, 'void-live-deploy', 'tower.evidence.json');
export const TRANCO = 'https://tranco-list.eu/top-1m.csv.zip';
const readJson = (p, d) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return d; } };

/** the floor id -> registrable domain of its site, from its url (else its site name when that is a host). Pure. */
export const domainsOf = (floors) => Object.fromEntries(floors.map((f) => [f.id, regDomain(f.url) || regDomain(f.site)]).filter(([, d]) => d));
/** the file: ranks of our rivals from the list's text ("rank,domain" lines). null = outside the list. Deterministic. Pure. */
export function buildRank({ floors, csv, list, order = {} }) {
  const domains = domainsOf(floors), want = new Set(Object.values(domains)), found = new Map();
  for (const line of String(csv).split('\n')) { const i = line.indexOf(','); if (i < 1) continue; const d = line.slice(i + 1).trim().toLowerCase(); if (want.has(d) && !found.has(d)) found.set(d, +line.slice(0, i)); }
  const ranks = {}; for (const f of floors) ranks[f.id] = domains[f.id] ? found.get(domains[f.id]) || null : null;
  const clean = {}; for (const [k, v] of Object.entries(order || {})) if (Number.isFinite(+v) && v !== null) clean[k] = +v;
  return { about: 'How big each Versus site is: its place in the Tranco top-million list of most visited sites (1 = the most visited; null = outside the million). Written by tools/tower-rank.mjs; hand overrides come from domains/tower.order.json.',
    credit: 'Tranco, https://tranco-list.eu. Le Pochat, Van Goethem, Tajalizadeh, Joosen, Joosen: "Tranco: A Research-Oriented Top Sites Ranking Hardened Against Manipulation", NDSS 2019.',
    list, ranks, domains, order: clean };
}
const csvOfFile = (p) => { if (/\.zip$/i.test(p)) { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tranco-')); execFileSync('unzip', ['-o', '-q', p, '-d', d]); return fs.readFileSync(path.join(d, 'top-1m.csv'), 'utf8'); } return fs.readFileSync(p, 'utf8'); };
function fetchList() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'tranco-')), z = path.join(d, 't.zip'), h = path.join(d, 'h.txt');
  execFileSync('curl', ['-fsSL', '--retry', '3', '--max-time', '180', '-D', h, '-o', z, TRANCO], { stdio: ['ignore', 'inherit', 'inherit'] });
  const m = /last-modified:\s*(.+)/i.exec(fs.readFileSync(h, 'utf8')), t = m && Date.parse(m[1]);
  const day = Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
  return { csv: csvOfFile(z), list: { source: TRANCO, date: day } };
}
const print = (rows, ranks, order) => rows.forEach((f, i) => console.log(String(i + 1).padStart(3), rankLabel(sizeOf(f.id, ranks, order)).padStart(10), (order[f.id] != null ? '*' : ' '), f.id, '(' + f.site + ', ' + f.n + ' of ' + f.m + ' aspects)'));

/** the lead's question: the next n un-surpassed floors by size. Reads the committed rank file, the hand order and the gate's evidence. */
export function nextRows(n = 10) {
  const r = readJson(OUT, null); if (!r) throw new Error('no tower.rank.json yet: run node tools/tower-rank.mjs (or the Tower rank workflow)');
  const ev = readJson(EVID, {}), order = { ...(r.order || {}), ...((readJson(ORDER, {}) || {}).order || {}) };
  return { rows: nextUnsurpassed(tower([], ev.floors || {}, null, null).floors, r.ranks, order, n), ranks: r.ranks, order, list: r.list };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2);
  if (a[0] === '--next') { const { rows, ranks, order, list } = nextRows(+a[1] || 10); console.log('next un-surpassed floors, smallest site first (Tranco ' + ((list && list.date) || '?') + '; * = hand order):'); print(rows, ranks, order); process.exit(0); }
  let src; if (a[0] === '--file') src = { csv: csvOfFile(a[1]), list: { source: path.basename(a[1]), date: '' } }; else src = fetchList();
  const order = (readJson(ORDER, {}) || {}).order || {}, out = buildRank({ floors: FLOORS, csv: src.csv, list: src.list, order });
  const ranked = Object.values(out.ranks).filter(Boolean).length;
  if (!ranked) { console.error('no rival found in the list: not writing'); process.exit(1); }
  fs.writeFileSync(OUT, '{\n"about": ' + JSON.stringify(out.about) + ',\n"credit": ' + JSON.stringify(out.credit) + ',\n"list": ' + JSON.stringify(out.list) + ',\n"order": ' + JSON.stringify(out.order) + ',\n"ranks": {\n'
    + Object.entries(out.ranks).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n},\n"domains": {\n' + Object.entries(out.domains).map(([k, v]) => JSON.stringify(k) + ': ' + JSON.stringify(v)).join(',\n') + '\n}\n}\n');
  console.log('wrote ' + path.relative(ROOT, OUT) + ': ' + ranked + ' of ' + FLOORS.length + ' floors ranked, ' + (FLOORS.length - ranked) + ' outside the million');
}
