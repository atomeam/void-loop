// lib/zones.js: the time in any city, a converter and a meeting planner, all from the browser's own zone data (Intl), daylight saving included
import test from 'node:test';
import assert from 'node:assert/strict';
import { findPlace, placeAt, cityName, cityOf, wall, clockText, dst, gapText, instantOf, convert, planner, bestSpans, offsetMin, coordsOf, countryOf, lengthText, dateSpan, businessDay } from '../void-live-deploy/lib/zones.js';
import { sunDay, moonOfDay } from '../void-live-deploy/lib/sun-day.js';

test('a city, a zone id, an alias, an abbreviation or an offset finds its zone; nonsense finds none', () => {
  assert.deepEqual(findPlace('tokyo'), { name: 'Tokyo', tz: 'Asia/Tokyo' }); assert.equal(findPlace('Asia/Tokyo').tz, 'Asia/Tokyo'); assert.equal(findPlace('time in Tokyo').tz, 'Asia/Tokyo');
  assert.equal(findPlace('San Francisco').tz, 'America/Los_Angeles'); assert.equal(findPlace('mumbai').tz, 'Asia/Kolkata'); assert.equal(findPlace('São Paulo').tz, 'America/Sao_Paulo');
  assert.equal(findPlace('EST').tz, 'America/New_York'); assert.equal(findPlace('UTC+9').tz, 'Etc/GMT-9'); assert.equal(offsetMin(findPlace('UTC+9').tz, new Date()), 540);
  assert.equal(findPlace('xyzzy'), null); assert.equal(findPlace(''), null); assert.equal(cityOf('America/Argentina/Buenos_Aires'), 'Buenos Aires');
});
test('the wall clock and its words', () => {
  const at = new Date('2026-10-25T12:00:00Z');
  assert.deepEqual(wall('Asia/Tokyo', at), { h: 21, m: 0, s: 0, ymd: [2026, 9, 25], day: 'Sunday' });
  assert.equal(clockText(21, 5), '9:05 PM'); assert.equal(clockText(0, 5, { s: 7 }), '12:05:07 AM'); assert.equal(clockText(9, 5, { h24: true }), '09:05');
  assert.equal(gapText(330), '5.5 hours ahead'); assert.equal(gapText(-60), '1 hour behind'); assert.equal(gapText(0), 'same time');
});
test('daylight saving: London keeps it (on in July, off in December), Tokyo never does', () => {
  assert.deepEqual(dst('Europe/London', new Date('2026-07-01T12:00:00Z')), { observes: true, now: true });
  assert.deepEqual(dst('Europe/London', new Date('2026-12-01T12:00:00Z')), { observes: true, now: false });
  assert.deepEqual(dst('Asia/Tokyo', new Date('2026-07-01T12:00:00Z')), { observes: false, now: false });
});
test('a time carried between zones, across the date line and a daylight-saving change', () => {
  const at = instantOf('3pm', 'Europe/London', [2026, 9, 26]); assert.equal(at.toISOString(), '2026-10-26T15:00:00.000Z', 'London is back on GMT after 25 October');
  const r = convert(at, ['Europe/London', 'Asia/Tokyo', 'America/Los_Angeles']);
  assert.deepEqual(r.map((x) => [x.h, x.m, x.dayShift]), [[15, 0, 0], [0, 0, 1], [8, 0, 0]]);
  assert.equal(instantOf('9:30 am', 'America/New_York', [2026, 6, 1]).toISOString(), '2026-07-01T13:30:00.000Z');
  assert.equal(instantOf('noon', 'Asia/Kolkata', [2026, 0, 1]).toISOString(), '2026-01-01T06:30:00.000Z');
  assert.equal(instantOf('25:00', 'UTC'), null); assert.equal(instantOf('soon', 'UTC'), null);
});
test('the meeting planner: 24 hours of the first city\'s day, and the hours inside everyone\'s working day', () => {
  const rows = planner(['Europe/London', 'America/New_York', 'Europe/Berlin'], [2026, 9, 27]);
  assert.equal(rows.length, 24); assert.deepEqual(rows[13].cells.map((c) => c.h), [13, 9, 14]);
  assert.deepEqual(bestSpans(rows), { kind: 'work', spans: ['12:00 PM to 5:00 PM'] });
  assert.equal(bestSpans(planner(['Europe/London', 'Asia/Tokyo', 'America/Los_Angeles'], [2026, 9, 27])).kind, 'none');
});
test('sunrise, sunset and day length worked out on the device, within 2 minutes of NOAA\'s solar calculator', () => {
  const near = (d, tz, hm) => { const w = wall(tz, d), [h, m] = hm.split(':').map(Number); return Math.abs(w.h * 60 + w.m + w.s / 60 - (h * 60 + m)) <= 2; };
  for (const [name, tz, ymd, rise, set] of [['Tokyo', 'Asia/Tokyo', [2026, 5, 21], '4:25', '19:00'], ['Tokyo', 'Asia/Tokyo', [2026, 2, 20], '5:45', '17:53'],
    ['London', 'Europe/London', [2026, 11, 21], '8:04', '15:53'], ['New York', 'America/New_York', [2026, 5, 21], '5:25', '20:31'], ['Sydney', 'Australia/Sydney', [2026, 5, 21], '7:00', '16:54']]) {
    const s = sunDay({ name, tz }, ymd); assert.ok(near(s.rise, tz, rise), name + ' rise ' + s.rise.toISOString()); assert.ok(near(s.set, tz, set), name + ' set ' + s.set.toISOString());
  }
  assert.equal(lengthText(sunDay({ name: 'Tokyo', tz: 'Asia/Tokyo' }, [2026, 5, 21]).dayMin), '14 hours 35 minutes');
  assert.equal(sunDay({ name: 'Longyearbyen', tz: 'Arctic/Longyearbyen' }, [2026, 5, 21]).state, 'always up', 'midnight sun');
  assert.equal(sunDay({ name: 'Longyearbyen', tz: 'Arctic/Longyearbyen' }, [2026, 11, 21]).state, 'always down', 'polar night');
  assert.deepEqual(coordsOf({ name: 'Your time (Paris)', tz: 'Europe/Paris', you: true }), { lat: 48.86, lon: 2.35 }, 'your own zone stands at its city');
  assert.equal(sunDay({ name: 'Eastern Time', tz: 'America/New_York' }), null, 'a zone, not a city: no coordinate guessed');
  assert.equal(sunDay({ name: 'UTC+9', tz: 'Etc/GMT-9' }), null);
});
test('solar noon, the three twilights and golden hour within 2 minutes of NOAA; the moon from the sky skills\' own almanac', () => {
  const tz = 'Asia/Tokyo', s = sunDay({ name: 'Tokyo', tz }, [2026, 5, 21]), hm = (d) => { const w = wall(tz, d); return w.h * 60 + w.m + w.s / 60; }, near = (d, h, m) => Math.abs(hm(d) - (h * 60 + m)) <= 2;
  assert.ok(near(s.noon, 11, 43), 'solar noon ' + s.noon.toISOString()); assert.ok(near(s.civil.dawn, 3, 55) && near(s.civil.dusk, 19, 30), 'civil');
  assert.ok(near(s.nautical.dawn, 3, 18) && near(s.nautical.dusk, 20, 7), 'nautical ' + s.nautical.dusk.toISOString()); assert.ok(s.astronomical.dawn < s.nautical.dawn && s.nautical.dawn < s.civil.dawn && s.civil.dawn < s.rise);
  assert.ok(s.golden.morning[0] < s.rise && s.rise < s.golden.morning[1] && s.golden.evening[0] < s.set && s.set < s.golden.evening[1], 'golden hour brackets sunrise and sunset');
  assert.ok(s.noonAlt > 77 && s.noonAlt < 78.5, 'the sun 77.7° high at the solstice (90 - 35.69 + 23.44)');
  const full = sunDay({ name: 'Tokyo', tz }, [2026, 9, 26]).moon; assert.equal(full.name, 'full moon'); assert.ok(full.illumination > 97, 'the full moon of 26 October 2026: ' + full.illumination);
  assert.ok(full.rise || full.set, 'a moonrise or moonset');
  // the phase needs no city: a time zone with no place on the map gets the same moon as a city on the same day and the same noon
  assert.deepEqual(moonOfDay('Asia/Tokyo', [2026, 9, 26]), { name: full.name, illumination: full.illumination }, 'the phase without a city');
  assert.equal(moonOfDay('Etc/UTC', [2026, 9, 26]).name, 'full moon', 'plain UTC on the full moon of 26 October 2026');
  assert.equal(sunDay({ name: 'Longyearbyen', tz: 'Arctic/Longyearbyen' }, [2026, 5, 21]).astronomical.dawn, null, 'never dark at midnight sun');
});
test('date to date: the start day counted, the end not, weekdays and weekends; business days on and back (weekends only)', () => {
  assert.deepEqual(dateSpan('2026-10-26', '2026-11-09'), { days: 14, weeks: 2, rest: 0, weekdays: 10, weekendDays: 4, hours: 336 });
  assert.deepEqual(dateSpan('2026-01-01', '2027-01-01'), { days: 365, weeks: 52, rest: 1, weekdays: 261, weekendDays: 104, hours: 8760 });
  assert.equal(dateSpan('2026-10-24', '2026-10-26').weekdays, 0, 'a weekend'); assert.equal(dateSpan('2026-11-09', '2026-10-26').days, -14); assert.equal(dateSpan('2026-10-26', '2026-10-26').days, 0);
  assert.deepEqual(businessDay('2026-10-23', 1), { iso: '2026-10-26', text: 'Monday, October 26, 2026' }); assert.equal(businessDay('2026-10-26', -1).iso, '2026-10-23'); assert.equal(businessDay('2026-10-26', 10).iso, '2026-11-09');
});

