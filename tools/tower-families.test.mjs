// One public Verse page per job family. Two floor pages of the same family fail this test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { FLOORS, LANE_PAGES } from '../void-live-deploy/lib/tower.js';
import { SITE_PAGES } from '../void-live-deploy/lib/tool-sites.js';
import { FAMILIES, familyOf, familyPageOf } from '../void-live-deploy/lib/tower-families.js';
import { probeFor } from './tower-probes.mjs';

const stem = (p) => String(p || '').replace(/[?#].*$/, '').replace(/\/$/, '') || '/';

test('every family has one combined page, and every member resolves to it', () => {
  const bad = [];
  for (const f of FAMILIES) {
    const stems = new Set(f.members.map((m) => stem(familyPageOf(m.path))));
    if (stems.size !== 1 || !stems.has(stem(f.page))) bad.push(f.id + ' resolves to ' + [...stems].join(', ') + ' (want ' + f.page + ')');
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});

test('two named floor pages never serve the same family as different public paths', () => {
  const named = [];
  for (const [id, p] of Object.entries(LANE_PAGES)) named.push({ why: 'LANE_PAGES ' + id, path: p });
  for (const r of SITE_PAGES) named.push({ why: 'SITE_PAGES ' + r.lane, path: r.path });
  for (const f of FLOORS) if (f.page) named.push({ why: 'floor ' + f.id, path: f.page });
  const byFamily = new Map();
  for (const n of named) {
    const fam = familyOf(n.path);
    if (!fam) continue;
    const s = stem(familyPageOf(n.path));
    const have = byFamily.get(fam.id) || new Set();
    have.add(s);
    byFamily.set(fam.id, have);
  }
  const bad = [...byFamily].filter(([, set]) => set.size > 1).map(([id, set]) => id + ': ' + [...set].join(', '));
  assert.deepEqual(bad, [], 'families with more than one public floor path:\n' + bad.join('\n'));
});

test('a floor in a family points at the combined page (same stem), and the gate measures that page', () => {
  const bad = [];
  for (const f of FLOORS) {
    if (!f.page) continue;
    const fam = familyOf(f.page) || familyOf(LANE_PAGES[f.id]);
    if (!fam) continue;
    if (stem(familyPageOf(f.page)) !== stem(fam.page)) bad.push(f.id + ' page ' + f.page + ' is not ' + fam.page);
    let pr = null; try { pr = probeFor(f.id); } catch (_) {}
    if (pr && pr.verse && stem(pr.verse) !== stem(fam.page)) bad.push(f.id + ' probe ' + pr.verse + ' is not ' + fam.page);
  }
  assert.deepEqual(bad, [], bad.join('\n'));
});
