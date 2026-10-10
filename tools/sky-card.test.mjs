// sky card (frontier #21, sky PR C): routing, names, compass, and the card for a pinned moment and place
import assert from 'node:assert/strict';
import { test } from 'node:test';
import skill, { skyCardOf } from '../void-live-deploy/skills/sky-card.js';
import { bodyOf, direction, look, take, card } from '../void-live-deploy/skills/sky-card-rules.js';

test('routes the asks it is for, and none of its near misses', () => {
  for (const a of skill.examples) assert.ok(skyCardOf(a), a);
  for (const a of skill.nearMisses) assert.equal(skyCardOf(a), null, a);
  assert.deepEqual(skyCardOf('Where is Jupiter?'), { key: 'jupiter' });
  assert.deepEqual(skyCardOf('where is the north star'), { key: 'star:Polaris' });
});

test('names and the compass', () => {
  assert.equal(bodyOf('the Moon'), 'moon');
  assert.equal(bodyOf('sirius'), 'star:Sirius');
  assert.equal(bodyOf('pluto'), null);
  assert.equal(direction(0), 'N'); assert.equal(direction(359), 'N'); assert.equal(direction(90), 'E'); assert.equal(direction(202.5), 'SSW');
});

// London, 2026-10-10 22:30 UTC: the sun well down, new moon (below the horizon), Saturn up in the south-east-to-south
const at = new Date('2026-10-10T22:30:00Z'), lat = 51.5, lonE = -0.13;
test('the sun at night: set, and the take says night with its numbers', () => {
  const L = look('sun', at, lat, lonE);
  assert.ok(L.alt < -18 && !L.up && L.rise && L.rise > at);
  const t = take({ ...L, when: at });
  assert.match(t.text, /has set; it is night/);
  assert.ok(t.evidence.some((e) => /^altitude -/.test(e)));
});

test('the moon on new-moon night: below, and it rises within the day', () => {
  const c = card('moon', at, lat, lonE);
  assert.match(c.take, /below the horizon/);
  assert.ok(c.now.some(([k, v]) => k === 'Phase' && /^[0-3]% lit/.test(v)), JSON.stringify(c.now));
  assert.ok(c.now.some(([k]) => k === 'Distance'));
});

test('a planet that is up after dark: every claim carries evidence; the card has its rows and chips', () => {
  const L = look('saturn', at, lat, lonE);
  assert.ok(L.up, 'saturn alt ' + L.alt);
  const c = card('saturn', at, lat, lonE);
  assert.match(c.take, /^Saturn is up, \d+° in the [NESW]+: a good time to look\.$|low, so find/);
  assert.ok(c.evidence.some((e) => /dark enough/.test(e)));
  assert.deepEqual(c.now.map(([k]) => k), ['Altitude', 'Direction', 'Distance', 'Rises / sets']);
  assert.equal(c.chips[0], 'show me the sky'); assert.ok(!c.chips.includes('where is saturn'));
});

test('a bright sky is never called a good time to look', () => {
  const noon = new Date('2026-10-10T12:00:00Z');
  const t = take({ ...look('mars', noon, lat, lonE), when: noon });
  assert.doesNotMatch(t.text, /good time to look/);
});

test('Polaris from London never sets', () => {
  const c = card('star:Polaris', at, lat, lonE);
  assert.ok(c.now.some(([k, v]) => k === 'Rises / sets' && v === 'never sets here'));
  assert.ok(c.now.some(([k]) => k === 'Magnitude'));
});

test('a new moon above the horizon is not called seeable', () => {
  const t = take({ ...look('moon', new Date('2026-10-10T14:00:00Z'), lat, lonE), when: new Date('2026-10-10T14:00:00Z') });
  assert.match(t.text, /it is new/);
});
