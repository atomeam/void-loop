// The Tower beyond websites, for the owner and for visitors: the names, the scan and the owner card.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KINDS, CHECK, SIDES, checksOf, readChecks, closeness, beaten, sidesOf, gapsOf, climbOrder, categories, protectedNames, scrubNames, stalled, jobsOf, kindOf } from '../void-live-deploy/lib/universe.js';
import { SEEDS } from '../void-live-deploy/lib/universe-seeds.js';
import { scrubSites, universeNames } from '../void-live-deploy/lib/scrub-sites.js';
import { ownerOnlyPath } from '../void-live-deploy/lib/owner-gate.js';
import { mergeTargets, markOf, step, aimOf, empty, serialize, rowsOf } from './universe.mjs';
import { scanFiles, servedFiles } from './universe-scan.mjs';
import { modelOf, nowBox, beyondBox } from '../void-live-deploy/versus/universe.js';
import { plainHtml } from '../void-live-deploy/versus/card.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const all = (t, verse, best = 90) => ({ ...t, marks: Object.fromEntries(checksOf(t).map((c) => [c.id, { verse, best }])) });
const game = SEEDS.find((t) => t.kind === 'game'), snail = SEEDS.find((t) => t.id === 'snail');

test('names: a target\'s own name is a plain word, what it is measured against is protected everywhere a visitor reads', () => {
  const names = protectedNames(SEEDS);
  assert.ok(names.includes('Grand Theft Auto VI') && !names.includes(snail.name));
  assert.equal(scrubNames('see Grand Theft Auto VI and a snail', names), 'see another one and a snail');
  assert.ok(!/Grand Theft Auto VI/.test(scrubSites('Grand Theft Auto VI')), 'the shared deploy scrub covers the targets');
  assert.ok(universeNames().length >= names.length);
  for (const t of SEEDS) for (const j of jobsOf(t, '2026-11-19')) for (const n of t.best.names) assert.ok(!j.job.includes(n), 'a build-list row never names what it is measured against');
});
test('a visitor\'s files show no target name', () => {
  const hits = scanFiles(servedFiles(), (u) => { try { return fs.readFileSync(new URL('../void-live-deploy' + u, import.meta.url), 'utf8'); } catch (_) { return ''; } }, protectedNames(JSON.parse(fs.readFileSync(new URL('../void-live-deploy/tower.universe.json', import.meta.url), 'utf8')).targets.concat(SEEDS)));
  assert.deepEqual(hits, []);
});
test('the owner card shows the category, the beyond-websites box and the mixed next-up; the site card is unchanged without it', () => {
  const t = { floors: [{ id: 'a.com', site: 'a.com', url: 'https://a.com/', state: 'current', assim: 80, label: 'Travel: a.com', lost: [], left: [], missingFeatures: [] }, { id: 'b.com', site: 'b.com', state: 'ahead', assim: 70, label: 'Travel: b.com' }], inventory: null };
  const plain = plainHtml(t, esc);
  assert.match(plain, />Working on now</); assert.doesNotMatch(plain, /Beyond websites/);
  let data = mergeTargets(empty(), SEEDS); data = markOf(data, 'snail', 'graphics', 95, { judge: 'test' });
  const m = modelOf(data, t.floors, '2026-11-19'), html = plainHtml(t, esc, { px: { beyondBox, nowBox, cantBox: (r) => '', nextLine: (o, e, s) => o.floor ? s(o.floor) : e(o.row.site) }, m });
  assert.match(html, /Working on now · Website/); assert.match(html, /Beyond websites/); assert.match(html, /data-category="game"/); assert.match(html, /data-category="creature"/);
  const strong = { ...data, targets: data.targets.map((x) => x.id === 'snail' ? all(x, 99) : x) };
  const lead = modelOf({ ...strong, targets: strong.targets.map((x) => x.id === 'snail' ? { ...x, marks: { ...x.marks, facts: { verse: 10, best: 90 } } } : x) }, [], '2026-11-19');
  assert.equal(lead.order[0].id, 'snail');
  assert.match(nowBox(lead.order[0].row, esc), /Working on now · Animal/);
  assert.equal(kindOf('creature').label, 'Animal');
});

