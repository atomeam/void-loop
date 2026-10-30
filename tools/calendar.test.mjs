// The calendar page's pure half (lib/calendar.js): recurrence for every FREQ (BYDAY, COUNT, UNTIL, a 31st skipping short months), the .ics round
// trip, the invite link, reminders due and next, the quick-add parser in English and German, the words, and the page's registrations
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as C from '../void-live-deploy/lib/calendar.js';
import { routeAsk, TOOLS, RELATED } from '../void-live-deploy/lib/toolkit.js';
import { PAGES } from '../void-live-deploy/lib/seo.js';
import { FLOORS, LANES } from '../void-live-deploy/lib/tower.js';
import { probeFor, score } from './tower-probes.mjs';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', 'void-live-deploy');
const now = new Date(2026, 9, 25, 10, 0); // Sunday 25 October 2026, 10:00 local
const starts = (ev, a, b) => C.occurrences(ev, a, b).map((o) => o.start);

test('local wall-clock dates read and written back; a day, a week, a month grid', () => {
  assert.equal(C.fmtLocal(C.parseLocal('2026-10-26T15:00')), '2026-10-26T15:00'); assert.equal(C.dayKey(C.parseLocal('2026-10-26')), '2026-10-26'); assert.equal(C.parseLocal('nope'), null);
  assert.equal(C.dayKey(C.startOfWeek(new Date(2026, 9, 25))), '2026-10-19', 'Monday starts the week'); assert.equal(C.dayKey(C.startOfWeek(new Date(2026, 9, 25), 0)), '2026-10-25');
  const g = C.monthGrid(2026, 9); assert.equal(g.length, 42); assert.equal(C.dayKey(g[0]), '2026-09-28'); assert.equal(C.dayKey(g[41]), '2026-11-08');
  assert.equal(C.dayKey(C.addMonths(new Date(2026, 0, 31), 1)), '2026-02-28', 'clipped to the month');
});
test('an event is made whole, or refused without a title or a start', () => {
  const e = C.normalize({ title: ' Dentist ', start: '2026-10-26T15:00', reminders: ['30', 30, -1, 'x'], invitees: 'a@b.co, nope, c@d.org' });
  assert.equal(e.title, 'Dentist'); assert.equal(e.end, '2026-10-26T16:00'); assert.deepEqual(e.reminders, [30]); assert.deepEqual(e.invitees, ['a@b.co', 'c@d.org']); assert.equal(e.rrule, null); assert.ok(e.id);
  assert.equal(C.normalize({ start: '2026-10-26' }), null); assert.equal(C.normalize({ title: 'x' }), null);
  assert.deepEqual(C.normalize({ title: 'x', start: '2026-10-26T10:00', allDay: true, end: '2026-10-25' }).end, '2026-10-26', 'an end before the start is the start');
});
test('occurrences: a plain event once; daily, weekly, monthly and yearly with INTERVAL, COUNT and UNTIL', () => {
  const one = { title: 'x', start: '2026-10-26T15:00' }; assert.deepEqual(starts(one, '2026-10-01', '2026-10-31'), ['2026-10-26T15:00']); assert.deepEqual(starts(one, '2026-11-01', '2026-11-30'), []);
  assert.deepEqual(starts({ ...one, rrule: { freq: 'DAILY', interval: 2, count: 4 } }, '2026-10-01', '2026-12-31'), ['2026-10-26T15:00', '2026-10-28T15:00', '2026-10-30T15:00', '2026-11-01T15:00']);
  assert.deepEqual(starts({ ...one, rrule: { freq: 'DAILY', until: '2026-10-28' } }, '2026-10-01', '2026-12-31'), ['2026-10-26T15:00', '2026-10-27T15:00', '2026-10-28T15:00'], 'UNTIL includes its day');
  assert.deepEqual(starts({ ...one, rrule: { freq: 'WEEKLY', interval: 2 } }, '2026-11-01', '2026-12-10'), ['2026-11-09T15:00', '2026-11-23T15:00', '2026-12-07T15:00']);
  assert.deepEqual(starts({ ...one, rrule: { freq: 'MONTHLY' } }, '2026-10-01', '2027-02-28'), ['2026-10-26T15:00', '2026-11-26T15:00', '2026-12-26T15:00', '2027-01-26T15:00', '2027-02-26T15:00']);
  assert.deepEqual(starts({ title: 'rent', start: '2026-10-31T09:00', rrule: { freq: 'MONTHLY' } }, '2026-10-01', '2027-01-31'), ['2026-10-31T09:00', '2026-12-31T09:00', '2027-01-31T09:00'], 'a 31st skips November');
  assert.deepEqual(starts({ title: 'bday', start: '2026-11-03', allDay: true, rrule: { freq: 'YEARLY' } }, '2027-01-01', '2029-12-31'), ['2027-11-03', '2028-11-03', '2029-11-03']);
  assert.deepEqual(starts({ title: 'leap', start: '2028-02-29', allDay: true, rrule: { freq: 'YEARLY' } }, '2028-01-01', '2033-12-31'), ['2028-02-29', '2032-02-29']);
  assert.equal(C.occurrences({ ...one, rrule: { freq: 'DAILY' } }, '2026-10-26', '2099-12-31').length <= 5000, true, 'capped');
});
test('occurrences: BYDAY weekly on chosen days, monthly on the nth weekday, and a day struck out (EXDATE)', () => {
  const mw = { title: 'gym', start: '2026-10-26T18:00', rrule: { freq: 'WEEKLY', byday: ['MO', 'WE'] } };
  assert.deepEqual(starts(mw, '2026-10-26', '2026-11-08'), ['2026-10-26T18:00', '2026-10-28T18:00', '2026-11-02T18:00', '2026-11-04T18:00']);
  assert.deepEqual(starts({ ...mw, rrule: { freq: 'WEEKLY', byday: ['MO', 'WE'], count: 3 } }, '2026-10-01', '2026-12-31'), ['2026-10-26T18:00', '2026-10-28T18:00', '2026-11-02T18:00']);
  assert.deepEqual(starts({ title: 'wed start', start: '2026-10-28T18:00', rrule: { freq: 'WEEKLY', byday: ['MO', 'WE'] } }, '2026-10-01', '2026-11-03'), ['2026-10-28T18:00', '2026-11-02T18:00'], 'nothing before the start');
  assert.deepEqual(starts({ title: 'board', start: '2026-11-03T19:00', rrule: { freq: 'MONTHLY', byday: ['1TU'] } }, '2026-11-01', '2027-01-31'), ['2026-11-03T19:00', '2026-12-01T19:00', '2027-01-05T19:00']);
  assert.deepEqual(starts({ title: 'payday', start: '2026-10-30T09:00', rrule: { freq: 'MONTHLY', byday: ['-1FR'] } }, '2026-10-01', '2026-12-31'), ['2026-10-30T09:00', '2026-11-27T09:00', '2026-12-25T09:00']);
  assert.deepEqual(starts({ ...mw, exdates: ['2026-10-28'] }, '2026-10-26', '2026-11-01'), ['2026-10-26T18:00']);
  const multi = C.occurrences({ title: 'trip', start: '2026-10-30', end: '2026-11-02', allDay: true }, '2026-11-01', '2026-11-01'); assert.equal(multi.length, 1, 'a trip under way counts on its middle day');
  const a = C.agenda([{ title: 'b', start: '2026-10-26T09:00' }, { title: 'a', start: '2026-10-26', allDay: true }, { title: 'c', start: '2026-10-25T20:00' }], '2026-10-25', '2026-10-26'); assert.deepEqual(a.map((o) => o.title), ['c', 'a', 'b'], 'by day, all-day first');
});
test('RRULE text both ways', () => {
  assert.equal(C.rruleText({ freq: 'WEEKLY', interval: 2, byday: ['MO', 'WE'], until: '2026-12-20' }), 'FREQ=WEEKLY;INTERVAL=2;UNTIL=20261220T235959;BYDAY=MO,WE');
  assert.deepEqual(C.parseRrule('RRULE:FREQ=MONTHLY;COUNT=5;BYDAY=-1FR'), { freq: 'MONTHLY', interval: 1, count: 5, byday: ['-1FR'] }); assert.deepEqual(C.parseRrule('FREQ=WEEKLY;UNTIL=20261220T235959Z'), { freq: 'WEEKLY', interval: 1, until: '2026-12-20' });
  assert.equal(C.parseRrule('FREQ=HOURLY'), null); assert.equal(C.parseRrule(''), null);
});
test('.ics out and back in: floating local times, all-day dates, the rule, the alarms, the attendees, folded lines, Z times and TZID', () => {
  const evs = [C.normalize({ id: 'abc', title: 'Dentist; teeth, cleaning', start: '2026-10-26T15:00', end: '2026-10-26T16:00', rrule: { freq: 'MONTHLY' }, reminders: [30, 1440], notes: 'bring the card\nand cash', invitees: ['sam@example.com'] }),
    C.normalize({ id: 'bd', title: 'Birthday ' + 'x'.repeat(120), start: '2026-11-03', allDay: true, rrule: { freq: 'YEARLY' }, exdates: ['2027-11-03'] })];
  const ics = C.icsOf(evs, new Date(Date.UTC(2026, 9, 25, 8, 0, 0)));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')); assert.ok(ics.includes('DTSTART:20261026T150000\r\nDTEND:20261026T160000\r\nSUMMARY:Dentist\\; teeth\\, cleaning\r\nDESCRIPTION:bring the card\\nand cash\r\nRRULE:FREQ=MONTHLY'));
  assert.ok(ics.includes('TRIGGER:-PT30M') && ics.includes('TRIGGER:-P1D') && ics.includes('ATTENDEE;CN=sam;RSVP=TRUE:mailto:sam@example.com') && ics.includes('DTSTAMP:20261025T080000Z'));
  assert.ok(ics.includes('DTSTART;VALUE=DATE:20261103\r\nDTEND;VALUE=DATE:20261104') && ics.includes('EXDATE;VALUE=DATE:20271103'));
  assert.ok(ics.split('\r\n').every((l) => l.length <= 75), 'folded at 75');
  const back = C.parseIcs(ics); assert.equal(back.length, 2);
  assert.equal(back[0].title, 'Dentist; teeth, cleaning'); assert.equal(back[0].notes, 'bring the card\nand cash'); assert.deepEqual(back[0].reminders, [30, 1440]); assert.deepEqual(back[0].invitees, ['sam@example.com']); assert.deepEqual(back[0].rrule, { freq: 'MONTHLY', interval: 1 }); assert.equal(back[0].id, 'abc');
  assert.equal(back[1].title, evs[1].title); assert.equal(back[1].allDay, true); assert.equal(back[1].start, '2026-11-03'); assert.equal(back[1].end, '2026-11-03'); assert.deepEqual(back[1].exdates, ['2027-11-03']);
  assert.deepEqual(back.map((e) => C.icsOf([e], new Date(0)).replace(/DTSTAMP:[^\r]*/, '')), evs.map((e) => C.icsOf([e], new Date(0)).replace(/DTSTAMP:[^\r]*/, '')), 'the round trip is exact');
  // other people's files: Google's TZID, a UTC time, a DURATION, no DTEND on an all-day
  const g = C.parseIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nUID:1@google.com\nDTSTART;TZID=Europe/Berlin:20261126T090000\nDURATION:PT45M\nSUMMARY:Standup\nRRULE:FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR\nBEGIN:VALARM\nTRIGGER;RELATED=END:-PT5M\nEND:VALARM\nBEGIN:VALARM\nTRIGGER:-PT10M\nACTION:DISPLAY\nEND:VALARM\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART;VALUE=DATE:20261224\nSUMMARY:Christmas Eve\nEND:VEVENT\nBEGIN:VEVENT\nDTSTART:20261101T120000Z\nSUMMARY:utc\nEND:VEVENT\nEND:VCALENDAR');
  assert.equal(g.length, 3); assert.equal(g[0].start, '2026-11-26T09:00'); assert.equal(g[0].end, '2026-11-26T09:45'); assert.deepEqual(g[0].reminders, [10], 'an alarm from the end is not a reminder before'); assert.deepEqual(g[0].rrule.byday, ['MO', 'TU', 'WE', 'TH', 'FR']);
  assert.equal(g[1].allDay, true); assert.equal(g[1].end, '2026-12-24'); assert.equal(g[2].start, C.fmtLocal(new Date(Date.UTC(2026, 10, 1, 12))), 'a Z time lands on the device clock');
  assert.deepEqual(C.parseIcs('hello'), []); assert.deepEqual(C.parseIcs(''), []);
});
test('an invite is a link that carries the whole event, and a mail with the .ics as its body', () => {
  const e = C.normalize({ id: 'inv1', title: 'Lunch with Sam ☕', start: '2026-10-26T13:00', reminders: [10], invitees: ['sam@example.com', 'ana@example.org'], notes: 'the usual place' });
  const i = C.inviteLink(e, 'https://a-to-mind.com/'); assert.ok(i.url.startsWith('https://a-to-mind.com/calendar/?e=')); assert.doesNotMatch(i.url.split('?e=')[1], /[+/=]/, 'base64url');
  const back = C.eventFromLink(i.url.split('?e=')[1]); assert.equal(back.title, 'Lunch with Sam ☕'); assert.equal(back.start, e.start); assert.deepEqual(back.reminders, [10]); assert.deepEqual(back.invitees, e.invitees); assert.equal(back.id, 'inv1');
  assert.ok(i.mailto.startsWith('mailto:sam@example.com,ana@example.org?subject=Invitation%3A%20Lunch')); const body = decodeURIComponent(i.mailto.split('&body=')[1]); assert.ok(body.includes('BEGIN:VCALENDAR') && body.includes(i.url) && body.includes('the usual place'));
  assert.equal(C.eventFromLink('not base64 at all!'), null); assert.equal(C.eventFromLink(''), null); assert.equal(C.inviteLink({ title: '' }), null);
});
test('reminders: the ones due in a window, and the next one from now', () => {
  const evs = [C.normalize({ title: 'dentist', start: '2026-10-26T15:00', reminders: [30], rrule: { freq: 'MONTHLY' } }), C.normalize({ title: 'call', start: '2026-10-25T10:20', reminders: [0, 10] }), C.normalize({ title: 'nothing', start: '2026-10-25T11:00' })];
  const n = C.nextReminder(evs, '2026-10-25T10:00'); assert.equal(n.event.title, 'call'); assert.equal(n.at, '2026-10-25T10:10'); assert.equal(n.minutes, 10);
  assert.equal(C.nextReminder(evs, '2026-10-25T10:21').event.title, 'dentist'); assert.equal(C.nextReminder(evs, '2026-10-25T10:21').at, '2026-10-26T14:30');
  assert.equal(C.nextReminder(evs, '2026-11-27T00:00').at, '2026-12-26T14:30', 'a repeat keeps reminding'); assert.equal(C.nextReminder([evs[2]], '2026-10-25T10:00'), null);
  assert.deepEqual(C.dueReminders(evs, '2026-10-25T10:09', '2026-10-25T10:20').map((r) => r.event.title + ' ' + r.at), ['call 2026-10-25T10:10', 'call 2026-10-25T10:20']);
  assert.deepEqual(C.dueReminders(evs, '2026-10-25T10:10', '2026-10-25T10:19'), [], 'the edge: since is exclusive, now inclusive');
});
test('quick add: one line of English or German into an event', () => {
  const d = C.quickAdd('dentist tomorrow 3pm, remind me 30 minutes before, every month', now);
  assert.equal(d.title, 'dentist'); assert.equal(d.start, '2026-10-26T15:00'); assert.equal(d.end, '2026-10-26T16:00'); assert.deepEqual(d.reminders, [30]); assert.deepEqual(d.rrule, { freq: 'MONTHLY', interval: 1 }); assert.equal(d.allDay, false);
  const l = C.quickAdd('lunch with Sam tomorrow 1pm', now); assert.equal(l.title, 'lunch with Sam'); assert.equal(l.start, '2026-10-26T13:00'); assert.equal(l.rrule, null); assert.deepEqual(l.reminders, []);
  const t = C.quickAdd('team call every monday 10:00 for 30 minutes', now); assert.equal(t.title, 'team call'); assert.equal(t.start, '2026-10-26T10:00'); assert.equal(t.end, '2026-10-26T10:30'); assert.deepEqual(t.rrule, { freq: 'WEEKLY', interval: 1, byday: ['MO'] });
  const z = C.quickAdd('Zahnarzt morgen 15 Uhr, erinnere mich 10 min vorher', now); assert.equal(z.title, 'Zahnarzt'); assert.equal(z.start, '2026-10-26T15:00'); assert.deepEqual(z.reminders, [10]);
  const b = C.quickAdd("mum's birthday 3 nov all day, every year", now); assert.equal(b.title, "mum's birthday"); assert.equal(b.start, '2026-11-03'); assert.equal(b.allDay, true); assert.equal(b.rrule.freq, 'YEARLY');
  const s = C.quickAdd('standup every weekday 9:15, 10 times', now); assert.deepEqual(s.rrule, { freq: 'WEEKLY', interval: 1, count: 10, byday: ['MO', 'TU', 'WE', 'TH', 'FR'] }); assert.equal(s.start, '2026-10-25T09:15');
  const g = C.quickAdd('gym 3-4pm friday', now); assert.equal(g.start, '2026-10-30T15:00'); assert.equal(g.end, '2026-10-30T16:00');
  const r = C.quickAdd('rent every 2 months on 2026-11-01 until 20 dec 2027', now); assert.equal(r.title, 'rent'); assert.equal(r.start, '2026-11-01'); assert.deepEqual(r.rrule, { freq: 'MONTHLY', interval: 2, until: '2027-12-20' });
  assert.equal(C.quickAdd('room 12 meeting at 3', now).start, '2026-10-25T15:00'); assert.equal(C.quickAdd('yoga 7.11. 18:30', now).start, '2026-11-07T18:30'); assert.equal(C.quickAdd('flight nov 3 6:45am', now).start, '2026-11-03T06:45');
  assert.equal(C.quickAdd('next sunday brunch noon', now).start, '2026-11-01T12:00', 'next sunday, said on a Sunday, is the one after'); assert.equal(C.quickAdd('call mum tonight at 8', now).start, '2026-10-25T20:00');
  assert.equal(C.quickAdd('from 9 to 5 work tomorrow', now).end, '2026-10-26T17:00'); assert.equal(C.quickAdd('conference 12/3', now).start, '2026-12-03');
  assert.equal(C.quickAdd('tomorrow 3pm', now), null, 'nothing left for a title'); assert.equal(C.quickAdd('', now), null); assert.equal(C.quickAdd('   ', now), null);
  assert.equal(C.quickAdd('just a note', now).allDay, true, 'no time means all day today'); assert.equal(C.quickAdd('just a note', now).start, '2026-10-25');
});
test('the words: times, days, repeats and reminders in English and German', () => {
  const d = C.parseLocal('2026-10-26T15:00'); assert.equal(C.fmtTime(d), '3:00 PM'); assert.equal(C.fmtTime(d, 'de-DE'), '15:00'); assert.equal(C.fmtTime(C.parseLocal('2026-10-26T00:05')), '12:05 AM');
  assert.equal(C.fmtDay(d), 'Monday, 26 October 2026'); assert.equal(C.fmtDay(d, 'de'), 'Montag, 26. Oktober 2026'); assert.equal(C.fmtDay(d, 'en', { weekday: false, year: false }), '26 October'); assert.equal(C.fmtMonth(d, 'de'), 'Oktober 2026');
  assert.deepEqual(C.dayNames('en'), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']); assert.deepEqual(C.dayNames('de'), ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']);
  assert.equal(C.repeatText({ freq: 'MONTHLY', interval: 1 }), 'every month'); assert.equal(C.repeatText({ freq: 'WEEKLY', interval: 2, byday: ['MO', 'WE'] }), 'every 2 weeks on Mon, Wed'); assert.equal(C.repeatText({ freq: 'DAILY', interval: 1, until: '2026-12-20', count: 5 }), 'every day until 20 December 2026, 5 times');
  assert.equal(C.repeatText({ freq: 'MONTHLY', interval: 1, byday: ['-1FR'] }), 'every month on last Fri'); assert.equal(C.repeatText({ freq: 'MONTHLY', interval: 1 }, 'de'), 'jeden Monat'); assert.equal(C.repeatText({ freq: 'WEEKLY', interval: 1 }, 'de'), 'jede Woche'); assert.equal(C.repeatText(null), '');
  assert.equal(C.reminderText(30), '30 minutes before'); assert.equal(C.reminderText(60), '1 hour before'); assert.equal(C.reminderText(1440), '1 day before'); assert.equal(C.reminderText(0), 'at the time'); assert.equal(C.reminderText(10, 'de'), '10 Minuten vorher');
  const en = C.wordsFor('en-US'), de = C.wordsFor('de-DE'); assert.deepEqual(Object.keys(en).sort(), Object.keys(de).sort()); assert.equal(de.title, 'Kalender'); for (const k of Object.keys(en)) assert.ok(en[k] && de[k], k);
  assert.equal(C.search([{ title: 'Dentist', notes: '', invitees: [] }, { title: 'Lunch', notes: 'with Sam', invitees: ['sam@x.co'] }], 'sam').length, 1); assert.equal(C.search([], 'x').length, 0);
  const evs = C.withEvent([], { title: 'a', start: '2026-10-26T10:00', id: 'a' }); assert.equal(C.withEvent(evs, { title: 'a2', start: '2026-10-26T10:00', id: 'a' }).length, 1); assert.equal(C.withoutEvent(evs, 'a').length, 0);
});
test('the page is registered: toolkit, the service worker, the SEO table, the ask bar, MAP, the floor, its lane and its probe', () => {
  assert.equal(TOOLS['/calendar/'], 'Calendar'); assert.ok(RELATED['/calendar/'].includes('/time/'));
  assert.ok(fs.readFileSync(path.join(root, 'sw.js'), 'utf8').includes("'/calendar/'")); assert.ok(PAGES.some((p) => p.path === '/calendar/' && p.action.template.includes('{event}')));
  assert.ok(fs.readFileSync(path.join(root, '..', 'docs', 'MAP.md'), 'utf8').includes('lib/calendar.js'));
  const html = fs.readFileSync(path.join(root, 'calendar', 'index.html'), 'utf8'); assert.ok(html.includes("import('/lib/calendar.js')") && html.includes('<nav id="related"') && html.includes('<!-- asks -->') && html.includes('rel="canonical" href="https://a-to-mind.com/calendar/"'));
  assert.equal(routeAsk('add dentist tomorrow 3pm to my calendar'), '/calendar/?q=dentist%20tomorrow%203pm'); assert.equal(routeAsk('my calendar'), '/calendar/'); assert.equal(routeAsk("what's on tomorrow"), '/calendar/?show=tomorrow'); assert.equal(routeAsk('remind me to call mum tomorrow 6pm'), '/calendar/?q=call%20mum%20tomorrow%206pm'); assert.equal(routeAsk('my week'), '/calendar/?show=week');
  assert.equal(routeAsk('pancake recipe'), '/recipes/?q=pancake', 'the recipes route still wins its own asks');
  const f = FLOORS.find((x) => x.id === 'calendar'); assert.equal(f.page, '/calendar/'); assert.ok(f.fatality); assert.equal(LANES.calendar[0], 'https://calendar.online/'); assert.equal(LANES.calendar[LANES.calendar.length - 1], 'https://outlook.live.com/calendar'); assert.equal(LANES.calendar.length, 10);
  assert.ok(FLOORS.some((x) => x.id === 'calendar: calendar.online')); assert.equal(probeFor('calendar: teamup.com').verse, '/calendar/');
  const p = probeFor('calendar'); assert.equal(p.truth.length, 5); assert.ok(p.ask.verse.includes('dentist%20tomorrow%203pm'));
  const t = new Date(Date.now() + 86400000), shown = 'dentist\nMonday, 26 October 2026, 3:00 PM – 4:00 PM\nRepeat every month\nReminder 30 minutes before'.replace('Monday, 26', ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][t.getDay()] + ', ' + t.getDate());
  assert.equal(score(shown, p.truth).n, 5, score(shown, p.truth).missing.join()); assert.equal(score('Dentist 3:00 PM every week', p.truth).n, 2);
  assert.equal(Object.keys(p.parts).join(), 'reminders,invites,recurring events'); assert.equal(score('Reminders · Notification · Invite · .ics · repeats', Object.values(p.parts).flat()).n, 5);
});

