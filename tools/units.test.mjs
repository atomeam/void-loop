// lib/units.js: exact unit conversion from SI definitions (fractions, never floating noise), every unit of a kind at once, asks read in words
import test from 'node:test';
import assert from 'node:assert/strict';
import { KINDS, GROUPS, kindsInOrder, unitOf, parseNum, fmt, convert, convertAll, parseAsk, unitsNamed, formulaOf } from '../void-live-deploy/lib/units.js';

const say = (ask, sig) => { const a = parseAsk(ask); assert.ok(a && a.to, ask); return fmt(convert(a.value, a.from, a.to), sig) + ' ' + a.to.sym; };

test('the kinds a converter needs (unitconverters.net\'s common and engineering groups), each with its units and no two units of a kind sharing an id', () => {
  for (const k of ['length', 'mass', 'temperature', 'volume', 'area', 'speed', 'time', 'data', 'pressure', 'energy', 'power', 'force', 'angle', 'frequency', 'fuel', 'heat', 'fluids', 'light', 'electricity', 'magnetism', 'radiology', 'radioactivity']) assert.ok(KINDS[k] && KINDS[k].units.length >= 5, k);
  for (const [k, v] of Object.entries(KINDS)) assert.equal(new Set(v.units.map((u) => u.id)).size, v.units.length, k);
  const order = kindsInOrder().map(([id, k]) => k.group); assert.equal(order.indexOf('engineering'), order.lastIndexOf('common') + 1, 'common kinds first, then engineering');
  assert.match(GROUPS.engineering, /heat.*fluids.*light.*electricity.*magnetism.*radiology/);
  for (const [, k] of Object.entries(KINDS)) for (const u of k.units) assert.ok(u.f.n > 0n && u.f.d > 0n, u.id + ' has a positive exact factor');
});
test('the engineering kinds and the new common ones: known values from the definitions', () => {
  assert.equal(say('1 lbf to N'), '4.44822161526 N'); assert.equal(say('1 kgf to N'), '9.80665 N'); assert.equal(say('1 kip to lbf'), '1000 lbf');
  assert.equal(say('180 deg to rad'), '3.14159265359 rad'); assert.equal(say('1 turn to deg'), '360 °'); assert.equal(say('1 deg to arcsec'), '3600 ″'); assert.equal(say('400 gon to turn'), '1 turn');
  assert.equal(say('60 rpm to Hz'), '1 Hz'); assert.equal(say('1 GHz to kHz'), '1000000 kHz'); assert.equal(say('1 rad/s to rpm'), '9.54929658551 rpm');
  assert.equal(say('1 mpg to km/l'), '0.42514370743 km/L'); assert.equal(say('30 mpg to l/100km'), '7.84048611111 L/100km'); assert.equal(say('5 l/100km to km/l'), '20 km/L'); assert.equal(say('1 mpg (uk) to mpg'), '0.832674184629 mpg (US)', 'an imperial gallon is bigger, so a UK mpg is fewer US mpg');
  assert.equal(say('1 btu/h/ft/f to w/mk'), '1.73073466637 W/(m·K)'); assert.equal(say('1 cal/s/cm/c to w/mk'), '418.4 W/(m·K)');
  assert.equal(say('1 gpm to l/min'), '3.785411784 L/min'); assert.equal(say('1 cfm to m3/h'), '1.69901079552 m³/h'); assert.equal(say('1 m3/s to l/s'), '1000 L/s');
  assert.equal(say('1 fc to lx'), '10.7639104167 lx'); assert.equal(say('1 phot to lux'), '10000 lx');
  assert.equal(say('1 Ah to C'), '3600 C'); assert.equal(say('1000 mah to ah'), '1 Ah'); assert.equal(say('1 statc to c'), '3.33564095198e-10 C');
  assert.equal(say('1 T to G'), '10000 G'); assert.equal(say('1 gamma to nT'), '1 nT');
  assert.equal(say('1 Gy to rd'), '100 rd'); assert.equal(say('1 rem to Sv'), '0.01 Sv'); assert.equal(say('1 Ci to Bq'), '37000000000 Bq'); assert.equal(say('1 dpm to Bq'), '0.0166666666667 Bq');
  assert.equal(convert(parseNum('0'), unitOf('fuel', 'kml'), unitOf('fuel', 'l100')), null, '0 km/L through a reciprocal has no value');
  // old words keep their old meaning beside the new units: kn is the knot, c the Celsius degree, g the gram, t the tonne, mil the thou
  assert.equal(unitsNamed('kn')[0].unit.name, 'knot'); assert.equal(unitsNamed('kN')[0].unit.name, 'kilonewton'); assert.equal(unitsNamed('G')[0].unit.name, 'gauss'); assert.equal(unitsNamed('g')[0].unit.name, 'gram');
  assert.equal(unitsNamed('T')[0].unit.name, 'tesla'); assert.equal(unitsNamed('t')[0].unit.name, 'tonne'); assert.equal(unitsNamed('mil')[0].kind, 'length'); assert.equal(unitsNamed('rad')[0].kind, 'angle'); assert.equal(say('1 c to f'), '33.8 °F');
});
test('the formula line a person can check, and the precision choice', () => {
  const u = (k, id) => unitOf(k, id);
  assert.equal(formulaOf(u('temperature', 'C'), u('temperature', 'F')), '°F = °C × 9/5 + 32'); assert.equal(formulaOf(u('temperature', 'F'), u('temperature', 'C')), '°C = (°F − 32) × 5/9');
  assert.equal(formulaOf(u('temperature', 'C'), u('temperature', 'K')), 'K = °C + 273.15'); assert.equal(formulaOf(u('temperature', 'K'), u('temperature', 'C')), '°C = K − 273.15');
  assert.equal(formulaOf(u('length', 'mi'), u('length', 'm')), 'm = mi × 1609.344'); assert.equal(formulaOf(u('data', 'GiB'), u('data', 'B')), 'B = GiB × 1073741824'); assert.equal(formulaOf(u('volume', 'gal'), u('volume', 'l')), 'L = gal × 3.785411784');
  assert.equal(formulaOf(u('fuel', 'kml'), u('fuel', 'l100')), 'L/100km = 100 ÷ km/L'); assert.equal(formulaOf(u('fuel', 'l100'), u('fuel', 'kml')), 'km/L = 100 ÷ L/100km'); assert.equal(formulaOf(u('fuel', 'mpg'), u('fuel', 'l100')), 'L/100km = 235.214583333 ÷ mpg (US)');
  assert.equal(formulaOf(u('length', 'm'), u('length', 'm')), ''); assert.equal(formulaOf(u('length', 'ft'), u('length', 'in'), 4), 'in = ft × 12');
  assert.equal(say('1 psi to pa', 6), '6894.76 Pa'); assert.equal(say('1 psi to pa', 15), '6894.75729316836 Pa'); assert.equal(say('2 c to f', 3), '35.6 °F');
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
  assert.equal(say('1 in to m'), '0.0254 m'); assert.equal(say('1 lb to kg'), '0.45359237 kg'); assert.equal(say('1 gal to l'), '3.785411784 L'); assert.equal(say('1 mile to m'), '1609.344 m');
  assert.equal(say('1 mi to ft'), '5280 ft'); assert.equal(say('1 acre to m2'), '4046.8564224 m²'); assert.equal(say('1 psi to pa'), '6894.75729317 Pa'); assert.equal(say('1 psi to pa', 13), '6894.757293168 Pa');
  assert.equal(say('1 hp to w'), '745.699871582 W'); assert.equal(say('1 hp to w', 14), '745.69987158227 W'); assert.equal(say('1 kwh to j'), '3600000 J'); assert.equal(say('1 mib to kb'), '1048.576 kB'); assert.equal(say('1 GiB to B'), '1073741824 B');
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
test('the rest of unitconverters.net: mechanics, electricity, more heat, fluids, light, magnetism and radiology, the other converters, and more units per kind', () => {
  for (const k of ['acceleration', 'angvel', 'density', 'specvol', 'torque', 'inertia', 'current', 'voltage', 'resistance', 'resistivity', 'conductance', 'conductivity', 'capacitance', 'inductance', 'efield',
    'specheat', 'heatflux', 'htc', 'massflow', 'dynvisc', 'kinvisc', 'molar', 'luminance', 'magfield', 'magflux', 'mmf', 'exposure', 'prefix', 'datarate', 'typography']) assert.ok(KINDS[k] && KINDS[k].units.length >= 5, k);
  assert.equal(say('1 g-force to m/s2'), '9.80665 m/s²'); assert.equal(say('1 Nm to lbf ft'), '0.737562149277 lbf·ft'); assert.equal(say('1 g/cm3 to lb/ft3'), '62.4279605761 lb/ft³');
  assert.equal(say('10 A to mA'), '10000 mA'); assert.equal(say('4.7 kohm to ohm'), '4700 Ω'); assert.equal(say('100 uF to nF'), '100000 nF'); assert.equal(say('1 statV to V'), '299.792458 V');
  assert.equal(say('1 Oe to A/m'), '79.5774715459 A/m'); assert.equal(say('1 Wb to Mx'), '100000000 Mx'); assert.equal(say('1 R to C/kg'), '0.000258 C/kg');
  assert.equal(say('1 BTU/lb/f to J/kg/k'), '4186.8 J/(kg·K)'); assert.equal(say('1 cP to Pa s'), '0.001 Pa·s'); assert.equal(say('1 St to cSt'), '100 cSt'); assert.equal(say('1 kg/s to kg/h'), '3600 kg/h');
  assert.equal(say('12 pt to px'), '16 px'); assert.equal(say('100 mbps to MB/s'), '12.5 MB/s'); assert.equal(say('1 kilo to milli'), '1000000 ×10⁻³');
  assert.equal(say('1 acre-foot to m3'), '1233.48183755 m³'); assert.equal(say('1 fortnight to d'), '14 d'); assert.equal(say('1 ksi to MPa'), '6.89475729317 MPa'); assert.equal(say('1 parsec to ly'), '3.26156377717 ly');
  assert.equal(say('1 ton of refrigeration to BTU/h'), '12000 BTU/h'); assert.equal(say('1 angstrom to nm'), '0.1 nm'); assert.equal(say('1 slug to lb'), '32.1740485564 lb');
  // the words that mean something else stay theirs: 1 c to f is a temperature, Gb a gigabit, R the Rankine degree, b the bit
  assert.equal(say('1 c to f'), '33.8 °F'); assert.equal(unitsNamed('Gb')[0].unit.name, 'gigabit'); assert.equal(unitsNamed('R')[0].kind, 'temperature'); assert.equal(unitsNamed('b')[0].unit.name, 'bit');
  const order = kindsInOrder().map(([, k]) => k.group); assert.ok(order.lastIndexOf('engineering') < order.indexOf('other'), 'other converters last');
});
