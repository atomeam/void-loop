// The Tower compounds (owner, 2026-11-19: "the Tower should compound"; any feature counts too, not only a new target). Every site and target that
// ever counted is measured again against its live original with the same checks (tools/tower-gate.mjs, tools/universe-play.mjs); one that no
// longer wins every check, or whose original gained a feature Verse lacks, stops counting and goes to the front of the build list with the failed
// checks and the feature attached. One row per pass says how many were checked, how many still win, how many went back, which features turned up
// and which Verse has now beaten. Owner-only (tower.compound.json; lib/owner-gate.js). Pure.
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const uniq = (a) => [...new Set(a.filter(Boolean))];
/** every id that ever counted: the assimilated, the passed, and any floor the gate now says is beaten. */
export const countedIds = (target, floors) => uniq([...((target && target.assimilated) || []), ...((target && target.passed) || [])].map((r) => r && r.id)
  .concat((floors || []).filter((f) => f.beaten || f.gateBeaten).map((f) => f.id)));
/** the names of a features file's features, as the scan wrote them (sites[host].features, or under auto). Pure. */
export function namesOf(file) {
  const sites = Object.assign({}, file && file.auto && file.auto.sites, file && file.sites), out = new Map();
  for (const s of Object.values(sites)) for (const f of (s && s.features) || []) if (f && f.name) out.set(norm(f.name), { name: f.name, verse: f.verse || 'missing' });
  return out;
}
/** features on the original now that the last record did not have: [{ name, verse }]. Pure. */
export const newFeatures = (before, after) => [...namesOf(after)].filter(([k]) => !namesOf(before).has(k)).map(([, v]) => v);
/** the features still open on a file: scanned and not yet had by Verse (a recorded one it lacks counts too). Pure. */
export const openFeatures = (file) => [...namesOf(file).values()].filter((f) => f.verse !== 'has').map((f) => f.name);
/** the pass over counted ids: `floors` are the floors as tower() builds them now, `found` maps id -> feature names new this pass.
 *  A counted id wins only if the gate still wins every check and the original has no feature Verse lacks. Pure. */
export function recheck(ids, floors, found = {}) {
  const by = new Map((floors || []).map((f) => [f.id, f])), won = [], requeued = [], retired = [];
  for (const id of ids) {
    const f = by.get(id), lost = f ? uniq([...(f.lost || []), ...(f.open || f.left || [])]) : [], feats = (found[id] || []).slice();
    if (!f) { retired.push(id); continue; } // no longer a floor (a gone or parked site): neither won nor sent back
    if (f && (f.beaten || f.gateBeaten) && !feats.length) won.push(id);
    else requeued.push({ id, failed: lost, features: feats });
  }
  return { checked: ids.length, won, requeued, retired };
}
/** build jobs for a pass, the front of the list: each failed check and each new feature, as a must-beat item. Pure. */
export const jobsOf = (requeued, today) => requeued.flatMap((r) => (r.failed || []).map((a) => ({ id: r.id, aspect: a, since: today, job: 'must-beat: win "' + a + '" again on ' + r.id }))
  .concat((r.features || []).map((n) => ({ id: r.id, aspect: 'feature: ' + n, since: today, job: 'must-beat: add "' + n + '" to Verse and beat the original\'s' }))));
/** a build list with the pass's jobs first and no job twice. Pure. */
export const front = (background, jobs) => { const seen = new Set(), key = (j) => j.id + '|' + j.aspect;
  return jobs.concat(background || []).filter((j) => !seen.has(key(j)) && seen.add(key(j))); };
/** a feature Verse added, re-scored against the same feature on every related original: the files whose features it matches. Pure. */
export const relatedTo = (name, files) => Object.entries(files || {}).filter(([, f]) => namesOf(f).has(norm(name))).map(([slug]) => slug);
/** one row for the log. `beaten` are the features found earlier that Verse now has. Pure. */
export function rowOf({ at, result, found = {}, beaten = [], universe = null }) {
  const nf = Object.entries(found).flatMap(([id, ns]) => ns.map((n) => ({ id, feature: n })));
  return { at, checked: result.checked, stillWin: result.won.length, retired: result.retired || [], requeued: result.requeued.map((r) => ({ id: r.id, failed: r.failed, features: r.features })),
    newFeatures: nf, featuresBeaten: beaten, ...(universe ? { universe } : {}) };
}
/** the row in plain words for the Tower card and /progress/. Pure. */
export const sayRow = (r) => !r ? 'No re-check yet.' : 'Re-checked ' + r.checked + ' that counted: ' + r.stillWin + ' still win, ' + r.requeued.length + ' sent back to the front of the build list' + ((r.retired || []).length ? ', ' + r.retired.length + ' retired (no longer a floor)' : '') + '. '
  + (r.newFeatures || []).length + ' new feature' + ((r.newFeatures || []).length === 1 ? '' : 's') + ' found on originals, ' + (r.featuresBeaten || []).length + ' beaten.';
