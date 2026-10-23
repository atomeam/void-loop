// The matchers of skills that had no test (tools/untested.mjs): each one takes its own examples and leaves its near misses for other skills.
// The narrowed matchers that settled three overlaps (tools/skill-overlap.mjs) are pinned here too.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import checkers from '../void-live-deploy/skills/checkers.js';
import mediaPick from '../void-live-deploy/skills/media-pick.js';
import notebook from '../void-live-deploy/skills/notebook.js';
import sleep from '../void-live-deploy/skills/sleep.js';
import { loadEvents } from '../void-live-deploy/skills/calendar3d.js';
import { rackOf } from '../void-live-deploy/skills/rack.js';
import cartoon from '../void-live-deploy/skills/cartoon.js';
import videoPlay from '../void-live-deploy/skills/video-play.js';

const takes = (s, t) => !!s.match(t.toLowerCase(), t);

for (const s of [checkers, mediaPick, notebook, sleep]) {
  test(s.name + ': takes its examples and leaves its near misses', () => {
    assert.ok(s.examples.length && s.nearMisses.length);
    for (const e of s.examples) assert.ok(takes(s, e), 'should take: ' + e);
    for (const n of s.nearMisses) assert.ok(!takes(s, n), 'should leave: ' + n);
  });
}

test('calendar3d: reads the agenda the calendar keeps, and an empty or broken one is an empty list', () => {
  const store = {};
  globalThis.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } };
  assert.deepEqual(loadEvents(), []);
  store['a2m.void.agenda.v1'] = '{not json';
  assert.deepEqual(loadEvents(), []);
  store['a2m.void.agenda.v1'] = JSON.stringify([{ id: 'a', title: 'dentist' }]);
  assert.equal(loadEvents()[0].title, 'dentist');
  delete globalThis.localStorage;
});

test('overlaps settled: a bare "games" is the Game Box\'s, "board games" stays the rack\'s; "play my cards" is not a video; a plain shape is not a cartoon', () => {
  assert.equal(rackOf('games'), null);
  assert.equal(rackOf('show me the games'), null);
  assert.deepEqual(rackOf('board games'), { kind: 'rack' });
  assert.deepEqual(rackOf('show me the board games'), { kind: 'rack' });
  assert.ok(!takes(videoPlay, 'play my cards'));
  assert.ok(!takes(videoPlay, 'play my deck'));
  assert.ok(takes(videoPlay, 'play despacito'));
  assert.ok(!takes(cartoon, 'draw a circle'));
  assert.ok(!takes(cartoon, 'draw a line'));
  assert.ok(!takes(cartoon, 'draw a red square'));
  assert.ok(!takes(cartoon, 'draw a big blue circle'));
  assert.ok(takes(cartoon, 'draw a toon cat'));
});
