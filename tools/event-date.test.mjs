// When is a named event (lib/event-date.js): the asks, the search words, the announced date in a Wikipedia summary, the time left.
import test from 'node:test';
import assert from 'node:assert/strict';
import { eventAsk, searchWords, datesIn, announcedDate, left } from '../void-live-deploy/lib/event-date.js';

test('it takes countdowns to a named event and leaves dates, holidays and times of day alone', () => {
  assert.deepEqual(eventAsk('how many hours til gta6?'), { event: 'gta6', unit: 'hours' });
  assert.deepEqual(eventAsk("how many days 'til GTA 6 comes out"), { event: 'GTA 6', unit: 'days' });
  assert.deepEqual(eventAsk('how long until the world cup starts'), { event: 'world cup', unit: 'hours' });
  assert.deepEqual(eventAsk('countdown to the olympics'), { event: 'olympics', unit: 'hours' });
  for (const no of ['how many days until christmas', 'days until new year', 'how long until sunset', 'how many hours until friday', 'how long until 5pm',
    'how many days until december 25', 'countdown to my birthday', 'how long to boil an egg', 'what is gta 6', 'how many hours in a day']) assert.equal(eventAsk(no), null, no);
});

test('short names become the title to search for', () => {
  assert.equal(searchWords('gta6'), 'Grand Theft Auto VI'); assert.equal(searchWords('GTA 5'), 'Grand Theft Auto V'); assert.equal(searchWords('world cup'), 'world cup');
});

const GTA = 'Grand Theft Auto VI is an upcoming action-adventure game developed by Rockstar Games. It is scheduled to be released on 19 November 2026 for the PlayStation 5 and Xbox Series X/S. It was announced on November 8, 2023, and its first trailer was released on 5 December 2023.';
test('the announced date is the release date still ahead, not the announcement or the trailer', () => {
  assert.equal(datesIn(GTA).length, 3);
  const a = announcedDate(GTA, new Date('2026-10-17T11:00:00Z'));
  assert.equal(a.date.toISOString().slice(0, 10), '2026-11-19'); assert.match(a.sentence, /scheduled to be released/);
  assert.equal(announcedDate(GTA, new Date('2026-11-20T00:00:00Z')), null, 'after the day, no date ahead');
  assert.equal(announcedDate('An upcoming game with no release date announced.', new Date('2026-10-17')), null, 'no date: never a guess');
  assert.equal(announcedDate('It opens on February 31, 2027.', new Date('2026-10-17')), null, 'a day that does not exist is not a date');
});

test('time left is days, hours and minutes to the start of the day where you are', () => {
  const day = new Date(Date.UTC(2026, 10, 19)), now = new Date(2026, 9, 17, 11, 0); // local times
  const l = left(day, now);
  assert.equal(l.totalHours, Math.floor((new Date(2026, 10, 19) - now) / 3600000));
  assert.ok(l.days === 32 || l.days === 33); assert.ok(l.hours >= 0 && l.hours < 24 && l.minutes >= 0 && l.minutes < 60);
  assert.equal(left(day, new Date(2027, 0, 1)).ms, 0, 'past: zero, never negative');
});