test('tasks: well formed or nothing; a day or none; open first by day; "task: buy milk friday" reads its day, "dentist friday" is not a task', () => {
  assert.equal(C.normalizeTask({ title: ' ' }), null); assert.equal(C.normalizeTask({ title: 'x', due: 'soon' }).due, ''); assert.equal(C.normalizeTask({ title: 'x', due: '2026-11-02', done: 1 }).done, true);
  let t = C.withTask([], { id: 'a', title: 'tax', due: '2026-11-02' }); t = C.withTask(t, { id: 'b', title: 'milk' }); t = C.withTask(t, { id: 'c', title: 'old', due: '2026-10-01', done: true }); t = C.withTask(t, { id: 'a', title: 'tax return', due: '2026-11-02' });
  assert.equal(t.length, 3); assert.deepEqual(C.sortTasks(t).map((x) => x.id), ['a', 'b', 'c'], 'open ones by day, the day-less last of them, then the ticked');
  assert.deepEqual(C.tasksOn(t, '2026-11-02').map((x) => x.title), ['tax return']); assert.equal(C.withoutTask(t, 'b').length, 2);
  const now = new Date(2026, 9, 26); assert.deepEqual(C.taskFromText('task: buy milk friday', now), { title: 'buy milk', due: '2026-10-30' }); assert.deepEqual(C.taskFromText('todo call Sam', now), { title: 'call Sam', due: '' });
  assert.deepEqual(C.taskFromText('Aufgabe Steuer 3 nov', now), { title: 'Steuer', due: '2026-11-03' }); assert.equal(C.taskFromText('dentist friday', now), null);
  assert.deepEqual(C.tasksOf({ tasks: [{ title: 'ok' }, { title: '' }, 5] }).map((x) => x.title), ['ok']);
});

