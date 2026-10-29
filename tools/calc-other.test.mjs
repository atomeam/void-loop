// tools/calc-other.test.mjs: the Other gaps tools/rival-inventory.mjs found on calculator.net's sitemap, filled on /calculators/ (docs/PARITY.md),
// each on known answers from published tables (the NWS wind-chill and heat-index charts), the calendar, or worked by hand, not from the code under test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { run, BY_ID, heatIndexF, toRoman, fromRoman, handicapIndex } from '../void-live-deploy/lib/calculators.js';

const near = (a, b, tol = 1e-9, what = '') => assert.ok(Math.abs(a - b) <= tol, what + ' ' + a + ' is not ' + b);
const go = (id, given = {}, units = {}) => { const r = run(id, given, units); assert.equal(r.error, '', id + ': ' + r.error); const o = {}; for (const x of r.outputs) o[x.k] = x.kind === 'text' ? x.si : x.value; return { o, r }; };
const bad = (id, given) => assert.notEqual(run(id, given, {}).error, '', id + ' should refuse ' + JSON.stringify(given));
export const IDS = ['wind-chill', 'heat-index', 'dew-point', 'day-of-week', 'roman-numerals', 'url-encode', 'download-time', 'sleep-cycles', 'gdp', 'horsepower',
  'engine-horsepower', 'golf-differential', 'handicap-index', 'time-card', 'dice-roller', 'adult-height', 'room-ac-btu'];

test('every Other gap-fill is there and works on its own defaults', () => { assert.equal(IDS.length, 17); for (const id of IDS) { assert.ok(BY_ID.get(id), id); go(id); } });

