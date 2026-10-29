// When is a named event (lib/event-date.js): the asks, the search words, the announced date in a Wikipedia summary, the time left.
import test from 'node:test';
import assert from 'node:assert/strict';
import { eventAsk, searchWords, datesIn, announcedDate, left } from '../void-live-deploy/lib/event-date.js';

test('it takes countdowns to a named event and leaves dates, holidays and times of day alone', () => {
  assert.deepEqual(eventAsk('how many hours til gta6?'), { event: 'gta6', unit: 'hours' });
  assert.deepEqual(eventAsk("how many days 'til GTA 6 comes out"), { event: 'GTA 6', unit: 'days' });
  assert.deepEqual(eventAsk('how long until the world cup starts'), { event: 'world cup', unit: 'hours' });
  assert.deepEqual(eventAsk('countdown to the olympics'), { event: 'olympics', unit: 'hours' });
  for (const no of ['how many days until christmas', 'how many days until summer', 'how long until spring', 'countdown to winter', 'days until new year', 'how long until sunset', 'how many hours until friday', 'how long until 5pm',
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

test('a summary that names no date: the lead, then the infobox release line give it (the live GTA VI card said "no announced date")', async () => {
  const { infoboxDates, announcedFrom } = await import('../void-live-deploy/lib/event-date.js');
  const now = new Date('2026-10-17T11:00:00Z');
  const box = '{{Infobox video game\n| title = Grand Theft Auto VI\n| developer = [[Rockstar Games]]\n| released = {{Video game release|WW|November 19, 2026}}\n| genre = [[Action-adventure game|Action-adventure]]\n}}';
  assert.equal(infoboxDates(box)[0].date.toISOString().slice(0, 10), '2026-11-19');
  assert.equal(infoboxDates('| release_date = {{Start date|2027|5|26}}')[0].date.toISOString().slice(0, 10), '2027-05-26');
  assert.equal(infoboxDates('| developer = Rockstar North, founded 1 January 2030').length, 0, 'only release-like fields');
  const extract = 'Grand Theft Auto VI is an upcoming action-adventure game developed and published by Rockstar Games.';
  assert.equal(announcedFrom({ extract }, now), null);
  assert.equal(announcedFrom({ extract, lead: extract + ' Following two delays, it is scheduled for release on 19 November 2026 for the PlayStation 5 and Xbox Series X/S.' }, now).date.toISOString().slice(0, 10), '2026-11-19');
  assert.equal(announcedFrom({ extract, lead: extract, wikitext: box }, now).date.toISOString().slice(0, 10), '2026-11-19');
  assert.equal(announcedFrom({ extract, wikitext: '| released = {{Video game release|WW|May 26, 2026}}' }, now), null, 'a release already past is not a countdown');
});

test('the card says which part of the page gave the date, and is less sure of an infobox field (asked by Verse)', async () => {
  const { announcedFrom, confidenceOf } = await import('../void-live-deploy/lib/event-date.js');
  const now = new Date('2026-10-17T11:00:00Z'), s = 'It is scheduled to be released on 19 November 2026.';
  assert.equal(announcedFrom({ extract: s }, now).from, 'summary');
  assert.equal(announcedFrom({ extract: 'No date.', lead: s }, now).from, 'lead');
  assert.equal(announcedFrom({ extract: 'No date.', wikitext: '| released = November 19, 2026' }, now).from, 'infobox');
  assert.equal(confidenceOf('summary').sure, 'high'); assert.equal(confidenceOf('lead').sure, 'high'); assert.equal(confidenceOf('infobox').sure, 'lower');
  assert.match(confidenceOf('infobox').label, /infobox/);
});

test('the badge shows the raw text the date was read from: the infobox wikitext line, or the sentence (asked by Verse, twice)', async () => {
  const { announcedFrom, rawSnippet } = await import('../void-live-deploy/lib/event-date.js');
  const now = new Date('2026-10-17T00:00:00Z');
  const box = announcedFrom({ extract: 'A game.', lead: 'A game by a studio.', wikitext: '| released = {{Video game release|WW|{{Start date|2026|11|19}}}}' }, now);
  assert.equal(box.from, 'infobox'); assert.equal(rawSnippet(box), '| released = {{Video game release|WW|{{Start date|2026|11|19}}}}');
  const prose = announcedFrom({ extract: 'It is scheduled for release on 19 November 2026.' }, now);
  assert.equal(rawSnippet(prose), 'It is scheduled for release on 19 November 2026.');
  assert.equal(rawSnippet(null), '');
});