test('week start by country, and week numbers: ISO for Monday weeks, "the week with 1 January is week 1" for Sunday weeks', () => {
  assert.equal(C.defaultWeekStart('en-US'), 0); assert.equal(C.defaultWeekStart('en-GB'), 1); assert.equal(C.defaultWeekStart('de-DE'), 1); assert.equal(C.defaultWeekStart('ar-EG'), 6); assert.equal(C.defaultWeekStart('en'), 1);
  const d = (y, m, dd) => new Date(y, m, dd);
  assert.deepEqual([d(2026, 0, 1), d(2026, 9, 26), d(2026, 11, 28), d(2027, 0, 1), d(2021, 0, 3)].map((x) => C.weekNumber(x, 1)), [1, 44, 53, 53, 53], 'ISO 8601');
  assert.deepEqual([d(2026, 0, 1), d(2026, 0, 4), d(2026, 9, 25), d(2026, 11, 31), d(2027, 0, 2)].map((x) => C.weekNumber(x, 0)), [1, 2, 44, 1, 1], 'the week holding 1 January is week 1, also at the year end');
  assert.equal(C.monthGrid(2026, 9, 0)[0].getDay(), 0); assert.equal(C.monthGrid(2026, 9, 6)[0].getDay(), 6); assert.equal(C.dayNames('en', 0)[0], 'Sun');
});

