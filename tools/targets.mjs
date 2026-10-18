// Verse's targets (owner, 2026-10-13): Verse sets its sights on one site at a time, learns everything it does, then does each
// thing one notch better ("We don't copy; we outdo and one-up. If they go to Tennessee, we go to Elevenessee."), then moves on to a
// site whose skills complement what it has. Each target is domains/targets/<site>.json: the site's features as the floor, and
// for each one the plus one, written before the build. A feature's "void" is none | matches | beats; only "beats" counts.
//   node tools/targets.mjs          the scorecard of every target, and the next feature to build past
//   node tools/targets.mjs --json   the same as JSON
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'domains', 'targets');
export const STATES = ['none', 'matches', 'beats'];

/** a target's score and the next feature to take: the first not yet beaten, one Verse already matches before one it lacks. Pure. */
export function scoreOf(t) {
  const fs = Array.isArray(t.features) ? t.features : [];
  const n = (s) => fs.filter((f) => f.void === s).length;
  const next = fs.find((f) => f.void === 'matches') || fs.find((f) => f.void !== 'beats') || null;
  return { site: t.site, total: fs.length, beats: n('beats'), matches: n('matches'), none: n('none'), done: fs.length > 0 && n('beats') === fs.length, next };
}

/** what is wrong with a target file: [] when it is fine. Pure. */
export function problems(t) {
  const bad = [];
  if (!t || !t.site) bad.push('no site');
  if (!Array.isArray(t && t.features) || !t.features.length) bad.push('no features');
  for (const f of (t && t.features) || []) {
    if (!f.id || !f.theirs) bad.push((f.id || '?') + ': needs an id and what the site does (theirs)');
    if (!f.plus_one) bad.push(f.id + ': needs its plus one, written before the build (Elevenessee)');
    if (!STATES.includes(f.void)) bad.push(f.id + ': void must be one of ' + STATES.join(', '));
  }
  return bad;
}

export function load() {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((f) => f.endsWith('.json')).sort().map((f) => ({ file: 'domains/targets/' + f, ...JSON.parse(readFileSync(resolve(dir, f), 'utf8')) }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const all = load(), scored = all.map((t) => ({ ...scoreOf(t), problems: problems(t) }));
  if (process.argv.includes('--json')) { console.log(JSON.stringify(scored, null, 1)); process.exit(scored.some((s) => s.problems.length) ? 1 : 0); }
  for (const s of scored) {
    console.log(`${s.site}: beats ${s.beats} of ${s.total}, matches ${s.matches}, not yet ${s.none}${s.done ? ' (done: pick the next target, one that complements this)' : ''}`);
    if (s.next) console.log(`  next: ${s.next.id}. They: ${s.next.theirs}. Verse, one notch past: ${s.next.plus_one}`);
    for (const p of s.problems) console.log('  problem: ' + p);
  }
  process.exit(scored.some((s) => s.problems.length) ? 1 : 0);
}
