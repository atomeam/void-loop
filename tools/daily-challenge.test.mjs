import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../void-live-deploy/lib/daily-challenge.js';
import skill from '../void-live-deploy/skills/daily-challenge.js';
import rally from '../void-live-deploy/skills/rally.js';
import debris from '../void-live-deploy/skills/debris-field.js';

test('the daily challenge takes its asks and leaves the others', () => {
  for (const a of ['daily challenge', "today's challenge", 'Today’s challenge', 'play the daily challenge', 'the daily challenge', 'daily debris field']) assert.deepEqual(D.askOf(a), { friend: null }, a);
  assert.deepEqual(D.askOf('beat 1200 on the daily challenge'), { friend: 1200 });
  for (const a of ['daily card challenge', 'daily note', 'debris field', 'challenge me', 'beat it', 'daily water intake']) assert.equal(skill.match(a.toLowerCase(), a), false, a);
  assert.equal(rally.match('daily card challenge', 'daily card challenge'), true);
  assert.equal(debris.match('debris field', 'debris field'), true);
});

test('one scored run a day, and a streak of days in a row', () => {
  let s = D.clean(null);
  s = D.record(s, '2026-11-19', 300);
  assert.equal(s.streak, 1); assert.equal(D.todayScore(s, '2026-11-19'), 300);
  assert.deepEqual(D.record(s, '2026-11-19', 9000), s, 'a second run the same day changes nothing');
  s = D.record(s, '2026-11-20', 450);
  assert.equal(s.streak, 2); assert.equal(s.best, 450); assert.equal(D.streakOn(s, '2026-11-21'), 2); assert.equal(D.streakOn(s, '2026-11-22'), 0);
  s = D.record(s, '2026-11-23', 100);
  assert.equal(s.streak, 1, 'a missed day starts the streak again');
  assert.equal(D.dayBefore('2026-03-01'), '2026-02-28');
  assert.equal(D.clean({ last: 'x', streak: -3, scores: { bad: 1, '2026-11-20': '7' } }).scores['2026-11-20'], 7);
});

test('the share line sends a friend the same round to beat', () => {
  const sh = D.shareOf(1234, 3);
  assert.equal(sh.url, 'https://a-to-mind.com/?q=beat%201234%20on%20the%20daily%20challenge');
  assert.match(sh.text, /I scored 1234 on today’s Verse challenge, 3 days in a row\. Beat me:/);
  assert.deepEqual(D.askOf(decodeURIComponent(sh.url.split('?q=')[1])), { friend: 1234 });
  assert.equal(D.hoursLeft(new Date('2026-11-20T23:30:00Z')), 1);
});
