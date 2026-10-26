import test from 'node:test';
import assert from 'node:assert/strict';
import { floorFor, draftProbe, laneLine, brief } from './floor-kit.mjs';
import { FLOORS, LANES, tower } from '../void-live-deploy/lib/tower.js';

test('a floor is found by id, by host, or by its lane host', () => {
  assert.equal(floorFor('translate').id, 'translate'); assert.equal(floorFor('deepl.com').id, 'translate: deepl.com'); assert.equal(floorFor('https://www.deepl.com/translator').id, 'translate: deepl.com');
  assert.equal(floorFor('translate: deepl.com').id, 'translate: deepl.com'); assert.equal(floorFor('nope.example'), null); assert.equal(floorFor(''), null);
});

test('a lane site takes its lane\'s probe; a floor with none gets a skeleton naming every extra aspect', () => {
  assert.equal(draftProbe(floorFor('translate: deepl.com')).ready, true);
  assert.equal(draftProbe(floorFor('recipes')).ready, true, 'the recipes floor has its probe now (2026-10-25)');
  const f = { id: 'newsite', site: 'espn.com', url: 'https://www.espn.com/', extra: ['reminders', 'invites'] };
  const d = draftProbe(f); assert.equal(d.ready, false);
  for (const w of ["'newsite': {", "verse: '/newsite/'", "'reminders':", "'invites':", 'TODO']) assert.ok(d.text.includes(w), w);
});

test('a site added to a lane goes to its bottom, the next fight; one already there is refused', () => {
  const line = laneLine('translate', 'https://tiny.example/', { translate: ['https://a.example/'] });
  assert.equal(line, "  translate: ['https://tiny.example/', 'https://a.example/'],");
  assert.equal(laneLine('translate', 'https://www.deepl.com/'), null);
  assert.throws(() => laneLine('translate', 'not a url'));
  // the real lane is one line in lib/tower.js, as --add expects
  assert.ok(LANES.translate.length >= 10);
});

test('the brief says where a floor stands and what to do next, from the evidence alone', () => {
  const ev = { 'translate: deepl.com': { speed: { verdict: 'worse', evidence: 'Verse 320 ms vs 180 ms' }, mobile: { verdict: 'equal-and-better' } } };
  const t = tower([], ev), f = FLOORS.find((x) => x.id === 'translate: deepl.com'), b = brief(f, ev, t);
  assert.equal(b.lane, 'translate'); assert.deepEqual(b.lost, ['speed']); assert.ok(b.unmeasured.includes('offline')); assert.ok(b.lines.some((l) => /speed\s+worse/.test(l)));
  assert.ok(b.next.some((n) => n.startsWith('fix speed'))); assert.ok(b.next.some((n) => n.startsWith('measure')));
  const fresh = brief({ id: 'newsite', site: 'espn.com', url: 'https://www.espn.com/', extra: [] }, {}, t);
  assert.ok(fresh.next[0].startsWith('build the page')); assert.ok(fresh.next[1].startsWith('add the probe'));
});
