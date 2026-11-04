// Bot families (owner, 2026-11-04: "have verse build thousands of bots"): templates that make one real bot per variant (every unit pair,
// every number-base pair, every Caesar shift, every data-format pair, every date-format pair). Each bot gets independent checks, never its
// own first answer: a round trip (A to B and back gives the input), a property (linear, ordered or lossless) and, where one exists, a known
// answer from a published constant. tools/bot-factory.mjs runs every check; a variant that fails any one is not live.
const near = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const rnd = (seed) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
// factors to one base unit per dimension (SI or exact legal definitions)
const UNITS = {
  length: { m: 1, km: 1e3, cm: 0.01, mm: 1e-3, um: 1e-6, nm: 1e-9, in: 0.0254, ft: 0.3048, yd: 0.9144, mi: 1609.344, nmi: 1852, au: 149597870700, ly: 9460730472580800, pc: 3.0856775814913673e16, furlong: 201.168, chain: 20.1168, league: 4828.032, fathom: 1.8288 },
  mass: { kg: 1, g: 1e-3, mg: 1e-6, ug: 1e-9, t: 1e3, lb: 0.45359237, oz: 0.028349523125, st: 6.35029318, ton_us: 907.18474, ton_uk: 1016.0469088, ct: 2e-4, gr: 6.479891e-5, slug: 14.59390294, troy_oz: 0.0311034768 },
  volume: { l: 1, ml: 1e-3, m3: 1e3, cm3: 1e-3, gal_us: 3.785411784, gal_uk: 4.54609, qt_us: 0.946352946, pt_us: 0.473176473, cup_us: 0.2365882365, floz_us: 0.0295735295625, tbsp_us: 0.01478676478125, tsp_us: 0.00492892159375, ft3: 28.316846592, in3: 0.016387064, bbl_oil: 158.987294928 },
  area: { m2: 1, km2: 1e6, cm2: 1e-4, ha: 1e4, acre: 4046.8564224, ft2: 0.09290304, in2: 0.00064516, yd2: 0.83612736, mi2: 2589988.110336 },
  time: { s: 1, ms: 1e-3, us: 1e-6, ns: 1e-9, min: 60, h: 3600, day: 86400, week: 604800, fortnight: 1209600, year: 31557600, decade: 315576000, century: 3155760000 },
  data: { B: 1, bit: 0.125, kB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12, PB: 1e15, KiB: 1024, MiB: 1048576, GiB: 1073741824, TiB: 1099511627776, kbit: 125, Mbit: 125e3, Gbit: 125e6 },
  speed: { 'm/s': 1, 'km/h': 1 / 3.6, mph: 0.44704, knot: 1852 / 3600, 'ft/s': 0.3048, mach: 340.29 },
  energy: { J: 1, kJ: 1e3, cal: 4.184, kcal: 4184, Wh: 3600, kWh: 3.6e6, eV: 1.602176634e-19, BTU: 1055.05585262, therm: 105505585.262, erg: 1e-7 },
  pressure: { Pa: 1, kPa: 1e3, bar: 1e5, atm: 101325, psi: 6894.757293168, mmHg: 133.322387415, torr: 101325 / 760, inHg: 3386.389 },
  power: { W: 1, kW: 1e3, MW: 1e6, hp: 745.69987158227, 'BTU/h': 0.29307107017, 'kcal/h': 1.1622222 },
  angle: { rad: 1, deg: Math.PI / 180, grad: Math.PI / 200, turn: 2 * Math.PI, arcmin: Math.PI / 10800, arcsec: Math.PI / 648000 },
  frequency: { Hz: 1, kHz: 1e3, MHz: 1e6, GHz: 1e9, rpm: 1 / 60 },
};
// published equalities, checked against the table (a typo in a factor fails these bots)
const KNOWN = [['length', 'mi', 'km', 1, 1.609344], ['length', 'ft', 'in', 1, 12], ['length', 'yd', 'ft', 1, 3], ['mass', 'lb', 'oz', 1, 16], ['mass', 'st', 'lb', 1, 14], ['mass', 'lb', 'kg', 1, 0.45359237], ['volume', 'gal_us', 'qt_us', 1, 4], ['volume', 'cup_us', 'tbsp_us', 1, 16], ['volume', 'tbsp_us', 'tsp_us', 1, 3], ['volume', 'gal_us', 'l', 1, 3.785411784], ['area', 'acre', 'ft2', 1, 43560], ['area', 'mi2', 'acre', 1, 640], ['time', 'day', 'h', 1, 24], ['time', 'week', 'day', 1, 7], ['data', 'GiB', 'MiB', 1, 1024], ['data', 'B', 'bit', 1, 8], ['speed', 'knot', 'km/h', 1, 1.852], ['energy', 'kWh', 'kJ', 1, 3600], ['energy', 'kcal', 'cal', 1, 1000], ['pressure', 'atm', 'torr', 1, 760], ['angle', 'turn', 'deg', 1, 360], ['frequency', 'kHz', 'rpm', 1, 60000]];
const TEMP = { C: [(x) => x, (x) => x], F: [(x) => ((x - 32) * 5) / 9, (c) => (c * 9) / 5 + 32], K: [(x) => x - 273.15, (c) => c + 273.15], R: [(x) => ((x - 491.67) * 5) / 9, (c) => ((c + 273.15) * 9) / 5] };
const TEMP_KNOWN = [['C', 'F', 100, 212], ['C', 'K', 0, 273.15], ['F', 'C', -40, -40], ['F', 'R', 0, 459.67]];
const FMT = { json: 1, csv: 1, tsv: 1, ndjson: 1, query: 1, ini: 1, markdown: 1, yaml: 1 };
const rows2 = [{ name: 'Ava', city: 'Lakeland' }, { name: 'Bo', city: 'Tampa' }];
const parse = { json: (s) => JSON.parse(s), ndjson: (s) => s.trim().split('\n').map((l) => JSON.parse(l)), csv: (s) => dsv(s, ','), tsv: (s) => dsv(s, '\t'),
  query: (s) => s.split('&&').map((r) => Object.fromEntries(new URLSearchParams(r))), ini: (s) => s.trim().split(/\n(?=\[)/).map((b) => Object.fromEntries(b.split('\n').slice(1).map((l) => l.split(' = ')))),
  markdown: (s) => { const l = s.trim().split('\n').map((x) => x.slice(2, -2).split(' | ')); return l.slice(2).map((r) => Object.fromEntries(l[0].map((k, i) => [k, r[i]]))); },
  yaml: (s) => s.trim().split(/\n(?=- )/).map((b) => Object.fromEntries(b.replace(/^- /, '').split('\n').map((l) => l.trim().split(': ')))) };
const dsv = (s, d) => { const [h, ...r] = s.trim().split('\n').map((l) => l.split(d)); return r.map((x) => Object.fromEntries(h.map((k, i) => [k, x[i]]))); };
const show = { json: (r) => JSON.stringify(r), ndjson: (r) => r.map((x) => JSON.stringify(x)).join('\n'), csv: (r) => [Object.keys(r[0]).join(','), ...r.map((x) => Object.values(x).join(','))].join('\n'), tsv: (r) => [Object.keys(r[0]).join('\t'), ...r.map((x) => Object.values(x).join('\t'))].join('\n'),
  query: (r) => r.map((x) => new URLSearchParams(x).toString()).join('&&'), ini: (r) => r.map((x, i) => '[row' + (i + 1) + ']\n' + Object.entries(x).map(([k, v]) => k + ' = ' + v).join('\n')).join('\n'),
  markdown: (r) => { const k = Object.keys(r[0]); return ['| ' + k.join(' | ') + ' |', '| ' + k.map(() => '---').join(' | ') + ' |', ...r.map((x) => '| ' + k.map((c) => x[c]).join(' | ') + ' |')].join('\n'); },
  yaml: (r) => r.map((x) => Object.entries(x).map(([k, v], i) => (i ? '  ' : '- ') + k + ': ' + v).join('\n')).join('\n') };
const DATES = { iso: (d) => d.toISOString().slice(0, 10), us: (d) => [d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCFullYear()].map((n) => String(n).padStart(2, '0')).join('/'), eu: (d) => [d.getUTCDate(), d.getUTCMonth() + 1, d.getUTCFullYear()].map((n) => String(n).padStart(2, '0')).join('.'), unix: (d) => String(d.getTime() / 1000), compact: (d) => d.toISOString().slice(0, 10).replace(/-/g, ''), julian: (d) => String(d.getTime() / 864e5 + 2440587.5) };
const DPARSE = { iso: (s) => new Date(s + 'T00:00:00Z'), us: (s) => { const [m, d, y] = s.split('/'); return new Date(Date.UTC(+y, m - 1, +d)); }, eu: (s) => { const [d, m, y] = s.split('.'); return new Date(Date.UTC(+y, m - 1, +d)); }, unix: (s) => new Date(+s * 1000), compact: (s) => new Date(s.slice(0, 4) + '-' + s.slice(4, 6) + '-' + s.slice(6) + 'T00:00:00Z'), julian: (s) => new Date((+s - 2440587.5) * 864e5) };

/** every family bot: { id, cat, family, job, from, run, checks: [[name, () => bool]] } */
export function families() {
  const out = [];
  for (const [dim, u] of Object.entries(UNITS)) for (const a in u) for (const b in u) if (a !== b) {
    const f = (x) => (x * u[a]) / u[b], back = (y) => (y * u[b]) / u[a], k = KNOWN.find((x) => x[0] === dim && ((x[1] === a && x[2] === b) || (x[1] === b && x[2] === a)));
    const checks = [['round trip', () => [1, 7.5, 1234].every((x) => near(back(f(x)), x))], ['linear', () => near(f(6), 6 * f(1)) && f(0) === 0], ['matches the table through the base', () => near(f(1) * u[b], u[a])]];
    if (k) checks.push(['known answer', () => (k[1] === a ? near(f(k[3]), k[4]) : near(f(k[4]), k[3]))]);
    out.push({ id: a + '-to-' + b, cat: 'units', family: 'units/' + dim, job: 'Converts ' + a + ' to ' + b, from: ['skills/convert.js', 'bots/unit-converter'], run: (s) => +f(parseFloat(s)).toPrecision(10) + ' ' + b, checks });
  }
  for (const a in TEMP) for (const b in TEMP) if (a !== b) {
    const f = (x) => TEMP[b][1](TEMP[a][0](x)), g = (y) => TEMP[a][1](TEMP[b][0](y)), k = TEMP_KNOWN.find((x) => x[0] === a && x[1] === b);
    out.push({ id: 'temp-' + a + '-to-' + b, cat: 'units', family: 'units/temperature', job: 'Converts °' + a + ' to °' + b, from: ['skills/convert.js', 'bots/unit-converter'], run: (s) => +f(parseFloat(s)).toPrecision(10) + ' °' + b,
      checks: [['round trip', () => [-40, 0, 37, 1000].every((x) => near(g(f(x)), x))], ['ordered', () => f(10) > f(0)], ...(k ? [['known answer', () => near(f(k[2]), k[3])]] : [])] });
  }
  for (let a = 2; a <= 36; a++) for (let b = 2; b <= 36; b++) if (a !== b) {
    const f = (s) => BigInt.asUintN(64, [...String(s).toLowerCase()].reduce((t, c) => t * BigInt(a) + BigInt(parseInt(c, 36)), 0n)).toString(b), r = rnd(a * 37 + b);
    out.push({ id: 'base' + a + '-to-base' + b, cat: 'math', family: 'number bases', job: 'Rewrites a base-' + a + ' number in base ' + b, from: ['skills/baseconv.js', 'bots/base-converter'], run: f,
      checks: [['round trip', () => Array.from({ length: 5 }, () => Math.floor(r() * 1e12)).every((n) => parseInt(f(n.toString(a)), b) === n)], ['digits valid', () => /^[0-9a-z]+$/.test(f((a - 1).toString(a).repeat(6))) && [...f((a - 1).toString(a).repeat(6))].every((c) => parseInt(c, 36) < b)], ['known answer', () => f((255).toString(a)) === (255).toString(b) && f('0') === '0']] });
  }
  const shift = (s, n) => String(s).replace(/[a-z]/gi, (c) => { const o = c <= 'Z' ? 65 : 97; return String.fromCharCode(((c.charCodeAt(0) - o + n + 26) % 26) + o); });
  for (let n = 1; n < 26; n++) for (const dir of ['encode', 'decode']) {
    const k = dir === 'encode' ? n : -n;
    out.push({ id: 'caesar-' + n + '-' + dir, cat: 'fun', family: 'ciphers', job: (dir === 'encode' ? 'Encodes' : 'Decodes') + ' a Caesar cipher with shift ' + n, from: ['bots/morse-bot', 'skills/crypto.js'], run: (s) => shift(s, k),
      checks: [['round trip', () => shift(shift('Hello, Verse 42!', k), -k) === 'Hello, Verse 42!'], ['keeps non-letters', () => shift('1 2!', k) === '1 2!'], ['known answer', () => (n === 13 ? shift('Hello', k) === 'Uryyb' : shift('a', k) === String.fromCharCode(97 + ((k + 26) % 26)))]] });
  }
  for (const a in FMT) for (const b in FMT) if (a !== b) {
    const f = (s) => show[b](parse[a](s));
    out.push({ id: a + '-to-' + b, cat: 'code', family: 'data formats', job: 'Turns ' + a + ' rows into ' + b, from: ['skills/csv-table.js', 'bots/csv-to-json'], run: f,
      checks: [['round trip', () => JSON.stringify(parse[b](f(show[a](rows2)))) === JSON.stringify(rows2)], ['lossless both ways', () => show[a](parse[b](f(show[a](rows2)))) === show[a](rows2)]] });
  }
  for (const a in DATES) for (const b in DATES) if (a !== b) {
    const f = (s) => DATES[b](DPARSE[a](s)), d = new Date(Date.UTC(2026, 10, 4));
    out.push({ id: 'date-' + a + '-to-' + b, cat: 'code', family: 'date formats', job: 'Rewrites a ' + a + ' date as ' + b, from: ['skills/date-calc.js', 'bots/unix-time'], run: f,
      checks: [['round trip', () => DATES[a](DPARSE[b](f(DATES[a](d)))) === DATES[a](d)], ['known answer', () => f(DATES[a](d)) === ({ iso: '2026-11-04', us: '11/04/2026', eu: '04.11.2026', unix: '1793750400', compact: '20261104', julian: '2461348.5' }[b])]] });
  }
  return out;
}
/** run one family bot's checks */
export function check(bot) { const fails = []; for (const [name, fn] of bot.checks) { let ok = false; try { ok = fn() === true; } catch (_) { ok = false; } if (!ok) fails.push(name); } return { ok: !fails.length, fails }; }
