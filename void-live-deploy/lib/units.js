/**
 * units: a unit converter that is exact (the tower's unitconverters.net floor, page /convert/). Every unit is defined by its exact SI
 * definition as a fraction (an inch is 0.0254 m exactly, a pound 0.45359237 kg, a US gallon 231 cubic inches), values are kept as BigInt
 * fractions, and only the shown number is rounded, to 12 significant digits with trailing zeros trimmed, so 0.1 + 0.2 noise never shows.
 * Temperature is affine: kelvin = (value + offset) x factor. Fuel consumption in L/100km is the reciprocal of km/L (inv). A unit converts
 * to every other unit of its kind at once; formulaOf writes how. The kinds are unitconverters.net's: its common converters and its engineering
 * groups (heat, fluids, light, electricity, magnetism, radiology), each from exact definitions. Pure. Tests: tools/units.test.mjs.
 */

// --- exact fractions: { n, d } as BigInt, d > 0, in lowest terms
const gcd = (a, b) => { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n; };
const R = (n, d = 1n) => { if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
const add = (a, b) => R(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a, b) => R(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a, b) => R(a.n * b.n, a.d * b.d);
const div = (a, b) => R(a.n * b.d, a.d * b.n);
const TEN = (k) => 10n ** BigInt(k);

/** a number as people type it, as an exact fraction, or null: "100", "-40", "1,234.5", "1.5e-3", ".5", "3/8", "1 1/2". Pure. */
export function parseNum(text) {
  const t = String(text ?? '').trim().replace(/[−–]/g, '-').replace(/(\d)[,_\s](?=\d{3}(?!\d))/g, '$1');
  let m = /^([-+])?(\d+)\s+(\d+)\/(\d+)$/.exec(t); // a mixed number: 1 1/2
  if (m) { if (/^0+$/.test(m[4])) return null; const w = R(BigInt(m[2])), f = R(BigInt(m[3]), BigInt(m[4])), v = add(w, f); return m[1] === '-' ? R(-v.n, v.d) : v; }
  m = /^([-+]?\d+)\/(\d+)$/.exec(t);
  if (m) return /^0+$/.test(m[2]) ? null : R(BigInt(m[1]), BigInt(m[2]));
  m = /^([-+])?(\d*)(?:\.(\d*))?(?:e([-+]?\d{1,4}))?$/i.exec(t);
  if (!m || !(m[2] || m[3])) return null;
  const frac = m[3] || '', e = Number(m[4] || 0) - frac.length; let n = BigInt((m[2] || '0') + frac);
  if (m[1] === '-') n = -n;
  return e >= 0 ? R(n * TEN(e)) : R(n, TEN(-e));
}
const q = (s) => parseNum(s); // a definition written as a decimal

/** an exact fraction as a plain number, rounded to `sig` significant digits (half away from zero), trailing zeros trimmed; very large or
 * very small values as 1.23456789012e-25. "0" for zero. Pure. */
export function fmt(v, sig = 12) {
  if (!v || typeof v.n !== 'bigint') return '';
  if (v.n === 0n) return '0';
  const neg = v.n < 0n, n = neg ? -v.n : v.n, d = v.d;
  let e = n.toString().length - d.toString().length; // first guess at floor(log10(n/d))
  const atLeast = (k) => (k >= 0 ? n >= d * TEN(k) : n * TEN(-k) >= d);
  while (!atLeast(e)) e--; while (atLeast(e + 1)) e++;
  const s = sig - 1 - e, num = s >= 0 ? n * TEN(s) : n, den = s >= 0 ? d : d * TEN(-s);
  let k = (2n * num + den) / (2n * den);
  if (k >= TEN(sig)) { k /= 10n; e++; }
  const digits = k.toString().padStart(sig, '0');
  let out;
  if (e >= 15 || e < -6) {
    const m = (digits[0] + '.' + digits.slice(1)).replace(/\.?0+$/, '');
    out = m + 'e' + (e < 0 ? '-' : '+') + Math.abs(e);
  } else if (e >= 0) {
    const whole = e + 1 >= sig ? digits + '0'.repeat(e + 1 - sig) : digits.slice(0, e + 1), frac = e + 1 >= sig ? '' : digits.slice(e + 1).replace(/0+$/, '');
    out = whole + (frac ? '.' + frac : '');
  } else out = ('0.' + '0'.repeat(-e - 1) + digits).replace(/0+$/, '');
  return (neg ? '-' : '') + out;
}

// --- the units: [id, name, symbol, factor to the kind's base unit (exact), words that name it, offset (temperature only)]
const IN = q('0.0254'), FT = q('0.3048'), YD = q('0.9144'), MI = q('1609.344'), LB = q('0.45359237'), G0 = q('9.80665');
const LBF = mul(LB, G0), USGAL = mul(q('231'), mul(IN, mul(IN, IN))), IMPGAL = q('0.00454609'), FLOZ = div(USGAL, q('128')), BTU = q('1055.05585262');
const PI = q('3.141592653589793238462643383279502884197'); // pi to 40 digits: an angle shown to 15 digits never sees the difference
const INV = Symbol('inverse'); // a unit that is the reciprocal of its kind's base (L/100km against km/L): base = factor / value
const sq = (x) => mul(x, x), cube = (x) => mul(x, mul(x, x)), x = (a, k) => mul(a, typeof k === 'string' ? q(k) : k), per = (a, k) => div(a, typeof k === 'string' ? q(k) : k);
const pl = (...w) => w.flatMap((s) => (s.endsWith('s') || s.includes(' per ') ? [s] : [s, s.endsWith('inch') ? s + 'es' : s + 's'])); // a word and its plural

export const KINDS = Object.freeze({
  length: { label: 'Length', units: [
    ['m', 'metre', 'm', q('1'), ['m', ...pl('meter', 'metre')]],
    ['km', 'kilometre', 'km', q('1000'), ['km', 'kms', ...pl('kilometer', 'kilometre')]],
    ['cm', 'centimetre', 'cm', q('0.01'), ['cm', ...pl('centimeter', 'centimetre')]],
    ['mm', 'millimetre', 'mm', q('0.001'), ['mm', ...pl('millimeter', 'millimetre')]],
    ['um', 'micrometre', 'µm', q('1e-6'), ['µm', 'um', 'μm', ...pl('micrometer', 'micrometre', 'micron')]],
    ['nm', 'nanometre', 'nm', q('1e-9'), ['nm', ...pl('nanometer', 'nanometre')]],
    ['in', 'inch', 'in', IN, ['in', '"', ...pl('inch')]],
    ['ft', 'foot', 'ft', FT, ['ft', "'", 'foot', 'feet']],
    ['yd', 'yard', 'yd', YD, ['yd', 'yds', ...pl('yard')]],
    ['mi', 'mile', 'mi', MI, ['mi', ...pl('mile')]],
    ['nmi', 'nautical mile', 'nmi', q('1852'), ['nmi', 'NM', ...pl('nautical mile')]],
    ['mil', 'mil (thou)', 'mil', x(IN, '0.001'), ['mil', 'mils', 'thou']],
    ['fur', 'furlong', 'fur', x(YD, '220'), ['fur', ...pl('furlong')]],
    ['au', 'astronomical unit', 'au', q('149597870700'), ['au', 'AU', ...pl('astronomical unit')]],
    ['ly', 'light-year', 'ly', q('9460730472580800'), ['ly', ...pl('light-year', 'light year', 'lightyear')]],
  ] },
  mass: { label: 'Weight and mass', units: [
    ['kg', 'kilogram', 'kg', q('1'), ['kg', 'kgs', 'kilo', 'kilos', ...pl('kilogram', 'kilogramme')]],
    ['g', 'gram', 'g', q('0.001'), ['g', 'gm', ...pl('gram', 'gramme')]],
    ['mg', 'milligram', 'mg', q('1e-6'), ['mg', ...pl('milligram')]],
    ['ug', 'microgram', 'µg', q('1e-9'), ['µg', 'ug', 'μg', 'mcg', ...pl('microgram')]],
    ['t', 'tonne', 't', q('1000'), ['t', ...pl('tonne', 'metric ton')]],
    ['lb', 'pound', 'lb', LB, ['lb', 'lbs', ...pl('pound')]],
    ['oz', 'ounce', 'oz', per(LB, '16'), ['oz', ...pl('ounce')]],
    ['st', 'stone', 'st', x(LB, '14'), ['st', 'stone', 'stones']],
    ['ton', 'short ton (US)', 'ton', x(LB, '2000'), [...pl('ton', 'short ton', 'us ton')]],
    ['lton', 'long ton (UK)', 'long ton', x(LB, '2240'), [...pl('long ton', 'imperial ton', 'uk ton')]],
    ['ct', 'carat', 'ct', q('0.0002'), ['ct', ...pl('carat')]],
    ['gr', 'grain', 'gr', per(LB, '7000'), ['gr', ...pl('grain')]],
    ['ozt', 'troy ounce', 'oz t', x(per(LB, '7000'), '480'), ['ozt', 'oz t', 'troy oz', ...pl('troy ounce')]],
  ] },
  temperature: { label: 'Temperature', units: [
    ['C', 'Celsius', '°C', q('1'), ['c', 'celsius', 'centigrade', 'degc'], q('273.15')],
    ['F', 'Fahrenheit', '°F', div(q('5'), q('9')), ['f', 'fahrenheit', 'degf'], q('459.67')],
    ['K', 'kelvin', 'K', q('1'), ['k', ...pl('kelvin')], q('0')],
    ['R', 'Rankine', '°R', div(q('5'), q('9')), ['r', 'ra', 'rankine'], q('0')],
    ['Re', 'Réaumur', '°Ré', div(q('5'), q('4')), ['re', 'ré', 'reaumur', 'réaumur'], q('218.52')],
  ] },
  volume: { label: 'Volume', units: [
    ['l', 'litre', 'L', q('0.001'), ['l', 'L', 'ltr', ...pl('liter', 'litre')]],
    ['ml', 'millilitre', 'mL', q('1e-6'), ['ml', 'mL', 'cc', 'cm3', 'cm³', ...pl('milliliter', 'millilitre')]],
    ['m3', 'cubic metre', 'm³', q('1'), ['m3', 'm³', 'cu m', ...pl('cubic meter', 'cubic metre')]],
    ['gal', 'US gallon', 'gal', USGAL, ['gal', 'gals', ...pl('gallon', 'us gallon'), 'us gal']],
    ['qt', 'US quart', 'qt', per(USGAL, '4'), ['qt', 'qts', ...pl('quart')]],
    ['pt', 'US pint', 'pt', per(USGAL, '8'), ['pt', 'pts', ...pl('pint')]],
    ['cup', 'US cup', 'cup', per(USGAL, '16'), [...pl('cup')]],
    ['floz', 'US fluid ounce', 'fl oz', FLOZ, ['fl oz', 'floz', 'fl. oz', ...pl('fluid ounce')]],
    ['tbsp', 'tablespoon', 'tbsp', per(FLOZ, '2'), ['tbsp', 'tbs', ...pl('tablespoon')]],
    ['tsp', 'teaspoon', 'tsp', per(FLOZ, '6'), ['tsp', ...pl('teaspoon')]],
    ['igal', 'imperial gallon', 'imp gal', IMPGAL, ['imp gal', ...pl('imperial gallon', 'uk gallon')]],
    ['ipt', 'imperial pint', 'imp pt', per(IMPGAL, '8'), ['imp pt', ...pl('imperial pint', 'uk pint')]],
    ['ifloz', 'imperial fluid ounce', 'imp fl oz', per(IMPGAL, '160'), ['imp fl oz', 'uk fl oz', ...pl('imperial fluid ounce')]],
    ['ft3', 'cubic foot', 'ft³', cube(FT), ['ft3', 'ft³', 'cu ft', 'cubic foot', 'cubic feet']],
    ['in3', 'cubic inch', 'in³', cube(IN), ['in3', 'in³', 'cu in', ...pl('cubic inch')]],
    ['bbl', 'oil barrel', 'bbl', x(USGAL, '42'), ['bbl', ...pl('barrel', 'oil barrel')]],
  ] },
  area: { label: 'Area', units: [
    ['m2', 'square metre', 'm²', q('1'), ['m2', 'm²', 'sq m', 'sqm', ...pl('square meter', 'square metre')]],
    ['km2', 'square kilometre', 'km²', q('1e6'), ['km2', 'km²', 'sq km', ...pl('square kilometer', 'square kilometre')]],
    ['cm2', 'square centimetre', 'cm²', q('1e-4'), ['cm2', 'cm²', 'sq cm', ...pl('square centimeter', 'square centimetre')]],
    ['mm2', 'square millimetre', 'mm²', q('1e-6'), ['mm2', 'mm²', 'sq mm', ...pl('square millimeter', 'square millimetre')]],
    ['ha', 'hectare', 'ha', q('1e4'), ['ha', ...pl('hectare')]],
    ['ac', 'acre', 'ac', x(sq(FT), '43560'), ['ac', ...pl('acre')]],
    ['ft2', 'square foot', 'ft²', sq(FT), ['ft2', 'ft²', 'sq ft', 'sqft', 'square foot', 'square feet']],
    ['in2', 'square inch', 'in²', sq(IN), ['in2', 'in²', 'sq in', ...pl('square inch')]],
    ['yd2', 'square yard', 'yd²', sq(YD), ['yd2', 'yd²', 'sq yd', ...pl('square yard')]],
    ['mi2', 'square mile', 'mi²', sq(MI), ['mi2', 'mi²', 'sq mi', ...pl('square mile')]],
  ] },
  speed: { label: 'Speed', units: [
    ['kmh', 'kilometre per hour', 'km/h', div(q('1000'), q('3600')), ['km/h', 'kph', 'kmh', 'kmph', 'kilometers per hour', 'kilometres per hour']],
    ['mph', 'mile per hour', 'mph', div(MI, q('3600')), ['mph', 'mi/h', 'miles per hour']],
    ['mps', 'metre per second', 'm/s', q('1'), ['m/s', 'mps', 'meters per second', 'metres per second']],
    ['kn', 'knot', 'kn', div(q('1852'), q('3600')), ['kn', 'kt', 'kts', ...pl('knot')]],
    ['fps', 'foot per second', 'ft/s', FT, ['ft/s', 'fps', 'feet per second']],
    ['c', 'speed of light', 'c', q('299792458'), ['speed of light']],
  ] },
  time: { label: 'Time', units: [
    ['ns', 'nanosecond', 'ns', q('1e-9'), ['ns', ...pl('nanosecond')]],
    ['us', 'microsecond', 'µs', q('1e-6'), ['µs', 'us', 'μs', ...pl('microsecond')]],
    ['ms', 'millisecond', 'ms', q('0.001'), ['ms', ...pl('millisecond')]],
    ['s', 'second', 's', q('1'), ['s', 'sec', 'secs', ...pl('second')]],
    ['min', 'minute', 'min', q('60'), ['min', 'mins', ...pl('minute')]],
    ['h', 'hour', 'h', q('3600'), ['h', 'hr', 'hrs', ...pl('hour')]],
    ['d', 'day', 'd', q('86400'), ['d', ...pl('day')]],
    ['wk', 'week', 'wk', q('604800'), ['wk', 'wks', ...pl('week')]],
    ['mo', 'month (average)', 'mo', q('2629746'), ['mo', ...pl('month')]],
    ['yr', 'year (365.2425 days)', 'yr', q('31556952'), ['yr', 'yrs', 'y', ...pl('year')]],
    ['dec', 'decade', 'decade', q('315569520'), [...pl('decade')]],
    ['cen', 'century', 'century', q('3155695200'), ['century', 'centuries']],
  ] },
  data: { label: 'Data storage', units: [
    ['B', 'byte', 'B', q('1'), ['B', ...pl('byte')]],
    ['bit', 'bit', 'bit', q('0.125'), ['b', ...pl('bit')]],
    ['kB', 'kilobyte', 'kB', q('1e3'), ['kB', 'KB', ...pl('kilobyte')]],
    ['MB', 'megabyte', 'MB', q('1e6'), ['MB', ...pl('megabyte')]],
    ['GB', 'gigabyte', 'GB', q('1e9'), ['GB', ...pl('gigabyte')]],
    ['TB', 'terabyte', 'TB', q('1e12'), ['TB', ...pl('terabyte')]],
    ['PB', 'petabyte', 'PB', q('1e15'), ['PB', ...pl('petabyte')]],
    ['KiB', 'kibibyte', 'KiB', q('1024'), ['KiB', ...pl('kibibyte')]],
    ['MiB', 'mebibyte', 'MiB', q('1048576'), ['MiB', ...pl('mebibyte')]],
    ['GiB', 'gibibyte', 'GiB', q('1073741824'), ['GiB', ...pl('gibibyte')]],
    ['TiB', 'tebibyte', 'TiB', q('1099511627776'), ['TiB', ...pl('tebibyte')]],
    ['kbit', 'kilobit', 'kbit', q('125'), ['kbit', 'Kbit', ...pl('kilobit')]],
    ['Mbit', 'megabit', 'Mbit', q('125000'), ['Mb', 'Mbit', ...pl('megabit')]],
    ['Gbit', 'gigabit', 'Gbit', q('125000000'), ['Gb', 'Gbit', ...pl('gigabit')]],
  ] },
  pressure: { label: 'Pressure', units: [
    ['Pa', 'pascal', 'Pa', q('1'), ['pa', ...pl('pascal')]],
    ['hPa', 'hectopascal', 'hPa', q('100'), ['hpa', ...pl('hectopascal')]],
    ['kPa', 'kilopascal', 'kPa', q('1000'), ['kpa', ...pl('kilopascal')]],
    ['MPa', 'megapascal', 'MPa', q('1e6'), ['mpa', ...pl('megapascal')]],
    ['bar', 'bar', 'bar', q('1e5'), ['bar', 'bars']],
    ['mbar', 'millibar', 'mbar', q('100'), ['mbar', ...pl('millibar')]],
    ['atm', 'standard atmosphere', 'atm', q('101325'), ['atm', ...pl('atmosphere')]],
    ['psi', 'pound per square inch', 'psi', div(LBF, sq(IN)), ['psi', 'lbf/in2', 'pounds per square inch']],
    ['torr', 'torr', 'Torr', div(q('101325'), q('760')), ['torr']],
    ['mmHg', 'millimetre of mercury', 'mmHg', q('133.322387415'), ['mmhg', 'mm hg']],
    ['inHg', 'inch of mercury', 'inHg', x(q('133.322387415'), '25.4'), ['inhg', 'in hg']],
  ] },
  energy: { label: 'Energy', units: [
    ['J', 'joule', 'J', q('1'), ['j', ...pl('joule')]],
    ['kJ', 'kilojoule', 'kJ', q('1000'), ['kj', ...pl('kilojoule')]],
    ['MJ', 'megajoule', 'MJ', q('1e6'), ['mj', ...pl('megajoule')]],
    ['cal', 'calorie (thermochemical)', 'cal', q('4.184'), ['cal', 'small calorie']],
    ['kcal', 'kilocalorie (food calorie)', 'kcal', q('4184'), ['kcal', 'Cal', ...pl('kilocalorie', 'calorie', 'food calorie')]],
    ['Wh', 'watt-hour', 'Wh', q('3600'), ['wh', ...pl('watt-hour', 'watt hour')]],
    ['kWh', 'kilowatt-hour', 'kWh', q('3.6e6'), ['kwh', ...pl('kilowatt-hour', 'kilowatt hour')]],
    ['eV', 'electronvolt', 'eV', q('1.602176634e-19'), ['ev', ...pl('electronvolt', 'electron volt')]],
    ['BTU', 'British thermal unit', 'BTU', BTU, ['btu', 'btus', ...pl('british thermal unit')]],
    ['ftlbf', 'foot-pound', 'ft·lbf', mul(FT, LBF), ['ft lbf', 'ft-lbf', 'ft·lbf', 'ft lb', 'ft-lb', ...pl('foot-pound', 'foot pound')]],
    ['erg', 'erg', 'erg', q('1e-7'), ['erg', 'ergs']],
    ['thm', 'therm (US)', 'thm', q('105480400'), ['thm', ...pl('therm')]],
  ] },
  power: { label: 'Power', units: [
    ['W', 'watt', 'W', q('1'), ['w', ...pl('watt')]],
    ['kW', 'kilowatt', 'kW', q('1000'), ['kw', ...pl('kilowatt')]],
    ['MW', 'megawatt', 'MW', q('1e6'), ['mw', ...pl('megawatt')]],
    ['hp', 'horsepower (mechanical)', 'hp', x(mul(FT, LBF), '550'), ['hp', 'bhp', 'horsepower']],
    ['PS', 'metric horsepower', 'PS', q('735.49875'), ['ps', 'cv', 'metric horsepower']],
    ['BTUh', 'BTU per hour', 'BTU/h', div(BTU, q('3600')), ['btu/h', 'btu/hr', 'btuh', 'btu per hour']],
  ] },
  force: { label: 'Force', units: [
    ['N', 'newton', 'N', q('1'), ['n', ...pl('newton')]],
    ['kN', 'kilonewton', 'kN', q('1000'), [...pl('kilonewton')]],
    ['MN', 'meganewton', 'MN', q('1e6'), ['mn', ...pl('meganewton')]],
    ['dyn', 'dyne', 'dyn', q('1e-5'), ['dyn', ...pl('dyne')]],
    ['lbf', 'pound-force', 'lbf', LBF, ['lbf', 'lbs force', ...pl('pound-force', 'pound force')]],
    ['kip', 'kip', 'kip', x(LBF, '1000'), ['kip', 'kips']],
    ['ozf', 'ounce-force', 'ozf', per(LBF, '16'), ['ozf', ...pl('ounce-force', 'ounce force')]],
    ['kgf', 'kilogram-force', 'kgf', G0, ['kgf', 'kp', ...pl('kilogram-force', 'kilogram force', 'kilopond')]],
    ['pdl', 'poundal', 'pdl', mul(LB, FT), ['pdl', ...pl('poundal')]],
  ] },
  angle: { label: 'Angle', units: [
    ['deg', 'degree', '°', per(PI, '180'), ['°', 'deg', 'degs', ...pl('degree')]],
    ['rad', 'radian', 'rad', q('1'), ['rad', 'rads', ...pl('radian')]],
    ['mrad', 'milliradian', 'mrad', q('0.001'), ['mrad', ...pl('milliradian')]],
    ['grad', 'gradian (gon)', 'gon', per(PI, '200'), ['gon', 'grad', 'grads', ...pl('gradian', 'gon')]],
    ['arcmin', 'arcminute', '′', per(PI, '10800'), ['arcmin', 'moa', ...pl('arcminute', 'minute of arc')]],
    ['arcsec', 'arcsecond', '″', per(PI, '648000'), ['arcsec', ...pl('arcsecond', 'second of arc')]],
    ['turn', 'turn (revolution)', 'turn', x(PI, '2'), ['turn', 'turns', 'rev', 'revs', ...pl('revolution', 'rotation', 'circle')]],
    ['amil', 'NATO mil (6400 a turn)', 'mil (NATO)', per(x(PI, '2'), '6400'), ['nato mil', 'nato mils', 'angular mil', 'angular mils']],
  ] },
  frequency: { label: 'Frequency', units: [
    ['Hz', 'hertz', 'Hz', q('1'), ['hz', 'hertz', 'cps', 'per second']],
    ['kHz', 'kilohertz', 'kHz', q('1000'), ['khz', 'kilohertz']],
    ['MHz', 'megahertz', 'MHz', q('1e6'), ['mhz', 'megahertz']],
    ['GHz', 'gigahertz', 'GHz', q('1e9'), ['ghz', 'gigahertz']],
    ['THz', 'terahertz', 'THz', q('1e12'), ['thz', 'terahertz']],
    ['rpm', 'revolution per minute', 'rpm', div(q('1'), q('60')), ['rpm', 'rev/min', 'revolutions per minute']],
    ['rads', 'radian per second', 'rad/s', div(q('1'), x(PI, '2')), ['rad/s', 'radians per second']],
  ] },
  fuel: { label: 'Fuel consumption', units: [
    ['mpg', 'mile per US gallon', 'mpg (US)', div(MI, x(USGAL, '1e6')), ['mpg', 'mpg (us)', 'us mpg', 'miles per gallon', 'miles per us gallon']],
    ['mpgi', 'mile per imperial gallon', 'mpg (UK)', div(MI, x(IMPGAL, '1e6')), ['mpg (uk)', 'uk mpg', 'imperial mpg', 'miles per imperial gallon', 'miles per uk gallon']],
    ['kml', 'kilometre per litre', 'km/L', q('1'), ['km/l', 'kmpl', 'kilometers per liter', 'kilometres per litre']],
    ['mipl', 'mile per litre', 'mi/L', per(MI, '1000'), ['mi/l', 'miles per liter', 'miles per litre']],
    ['l100', 'litre per 100 km', 'L/100km', q('100'), ['l/100km', 'l/100 km', 'liters per 100 km', 'litres per 100 km', 'liters per 100km', 'litres per 100km'], INV],
  ] },
  // unitconverters.net's engineering groups, each by its most-asked quantity, from the same exact definitions
  heat: { label: 'Heat: thermal conductivity', group: 'engineering', units: [
    ['WmK', 'watt per metre-kelvin', 'W/(m·K)', q('1'), ['w/(m·k)', 'w/m·k', 'w/mk', 'w/m/k', 'watts per meter kelvin', 'watts per metre kelvin']],
    ['kWmK', 'kilowatt per metre-kelvin', 'kW/(m·K)', q('1000'), ['kw/(m·k)', 'kw/mk']],
    ['calscm', 'calorie per second-centimetre-°C', 'cal/(s·cm·°C)', q('418.4'), ['cal/(s·cm·°c)', 'cal/s·cm·°c', 'cal/s/cm/c']],
    ['kcalhm', 'kilocalorie per hour-metre-°C', 'kcal/(h·m·°C)', div(q('4184'), q('3600')), ['kcal/(h·m·°c)', 'kcal/h·m·°c', 'kcal/h/m/c']],
    ['btuhft', 'BTU per hour-foot-°F', 'BTU/(h·ft·°F)', mul(BTU, div(q('9'), x(FT, '18000'))), ['btu/(h·ft·°f)', 'btu/h·ft·°f', 'btu/h/ft/f', 'btu/hr/ft/f']],
    ['btuinh', 'BTU-inch per hour-square foot-°F', 'BTU·in/(h·ft²·°F)', per(mul(BTU, div(q('9'), x(FT, '18000'))), '12'), ['btu·in/(h·ft²·°f)', 'btu in/h ft2 f', 'btu-in/h-ft2-f']],
  ] },
  fluids: { label: 'Fluids: flow rate', group: 'engineering', units: [
    ['m3s', 'cubic metre per second', 'm³/s', q('1'), ['m3/s', 'm³/s', 'cubic meters per second', 'cubic metres per second']],
    ['m3h', 'cubic metre per hour', 'm³/h', div(q('1'), q('3600')), ['m3/h', 'm³/h', 'cubic meters per hour', 'cubic metres per hour']],
    ['ls', 'litre per second', 'L/s', q('0.001'), ['l/s', 'lps', 'liters per second', 'litres per second']],
    ['lmin', 'litre per minute', 'L/min', div(q('0.001'), q('60')), ['l/min', 'lpm', 'liters per minute', 'litres per minute']],
    ['lh', 'litre per hour', 'L/h', div(q('0.001'), q('3600')), ['l/h', 'lph', 'liters per hour', 'litres per hour']],
    ['gpm', 'US gallon per minute', 'gal/min (US)', per(USGAL, '60'), ['gpm', 'gal/min', 'us gpm', 'gallons per minute', 'us gallons per minute']],
    ['gph', 'US gallon per hour', 'gal/h (US)', per(USGAL, '3600'), ['gph', 'gal/h', 'gallons per hour']],
    ['igpm', 'imperial gallon per minute', 'gal/min (UK)', per(IMPGAL, '60'), ['uk gpm', 'imperial gpm', 'imperial gallons per minute']],
    ['cfm', 'cubic foot per minute', 'ft³/min', per(cube(FT), '60'), ['cfm', 'ft3/min', 'ft³/min', 'cubic feet per minute']],
    ['cfs', 'cubic foot per second', 'ft³/s', cube(FT), ['cfs', 'ft3/s', 'ft³/s', 'cubic feet per second']],
    ['bbld', 'oil barrel per day', 'bbl/d', per(x(USGAL, '42'), '86400'), ['bbl/d', 'bpd', 'barrels per day']],
  ] },
  light: { label: 'Light: illuminance', group: 'engineering', units: [
    ['lx', 'lux', 'lx', q('1'), ['lx', 'lux', 'lm/m2', 'lm/m²', 'lumens per square meter', 'lumens per square metre']],
    ['klx', 'kilolux', 'klx', q('1000'), ['klx', 'kilolux']],
    ['mlx', 'millilux', 'mlx', q('0.001'), ['mlx', 'millilux']],
    ['fc', 'foot-candle', 'fc', div(q('1'), sq(FT)), ['fc', 'lm/ft2', 'lm/ft²', ...pl('foot-candle', 'footcandle', 'foot candle')]],
    ['ph', 'phot', 'ph', q('10000'), ['ph', 'phot', 'phots', 'lm/cm2', 'lm/cm²']],
    ['nx', 'nox', 'nx', q('0.001'), ['nx', 'nox']],
  ] },
  electricity: { label: 'Electricity: charge', group: 'engineering', units: [
    ['Cb', 'coulomb', 'C', q('1'), [...pl('coulomb')]],
    ['kC', 'kilocoulomb', 'kC', q('1000'), ['kc', ...pl('kilocoulomb')]],
    ['mC', 'millicoulomb', 'mC', q('0.001'), ['mc', ...pl('millicoulomb')]],
    ['uC', 'microcoulomb', 'µC', q('1e-6'), ['µc', 'uc', ...pl('microcoulomb')]],
    ['Ah', 'ampere-hour', 'Ah', q('3600'), ['ah', ...pl('ampere-hour', 'amp-hour', 'amp hour', 'ampere hour')]],
    ['mAh', 'milliampere-hour', 'mAh', q('3.6'), ['mah', ...pl('milliampere-hour', 'milliamp-hour', 'milliamp hour')]],
    ['statC', 'statcoulomb (franklin)', 'statC', div(q('1'), q('2997924580')), ['statc', 'fr', ...pl('statcoulomb', 'franklin')]],
    ['e', 'elementary charge', 'e', q('1.602176634e-19'), ['elementary charge', 'elementary charges', 'electron charge']],
  ] },
  magnetism: { label: 'Magnetism: flux density', group: 'engineering', units: [
    ['T', 'tesla', 'T', q('1'), ['tesla', 'teslas']],
    ['mT', 'millitesla', 'mT', q('0.001'), ['mt', 'millitesla']],
    ['uT', 'microtesla', 'µT', q('1e-6'), ['µt', 'ut', 'microtesla']],
    ['nT', 'nanotesla', 'nT', q('1e-9'), ['nt', 'nanotesla']],
    ['G', 'gauss', 'G', q('1e-4'), ['gauss', 'gs']],
    ['kG', 'kilogauss', 'kG', q('0.1'), ['kilogauss']],
    ['mG', 'milligauss', 'mG', q('1e-7'), ['milligauss']],
    ['gamma', 'gamma', 'γ', q('1e-9'), ['gamma', 'gammas']],
  ] },
  radiology: { label: 'Radiology: absorbed dose', group: 'engineering', units: [
    ['Gy', 'gray', 'Gy', q('1'), ['gy', 'gray', 'grays']],
    ['mGy', 'milligray', 'mGy', q('0.001'), ['mgy', 'milligray']],
    ['uGy', 'microgray', 'µGy', q('1e-6'), ['µgy', 'ugy', 'microgray']],
    ['rd', 'rad (dose)', 'rd', q('0.01'), ['rd', 'rad (dose)', 'rads (dose)']],
    ['mrd', 'millirad', 'mrd', q('1e-5'), ['mrd', 'millirad', 'millirads']],
    ['Sv', 'sievert (equivalent dose)', 'Sv', q('1'), ['sv', 'sievert', 'sieverts']],
    ['mSv', 'millisievert', 'mSv', q('0.001'), ['msv', 'millisievert', 'millisieverts']],
    ['uSv', 'microsievert', 'µSv', q('1e-6'), ['µsv', 'usv', 'microsievert', 'microsieverts']],
    ['rem', 'rem', 'rem', q('0.01'), ['rem', 'rems']],
    ['mrem', 'millirem', 'mrem', q('1e-5'), ['mrem', 'millirem', 'millirems']],
  ] },
  radioactivity: { label: 'Radiology: radioactivity', group: 'engineering', units: [
    ['Bq', 'becquerel', 'Bq', q('1'), ['bq', 'becquerel', 'becquerels', 'dps', 'disintegrations per second']],
    ['kBq', 'kilobecquerel', 'kBq', q('1000'), ['kbq', 'kilobecquerel']],
    ['MBq', 'megabecquerel', 'MBq', q('1e6'), ['mbq', 'megabecquerel']],
    ['GBq', 'gigabecquerel', 'GBq', q('1e9'), ['gbq', 'gigabecquerel']],
    ['Ci', 'curie', 'Ci', q('3.7e10'), ['ci', 'curie', 'curies']],
    ['mCi', 'millicurie', 'mCi', q('3.7e7'), ['mci', 'millicurie']],
    ['uCi', 'microcurie', 'µCi', q('3.7e4'), ['µci', 'uci', 'microcurie']],
    ['nCi', 'nanocurie', 'nCi', q('37'), ['nci', 'nanocurie']],
    ['dpm', 'disintegration per minute', 'dpm', div(q('1'), q('60')), ['dpm', 'disintegrations per minute']],
    ['Rd', 'rutherford', 'Rd', q('1e6'), ['rutherford', 'rutherfords']],
  ] },
});
for (const k of Object.values(KINDS)) { k.group = k.group || 'common'; k.units = k.units.map(([id, name, sym, f, words, o]) => Object.freeze({ id, name, sym, f, o: o === INV ? null : o || null, inv: o === INV, words })); }
/** the two groups the kinds fall in, in the order the page lists them, with the words unitconverters.net uses for them. */
export const GROUPS = Object.freeze({ common: 'Common converters', engineering: 'Engineering converters: heat, fluids, light, electricity, magnetism, radiology' });

/** a unit of a kind by its id, or null. Pure. */
export const unitOf = (kind, id) => (KINDS[kind] ? KINDS[kind].units.find((u) => u.id === id) : null) || null;

const norm = (w) => String(w || '').trim().replace(/\.$/, '').replace(/^(?:degrees?|deg)\s+/i, '').replace(/^°\s*/, '').replace(/\s+/g, ' ');
/** every { kind, unit } a word could name, the units whose words match it letter for letter (case and all) first, then any case. Pure. */
export function unitsNamed(word) {
  const w = norm(word), lw = w.toLowerCase(), exact = [], loose = [];
  if (!w) return [];
  for (const [kind, k] of Object.entries(KINDS)) for (const u of k.units) {
    if (u.words.includes(w) || u.sym === w || u.id === w) exact.push({ kind, unit: u });
    else if (u.words.some((x) => x.toLowerCase() === lw) || u.sym.toLowerCase() === lw) loose.push({ kind, unit: u });
  }
  return [...exact, ...loose];
}

/** a value in one unit in another of the same kind, exactly: kelvin-like base = (v + offset) x factor; a reciprocal unit (L/100km) is
 * factor / value both ways. null only for 0 through a reciprocal (0 L/100km is no consumption at all). Pure. */
export function convert(v, from, to) {
  if (v.n === 0n && (from.inv || to.inv)) return null;
  const base = from.inv ? div(from.f, v) : mul(from.o ? add(v, from.o) : v, from.f), out = to.inv ? div(to.f, base) : div(base, to.f);
  return to.o ? sub(out, to.o) : out;
}
/** how one unit becomes another, as a line a person can check: "°F = °C × 9/5 + 32", "°C = (°F − 32) × 5/9", "m = mi × 1609.344",
 * "L/100km = 100 ÷ km/L"; the shorter of the two affine forms, a ratio as a small fraction when that is shorter than its decimal. Pure. */
export function formulaOf(from, to, sig = 12) {
  if (!from || !to || from === to) return '';
  const r = (v) => { const f = fmt(v, sig); return v.d !== 1n && v.d <= 1000n && (v.n < 0n ? -v.n : v.n) < 10000n && (v.n.toString().length + v.d.toString().length + 1) <= f.length ? v.n + '/' + v.d : f; };
  const neg = (v) => v.n < 0n, abs = (v) => ({ n: neg(v) ? -v.n : v.n, d: v.d }), one = (v) => v.n === v.d;
  if (from.inv !== to.inv) return to.sym + ' = ' + r(from.inv ? div(from.f, to.f) : div(to.f, from.f)) + ' ÷ ' + from.sym;
  const ratio = from.inv ? div(to.f, from.f) : div(from.f, to.f), k = sub(mul(from.o || R(0n), ratio), to.o || R(0n));
  const times = one(ratio) ? '' : ' × ' + r(ratio), plus = (v) => (v.n === 0n ? '' : (neg(v) ? ' − ' : ' + ') + r(abs(v)));
  const a = to.sym + ' = ' + from.sym + times + plus(k); if (k.n === 0n || one(ratio)) return a;
  const b = to.sym + ' = (' + from.sym + plus(div(k, ratio)) + ')' + times; return b.length < a.length ? b : a;
}
/** a value in one unit in every unit of its kind: [{ unit, value }], in the kind's order. Pure. */
export const convertAll = (kind, v, from) => KINDS[kind].units.map((u) => ({ unit: u, value: u === from ? v : convert(v, from, u) }));
/** the unit whose words make the fewest false friends when the kinds are listed: KINDS in page order, common before engineering. Pure. */
export const kindsInOrder = () => Object.entries(KINDS).sort((a, b) => (a[1].group === b[1].group ? 0 : a[1].group === 'common' ? -1 : 1));

const NUM = '[-+−]?(?:\\d[\\d,_]*(?:\\.\\d*)?|\\.\\d+)(?:e[-+]?\\d{1,4})?(?:\\s+\\d+/\\d+|/\\d+)?';
/** what an ask means: "100 c to f", "5 km in miles", "convert 3.5 lb to kg", "how many feet in a mile", "250 ml", "kg to lb". Gives
 * { kind, from, to (a unit or null), value (exact), text (the number as typed) }, or null when it names no unit. Pure. */
export function parseAsk(text) {
  let t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/^(?:please\s+)?(?:convert|change|turn|what(?:'s| is)|how much is)\s+/i, '').trim();
  let m = /^how many\s+(.+?)\s+(?:are\s+)?in\s+(?:an?\s+|one\s+)?(.+)$/i.exec(t); // how many feet in a mile: 1 of the second in the first
  if (m) t = '1 ' + m[2] + ' to ' + m[1];
  m = new RegExp('^(' + NUM + ')?\\s*(.+?)(?:\\s*(?:\\bto\\b|\\binto\\b|\\bin\\b|\\bas\\b|=|->|→)\\s*(.+))?$', 'i').exec(t);
  if (!m) return null;
  const num = m[1] ? m[1].trim() : '1', value = parseNum(num); if (!value) return null;
  const a = unitsNamed(m[2]); if (!a.length) return null;
  if (!m[3]) return { kind: a[0].kind, from: a[0].unit, to: null, value, text: num };
  const b = unitsNamed(m[3]);
  for (const x of a) { const y = b.find((u) => u.kind === x.kind && u.unit !== x.unit); if (y) return { kind: x.kind, from: x.unit, to: y.unit, value, text: num }; }
  return null;
}
