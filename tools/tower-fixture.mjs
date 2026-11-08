// The browser suite's Versus fixture (tools/test_void.mjs, the "tower:" checks). Run its tests: node --test tools/tower-fixture.test.mjs
//
// Since the season (tower.target.json `season`, owner, 2026-11-06: "clear and reset your damn verse screens") a site counts as surpassed
// or passed only when tools/tower-target.mjs has put it in tower.target.json `passed`, smallest first (lib/tower.js tower(), `inSeason`).
// A check that stubs a site's evidence as fully won but leaves the served tower.target.json in place follows whatever Versus did today:
// the stubbed sites stay in the queue and the sites the served file passed take their place (main went red on 2026-11-06 when the target
// became squoosh.app). So a check that conquers sites loads its own tower.target.json: the served file (its target, its season) with
// `passed` naming exactly the sites the check conquers, and the crawl rows of those sites left out of tower.features.json, so a later
// crawl that finds a missing feature on one of them cannot hold it back from the check. Pure.

import { hostOf } from '../void-live-deploy/lib/tower.js';

const hostKey = (f) => hostOf(f.url) || hostOf(f.site);

/** the served tower.target.json with `passed` naming exactly `floors` (each { id, url, site }), in the served season; the input is not
 *  changed. A served file with no season gets the target's own day as one, so the check always runs the season path the live card runs. */
export function seasonTarget(served, floors) {
  const s = served || {}, day = String((s.season && (s.season.start || s.season)) || s.since || '2026-11-06');
  return { ...s, season: s.season || { start: day }, passed: floors.map((f) => ({ id: f.id, at: day, n: 0, m: 0, open: [] })) };
}

/** the served tower.features.json without the crawl rows of `floors`, or null when nothing is served. Pure. */
export function featuresWithout(served, floors) {
  if (!served || !served.sites) return served || null;
  const drop = new Set(floors.map(hostKey).filter(Boolean)), sites = {};
  for (const [h, row] of Object.entries(served.sites)) if (!drop.has(hostOf(h) || h)) sites[h] = row; // lib/tower.js looks a crawl up by hostOf, so a www. key is the same site
  return { ...served, sites };
}

/** both files a conquering check routes: { target, features }. Pure. */
export const towerFixture = ({ target, features } = {}, floors = []) => ({ target: seasonTarget(target, floors), features: featuresWithout(features, floors) });

/** the first `n` floors a check can conquer: not the target, not held (a held floor is never surpassed). Pure. */
export const conquerable = (floors, { target = null, n = 3 } = {}) => floors.filter((f) => f.id !== target && !f.held).slice(0, n);