test('busyDays: the days of a year with something on them (a multi-day event marks each day, a repeat each of its days, an open task its day, a done one not)', () => {
  const ev = [{ title: 'trip', start: '2026-11-02', end: '2026-11-04', allDay: true }, { title: 'yoga', start: '2026-10-26T18:00', end: '2026-10-26T19:00', rrule: { freq: 'WEEKLY', interval: 1, count: 3 } }, { title: 'next year', start: '2027-01-05T10:00' }];
  const b = C.busyDays(ev, [{ due: '2026-12-24', done: false }, { due: '2026-12-25', done: true }], 2026);
  assert.deepEqual([...b].sort(), ['2026-10-26', '2026-11-02', '2026-11-03', '2026-11-04', '2026-11-02', '2026-11-09', '2026-12-24'].filter((x, i, a) => a.indexOf(x) === i).sort());
  assert.ok(!b.has('2027-01-05') && !b.has('2026-12-25'));
});

test('moving: whole days, times and length kept; a multi-day event keeps its length; one day of a repeat is split off and the series skips it', () => {
  assert.equal(C.dayDiff('2026-11-01', '2026-10-26'), 6); assert.equal(C.dayDiff('2026-03-30', '2026-03-28'), 2, 'across a clock change');
  const one = C.normalize({ id: 'x', title: 'Dentist', start: '2026-10-28T15:00', end: '2026-10-28T16:30' });
  const m = C.moveOccurrence(one, '2026-10-28', 3); assert.equal(m.length, 1); assert.equal(m[0].id, 'x'); assert.equal(m[0].start, '2026-10-31T15:00'); assert.equal(m[0].end, '2026-10-31T16:30');
  assert.deepEqual(C.moveOccurrence(one, '2026-10-28', 0), []);
  const trip = C.normalize({ id: 't', title: 'Trip', start: '2026-12-20', end: '2026-12-22', allDay: true }); assert.deepEqual(C.moveOccurrence(trip, '2026-12-20', -2).map((e) => [e.start, e.end]), [['2026-12-18', '2026-12-20']]);
  const yoga = C.normalize({ id: 'y', title: 'Yoga', start: '2026-10-26T18:00', end: '2026-10-26T19:00', rrule: { freq: 'WEEKLY', interval: 1 }, rsvp: { id: 'AAAAAAAAAAA', owner: 'o'.repeat(22), reply: 'r'.repeat(22) } });
  const r = C.moveOccurrence(yoga, '2026-11-09', 1); assert.equal(r.length, 2); assert.equal(r[0].id, 'y'); assert.deepEqual(r[0].exdates, ['2026-11-09']); assert.ok(r[0].rrule);
  assert.equal(r[1].start, '2026-11-10T18:00'); assert.equal(r[1].end, '2026-11-10T19:00'); assert.ok(!r[1].rrule && !r[1].rsvp && r[1].id !== 'y' && !r[1].exdates.length);
  assert.ok(!C.occurrences(r[0], '2026-11-09', '2026-11-09').length, 'the series skips the day it gave up');
});