test('weather: the NWS charts (0 °F at 15 mph feels like −19; 90 °F at 70% feels like 106) and a Magnus dew point', () => {
  let { o } = go('wind-chill'); near(o.wc, -19.4, 0.05); assert.match(o.note, /within/);
  ({ o } = go('wind-chill', { T: '-20', V: '30' })); near(o.wc, -53, 0.5); // NWS chart: −53
  ({ o } = go('wind-chill', { T: '60', V: '20' })); near(o.wc, 60, 1e-9); assert.match(o.note, /outside/);
  ({ o } = go('heat-index')); near(o.hi, 106, 0.5); assert.match(o.risk, /^danger/);
  ({ o } = go('heat-index', { T: '100', RH: '50' })); near(o.hi, 118, 0.5); // NWS chart: 118
  ({ o } = go('heat-index', { T: '70', RH: '50' })); assert.ok(o.hi < 80); near(heatIndexF(80, 40), 80, 1);
  ({ o } = go('dew-point')); near(o.td, 16.7, 0.01); near(o.spread, 8.3, 0.01); // γ = ln 0.6 + 17.625·25/268.04 = 1.13305, Td = 243.04γ/(17.625 − γ)
  ({ o } = go('dew-point', { RH: '100' })); near(o.td, 25, 1e-9);
  bad('heat-index', { RH: '120' }); bad('dew-point', { RH: '0' });
});
test('calendar: 2026-10-28 is a Wednesday, day 301, ISO week 44; the ISO year edges', () => {
  let { o } = go('day-of-week'); assert.equal(o.wd, 'Wednesday'); assert.equal(o.doy, 301); assert.equal(o.iso, '2026-W44'); assert.equal(o.left, 64); assert.equal(o.leap, 'no');
  ({ o } = go('day-of-week', { d: '2027-01-01' })); assert.equal(o.wd, 'Friday'); assert.equal(o.iso, '2026-W53');
  ({ o } = go('day-of-week', { d: '2024-12-30' })); assert.equal(o.iso, '2025-W01'); assert.equal(o.doy, 365); assert.equal(o.leap, 'yes');
  ({ o } = go('day-of-week', { d: '2000-02-29' })); assert.equal(o.wd, 'Tuesday'); assert.equal(o.leap, 'yes');
});
test('Roman numerals both ways, and only the standard form', () => {
  assert.equal(toRoman(1994), 'MCMXCIV'); assert.equal(toRoman(3999), 'MMMCMXCIX'); assert.equal(toRoman(4), 'IV'); assert.equal(fromRoman('mmxxvi'), 2026);
  for (let n = 1; n <= 3999; n++) assert.equal(fromRoman(toRoman(n)), n);
  let { o } = go('roman-numerals'); assert.equal(o.out, 'MCMXCIV'); ({ o } = go('roman-numerals', { v: 'XLII' })); assert.equal(o.out, '42');
  bad('roman-numerals', { v: 'IIII' }); bad('roman-numerals', { v: '4000' }); bad('roman-numerals', { v: '0' });
});
test('URL encoding per RFC 3986, and decoding', () => {
  let { o } = go('url-encode'); assert.equal(o.out, 'a%20b%26c%3Dd%2F%C3%A9');
  ({ o } = go('url-encode', { s: "it's (ok)!", how: 'part' })); assert.equal(o.out, 'it%27s%20%28ok%29%21');
  ({ o } = go('url-encode', { s: 'https://x.org/a b?q=1&r=é', how: 'url' })); assert.equal(o.out, 'https://x.org/a%20b?q=1&r=%C3%A9');
  ({ o } = go('url-encode', { s: 'a%20b+c%C3%A9', how: 'dec' })); assert.equal(o.out, 'a b cé');
  bad('url-encode', { s: '%E0%A4%A', how: 'dec' });
});
test('download time: 1 GB at 100 Mbit/s is 80 s; 1 GiB is 85.9 s; overhead', () => {
  let { o } = go('download-time'); near(o.t, 80, 1e-9); assert.equal(o.text, '1 min 20 s'); near(o.per, 45, 1e-9);
  ({ o } = go('download-time', { su: '1073741824' })); near(o.t, 85.89934592, 1e-9);
  ({ o } = go('download-time', { size: '50', ovh: '20' })); near(o.t, 5000, 1e-9); assert.equal(o.text, '1 h 23 min 20 s');
  bad('download-time', { rate: '0' });
});
test('sleep cycles: up at 7:00 am means bed at 9:45 pm, 11:15 pm, 12:45 am or 2:15 am; in bed at 10:30 pm', () => {
  let { o } = go('sleep-cycles'); assert.deepEqual([o.six, o.five, o.four, o.three], ['9:45 pm', '11:15 pm', '12:45 am', '2:15 am']);
  ({ o } = go('sleep-cycles', { mode: 'bed', t: '22:30', fall: '0' })); assert.deepEqual([o.six, o.five, o.four, o.three], ['7:30 am', '6:00 am', '4:30 am', '3:00 am']);
  bad('sleep-cycles', { t: 'soon' });
});
test('GDP: C + I + G + X − M, and real GDP by the deflator', () => {
  let { o } = go('gdp'); assert.equal(o.gdp, 22800); assert.equal(o.nx, -700); assert.equal(o.real, 22800);
  ({ o } = go('gdp', { def: '120' })); near(o.real, 19000, 1e-9);
});
test('horsepower: 300 lb·ft at 5252 rpm is 300 hp (the 5252 rule rounds 33000/2π = 5252.11)', () => {
  let { o } = go('horsepower'); near(o.p, (300 * 5252) / (33000 / (2 * Math.PI)), 1e-9); near(o.p, 300, 0.01); near(o.kw, 223.705, 0.001);
  ({ o } = go('horsepower', { tq: '400', rpm: '3000' })); near(o.p, 228.48, 0.01);
});
test('quarter mile: 3000 lb in 12 s is about 343 hp, at 115 mph about 356 hp', () => {
  const { o } = go('engine-horsepower'); near(o.byet, 3000 / (12 / 5.825) ** 3, 1e-6); near(o.byet, 343.1, 0.1); near(o.bytrap, 3000 * (115 / 234) ** 3, 1e-6); near(o.bytrap, 356.1, 0.1);
  bad('engine-horsepower', { et: '0', v: '0' });
});
test('golf: 90 on a 72.0 / 130 course is a 15.6 differential; the index table', () => {
  let { o } = go('golf-differential'); assert.equal(o.diff, 15.6); assert.equal(o.ch, 17); // 15 × 130/113 = 17.26
  ({ o } = go('golf-differential', { pcc: '1' })); assert.equal(o.diff, 14.8);
  ({ o } = go('handicap-index')); assert.equal(o.index, 13.1); assert.equal(o.used, 'lowest 8 of 20'); // lowest 8: 11.8 12.1 12.5 12.9 13.2 13.5 14.0 14.4 → 13.05
  assert.deepEqual(handicapIndex([10, 12, 14]), { index: 8, used: 1, of: 3, adj: -2 });
  assert.equal(handicapIndex([10, 12, 14, 9, 20, 11]).index, 8.5); // lowest 2 of 6 is 9.5, minus 1.0
  assert.equal(handicapIndex([60, 60, 60, 60, 60]).index, 54);
  bad('handicap-index', { d: '10, 12' }); bad('golf-differential', { slope: '200' });
});
test('time card: 44 hours at $20 is $920 with 4 at time and a half', () => {
  let { o } = go('time-card'); assert.equal(o.total, 44); assert.equal(o.ot, 4); assert.equal(o.pay, 920);
  ({ o } = go('time-card', { h: '8, 8, 8, 8' })); assert.equal(o.ot, 0); assert.equal(o.pay, 640);
  bad('time-card', { h: '25' });
});
test('dice: totals stay in range, the average is n(s + 1)/2 + k, and the page marks it random', () => {
  assert.ok(BY_ID.get('dice-roller').random);
  for (let i = 0; i < 200; i++) { const { o } = go('dice-roller', { n: '3', sides: '6', k: '2' }); assert.ok(o.total >= 5 && o.total <= 20); assert.equal(o.rolls.split(', ').length, 3); assert.equal(o.avg, 12.5); }
  bad('dice-roller', { sides: '1' }); bad('dice-roller', { n: '1.5' });
});
test('adult height: a 180 cm father and 165 cm mother give a boy 179 cm (170.5 to 187.5) and a girl 166 cm', () => {
  let { o } = go('adult-height'); near(o.h, 179, 1e-9); near(o.lo, 170.5, 1e-9); near(o.hi, 187.5, 1e-9);
  ({ o } = go('adult-height', { sex: 'g' })); near(o.h, 166, 1e-9);
});
test('room air conditioner: the ENERGY STAR table and its adjustments', () => {
  let { o } = go('room-ac-btu'); assert.equal(o.btu, 9000); assert.equal(o.band, '350 to 400 ft²: 9,000 BTU/h'); near(o.w, 2.6376, 0.0001); // kW display
  ({ o } = go('room-ac-btu', { a: '401' })); assert.equal(o.btu, 10000);
  ({ o } = go('room-ac-btu', { a: '120', sun: '0.1', people: '4' })); assert.equal(o.btu, 6700); // 5,000 + 10% + 2 × 600
  ({ o } = go('room-ac-btu', { a: '200', sun: '-0.1', kit: '1' })); assert.equal(o.btu, 9400); // 6,000 − 10% + 4,000
  bad('room-ac-btu', { a: '50' }); bad('room-ac-btu', { a: '3000' });
});
