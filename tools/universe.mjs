// The Tower beyond websites: seed, score, step, aim and generate (lib/universe.js; the data is void-live-deploy/tower.universe.json, owner-only).
//   node tools/universe.mjs seed                      add the starter targets (lib/universe-seeds.js); marks already earned stay
//   node tools/universe.mjs mark <id> <check> <0-100> [judge] [best]   record a measured number for a check
//   node tools/universe.mjs step                      stall rule, assimilated list, build-list rows, and the lane aim (data/universe-aim.json)
// Targets are only for measuring, never for copying. Names of what a target is measured against never reach a public file (lib/scrub-sites.js).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEEDS } from '../void-live-deploy/lib/universe-seeds.js';
import { readChecks, rowOf, jobsOf, gapsOf, stalled, CHECK } from '../void-live-deploy/lib/universe.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FILE = path.join(ROOT, 'void-live-deploy/tower.universe.json');
export const AIM = path.join(ROOT, 'data/universe-aim.json');
export const REST_DAYS = 14;
export const empty = () => ({ about: 'Targets beyond websites, measured against the best in the world. Owner-only (lib/owner-gate.js).', targets: [], progress: {}, rest: {}, assimilated: [], background: [], generated: [] });
export const load = (f = FILE) => { try { return { ...empty(), ...JSON.parse(fs.readFileSync(f, 'utf8')) }; } catch (_) { return empty(); } };
/** one line per target and per row, so a diff shows what moved. Pure. */
export const serialize = (u) => '{\n' + Object.entries(u).map(([k, v]) => ' ' + JSON.stringify(k) + ': ' + (Array.isArray(v) && v.length ? '[\n' + v.map((x) => '  ' + JSON.stringify(x)).join(',\n') + '\n ]' : JSON.stringify(v))).join(',\n') + '\n}\n';
export const save = (u, f = FILE) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, serialize(u)); };

/** merge targets in by id; what a target already earned (marks, progress) stays. Pure. */
export function mergeTargets(u, incoming) {
  const by = new Map(u.targets.map((t) => [t.id, t]));
  for (const s of incoming) { const old = by.get(s.id); by.set(s.id, old ? { ...old, ...s, marks: old.marks || undefined } : { ...s }); }
  return { ...u, targets: [...by.values()].map((t) => { if (!t.marks) delete t.marks; return t; }) };
}
/** one measured number for one check. Pure. */
export function markOf(u, id, check, verse, { judge = '', best = null, at = new Date().toISOString().slice(0, 10) } = {}) {
  if (!CHECK[check]) throw new Error('unknown check ' + check);
  return { ...u, targets: u.targets.map((t) => t.id !== id ? t : { ...t, marks: { ...(t.marks || {}), [check]: { ...((t.marks || {})[check] || {}), verse: Math.max(0, Math.min(100, Math.round(+verse))), judge, at, ...(best == null ? {} : { best: +best }) } } }) };
}
/** the rows the climb reads: every target not resting after a stall. Pure. */
export function rowsOf(u, today) {
  const rest = new Set(Object.entries(u.rest || {}).filter(([, at]) => (Date.parse(today) - Date.parse(at)) / 864e5 < REST_DAYS).map(([id]) => id));
  return u.targets.map((t) => ({ ...rowOf(t), resting: rest.has(t.id) }));
}
/** one run of the stall rule (#3040): a target with no progress for 3 days gives way, its gaps go to the build list, and it rests 14 days. Pure. */
export function step(u, today) {
  const progress = { ...(u.progress || {}) }, rest = { ...(u.rest || {}) }, background = (u.background || []).slice(), assimilated = (u.assimilated || []).slice(), last = [];
  const first = rowsOf(u, today).filter((r) => !r.beaten && !r.resting).sort((a, b) => b.assim - a.assim)[0];
  for (const r of rowsOf(u, today)) {
    if (r.beaten) { if (!assimilated.some((a) => a.id === r.id)) assimilated.push({ id: r.id, at: today }); continue; }
    if (r.resting) continue;
    const t = u.targets.find((x) => x.id === r.id), s = stalled(progress[r.id], r, today);
    progress[r.id] = { n: s.n, assim: s.assim, progressAt: s.progressAt };
    // every gap goes to the build list once (the lanes read it); the one being worked on is the closest
    if (r === first || s.stalled) for (const j of jobsOf(t, today)) if (!background.some((b) => b.id === j.id && b.aspect === j.aspect)) background.push(j);
    if (s.stalled) { rest[r.id] = today; last.push(r.id + ' made no progress for 3 days: its gaps went to the build list and the climb moved on'); }
  }
  return { ...u, progress, rest, assimilated, background: background.slice(-600), last };
}
/** what the game-updates lane and the quality engine aim at, in plain words and never a target's name: per Verse game, its weakest gap. Pure. */
export function aimOf(u) {
  const aim = { about: 'Plain-word aims from the Tower beyond websites; no names (tools/universe.mjs aim).', games: {}, things: {} };
  for (const t of u.targets) {
    const g = gapsOf(t)[0]; if (!g) continue;
    const words = g.build + (g.verse == null ? ' (not measured yet)' : ' (now ' + g.verse + ', needs more than ' + g.best + ')');
    if (t.entry && t.entry.game) aim.games[t.entry.game] = { check: g.id, side: g.side, words };
    else if (t.entry && t.entry.scene) aim.things[t.entry.scene] = { check: g.id, side: g.side, words };
  }
  return aim;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...a] = process.argv.slice(2), today = new Date().toISOString().slice(0, 10);
  let u = load();
  if (cmd === 'seed') { u = mergeTargets(u, SEEDS); save(u); console.log('targets: ' + u.targets.length); }
  else if (cmd === 'mark') { u = markOf(u, a[0], a[1], a[2], { judge: a[3] || '', best: a[4] == null ? null : a[4] }); save(u); console.log('marked ' + a[0] + ' ' + a[1]); }
  else if (cmd === 'step') { u = step(u, today); const aim = aimOf(u); delete u.last; save(u); fs.mkdirSync(path.dirname(AIM), { recursive: true }); fs.writeFileSync(AIM, JSON.stringify(aim, null, 1) + '\n'); console.log('stepped: ' + u.targets.length + ' targets, aim for ' + Object.keys(aim.games).length + ' games'); }
  else { console.log('usage: node tools/universe.mjs seed | mark <id> <check> <0-100> | step'); process.exit(cmd ? 2 : 0); }
}
