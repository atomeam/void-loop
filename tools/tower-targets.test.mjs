// Every tower comes with its page named in two places (asked by Verse: "Add a lib/tool-sites.js row and LANE_PAGES entry for any new tower"): a site
// Versus has passed (tower.target.json passed; the target now is still being built) and a site keyed by its host in lib/tower.js
// LANE_PAGES each has a LANE_PAGES entry and a row in lib/tool-sites.js (SITE_PAGES, SELF_SITES or MODE_SITES) for the same page. A hand floor
// (lib/tower.js FLOORS, no lane) carries its page on the floor itself and is checked by tools/lane-pages.test.mjs. A new target without both fails here,
// and the failure names what to add.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FLOORS, LANE_PAGES } from '../void-live-deploy/lib/tower.js';
import { SITE_PAGES, MODE_SITES } from '../void-live-deploy/lib/tool-sites.js';

// the host pages built before the rule (2026-11-06): they have a LANE_PAGES entry but no row yet. The list only shrinks: a listed host that has a row
// fails, so take it off the day its row lands, and nothing is added to it
// dalyfeds.com (/starboard/) landed on main the same day, before this rule did
const BEFORE_THE_RULE = ['sycophanthex.com', 'wheelroot.com', 'onlineconverter.com', 'dalyfeds.com'];
const target = JSON.parse(readFileSync(new URL('../void-live-deploy/tower.target.json', import.meta.url), 'utf8'));
const pathOf = (p) => String(p || '').replace(/[?#].*$/, '');
const handFloor = (id) => FLOORS.some((f) => (f.id === id || f.id === String(id).split(': ')[0]) && !f.lane);
/** the targets that are sites and were passed, hand floors left out. Pure. The target now, a skipped one and one in the background are still being
 *  built (their page comes in the fight), so the rule holds once a tower is passed. */
export function towerTargets(t) {
  const ids = (Array.isArray(t.passed) ? t.passed : []).map((r) => (r && r.id) || r);
  return [...new Set(ids.filter((id) => typeof id === 'string' && id && !handFloor(id)))];
}
/** what a tower lacks: [] when it has a LANE_PAGES entry and a tool-sites row for that same page, else the missing parts. Pure. */
export function lacks(id, lanePages = LANE_PAGES, rows = [...SITE_PAGES, ...MODE_SITES]) {
  const page = lanePages[id], out = [];
  if (!page) out.push('a LANE_PAGES entry in lib/tower.js');
  const row = rows.find((r) => r && r.lane === id && (page ? (r.page || r.path) === page || r.path === pathOf(page) : true));
  if (!row) out.push('a lib/tool-sites.js row with lane "' + id + '"' + (page ? ' for ' + page : ''));
  return out;
}

test('every tower target has a LANE_PAGES entry and a lib/tool-sites.js row for the same page', () => {
  const targets = towerTargets(target);
  assert.ok(targets.includes('ndscalc.ru'), 'the ndscalc.ru tower of 2026-11-05 is read (emoji combos is a hand floor now, checked by tools/lane-pages.test.mjs)');
  const bad = targets.filter((id) => !BEFORE_THE_RULE.includes(id)).map((id) => [id, lacks(id)]).filter(([, l]) => l.length).map(([id, l]) => id + ': needs ' + l.join(' and '));
  assert.deepEqual(bad, [], 'tower targets without their page named:\n' + bad.join('\n'));
});
test('every site keyed by its host in LANE_PAGES has its row, apart from the pages built before the rule', () => {
  const hosts = Object.keys(LANE_PAGES).filter((k) => !k.includes(': ') && /\./.test(k) && !handFloor(k));
  const bad = hosts.filter((h) => !BEFORE_THE_RULE.includes(h)).filter((h) => lacks(h).length).map((h) => h + ': needs ' + lacks(h).join(' and '));
  assert.deepEqual(bad, [], 'host pages without a lib/tool-sites.js row:\n' + bad.join('\n'));
  const done = BEFORE_THE_RULE.filter((h) => !lacks(h).length);
  assert.deepEqual(done, [], 'these have a row now: take them off BEFORE_THE_RULE');
});
test('the rule catches a new tower that comes without its page named', () => {
  assert.deepEqual(lacks('new-site.test', {}, []), ['a LANE_PAGES entry in lib/tower.js', 'a lib/tool-sites.js row with lane "new-site.test"']);
  assert.deepEqual(lacks('new-site.test', { 'new-site.test': '/x/' }, []), ['a lib/tool-sites.js row with lane "new-site.test" for /x/']);
  assert.deepEqual(lacks('new-site.test', { 'new-site.test': '/x/?m=1' }, [{ path: '/x/', lane: 'new-site.test' }]), []);
  assert.deepEqual(lacks('new-site.test', { 'new-site.test': '/x/' }, [{ path: '/y/', lane: 'new-site.test' }]).length, 1, 'a row for another page is not its row');
  assert.deepEqual(towerTargets({ id: 'c.test', passed: [{ id: 'a.test' }, { id: 'a.test' }, { id: 'prizes' }, { id: 'image boards: x.test' }], skipped: [{ id: 'b.test' }], background: [{ id: 'd.test' }] }), ['a.test'], 'only passed sites, each once, hand floors left out');
  assert.deepEqual(lacks('ndscalc.ru'), []); assert.deepEqual(lacks('emoji combos: emojigraph.org'), []);
});
