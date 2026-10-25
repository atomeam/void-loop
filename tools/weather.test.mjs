// lib/weather.js: the forecast read into a view on a fixture (no network), both scales agreeing, today first, the hours from the current
// hour, the US alerts, and the tower's weather probe passing on the page's own text
import test from 'node:test'; import assert from 'node:assert/strict';
import { viewOf, textOf, alertsOf, placeOf, locOf, both, dayName, hourName, radarLoop, alertsUrl } from '../void-live-deploy/lib/weather.js';
import { probeFor, score } from './tower-probes.mjs';

const hours = Array.from({ length: 48 }, (_, i) => '2026-10-25T' + String(i % 24).padStart(2, '0') + ':00').map((t, i) => (i < 24 ? t : t.replace('-25T', '-26T')));
const FIX = {
  current: { time: '2026-10-25T14:10', temperature_2m: 16.2, apparent_temperature: 14.9, relative_humidity_2m: 58, weather_code: 2, wind_speed_10m: 19.3, is_day: 1 },
  hourly: { time: hours, temperature_2m: hours.map((_, i) => 10 + (i % 12)), precipitation_probability: hours.map((_, i) => (i * 7) % 100), weather_code: hours.map((_, i) => (i % 3 ? 1 : 61)) },
  daily: { time: ['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31'], temperature_2m_max: [18, 17, 15, 14, 16, 19, 20], temperature_2m_min: [9, 8, 7, 6, 8, 10, 11],
    precipitation_probability_max: [20, 60, 80, 10, 0, 5, 30], weather_code: [2, 61, 63, 1, 0, 0, 2], sunrise: ['2026-10-25T07:08'], sunset: ['2026-10-25T17:48'] },
};
const LOC = locOf({ name: 'Boston', admin1: 'Massachusetts', country: 'United States', country_code: 'US', latitude: 42.3584, longitude: -71.0598 });

test('the place, the scales and the names', () => {
  assert.equal(placeOf('weather in Boston'), 'Boston'); assert.equal(placeOf('  Tokyo? '), 'Tokyo'); assert.equal(placeOf("what's the forecast for New York"), 'New York');
  assert.equal(both(16.2), '61 °F / 16 °C'); assert.equal(both(-3.6), '26 °F / -4 °C'); assert.equal(both(NaN), '');
  assert.equal(dayName('2026-10-25'), 'Sunday'); assert.equal(hourName('2026-10-25T14:00'), '2pm'); assert.equal(hourName('2026-10-25T00:00'), '12am');
  assert.equal(LOC.name, 'Boston, Massachusetts, United States'); assert.equal(LOC.us, true); assert.equal(locOf({ name: 'x' }), null);
  assert.equal(radarLoop('kbox'), 'https://radar.weather.gov/ridge/standard/KBOX_loop.gif'); assert.equal(alertsUrl(42.35841, -71.05983), 'https://api.weather.gov/alerts/active?point=42.3584,-71.0598');
});
test('the view: now, the next 24 hours from the current hour, 7 days with today first, sunrise and sunset', () => {
  const v = viewOf(FIX, LOC);
  assert.equal(v.place, 'Boston, Massachusetts, United States'); assert.equal(v.now.temp, 16.2); assert.equal(v.now.windMph, 12);
  assert.equal(v.hours.length, 24); assert.equal(v.hours[0].at, '2pm'); assert.equal(v.hours[23].at, '1pm'); // the current hour is 14:10, so 2pm is the first
  assert.equal(v.days.length, 7); assert.equal(v.days[0].name, 'Sunday'); assert.equal(v.days[0].today, true); assert.equal(v.days[1].name, 'Monday');
  assert.equal(v.sunrise, '7:08 am'); assert.equal(v.sunset, '5:48 pm');
  const t = textOf(v);
  for (const m of t.matchAll(/(-?\d+) °F \/ (-?\d+) °C/g)) assert.ok(Math.abs(+m[1] - (+m[2] * 9 / 5 + 32)) <= 1.5, m[0]); // the two scales agree everywhere
  assert.match(t, /Sunday \(today\) 64 °F \/ 18 °C high, 48 °F \/ 9 °C low, 20% chance of rain, Partly cloudy/);
  assert.equal(viewOf({}, null).hours.length, 0, 'no forecast: an empty view, never a throw');
});
test('alerts from the weather service, and none', () => {
  const a = alertsOf({ features: [{ properties: { event: 'Wind Advisory', headline: 'Wind Advisory until 6 PM EDT', severity: 'Moderate', ends: '2026-10-25T22:00:00-04:00' } }] });
  assert.deepEqual(a, [{ event: 'Wind Advisory', headline: 'Wind Advisory until 6 PM EDT', severity: 'Moderate', until: '2026-10-25T22:00:00-04:00' }]);
  assert.deepEqual(alertsOf(null), []);
});
test("the tower's weather probe passes on the page's own text for Boston", () => {
  const p = probeFor('weather'); assert.ok(p && p.truth.length >= 4);
  // the fixture's first day is a Sunday; the probe wants today in Boston's zone first, so the page text is dated today for the check
  const today = new Intl.DateTimeFormat('en-US', { weekday: 'long', timeZone: 'America/New_York' }).format(new Date()), stale = today === 'Monday' ? 'Tuesday' : 'Monday';
  const page = (textOf(viewOf(FIX, LOC)) + '\nAlerts\nNo alerts in force.\nRadar\nRadar loop from KBOX\nCopy link · Share').replace('Sunday (today)', today + ' (today)');
  const s = score(page, p.truth); assert.deepEqual(s.missing, [], 'truth: ' + s.missing.join(', '));
  for (const [a, items] of Object.entries(p.askParts)) { const r = score(page, items); assert.equal(r.n, r.of, a + ': ' + r.missing.join(', ')); }
  assert.equal(score(page.replace(today + ' (today)', stale + ' (today)'), p.truth).has.includes('today first in the days ahead'), false, 'a stale forecast is wrong');
  assert.equal(score(page.replace('61 °F / 16 °C', '70 °F / 16 °C'), p.truth).has.includes('a temperature in °F and °C that agree'), false, 'one pair that disagrees is wrong');
  assert.equal(score('Boston\nNow: 70 °F / 16 °C', p.truth).has.includes('a temperature in °F and °C that agree'), false);
});
