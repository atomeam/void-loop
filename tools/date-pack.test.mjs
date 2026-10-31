// Tools pack 11 (owner, 2026-10-18): DATES & CALENDARS 341-400. Pure date math and the words that reach it; every test passes
// its own dates (no clock, no time zone of the machine), so it gives the same answer everywhere.
// Run: node --test tools/date-pack.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as M from '../void-live-deploy/lib/date-math.js';
import { dateAsk } from '../void-live-deploy/lib/date-ask.js';
import grid, { gridAsk, markAsk, importAsk, exportAsk, anchorOf, marksSavedGrid } from '../void-live-deploy/skills/date-grid.js';
import calc from '../void-live-deploy/skills/date-calc.js';
import { localDay } from '../void-live-deploy/lib/stage-pack.js';

const TODAY = '2026-10-18'; // a Sunday
const ask = (q, nowMin = 870) => dateAsk(q, { today: TODAY, nowMin });
const rowOf = (r, k) => (r.rows.find((x) => x[0] === k) || [])[1];

test('days: weekdays, adding days, weeks, months and years (341, 342)', () => {
  assert.equal(M.weekday('2026-10-18'), 0);
  assert.equal(M.dayName('2000-01-01'), 'Saturday');
  assert.equal(M.addDays('2026-03-01', 30), '2026-03-31');
  assert.equal(M.addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(M.addDays('2024-02-28', 2), '2024-03-01');
  assert.equal(M.addWeeks('2026-10-18', 2), '2026-11-01');
  assert.equal(M.addMonths('2026-01-31', 1), '2026-02-28');
  assert.equal(M.addMonths('2024-01-31', 1), '2024-02-29');
  assert.equal(M.addMonths('2026-11-30', -9), '2026-02-28');
  assert.equal(M.addYears('2024-02-29', 1), '2025-02-28');
  assert.equal(M.isDay('2026-02-30'), false);
  assert.equal(M.isDay('2024-02-29'), true);
});

test('business days skip weekends and a manual holiday list (343)', () => {
  assert.equal(M.addBusinessDays('2026-10-16', 1), '2026-10-19'); // Friday -> Monday
  assert.equal(M.addBusinessDays('2026-10-18', 10), '2026-10-30');
  assert.equal(M.addBusinessDays('2026-10-19', 1, ['2026-10-20']), '2026-10-21');
  assert.equal(M.addBusinessDays('2026-10-19', -1), '2026-10-16');
  assert.equal(M.addBusinessDays('2026-10-19', 0), '2026-10-19');
  assert.equal(M.businessDaysBetween('2026-10-01', '2026-10-31'), 21);
  assert.equal(M.businessDaysBetween('2026-10-31', '2026-10-01'), -22); // the start day is not counted, the end day is: going back counts 1 Oct
});

test('next/previous weekday, month, quarter and ISO week edges (344-350)', () => {
  assert.equal(M.nextWeekday('2026-10-18', 1), '2026-10-19'); // next monday from a sunday
  assert.equal(M.nextWeekday('2026-10-19', 1), '2026-10-26'); // strictly after
  assert.equal(M.nextWeekday('2026-10-18', 5), '2026-10-23');
  assert.equal(M.prevWeekday('2026-10-18', 5), '2026-10-16');
  assert.equal(M.endOfMonth('2026-02-10'), '2026-02-28');
  assert.equal(M.endOfMonth('2028-02-10'), '2028-02-29');
  assert.equal(M.startOfMonth('2026-10-18'), '2026-10-01');
  assert.equal(M.quarterStart('2026-11-15'), '2026-10-01');
  assert.equal(M.quarterEnd('2026-11-15'), '2026-12-31');
  assert.equal(M.quarterEnd('2026-02-01'), '2026-03-31');
  assert.equal(M.isoWeekStart('2026-10-18'), '2026-10-12');
  assert.equal(M.isoWeekStart('2026-10-19'), '2026-10-19');
  assert.deepEqual(M.isoWeek('2026-12-31'), { year: 2026, week: 53 });
  assert.deepEqual(M.isoWeek('2027-01-01'), { year: 2026, week: 53 });
  assert.deepEqual(M.isoWeek('2026-01-01'), { year: 2026, week: 1 });
});

test('format and fuzzy parsing, relative words (351, 352, 355)', () => {
  assert.equal(M.formatDay('2026-10-03', 'long'), 'Saturday, October 3, 2026');
  assert.equal(M.formatDay('2026-10-03', 'us'), '10/03/2026');
  assert.equal(M.formatDay('2026-10-03', 'eu'), '03/10/2026');
  assert.equal(M.formatDay('2026-10-03', 'short'), 'Sat 3 Oct 2026');
  const p = (s) => M.parseDay(s, TODAY);
  assert.equal(p('2026-10-03'), '2026-10-03');
  assert.equal(p('2026-02-30'), null);
  assert.equal(p('Oct 3 2026'), '2026-10-03');
  assert.equal(p('3rd of october'), '2027-10-03'); // already past this year: the next one
  assert.equal(p('december 25'), '2026-12-25');
  assert.equal(p('25 Dec 2027'), '2027-12-25');
  assert.equal(p('10/3/2026'), '2026-10-03');
  assert.equal(M.parseDayLoose('13/10/2026', TODAY), '2026-10-13');
  assert.equal(p('yesterday'), '2026-10-17');
  assert.equal(p('tomorrow'), '2026-10-19');
  assert.equal(p('next week'), '2026-10-25');
  assert.equal(p('last week'), '2026-10-11');
  assert.equal(p('in 3 days'), '2026-10-21');
  assert.equal(p('3 days ago'), '2026-10-15');
  assert.equal(p('3 days'), null); // a length, not a day
  assert.equal(p('next monday'), '2026-10-19');
  assert.equal(p('last friday'), '2026-10-16');
  assert.equal(p('end of month'), '2026-10-31');
  assert.equal(p('end of next month'), '2026-11-30');
  assert.equal(p('start of the quarter'), '2026-10-01');
  assert.equal(p('end of the week'), '2026-10-18');
  assert.equal(p('what'), null);
  assert.equal(p(''), null);
});

test('between, overlap, recurring, skipping holidays (356-360)', () => {
  assert.equal(M.daysBetween('2026-01-01', '2026-03-01'), 59);
  assert.deepEqual(M.rangeOverlap('2026-10-01', '2026-10-10', '2026-10-08', '2026-10-20'), { overlap: true, days: 3, start: '2026-10-08', end: '2026-10-10', gap: 0 });
  assert.equal(M.rangeOverlap('2026-10-01', '2026-10-05', '2026-10-06', '2026-10-09').overlap, false); // touching but not sharing a day
  assert.equal(M.rangeOverlap('2026-10-01', '2026-10-05', '2026-10-08', '2026-10-09').gap, 2);
  assert.equal(M.rangeOverlap('2026-10-10', '2026-10-01', '2026-10-05', '2026-10-07').days, 3); // ends in either order
  assert.deepEqual(M.everyNDays('2026-10-01', 10, 3), ['2026-10-01', '2026-10-11', '2026-10-21']);
  assert.deepEqual(M.everyNDays('2026-10-01', 10, 3, ['2026-10-11']), ['2026-10-01', '2026-10-21', '2026-10-31']);
  assert.deepEqual(M.weeklyDays('2026-10-18', [1, 4], 4), ['2026-10-19', '2026-10-22', '2026-10-26', '2026-10-29']);
  assert.deepEqual(M.weeklyDays('2026-10-19', [1], 2), ['2026-10-19', '2026-10-26']); // the start day counts
  assert.deepEqual(M.skipHolidays(['2026-12-24', '2026-12-25'], ['2026-12-25']), ['2026-12-24']);
  assert.deepEqual(M.skipHolidays(['2026-12-24', '2026-12-25'], ['2026-12-25'], 'shift'), ['2026-12-24', '2026-12-28']);
});

test('countdown, birthday, age, zodiac, moon (361-366)', () => {
  assert.equal(M.daysUntil(TODAY, '2026-12-25'), 68);
  assert.equal(M.daysUntil(TODAY, '2026-10-01'), -17);
  assert.deepEqual(M.nextAnnual('1990-05-03', TODAY), { date: '2027-05-03', days: 197, years: 37 });
  assert.deepEqual(M.nextAnnual('1990-10-18', TODAY), { date: '2026-10-18', days: 0, years: 36 }); // today counts
  assert.equal(M.nextAnnual('2000-02-29', '2026-10-18').date, '2027-02-28');
  assert.equal(M.nextAnnual('2000-02-29', '2027-10-18').date, '2028-02-29');
  assert.deepEqual(M.ageParts('1990-05-03', TODAY), { years: 36, months: 5, days: 15, totalMonths: 437, totalDays: 13317 });
  assert.deepEqual(M.ageParts('2026-01-31', '2026-03-01').months, 1);
  assert.equal(M.ageParts('2027-01-01', TODAY), null);
  assert.equal(M.zodiac('2026-03-03'), 'Pisces');
  assert.equal(M.zodiac('2026-03-21'), 'Aries');
  assert.equal(M.zodiac('2026-12-25'), 'Capricorn');
  assert.equal(M.zodiac('2026-01-19'), 'Capricorn');
  assert.equal(M.zodiac('2026-01-20'), 'Aquarius');
  assert.equal(M.moonPhase('2000-01-06').name, 'New Moon');
  assert.equal(M.moonPhase('2026-10-26').name, 'Full Moon'); // the October 2026 full moon
  assert.equal(M.moonPhase('2026-10-18').name, 'First Quarter');
  const full = M.moonPhase('2026-10-26').illumination, newer = M.moonPhase('2026-10-11').illumination;
  assert.ok(full >= 95 && newer <= 10);
});

test('time of day: midnight, workday fraction, billable rounding (368-370)', () => {
  assert.equal(M.minutesToMidnight(870), 570);
  assert.equal(M.minutesToMidnight(0), 1440);
  assert.equal(M.parseClock('9am'), 540);
  assert.equal(M.parseClock('5:15pm'), 1035);
  assert.equal(M.parseClock('12am'), 0);
  assert.equal(M.parseClock('12pm'), 720);
  assert.equal(M.parseClock('noon'), 720);
  assert.equal(M.parseClock('25:00'), null);
  assert.equal(M.parseClock('13pm'), null);
  assert.equal(M.workdayFraction(780), 0.5); // 13:00 of 9:00-17:00
  assert.equal(M.workdayFraction(400), 0);
  assert.equal(M.workdayFraction(1100), 1);
  assert.deepEqual(M.billableRound(47, 15), { minutes: 60, hours: 1 });
  assert.deepEqual(M.billableRound(60, 15), { minutes: 60, hours: 1 });
  assert.deepEqual(M.billableRound(52, 15, 'nearest'), { minutes: 45, hours: 0.75 });
  assert.deepEqual(M.billableRound(7, 6), { minutes: 12, hours: 0.2 });
});

test('traffic light, snooze, conflicts, buffer, leave-by (380-382, 387-390)', () => {
  assert.deepEqual(M.trafficLight(TODAY, '2026-10-30'), { light: 'green', days: 12 });
  assert.equal(M.trafficLight(TODAY, '2026-10-24').light, 'amber');
  assert.equal(M.trafficLight(TODAY, '2026-10-20').light, 'red');
  assert.equal(M.trafficLight(TODAY, '2026-10-17').light, 'red');
  assert.equal(M.snooze('2026-10-18T23:30', 'hour'), '2026-10-19T00:30');
  assert.equal(M.snooze('2026-10-18T14:30', 'day'), '2026-10-19T14:30');
  assert.equal(M.snooze('2026-10-18T14:30', 'monday'), '2026-10-19T09:00'); // from a Sunday
  assert.equal(M.snooze('2026-10-19T08:00', 'monday'), '2026-10-26T09:00'); // a Monday snoozes to the next one
  assert.equal(M.snooze('nonsense', 'hour'), null);
  const list = [{ start: 600, end: 660 }, { start: 630, end: 720 }, { start: 720, end: 780 }];
  assert.deepEqual(M.conflicts(list).map((c) => [c.a, c.b, c.gap]), [[0, 1, -30]]); // back to back (1,2) is fine
  assert.equal(M.conflicts(list, 15).length, 2); // with a 15 minute buffer, 11:00-12:00 then 12:00 is too close
  assert.equal(M.leaveBy(840, 30, 10), 800);
  assert.equal(M.clockText(M.leaveBy(840, 30, 10)), '13:20');
});

test('time zones: pair, three-zone meeting, working and quiet hours flags (383-386)', () => {
  // fixed dates around the 2026 clock changes keep daylight saving honest
  assert.equal(M.zoneOf('New York'), 'America/New_York');
  assert.equal(M.zoneOf('Europe/Paris'), 'Europe/Paris');
  assert.equal(M.zoneOf('atlantis'), null);
  assert.equal(M.convertZone('2026-10-20T09:00', 'America/New_York', 'Asia/Tokyo'), '2026-10-20T22:00');
  assert.equal(M.convertZone('2026-12-20T09:00', 'America/New_York', 'Asia/Tokyo'), '2026-12-20T23:00'); // winter: New York is UTC-5
  assert.equal(M.convertZone('2026-10-20T09:00', 'America/New_York', 'Europe/London'), '2026-10-20T14:00');
  assert.equal(M.convertZone('2026-10-20T23:00', 'America/Los_Angeles', 'Asia/Tokyo'), '2026-10-21T15:00'); // the next day
  assert.equal(M.offsetMinutes('Asia/Kolkata', Date.UTC(2026, 0, 1)), 330);
  assert.deepEqual(M.hourFlags(600), { working: true, quiet: false });
  assert.deepEqual(M.hourFlags(1380), { working: false, quiet: true });
  assert.deepEqual(M.hourFlags(180), { working: false, quiet: true });
  assert.deepEqual(M.hourFlags(1200), { working: false, quiet: false });
  const mtg = M.meetingAcross('2026-10-20T09:00', ['America/New_York', 'Europe/London', 'Asia/Tokyo']);
  assert.deepEqual(mtg.rows.map((r) => r.local.slice(11)), ['09:00', '14:00', '22:00']);
  assert.equal(mtg.allWorking, false);
  assert.equal(mtg.anyQuiet, true);
});

test('life admin: fiscal year, sprints, terms, pay days, renewals (391-400)', () => {
  assert.deepEqual(M.fiscalYear('2026-10-18', 4), { label: 'FY2027', start: '2026-04-01', end: '2027-03-31', quarter: 3 });
  assert.equal(M.fiscalYear('2026-02-01', 4).label, 'FY2026');
  assert.equal(M.fiscalYear('2026-10-18', 1).label, 'FY2026');
  assert.equal(M.fiscalYear('2026-10-18', 10).quarter, 1);
  assert.deepEqual(M.sprintAt('2026-10-05', 14, '2026-10-18'), { n: 1, start: '2026-10-05', end: '2026-10-18', dayOf: 14, daysLeft: 0, next: '2026-10-19' });
  assert.equal(M.sprintAt('2026-10-05', 14, '2026-10-19').n, 2);
  assert.equal(M.sprintAt('2026-10-25', 14, '2026-10-18').daysToStart, 7);
  assert.deepEqual(M.termProgress('2026-09-01', '2026-12-18', '2026-10-18'), { totalDays: 109, doneDays: 48, weeksLeft: 9, pct: 44, state: 'in progress' });
  assert.equal(M.termProgress('2026-09-01', '2026-12-18', '2027-01-01').state, 'over');
  assert.deepEqual(M.payDates('biweekly', '2026-10-09', TODAY, 2), ['2026-10-23', '2026-11-06']);
  assert.deepEqual(M.payDates('weekly', '2026-10-18', TODAY, 2), ['2026-10-18', '2026-10-25']);
  assert.deepEqual(M.payDates('semimonthly', null, TODAY, 3), ['2026-10-31', '2026-11-15', '2026-11-30']);
  assert.deepEqual(M.payDates('monthly', '2026-01-31', TODAY, 2), ['2026-10-31', '2026-11-30']);
  assert.deepEqual(M.nextRenewal('2026-01-31', 1, TODAY), { date: '2026-10-31', days: 13, count: 9 });
  assert.equal(M.nextRenewal('2025-03-10', 12, TODAY).date, '2027-03-10');
});

test('grids and marks: month, 7x5, streaks, export and import (371-379)', () => {
  const weeks = M.monthGrid('2026-10-18');
  assert.equal(weeks.length, 5);
  assert.deepEqual(weeks[0], [null, null, null, '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04']); // October 2026 starts on a Thursday
  assert.ok(weeks.every((w) => w.length === 7));
  assert.equal(weeks.flat().filter(Boolean).length, 31);
  const heat = M.heatGrid(TODAY);
  assert.equal(heat.length, 5); assert.ok(heat.every((w) => w.length === 7));
  assert.equal(heat[4][6], '2026-10-18'); // ends on this week's Sunday
  assert.equal(M.weekDays(TODAY)[0], '2026-10-12');
  assert.deepEqual(M.streakInfo(['2026-10-16', '2026-10-17', '2026-10-18', '2026-10-01', '2026-10-02'], TODAY), { current: 3, best: 3 });
  assert.deepEqual(M.streakInfo(['2026-10-16', '2026-10-17'], TODAY), { current: 2, best: 2 }); // today still open
  assert.deepEqual(M.streakInfo(['2026-10-10'], TODAY), { current: 0, best: 1 });
  let marks = M.markDay({}, '2026-10-18', 'done');
  marks = M.markDay(marks, '2026-10-17', 'skip');
  assert.equal(M.exportMarks(marks), '2026-10-17 skip\n2026-10-18 done');
  assert.deepEqual(M.importMarks('2026-10-17 skip\n2026-10-18 done'), marks);
  assert.deepEqual(M.importMarks('2026-10-01 done, 2026-10-03 skipped; 2026-02-30 done; junk'), { '2026-10-01': 'done', '2026-10-03': 'skip' });
  assert.deepEqual(M.markDay(marks, '2026-10-18', 'done'), { '2026-10-17': 'skip' }); // the same mark again clears it
  assert.deepEqual(M.markDay(marks, '2026-10-18', null), { '2026-10-17': 'skip' });
  const ts = M.timesheetRow('2026-10-18', [8, 7.5, 8, 8, 6, 0, 0]);
  assert.equal(ts.total, 37.5); assert.equal(ts.days[0], '2026-10-12');
  assert.equal(M.timesheetRow(TODAY, ['x', -3]).total, 0);
});

test('words: the asks date-calc takes and what it hands on', () => {
  assert.equal(rowOf(ask('30 days after 2026-03-01'), 'ISO'), '2026-03-31');
  assert.equal(rowOf(ask('what is 30 days before 2026-03-31'), 'ISO'), '2026-03-01');
  assert.equal(rowOf(ask('10 business days from today'), 'ISO'), '2026-10-30');
  assert.equal(rowOf(ask('5 business days after 2026-12-24 skipping 2026-12-25'), 'ISO'), '2027-01-01');
  assert.equal(rowOf(ask('add 2 weeks to oct 3 2026'), 'ISO'), '2026-10-17');
  assert.equal(rowOf(ask('subtract 1 month from 2026-03-31'), 'ISO'), '2026-02-28');
  assert.equal(rowOf(ask('2026-03-01 plus 30 days'), 'ISO'), '2026-03-31');
  assert.equal(rowOf(ask('in 3 business days'), 'ISO'), '2026-10-21');
  assert.equal(rowOf(ask('next monday'), 'ISO'), '2026-10-19');
  assert.equal(rowOf(ask('what date is next friday'), 'ISO'), '2026-10-23');
  assert.equal(rowOf(ask('end of this month'), 'ISO'), '2026-10-31');
  assert.equal(rowOf(ask('last day of the month'), 'ISO'), '2026-10-31');
  assert.equal(rowOf(ask('start of next quarter'), 'ISO'), '2027-01-01');
  assert.equal(rowOf(ask('when does this quarter end'), 'ISO'), '2026-12-31');
  assert.equal(rowOf(ask('end of the month of 2026-02-10'), 'ISO'), '2026-02-28');
  assert.equal(rowOf(ask('what date was yesterday'), 'ISO'), '2026-10-17');
  assert.equal(rowOf(ask('what is the date next week'), 'ISO'), '2026-10-25');
  assert.equal(rowOf(ask('iso week start'), 'Week starts (Monday)'), 'Monday, October 12, 2026');
  assert.equal(rowOf(ask('week number of 2026-12-31'), 'ISO week'), 'week 53 of 2026');
  assert.equal(rowOf(ask('format 2026-10-03 as us'), 'US (month first)'), '10/03/2026');
  assert.equal(rowOf(ask('parse 3rd of october 2026'), 'ISO'), '2026-10-03');
  assert.equal(rowOf(ask('business days between 2026-10-01 and 2026-10-31'), 'Business days (Mon-Fri)'), '21');
  assert.equal(ask('do 2026-10-01 to 2026-10-10 and 2026-10-08 to 2026-10-20 overlap').title, 'Yes, they overlap');
  assert.equal(ask('do oct 1 to oct 5 2026 and oct 8 to oct 9 2026 overlap').title, 'No overlap');
  assert.deepEqual(ask('every 10 days from 2026-10-01 for 3 times').list, ['2026-10-01', '2026-10-11', '2026-10-21']);
  assert.deepEqual(ask('every monday and thursday for 4 times').list, ['2026-10-19', '2026-10-22', '2026-10-26', '2026-10-29']);
  assert.deepEqual(ask('every monday for 3 times skipping 2026-10-26').list, ['2026-10-19', '2026-11-02', '2026-11-09']);
  assert.deepEqual(ask('every 2 weeks starting 2026-10-19 for 2 times').list, ['2026-10-19', '2026-11-02']);
  assert.equal(rowOf(ask('days until 2026-12-25'), 'Days to go'), '68');
  assert.equal(rowOf(ask('days since 2026-01-01'), 'Days since'), '290');
  // whole words, no "1 weeks" and no "0 weeks"
  assert.equal(rowOf(ask('days until 2026-10-26'), 'Weeks and days'), '1 week 1 day');
  assert.equal(rowOf(ask('days until 2026-10-21'), 'Weeks and days'), '3 days');
  assert.equal(rowOf(ask('days until 2026-10-25'), 'Weeks and days'), '1 week');
  assert.equal(rowOf(ask('days since 2026-10-10'), 'Weeks and days'), '1 week 1 day');
  assert.equal(rowOf(ask('weeks between 2026-10-01 and 2026-10-04'), 'Weeks'), '3 days');
  assert.equal(rowOf(ask('months between 2026-01-01 and 2026-02-01'), 'Months'), '1 month');
  assert.equal(rowOf(ask('next birthday 1990-05-03'), 'Next birthday'), 'Thursday, May 3, 2027'.replace('Thursday', 'Monday'));
  assert.equal(rowOf(ask('my anniversary on june 12 2018'), 'Years'), '9');
  assert.equal(rowOf(ask('exact age born 1990-05-03'), 'Years, months, days'), '36 y 5 m 15 d');
  assert.equal(ask('zodiac sign for march 3').title, 'Pisces');
  assert.equal(ask('moon phase on 2026-10-26').title, 'Full Moon');
  assert.equal(rowOf(ask('daylight from sunrise 6:12 to sunset 19:40'), 'Daylight'), '13 h 28 min');
  assert.equal(ask('how long until midnight', 870).title, '9 h 30 min until midnight');
  assert.equal(rowOf(ask('how much of the workday is done', 780), 'Done'), '50%');
  assert.equal(rowOf(ask('round 47 minutes to 15 minutes'), 'Billable'), '1 h 00 min (1 h)');
  assert.equal(rowOf(ask('billable 2h 10m in 15 minute blocks'), 'Billable'), '2 h 15 min (2.25 h)');
  assert.equal(ask('deadline risk 2026-10-20').light, 'red');
  assert.equal(ask('traffic light for deadline 2026-11-30').light, 'green');
  assert.equal(rowOf(ask('snooze 1 hour', 870), 'To'), 'Sun 18 Oct 2026 15:30');
  assert.equal(rowOf(ask('snooze until monday', 870), 'To'), 'Mon 19 Oct 2026 09:00');
  assert.equal(ask('do 10:00-11:00 and 10:30-12:00 conflict').title, '1 conflict');
  assert.equal(ask('do 9-10am and 10-11am conflict').title, 'No conflicts');
  assert.equal(ask('do 9-10am and 10-11am conflict with a 15 minute buffer').title, '1 conflict');
  assert.equal(ask('appointment at 14:00 with 30 min travel, when do I leave').title, 'Leave by 13:20');
  assert.match(ask('convert 9am new york to tokyo on 2026-10-20').title, /22:00 tokyo/);
  assert.match(ask('meeting 9am new york across london and tokyo').title, /quiet hours/);
  assert.match(ask('best meeting times across new york, london and tokyo').title, /\d\d:\d\d/);
  assert.equal(ask('visa expires 2027-03-01').light, 'green');
  assert.equal(ask('passport expires 2026-11-10').light, 'red');
  assert.equal(rowOf(ask('subscription renews monthly from 2026-01-31'), 'Next renewal'), 'Saturday, October 31, 2026');
  assert.equal(rowOf(ask('warranty 24 months from 2025-11-01'), 'Ends'), 'Monday, November 1, 2027');
  assert.equal(rowOf(ask('lease from 2026-01-01 for 12 months with 60 days notice'), 'Lease ends'), 'Thursday, December 31, 2026');
  assert.equal(rowOf(ask('lease ends 2027-02-28'), 'Lease ends'), 'Sunday, February 28, 2027');
  assert.equal(rowOf(ask('school term 2026-09-01 to 2026-12-18'), 'Done'), '44% (48 of 109 days)');
  assert.equal(ask('biweekly payday 2026-10-09').rows[0][1], 'Friday, October 23, 2026');
  assert.equal(ask('sprint 2 weeks starting 2026-10-05').title, 'Sprint 1, day 14 of 14');
  assert.equal(ask('fiscal year starting april for 2026-10-18').title, 'FY2027 · Q3');
});

test('words: look-alikes date-calc leaves alone', () => {
  for (const q of ['what is a sprint', 'sprint planning tips', 'lease a car', 'fiscal year meaning', 'what is a visa', '10 years ago', 'days until christmas', 'days until dec 25', 'days between 2026-01-01 and 2026-03-01',
    'how old am i', 'what day is it today', 'tomorrow', 'remind me in 3 days', 'call sam next tuesday at 4', 'dentist october 12 at 3pm', 'holidays in japan', 'warranty on my laptop',
    'set a timer for 10 minutes', 'what time is it in tokyo', "time in tokyo when it's 9am in new york", '3pm London to Tokyo', 'conflict resolution at work', 'moon phase tonight', 'moon phase today', 'zodiac signs',
    'school term dates', 'pay day loans', 'snooze', 'round numbers', 'how many days in march', 'what is 30 days after', 'every day i walk', 'parse json', 'meeting notes', 'convert 5 km to miles', 'every time i see you']) assert.equal(ask(q), null, q);
  assert.equal(dateAsk('30 days after 2026-03-01', { today: 'not a day' }), null);
  assert.equal(dateAsk('x'.repeat(400), { today: TODAY }), null);
});

test('words: grids, marks, import and export (371-379)', () => {
  assert.deepEqual(gridAsk('empty month grid for november 2026', TODAY), { mode: 'month', anchor: '2026-11-01', label: '' });
  assert.deepEqual(gridAsk('make an empty month grid', TODAY), { mode: 'month', anchor: TODAY, label: '' });
  assert.deepEqual(gridAsk('calendar grid for next month', TODAY), { mode: 'month', anchor: '2026-11-18', label: '' });
  assert.equal(gridAsk('empty week grid', TODAY).mode, 'week');
  assert.equal(gridAsk('7x5 heatmap', TODAY).mode, 'heat');
  assert.equal(gridAsk('a 7 by 5 heatmap for gym', TODAY).label, 'gym');
  const st = gridAsk('streak calendar for reading', TODAY);
  assert.equal(st.mode, 'streak'); assert.equal(st.label, 'reading');
  assert.deepEqual(gridAsk('timesheet row for this week', TODAY), { mode: 'sheet', anchor: TODAY, label: '' });
  assert.equal(gridAsk('timesheet row for next week', TODAY).anchor, '2026-10-25');
  assert.equal(gridAsk('timesheet', TODAY).mode, 'sheet');
  for (const q of ['what is a heatmap', 'my calendar', 'heatmap of sales by region', 'timesheet software for freelancers', 'month calendar', 'streak', 'a streak calendar is what', 'week planner tips']) assert.equal(gridAsk(q, TODAY), null, q);
  assert.equal(anchorOf('march', TODAY), '2026-03-01');
  assert.equal(anchorOf('2027-01', TODAY), '2027-01-01');
  assert.deepEqual(markAsk('mark today done', TODAY), { iso: TODAY, state: 'done' });
  assert.deepEqual(markAsk('skip yesterday', TODAY), { iso: '2026-10-17', state: 'skip' });
  assert.deepEqual(markAsk('mark 2026-10-16 as skipped', TODAY), { iso: '2026-10-16', state: 'skip' });
  assert.deepEqual(markAsk('unmark today', TODAY), { iso: TODAY, state: 'off' });
  assert.deepEqual(markAsk('mark oct 3 done', TODAY), { iso: '2027-10-03', state: 'done' }); // a bare month and day is the next one
  for (const q of ['mark walk done today', 'mark my homework as done', 'skip the intro', 'mark it']) assert.equal(markAsk(q, TODAY), null, q);
  assert.deepEqual(importAsk('import dates 2026-10-01 done, 2026-10-03 skip'), { '2026-10-01': 'done', '2026-10-03': 'skip' });
  assert.equal(importAsk('import dates please'), null);
  assert.equal(exportAsk('export my dates'), true);
  assert.equal(exportAsk('export my contacts'), false);
  // the marking asks only fire when a grid that takes marks is on the saved stage
  const bag = (obj) => ({ getItem: () => JSON.stringify(obj) });
  assert.equal(marksSavedGrid('mark today done', bag({ a: { kind: 'dategrid', mode: 'streak' } })), true);
  assert.equal(marksSavedGrid('mark today done', bag({ a: { kind: 'dategrid', mode: 'heat' } })), false);
  assert.equal(marksSavedGrid('mark today done', bag({})), false);
  assert.equal(marksSavedGrid('mark today done', { getItem: () => { throw new Error('blocked'); } }), false);
});

test('skills: contract fields and the routing they claim', () => {
  for (const s of [calc, grid]) {
    assert.ok(s.name && Array.isArray(s.examples) && s.examples.length && Array.isArray(s.nearMisses) && typeof s.match === 'function' && typeof s.run === 'function');
    for (const e of s.examples) assert.equal(!!s.match(e.toLowerCase(), e), true, s.name + ': ' + e);
    for (const e of s.nearMisses) assert.equal(!!s.match(e.toLowerCase(), e), false, s.name + ' near: ' + e);
  }
  assert.ok(grid.stageKinds.dategrid && typeof grid.stageKinds.dategrid.mount === 'function');
});

test('the stage helper names a local day, not a UTC one', () => {
  assert.equal(localDay(new Date(2026, 9, 18, 23, 59)), '2026-10-18');
  assert.equal(localDay(new Date(2026, 0, 5, 0, 1)), '2026-01-05');
});

// the everyday benchmark (tools/bench.json) lets date-calc answer these date asks it used to leave to the calculator: its card must
// carry the right date, worked out here a second way with plain Date arithmetic (the benchmark itself has no "says" for most of them)
test('the benchmark date asks date-calc takes get the right dates', () => {
  const plus = (n) => new Date(Date.UTC(2026, 9, 18 + n)).toISOString().slice(0, 10);
  const iso = (q) => rowOf(ask(q), 'ISO');
  assert.equal(iso('what was the date 30 days ago'), plus(-30));
  assert.equal(iso('what is the date in 10 days'), plus(10));
  assert.equal(iso("what's the date 3 weeks from today"), plus(21));
  assert.equal(iso('what is the date 30 days from today'), plus(30));
  assert.equal(iso('what was the date 100 days ago'), plus(-100));
  assert.equal(iso("what's 2 weeks from today"), plus(14));
  assert.equal(iso('what is the date next friday'), '2026-10-23');
  assert.equal(rowOf(ask('what is my zodiac sign if i was born march 3'), 'Sun sign'), 'Pisces');
  assert.equal(rowOf(ask('how many days old am i if born on june 1 1990'), 'Total days'), String((Date.UTC(2026, 9, 18) - Date.UTC(1990, 5, 1)) / 864e5));
  const bench = JSON.parse(fs.readFileSync(new URL('./bench.json', import.meta.url), 'utf8'));
  for (const q of ['what was the date 30 days ago', 'what is the date next friday', 'what is my zodiac sign if i was born march 3']) assert.ok(bench.find((x) => x.ask === q).want.split('|').includes('skill:date-calc'), q);
});
