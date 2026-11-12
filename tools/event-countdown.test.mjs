// skills/event-countdown.js (how long until a named event, the date read from the event's own Wikipedia page): its pure lines and its
// match, tested (lists run 23, 2026-11-12; one of the biggest files no test named in node tools/untested.mjs).
// Run: node --test tools/event-countdown.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import skill, { verifiedLine, bigLine } from '../void-live-deploy/skills/event-countdown.js';

test('the big line in the unit asked for, singular and plural', () => {
  const l = { ms: 32 * 86400000 + 13 * 3600000, days: 32, hours: 13, totalHours: 781 };
  assert.equal(bigLine(l, 'hours'), '781 hours');
  assert.equal(bigLine(l, 'minutes'), String(Math.floor(l.ms / 60000)) + ' minutes');
  assert.equal(bigLine(l, 'weeks'), '4 weeks, 4 days');
  assert.equal(bigLine(l), '32 days, 13 hours');
  assert.equal(bigLine({ ms: 86400000, days: 1, hours: 0, totalHours: 24 }), '1 day', 'no hours line when there are none');
  assert.equal(bigLine({ ms: 14 * 86400000, days: 14, hours: 1, totalHours: 337 }, 'weeks'), '2 weeks', 'whole weeks have no day part');
  assert.equal(bigLine({ ms: 3600000, days: 0, hours: 1, totalHours: 1 }, 'hours'), '1 hour');
});

test('the freshness line: the page edit day in UTC and when Verse read it, or nothing', () => {
  const s = verifiedLine('2026-11-01T23:30:00Z', new Date('2026-11-12T14:00:00Z'));
  assert.ok(s.startsWith('page last edited ') && s.includes(' · checked '), s);
  assert.ok(/2026/.test(s) && /\b1\b/.test(s), 'the edit day is the UTC day: ' + s);
  assert.equal(verifiedLine(''), '');
  assert.equal(verifiedLine('not a date'), '');
  assert.equal(verifiedLine(null), '');
});

test('its examples match and its near misses stay with countdown, holidays, the clock and the rest', () => {
  for (const a of skill.examples) assert.equal(skill.match(a.toLowerCase(), a), true, a);
  for (const a of skill.nearMisses) assert.equal(skill.match(a.toLowerCase(), a), false, a);
});
