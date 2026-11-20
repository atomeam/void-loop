// The compounding pass (lib/compound.js): every site and target that ever counted is measured again against its live original, one that no longer
// wins every check, or whose original gained a feature Verse lacks, goes to the front of the build list ahead of any new target, and one row is
// logged for the owner (tower.compound.json: the Tower card and /progress/). Reuses tools/tower-gate.mjs (the same checks), tools/feature-scan.mjs
// (the feature diff against domains/features/), tools/tower-target.mjs (floors and the build list) and lib/universe.js (targets beyond sites).
//   node tools/tower-compound.mjs [--live] [--features] [--dry]   --live: the gate on every counted site; --features: scan each original again
import fs from 'node:fs'; import path from 'node:path'; import { spawnSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
import { countedIds, recheck, jobsOf, front, rowOf, newFeatures, namesOf, relatedTo, sayRow } from '../void-live-deploy/lib/compound.js';
import { rowOf as targetRow } from '../void-live-deploy/lib/universe.js';
import { floorsNow } from './tower-target.mjs';
import { featureSlug } from './tower-probes.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), SITE = path.join(ROOT, 'void-live-deploy'), FEATURES = path.join(ROOT, 'domains', 'features');
const rd = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch (_) { return null; } };
const wr = (p, v) => fs.writeFileSync(p, JSON.stringify(v, null, 1) + '\n');
const allFiles = () => Object.fromEntries((fs.existsSync(FEATURES) ? fs.readdirSync(FEATURES) : []).filter((n) => /\.json$/.test(n)).map((n) => [n.slice(0, -5), rd(path.join(FEATURES, n))]));
const featuresOf = (id) => rd(path.join(FEATURES, featureSlug(id) + '.json'));

/** the new target file and compound file from one pass. Pure but for nothing: all inputs are arguments. */
export function apply({ target, compound, result, found, blockers, beaten, universe, today }) {
  const back = new Set(result.requeued.map((r) => r.id)), keep = (r) => !back.has(r && r.id) && !(result.retired || []).includes(r && r.id);
  const open = Object.entries(blockers).flatMap(([id, ns]) => ns.map((feature) => ({ id, feature })));
  const row = rowOf({ at: today, result, found, beaten, universe });
  const nt = { ...target, assimilated: (target.assimilated || []).filter(keep), ...(target.passed ? { passed: target.passed.filter(keep) } : {}),
    background: front(target.background, jobsOf(result.requeued, today)).slice(0, 300), requeue: [...back, ...(target.requeue || []).filter((id) => !back.has(id))] };
  return { target: nt, compound: { about: 'The compounding pass: sites and targets that counted, measured again against their live originals. Owner-only (lib/owner-gate.js).', rows: ((compound && compound.rows) || []).concat(row).slice(-60), open, last: row }, row };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const a = process.argv.slice(2), has = (f) => a.includes(f), today = new Date().toISOString().slice(0, 10);
  const target = rd(path.join(SITE, 'tower.target.json')) || {}, compound = rd(path.join(SITE, 'tower.compound.json')) || {};
  let floors = floorsNow(target); const ids = countedIds(target, floors);
  if (has('--live')) { // the same checks on every site that counted, each floor in its own browser, evidence written after each
    const r = spawnSync('node', [path.join(ROOT, 'tools', 'tower-gate.mjs'), '--floors', ids.join(',')], { cwd: ROOT, stdio: 'inherit', timeout: 6 * 3600e3 });
    if (r.status) console.error('the gate stopped with ' + r.status + ': floors it did not reach keep their old verdicts');
    floors = floorsNow(target);
  }
  const found = {}, blockers = {}, prior = (compound.open || []), beaten = [];
  for (const id of ids) {
    const before = featuresOf(id); let now = before;
    if (has('--features') && before) { spawnSync('node', [path.join(ROOT, 'tools', 'feature-scan.mjs'), id], { cwd: ROOT, stdio: 'inherit', timeout: 20 * 60e3 }); now = featuresOf(id); }
    const fresh = newFeatures(before, now), names = namesOf(now);
    if (fresh.length) found[id] = fresh.map((f) => f.name);
    const gone = prior.filter((p) => p.id === id && (names.get(p.feature.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()) || {}).verse === 'has').map((p) => p.feature);
    beaten.push(...gone.map((feature) => ({ id, feature, related: relatedTo(feature, allFiles()) }))); // a feature Verse added is re-scored on every original that lists it
    const still = [...new Set(prior.filter((p) => p.id === id && !gone.includes(p.feature)).map((p) => p.feature).concat(fresh.filter((f) => f.verse !== 'has').map((f) => f.name)))];
    if (still.length) blockers[id] = still;
  }
  const result = recheck(ids, floors, blockers);
  const uni = (rd(path.join(SITE, 'tower.universe.json')) || {}).targets || [], won = uni.filter((t) => targetRow(t).beaten);
  const out = apply({ target, compound, result, found, blockers, beaten, universe: { targets: uni.length, counted: won.length }, today });
  if (!has('--dry')) { wr(path.join(SITE, 'tower.target.json'), out.target); wr(path.join(SITE, 'tower.compound.json'), out.compound); }
  console.log(sayRow(out.row)); for (const r of result.requeued) console.log('  back: ' + r.id + ' (' + (r.failed.join('; ') || 'none') + ')' + (r.features.length ? ' + ' + r.features.length + ' feature(s)' : ''));
}
