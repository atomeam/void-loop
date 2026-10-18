// The coral heat card's 48-hour projected dose (lib/heat-dose.js, asked by Verse): NOAA's HotSpot and degree-heating-week
// maths on Open-Meteo's marine and UV forecasts. Run: node --test tools/heat-dose.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doseForecast, doseLines, THRESHOLD_C, MMM_C, MARINE_URL, WX_URL } from '../void-live-deploy/lib/heat-dose.js';

const hours = (n) => Array.from({ length: n }, (_, i) => '2026-08-01T' + String(i % 24).padStart(2, '0') + ':00');
test('heat-dose: hours over the threshold, the mean HotSpot and the degree heating weeks they add', () => {
  const sst = Array(48).fill(29.0).map((t, i) => (i >= 12 && i < 36 ? 31.0 : t)); // a day at 31 °C, a day at 29
  const d = doseForecast({ hourly: { time: hours(48), sea_surface_temperature: sst } }, { hourly: { time: hours(48), uv_index: Array(48).fill(0).map((_, i) => (i % 24 === 13 ? 9 : 3)), temperature_2m: Array(48).fill(31) } });
  assert.equal(d.hours, 48); assert.equal(d.hot, 24); assert.equal(d.over, 0.5); assert.equal(d.sstMin, 29); assert.equal(d.sstMax, 31);
  assert.equal(d.dhwAdd, 0.21); // 24 hours at 1.5 °C over the MMM: 36 °C-hours / 168 = 0.21 weeks
  assert.equal(d.uvPeak, 9); assert.equal(d.uvHours, 24 * 3 * 2 - 6 + 18); assert.equal(d.airMax, 31);
  assert.equal(THRESHOLD_C, MMM_C + 1);
  const L = doseLines(d);
  assert.match(L[0], /48 hours/); assert.match(L[1], /24 of 48 hours at or above/); assert.match(L[2], /UV peaks at 9 \(very high\)/); assert.match(L[3], /adds about 0\.21 degree heating weeks/); assert.match(L[3], /strong light/);
});
test('heat-dose: a cool window adds nothing, a missing forecast is said, nothing at all is null', () => {
  const cool = doseForecast({ hourly: { time: hours(24), sea_surface_temperature: Array(24).fill(28.2) } }, null);
  assert.equal(cool.hot, 0); assert.equal(cool.dhwAdd, 0); assert.equal(cool.uvPeak, null);
  assert.match(doseLines(cool)[3], /rest/); assert.match(doseLines(cool)[2], /No UV forecast/);
  const warm = doseForecast({ hourly: { time: hours(24), sea_surface_temperature: Array(24).fill(30.2) } }, null); // over MMM, under 1 °C over: no DHW
  assert.equal(warm.hot, 0); assert.equal(warm.dhwAdd, 0);
  const light = doseForecast(null, { hourly: { time: hours(24), uv_index: Array(24).fill(5), temperature_2m: Array(24).fill(30) } });
  assert.equal(light.sstMax, null); assert.match(doseLines(light)[1], /No water forecast/); assert.match(doseLines(light)[3], /light half/);
  assert.equal(doseForecast(null, null), null); assert.deepEqual(doseLines(null), []);
  assert.equal(doseForecast({ hourly: { sea_surface_temperature: [null, 'x'] } }, {}), null);
  assert.match(MARINE_URL, /marine-api\.open-meteo\.com.*sea_surface_temperature.*forecast_days=2/); assert.match(WX_URL, /uv_index,temperature_2m/);
});