test('the next clock change: forward in spring, back in autumn, to the minute; none where the clock never changes', async () => {
  const { nextChange } = await import('../void-live-deploy/lib/zones.js');
  const ny = nextChange('America/New_York', new Date(Date.UTC(2026, 0, 15)));
  assert.equal(ny.at.toISOString(), '2026-03-08T07:00:00.000Z'); assert.ok(ny.forward); assert.deepEqual([ny.from, ny.to], [-300, -240]); assert.deepEqual([ny.before, ny.after], [[2, 0], [3, 0]]);
  const lon = nextChange('Europe/London', new Date(Date.UTC(2026, 5, 1)));
  assert.equal(lon.at.toISOString(), '2026-10-25T01:00:00.000Z'); assert.equal(lon.forward, false); assert.deepEqual([lon.before, lon.after], [[2, 0], [1, 0]]);
  assert.equal(nextChange('Asia/Tokyo', new Date(Date.UTC(2026, 0, 1))), null);
  const syd = nextChange('Australia/Sydney', new Date(Date.UTC(2026, 0, 1))); assert.equal(syd.at.toISOString(), '2026-04-04T16:00:00.000Z'); assert.equal(syd.forward, false);
});

test('a link place "City@Area/Zone" keeps its name and zone; no "@", an empty name or a zone the clock does not know gives none', () => {
  assert.deepEqual(placeAt('Kahului@Pacific/Honolulu'), { name: 'Kahului', tz: 'Pacific/Honolulu' }); assert.deepEqual(placeAt('Kolkata@Asia/Kolkata'), { name: 'Kolkata', tz: 'Asia/Kolkata' });
  for (const x of ['London', '@UTC', 'x@Mars/Olympus', 'x@<b>', 'x@', '']) assert.equal(placeAt(x), null, x);
  assert.equal(placeAt('a'.repeat(80) + '@UTC').name.length, 60);
});

