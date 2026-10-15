// How skills/country.js reads a country ask: the field wanted and the country named. Run: node --test tools/country-parse.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countryOf, rowsOf, timeLine, offsetOf, CAPITAL_ZONES } from '../void-live-deploy/skills/country.js';

const read = (a) => { const q = countryOf(a); return q ? q.want + ' | ' + q.name : 'null'; };

test('country: the fields people ask for, and the country', () => {
  assert.equal(read('what currency does the uk use'), 'currencies | uk');
  assert.equal(read('what currency does japan use'), 'currencies | japan');
  assert.equal(read('what money do they use in japan'), 'currencies | japan');
  assert.equal(read('what do they speak in brazil'), 'languages | brazil');
  assert.equal(read('what continent is egypt in'), 'continent | egypt');
  assert.equal(read('which continent is peru on'), 'continent | peru');
  assert.equal(read('what countries border germany'), 'borders | germany');
  assert.equal(read('neighbouring countries of france'), 'borders | france');
  assert.equal(read('what is the calling code for france'), 'calling | france');
  assert.equal(read('country code for italy'), 'calling | italy');
  assert.equal(read('what side of the road do they drive on in japan'), 'drives | japan');
  assert.equal(read('do they drive on the left in australia'), 'drives | australia');
  assert.equal(read('capital of new zealand'), 'capital | new zealand');
});

test('country: not a country ask', () => {
  for (const a of ['population of the world', 'what currency does bitcoin use', 'what do they speak in the movie', 'country code for a phone number', 'what continent is the best'])
    assert.equal(read(a), 'null', a);
});

test('country: the card rows from a REST Countries record', () => {
  const r = rowsOf({ capital: ['Berlin'], population: 83000000, currencies: { EUR: { name: 'Euro', symbol: '€' } }, languages: { deu: 'German' }, area: 357114,
    continents: ['Europe'], idd: { root: '+4', suffixes: ['9'] }, car: { side: 'right' } }, ['France', 'Poland']);
  assert.equal(r.continent[1], 'Europe'); assert.equal(r.calling[1], '+49'); assert.equal(r.drives[1], 'on the right'); assert.equal(r.borders[1], 'France, Poland');
  assert.equal(rowsOf({ idd: { root: '+1', suffixes: ['201', '202'] } }, []).calling[1], '+1');
  assert.equal(rowsOf({}, []).borders[1], 'none (an island or no land borders)');
});

test('country: the time there now from the built-in zones, daylight saving included (no live source needed)', () => {
  const now = new Date('2026-10-15T05:32:00Z');
  assert.equal(timeLine('japan', [], -240, now), '2:32 PM Thu in Tokyo, UTC+09:00 (13 h ahead of you)');
  assert.equal(timeLine('india', ['UTC+05:30'], 0, now), '11:02 AM Thu in New Delhi, UTC+05:30 (5.5 h ahead of you)');
  assert.match(timeLine('united states', ['UTC-05:00', 'UTC-08:00'], 0, now), /^1:32 AM Thu in Washington, D\.C\., UTC−08:00 to UTC−05:00 \(2 zones\)$/);
  assert.equal(offsetOf('Europe/London', now), 60); assert.equal(offsetOf('Europe/London', new Date('2026-01-15T12:00:00Z')), 0);
  assert.equal(timeLine('atlantis', ['UTC+01:00'], 0, now), 'UTC+01:00 (1 h ahead of you)');
  assert.equal(rowsOf({ timezones: ['UTC+09:00'] }, [], -240, 'japan', now).time[1], '2:32 PM Thu in Tokyo, UTC+09:00 (13 h ahead of you)');
  for (const z of new Set(Object.values(CAPITAL_ZONES))) assert.notEqual(offsetOf(z, now), null, z);
});