test('time zones: names checked, wall times to instants and back with daylight saving, an event in another zone shown on the viewer\'s clock, .ics with TZID both ways', () => {
  assert.ok(C.isTz('America/New_York') && C.isTz('UTC')); for (const bad of ['', 'Nope/Zone', '<x>', 'a'.repeat(80), null]) assert.ok(!C.isTz(bad), String(bad));
  assert.equal(C.wallToDate('2026-11-05T10:00', 'America/New_York').toISOString(), '2026-11-05T15:00:00.000Z', 'EST, UTC-5');
  assert.equal(C.wallToDate('2026-03-09T10:00', 'America/New_York').toISOString(), '2026-03-09T14:00:00.000Z', 'EDT, UTC-4, after 8 March');
  assert.equal(C.zoneWall(C.wallToDate('2026-11-05T10:00', 'America/New_York'), 'Asia/Tokyo'), '2026-11-06T00:00', 'the next day in Tokyo');
  assert.equal(C.tzCity('America/New_York'), 'New York');
  const e = { id: 's', title: 'Standup', start: '2026-03-05T10:00', end: '2026-03-05T10:30', tz: 'America/New_York', rrule: { freq: 'DAILY', interval: 1, count: 7 } };
  const o = C.occurrences(e, '2026-03-05', '2026-03-12', 'Europe/London'); assert.equal(o.length, 7);
  assert.deepEqual(o.map((x) => x.start.slice(5)), ['03-05T15:00', '03-06T15:00', '03-07T15:00', '03-08T14:00', '03-09T14:00', '03-10T14:00', '03-11T14:00'], 'London sees 15:00, then 14:00 once the US clocks have changed and the UK has not');
  assert.equal(o[0].wallStart, '2026-03-05T10:00'); assert.equal(o[3].occurrence, '2026-03-08', 'the day in its own zone, for exceptions');
  assert.equal(C.occurrences(e, '2026-03-05', '2026-03-12', 'America/New_York')[0].start, '2026-03-05T10:00', 'in its own zone nothing moves');
  assert.equal(C.occurrences({ ...e, rrule: null, start: '2026-03-05T22:00', end: '2026-03-05T23:00' }, '2026-03-06', '2026-03-06', 'Asia/Tokyo').length, 1, 'a late evening in New York is the next day in Tokyo, found by the next day\'s range');
  assert.equal(C.normalize({ title: 'x', start: '2026-01-01', allDay: true, tz: 'Europe/Paris' }).tz, undefined); assert.equal(C.normalize({ title: 'x', start: '2026-01-01T10:00', tz: 'Nope/Zone' }).tz, undefined);
  const t = C.icsOf([C.normalize(e)]); assert.match(t, /DTSTART;TZID=America\/New_York:20260305T100000/); const back = C.parseIcs(t)[0]; assert.equal(back.tz, 'America/New_York'); assert.equal(back.start, '2026-03-05T10:00');
  assert.equal(C.parseIcs('BEGIN:VCALENDAR\nBEGIN:VEVENT\nSUMMARY:x\nDTSTART;TZID=W. Europe Standard Time:20260305T100000\nEND:VEVENT\nEND:VCALENDAR')[0].tz, undefined, 'a Windows zone name is not guessed');
});

