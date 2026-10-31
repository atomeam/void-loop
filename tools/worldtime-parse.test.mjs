// How skills/worldtime.js reads a time asked between two places, in the orders people type it.
// Run: node --test tools/worldtime-parse.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseWorldTime } from '../void-live-deploy/skills/worldtime.js';

const conv = (a) => { const q = parseWorldTime(a); return q && q.kind === 'convert' ? [q.time, q.from, q.to].join(' | ') : JSON.stringify(q); };

test('worldtime: a time between two places, in the orders people type it', () => {
  assert.equal(conv('what time is 9am london in new york'), '9am | london | new york');
  assert.equal(conv('noon in paris is what time in chicago'), 'noon | paris | chicago');
  assert.equal(conv('3pm london is what time in tokyo'), '3pm | london | tokyo');
  assert.equal(conv('meeting at 2pm london what time in san francisco'), '2pm | london | san francisco');
  assert.equal(conv('my call is at 10am in new york, what time is that in berlin'), '10am | new york | berlin');
  assert.equal(conv('is sydney ahead of los angeles'), 'now | los angeles | sydney');
  assert.equal(conv('is tokyo behind london'), 'now | london | tokyo');
  // the older forms still read the same
  assert.equal(conv("when it's 6pm in berlin what time is it in dubai"), '6pm | berlin | dubai');
  assert.equal(conv('3pm london to tokyo'), '3pm | london | tokyo');
});

test('worldtime: GMT and UTC now, and look-alikes left alone', () => {
  for (const a of ['what is gmt now', 'gmt now', 'utc time', "what's utc right now"]) {
    const q = parseWorldTime(a); assert.ok(q && q.kind === 'now', a);
  }
  for (const a of ['is the meeting at 2pm', 'is sydney ahead', 'meeting at 2pm tomorrow', 'is it ahead of schedule'])
    assert.ok(!parseWorldTime(a) || parseWorldTime(a).kind !== 'convert', a);
});

test('worldtime: the full link opens the Time zones page on the same places, by name and zone', async () => {
  const { timePage } = await import('../void-live-deploy/skills/worldtime.js');
  const { findPlace } = await import('../void-live-deploy/lib/zones.js');
  const one = timePage([{ name: 'Kyoto', tz: 'Asia/Tokyo' }]);
  assert.equal(one, '/time/?c=Kyoto%40Asia%2FTokyo');
  // the page reads each place back with the name the card showed, not its zone's city
  const asked = new URLSearchParams(one.slice(one.indexOf('?'))).get('c').split(/\s*[,;|]\s*/);
  assert.deepEqual(asked.map((n) => findPlace(n)), [{ name: 'Kyoto', tz: 'Asia/Tokyo' }]);
  const two = new URLSearchParams(timePage([{ name: 'São Paulo', tz: 'America/Sao_Paulo' }, { name: 'Ho Chi Minh City', tz: 'Asia/Ho_Chi_Minh' }]).split('?')[1]).get('c');
  assert.deepEqual(two.split(/\s*[,;|]\s*/).map((n) => findPlace(n)), [{ name: 'São Paulo', tz: 'America/Sao_Paulo' }, { name: 'Ho Chi Minh City', tz: 'Asia/Ho_Chi_Minh' }]);
  // a name that holds a separator cannot split the list; a zone that is not real is not taken
  assert.ok(!/%2C.*%2C/.test(timePage([{ name: 'Washington, D.C.', tz: 'America/New_York' }])));
  assert.equal(findPlace('Nowhere@Mars/Base'), null);
  // and the card frame takes it as the Time zones page with a plain query
  const { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js');
  assert.deepEqual(pageOfCard('worldtime', one), [one, 'Time zones']);
});
