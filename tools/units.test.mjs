// lib/units.js: exact unit conversion from SI definitions (fractions, never floating noise), every unit of a kind at once, asks read in words
import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, unitOf, parseNum, fmt, convert, convertAll, parseAsk, unitsNamed } from '../void-live-deploy/lib/units.js';

const say = (ask) => { const a = parseAsk(ask); assert.ok(a && a.to, ask); return fmt(convert(a.value, a.from, a.to)) + ' ' + a.to.sym; };

test('the kinds a converter needs, each with its units and no two units of a kind sharing an id', () => {
  for (const k of ['length', 'mass', 'temperature', 'volume', 'area', 'speed', 'time', 'data', 'pressure', 'energy', 'power']) assert.ok(KINDS[k] && KINDS[k].units.length >= 5, k);
  for (const [k, v] of Object.entries(KINDS)) assert.equal(new Set(v.units.map((u) => u.id)).size, v.units.length, k);
});
test('numbers as people type them, exactly', () => {
  assert.deepEqual(parseNum('0.1'), { n: 1n, d: 10n }); assert.deepEqual(parseNum('1,234.5'), { n: 2469n, d: 2n }); assert.deepEqual(parseNum('1 1/2'), { n: 3n, d: 2n });
  assert.deepEqual(parseNum('-3/8'), { n: -3n, d: 8n }); assert.deepEqual(parseNum('1.5e-3'), { n: 3n, d: 2000n }); assert.deepEqual(parseNum('.5'), { n: 1n, d: 2n });
  for (const no of ['', 'abc', '1/0', '-', 'e5', '1.2.3']) assert.equal(parseNum(no), null, no);
});
test('12 significant digits, trailing zeros trimmed, no floating noise', () => {
  assert.equal(fmt(parseNum('0.30000000000000004')), '0.3'); assert.equal(fmt(parseNum('212.000')), '212'); assert.equal(fmt(parseNum('-0.000001234')), '-0.000001234');
  assert.equal(fmt(parseNum('2/3')), '0.666666666667'); assert.equal(fmt(parseNum('999999999999.5')), '1000000000000'); assert.equal(fmt(parseNum('1.5e20')), '1.5e+20');
  assert.equal(fmt(parseNum('0')), '0');
});
test('exact definitions: an inch is 0.0254 m, a pound 0.45359237 kg, a US gallon 231 cubic inches', () => {
  assert.equal(say('1 in to m'), '0.0254 m'); assert.equal(say('1 lb to kg'), '0.45359237 kg'); assert.equal(say('1 gal to l'), '3.785411784 L');
  assert.equal(say('1 mi to ft'), '5280 ft'); assert.equal(say('1 acre to m2'), '4046.8564224 m²'); assert.equal(say('1 psi to pa'), '6894.75729317 Pa');
  assert.equal(say('1 hp to w'), '745.699871582 W'); assert.equal(say('1 kwh to j'), '3600000 J'); assert.equal(say('1 mib to kb'), '1048.576 kB');
  assert.equal(say('60 mph to km/h'), '96.56064 km/h'); assert.equal(say('1 day to s'), '86400 s'); assert.equal(say('1 atm to torr'), '760 Torr');
  // a round trip lands where it started, exactly, for every pair of units of every kind
  for (const [k, v] of Object.entries(KINDS)) for (const a of v.units) for (const b of v.units) { const x = parseNum('12.5'); assert.deepEqual(convert(convert(x, a, b), b, a), x, k + ' ' + a.id + ' ' + b.id); }
});
test('temperature is affine, both ways', () => {
  assert.equal(say('100 c to f'), '212 °F'); assert.equal(say('-40 f to c'), '-40 °C'); assert.equal(say('0 K to C'), '-273.15 °C');
  assert.equal(say('72 °F in celsius'), '22.2222222222 °C'); assert.equal(say('0 c to rankine'), '491.67 °R'); assert.equal(say('80 reaumur to c'), '100 °C');
});
test('every unit of a kind at once', () => {
  const all = convertAll('temperature', parseNum('100'), unitOf('temperature', 'C'));
  assert.deepEqual(all.map((r) => r.unit.id + ' ' + fmt(r.value)), ['C 100', 'F 212', 'K 373.15', 'R 671.67', 'Re 80']);
});
test('asks in words: either order of separator, one unit alone, how many in, and words that mean different things', () => {
  assert.equal(say('5 km in miles'), '3.10685596119 mi'); assert.equal(say('convert 3.5 lb to kg'), '1.587573295 kg'); assert.equal(say('how many feet in a mile?'), '5280 ft');
  assert.equal(say('1 1/2 cups to ml'), '354.88235475 mL'); assert.equal(say('500 ms to s'), '0.5 s'); assert.equal(say('100c to f'), '212 °F'); assert.equal(say('3 tbsp = tsp'), '9 tsp');
  const one = parseAsk('250 ml'); assert.equal(one.kind, 'volume'); assert.equal(one.to, null); assert.equal(one.text, '250');
  assert.equal(parseAsk('kg to lb').text, '1');
  assert.equal(unitsNamed('B')[0].unit.name, 'byte'); assert.equal(unitsNamed('b')[0].unit.name, 'bit'); assert.equal(unitsNamed('Mb')[0].unit.name, 'megabit'); assert.equal(unitsNamed('mb')[0].unit.name, 'megabyte');
  assert.equal(unitsNamed('c')[0].kind, 'temperature'); assert.equal(say('1 c to m/s'), '299792458 m/s', 'c beside a speed is the speed of light');
  for (const no of ['hello', '5 km to kg', '']) assert.equal(parseAsk(no), null, no);
});
