// node tools/calendar-rivals.test.mjs: what /calendar/ took from Google Calendar's appointment schedules and time insights, Outlook
// Bookings, Proton and Cozi (lib/cal-booking.js): booking links both ways, the booking's event on each side, and where a week's hours went.
import test from 'node:test'; import assert from 'node:assert/strict';
import * as B from '../void-live-deploy/lib/cal-booking.js';
import { fmtLocal } from '../void-live-deploy/lib/calendar.js';

const param = (u, k) => new URL(u).searchParams.get(k);
const NOW = new Date(2030, 0, 1, 8, 0);

test('a booking link carries the title, host, length and times, and reads back in local time', () => {
  const u = B.bookingLink({ title: 'Intro call', host: 'Sam', email: 'sam@example.com', minutes: 30, slots: [{ start: '2030-01-02T10:00' }, { start: '2030-01-02T10:00' }, { start: '2030-01-03T09:30' }] }, 'https://a-to-mind.com');
  assert.match(u, /^https:\/\/a-to-mind\.com\/calendar\/\?book=[A-Za-z0-9_-]+$/);
  const b = B.readBooking(param(u, 'book'), NOW);
  assert.equal(b.title, 'Intro call'); assert.equal(b.host, 'Sam'); assert.equal(b.email, 'sam@example.com'); assert.equal(b.minutes, 30);
  assert.deepEqual(b.slots.map((s) => s.start), ['2030-01-02T10:00', '2030-01-03T09:30']); assert.equal(b.slots[0].end, '2030-01-02T10:30');
});

test('times already past leave the list; a broken link, a bad length or no title read as nothing', () => {
  const u = B.bookingLink({ title: 'x', minutes: 60, slots: [{ start: '2029-12-31T10:00' }, { start: '2030-01-05T10:00' }] });
  assert.deepEqual(B.readBooking(param('https://x' + u, 'book'), NOW).slots.map((s) => s.start), ['2030-01-05T10:00']);
  assert.equal(B.bookingLink({ title: '', minutes: 30, slots: [{ start: '2030-01-02T10:00' }] }), null);
  assert.equal(B.bookingLink({ title: 'x', minutes: 2, slots: [{ start: '2030-01-02T10:00' }] }), null);
  assert.equal(B.bookingLink({ title: 'x', minutes: 30, slots: [] }), null);
  assert.equal(B.readBooking('not base64!'), null); assert.equal(B.readBooking(Buffer.from('{"t":"x","m":9999,"s":[1]}').toString('base64url')), null);
  assert.equal(B.bookingLink({ title: 'x', email: 'not an email', minutes: 30, slots: [{ start: '2030-01-02T10:00' }] }).length > 0, true);
});

test('at most 60 times ride in a link', () => {
  const slots = Array.from({ length: 80 }, (_, i) => ({ start: fmtLocal(new Date(2030, 0, 2, 0, i * 30)) }));
  assert.equal(B.readBooking(param('https://x' + B.bookingLink({ title: 'x', minutes: 30, slots }), 'book'), NOW).slots.length, 60);
});

test('the guest\'s pick comes back as a link and a mail to the host, and makes the same event on both sides', () => {
  const b = B.readBooking(param('https://x' + B.bookingLink({ title: 'Intro call', host: 'Sam', email: 'sam@example.com', minutes: 45, slots: [{ start: '2030-01-02T10:00' }] }), 'book'), NOW);
  const back = B.bookedLink(b, b.slots[0].at, 'Ana', 'https://a-to-mind.com', 'about the shop');
  assert.match(back.url, /\/calendar\/\?booked=/); assert.match(back.mailto, /^mailto:sam@example\.com\?subject=Booked%3A%20Intro%20call%20with%20Ana/); assert.match(decodeURIComponent(back.mailto), /Add it to your calendar: https:\/\/a-to-mind\.com\/calendar\/\?booked=/);
  const got = B.readBooked(param(back.url, 'booked'));
  assert.equal(got.guest, 'Ana'); assert.equal(got.start, '2030-01-02T10:00'); assert.equal(got.end, '2030-01-02T10:45'); assert.equal(got.note, 'about the shop');
  const host = B.bookingEvent(got, 'host'), guest = B.bookingEvent({ ...b, guest: 'Ana', at: b.slots[0].at, start: b.slots[0].start, end: b.slots[0].end }, 'guest');
  assert.equal(host.title, 'Intro call with Ana'); assert.equal(guest.title, 'Intro call with Sam'); assert.equal(host.id, guest.id); assert.deepEqual(host.reminders, [10]);
  assert.equal(B.bookedLink(b, b.slots[0].at, '', 'https://x'), null); assert.equal(B.bookedLink({ ...b, email: '' }, b.slots[0].at, 'Ana').mailto, '');
});

test('time insights: hours by calendar and by day, all-day events left out, busiest day and longest event', () => {
  const cals = [{ id: 'main', name: 'My calendar', color: '#111' }, { id: 'work', name: 'Work', color: '#222' }];
  const ev = [
    { id: '1', title: 'Standup', start: '2030-01-07T09:00', end: '2030-01-07T09:30', rrule: { freq: 'DAILY', interval: 1 }, cal: 'work' },
    { id: '2', title: 'Workshop', start: '2030-01-09T13:00', end: '2030-01-09T16:00', cal: 'work', invitees: ['a@b.co'] },
    { id: '3', title: 'Gym', start: '2030-01-08T18:00', end: '2030-01-08T19:00' },
    { id: '4', title: 'Holiday', start: '2030-01-10', end: '2030-01-10', allDay: true },
    { id: '5', title: 'Next week', start: '2030-01-14T10:00', end: '2030-01-14T11:00' },
  ];
  const r = B.timeInsights(ev, cals, '2030-01-07', 7);
  assert.equal(r.total, 7 * 30 + 180 + 60); assert.equal(r.events, 9);
  assert.deepEqual(r.byCal.map((c) => [c.id, c.minutes]), [['work', 390], ['main', 60]]);
  assert.equal(r.byDay.length, 7); assert.equal(r.byDay[2].minutes, 210); assert.equal(r.busiest.day, '2030-01-09');
  assert.deepEqual(r.longest, { title: 'Workshop', minutes: 180 }); assert.equal(r.meetings, 1);
  assert.equal(B.timeInsights([], cals, '2030-01-07').total, 0); assert.equal(B.timeInsights([], cals, '2030-01-07').busiest, null);
  assert.equal(B.hm(200), '3 h 20 min'); assert.equal(B.hm(45), '45 min'); assert.equal(B.hm(120), '2 h');
});