test('free slots: gaps between timed events inside the working day, none before now, weekends skipped, an all-day event does not block', () => {
  const ev = [{ title: 'a', start: '2026-10-26T10:00', end: '2026-10-26T11:30' }, { title: 'b', start: '2026-10-26T13:00', end: '2026-10-26T14:00' }, { title: 'allday', start: '2026-10-27', end: '2026-10-27', allDay: true }, { title: 'sat', start: '2026-10-31T10:00', end: '2026-10-31T11:00' }];
  const at = (r) => r.map((x) => x.start.slice(5) + '-' + x.end.slice(11));
  assert.deepEqual(at(C.freeSlots(ev, { from: new Date(2026, 9, 26), now: new Date(2026, 9, 26, 8), days: 2, minutes: 60 })), ['10-26T09:00-10:00', '10-26T11:30-12:30', '10-26T14:00-15:00', '10-27T09:00-10:00', '10-27T10:00-11:00', '10-27T11:00-12:00']);
  assert.deepEqual(C.freeSlots(ev, { from: new Date(2026, 9, 26), now: new Date(2026, 9, 26, 12), days: 1, minutes: 60 }).map((x) => x.start.slice(11)), ['12:00', '14:00', '15:00'], 'nothing before now');
  assert.deepEqual(C.freeSlots(ev, { from: new Date(2026, 9, 31), now: new Date(2026, 9, 26), days: 2, minutes: 60 }), [], 'a weekend, weekdays only'); assert.equal(C.freeSlots(ev, { from: new Date(2026, 9, 31), now: new Date(2026, 9, 26), days: 2, minutes: 60, weekdaysOnly: false }).length, 6);
  assert.deepEqual(C.freeSlots([], { minutes: 600 }), [], 'longer than the working day'); assert.equal(C.freeSlots(ev, { from: new Date(2026, 9, 26), now: new Date(2026, 9, 26, 8), days: 30, minutes: 30, max: 5 }).length, 5);
});