test('a clock as a city another page can look up: its own name, the zone city for a short form or your own clock, none for an offset', () => {
  // the country of a zone, for the pages that open what is open in a country (/time/ -> /jobs/?cc=): every zone this engine knows has one, or is no one country's
  assert.equal(countryOf('Asia/Tokyo'), 'JP'); assert.equal(countryOf('Europe/London'), 'GB'); assert.equal(countryOf('America/Chicago'), 'US');
  assert.equal(countryOf('Asia/Calcutta'), 'IN', 'the older name a browser may still give'); assert.equal(countryOf('Europe/Kiev'), 'UA'); assert.equal(countryOf('America/Argentina/Buenos_Aires'), 'AR');
  for (const no of ['UTC', 'Etc/GMT+3', '', null, 'constructor', '__proto__', 'Mars/Olympus']) assert.equal(countryOf(no), '', String(no) + ' is no country');
  for (const z of Intl.supportedValuesOf('timeZone')) if (!/^(UTC|Etc\/|GMT)/.test(z)) assert.match(countryOf(z), /^[A-Z]{2}$/, z + ' has a country');
  assert.equal(cityName({ name: 'Kyoto', tz: 'Asia/Tokyo' }), 'Kyoto');
  assert.equal(cityName({ name: 'NYC', tz: 'America/New_York' }), 'New York');
  assert.equal(cityName({ name: 'Your time (Los Angeles)', tz: 'America/Los_Angeles', you: true }), 'Los Angeles');
  for (const p of [{ name: 'UTC+9', tz: 'Etc/GMT-9' }, { name: 'UTC', tz: 'UTC' }, null, {}]) assert.equal(cityName(p), '', JSON.stringify(p));
});