test('travel time: minutes on a timed event, kept in the .ics the way Apple writes it and read back; none on an all-day event', () => {
  const e = C.normalize({ title: 'Dentist', start: '2026-11-05T15:00', travel: '25' }); assert.equal(e.travel, 25);
  assert.equal(C.normalize({ title: 'x', start: '2026-11-05T15:00', travel: 0 }).travel, undefined); assert.equal(C.normalize({ title: 'x', start: '2026-11-05', allDay: true, travel: 20 }).travel, undefined); assert.equal(C.normalize({ title: 'x', start: '2026-11-05T15:00', travel: 9999 }).travel, 300);
  const t = C.icsOf([e]); assert.match(t, /X-APPLE-TRAVEL-DURATION;VALUE=DURATION:PT25M/); assert.equal(C.parseIcs(t)[0].travel, 25);
});
test('a video call on an event, as Google Calendar adds one: made, kept, carried by .ics and invites, read back from Google and Zoom .ics', () => {
  let i = 0; const rand = () => (i++ * 7 % 24) / 24;
  const v = C.videoLink('Team sync: Q3 plans!', rand);
  assert.match(v, /^https:\/\/meet\.jit\.si\/Verse-TeamSyncQ3Plans-[a-z]{12}$/); assert.notEqual(C.videoLink('x'), C.videoLink('x'));
  assert.match(C.videoLink(''), /^https:\/\/meet\.jit\.si\/Verse-[a-z]{12}$/);
  const e = C.normalize({ title: 'Sync', start: '2026-11-02T10:00', video: v }); assert.equal(e.video, v);
  for (const bad of ['javascript:alert(1)', 'http://meet.jit.si/x', 'https://a b', '']) assert.equal(C.normalize({ title: 'S', start: '2026-11-02T10:00', video: bad }).video, undefined);
  const ics = C.icsOf([e]); assert.match(ics, /\r\nURL:https:\/\/meet\.jit\.si\//); assert.match(ics, /CONFERENCE;VALUE=URI;FEATURE=VIDEO/);
  assert.equal(C.parseIcs(ics)[0].video, v);
  assert.equal(C.parseIcs('BEGIN:VEVENT\r\nSUMMARY:Call\r\nDTSTART:20261102T100000\r\nX-GOOGLE-CONFERENCE:https://meet.google.com/abc-defg-hij\r\nEND:VEVENT')[0].video, 'https://meet.google.com/abc-defg-hij');
  assert.equal(C.parseIcs('BEGIN:VEVENT\r\nSUMMARY:Call\r\nDTSTART:20261102T100000\r\nURL:https://example.com/page\r\nEND:VEVENT')[0].video, undefined);
  const inv = C.inviteLink({ ...e, invitees: ['a@b.co'] }, 'https://a-to-mind.com'); assert.match(decodeURIComponent(inv.mailto), /Video call: https:\/\/meet\.jit\.si\//);
  assert.equal(C.eventFromLink(inv.url.split('?e=')[1]).video, v);
});
test("the Calendar page's card opens on the day the page shows, and the card's page link follows the day back", async () => {
  const A = await import('../void-live-deploy/lib/agenda.js');
  const { parseCalendar } = await import('../void-live-deploy/skills/calendar.js');
  const { pageOfDay } = await import('../void-live-deploy/skills/calendar3d.js');
  assert.equal(A.cardAskOf('2026-12-03'), 'my calendar on 2026-12-03');
  assert.equal(A.cardAskOf('2026-02-30'), '', 'no such day: no ask'); assert.equal(A.cardAskOf('soon'), '');
  assert.deepEqual(parseCalendar('my calendar on 2026-12-03'), { kind: 'show', focus: '2026-12-03' });
  assert.deepEqual(parseCalendar('my calendar'), { kind: 'show' }, 'the plain ask is as it was');
  assert.equal(A.cardDayOf('my calendar on 2026-13-01'), '');
  const d = A.dayOfKey('2026-12-03'); assert.equal([d.getFullYear(), d.getMonth(), d.getDate()].join(), '2026,11,3', 'a local day, not UTC midnight');
  assert.equal(pageOfDay(2026, 11, '2026-12-3'), '/calendar/?d=2026-12-03', 'the day picked');
  assert.equal(pageOfDay(2027, 0, null), '/calendar/?d=2027-01-01', 'a month turned to');
  const page = fs.readFileSync(path.join(root, 'calendar', 'index.html'), 'utf8');
  assert.match(page, /mountRelated\(\$\('related'\), '\/calendar\/'[\s\S]*?\{ card: \(\) => A\.cardAskOf\(C\.dayKey\(state\.cursor\)\) \}\)/, 'the page gives its card the day it shows');
});
