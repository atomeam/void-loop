/**
 * flights-core: the maths and the data of the flights pages (/flights/ and one page per site of the travel lane, lib/flight-sites.js). Owner, 2026-10-26: "need a flights page".
 * Everything here runs on the device and sends nothing: Verse has no paid flight-price feed, so there are no live fares; what it does is the part that needs no feed.
 *   - the airport index (flights/airports.json, OurAirports, public domain): search by city, name or code, nearby airports, multi-airport city codes (LON, NYC, ...)
 *   - route facts: great-circle distance, a typical flight time, the time-zone difference, the local arrival time, a CO2 estimate with its method named
 *   - search across providers: one search on Google Flights, Skyscanner, Kayak, Momondo, Expedia and an airline's own site, from fixed address templates (a closed list;
 *     every field is encoded; nothing is sent by the page, the visitor opens the link)
 *   - price log: fares the visitor saw, the lowest seen, a watch target, CSV in and out
 *   - itineraries: a confirmation text read into flight segments, layover checks, an .ics file, a link that carries the trip
 * Pure (Intl is the only outside thing it reads). Tests: tools/flights.test.mjs.
 */
import { fold, escText } from './ics.js';

export const R_KM = 6371.0088, KM_MI = 0.621371192, KM_NM = 0.539956803;
const rad = (d) => d * Math.PI / 180, deg = (r) => r * 180 / Math.PI;
const pad = (n, w = 2) => String(n).padStart(w, '0');

// ---------- the airport index ----------
/** the index for a parsed airports.json: { list, byIata, byIcao, tz(a), country(a) }. Pure. */
export function makeIndex(data) {
  const list = (data.a || []).map((r) => ({ iata: r[0], icao: r[1], name: r[2], city: r[3], cc: r[4], lat: r[5], lon: r[6], tz: data.tz[r[7]], size: r[8] & 3, approx: !!(r[8] & 4), country: (data.countries || {})[r[4]] || r[4] }));
  const byIata = new Map(list.map((a) => [a.iata, a])), byIcao = new Map(list.map((a) => [a.icao, a]));
  for (const a of list) a.key = fold_(a.iata + ' ' + a.icao + ' ' + a.city + ' ' + a.name + ' ' + a.country);
  return { list, byIata, byIcao, source: data.source || '' };
}
/** lower case, no accents, single spaces. */
export function fold_(s) { return String(s || '').replace(/ä/gi, 'ae').replace(/ö/gi, 'oe').replace(/ü/gi, 'ue').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ß/g, 'ss').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
/** multi-airport city codes: the city code and its airports (IATA metropolitan area codes). */
export const METRO = Object.freeze({ LON: ['LHR', 'LGW', 'STN', 'LTN', 'LCY', 'SEN'], NYC: ['JFK', 'LGA', 'EWR'], PAR: ['CDG', 'ORY', 'BVA'], MIL: ['MXP', 'LIN', 'BGY'], ROM: ['FCO', 'CIA'], TYO: ['HND', 'NRT'], OSA: ['KIX', 'ITM'], WAS: ['IAD', 'DCA', 'BWI'], CHI: ['ORD', 'MDW'], MOW: ['SVO', 'DME', 'VKO'], STO: ['ARN', 'BMA', 'NYO'], BUE: ['EZE', 'AEP'], RIO: ['GIG', 'SDU'], SAO: ['GRU', 'CGH', 'VCP'], YTO: ['YYZ', 'YTZ'], YMQ: ['YUL', 'YMX'], SEL: ['ICN', 'GMP'], BJS: ['PEK', 'PKX'], SHA: ['PVG', 'SHA'], JKT: ['CGK', 'HLP'], IST: ['IST', 'SAW'], DFW: ['DFW', 'DAL'], HOU: ['IAH', 'HOU'], MIA: ['MIA', 'FLL'] });
export const METRO_NAME = Object.freeze({ LON: 'London', NYC: 'New York', PAR: 'Paris', MIL: 'Milan', ROM: 'Rome', TYO: 'Tokyo', OSA: 'Osaka', WAS: 'Washington', CHI: 'Chicago', MOW: 'Moscow', STO: 'Stockholm', BUE: 'Buenos Aires', RIO: 'Rio de Janeiro', SAO: 'Sao Paulo', YTO: 'Toronto', YMQ: 'Montreal', SEL: 'Seoul', BJS: 'Beijing', SHA: 'Shanghai', JKT: 'Jakarta', IST: 'Istanbul', DFW: 'Dallas', HOU: 'Houston', MIA: 'Miami' });
/** a city's name in its own language, folded, to the English name the index uses. */
const ALIAS = Object.freeze({ muenchen: 'Munich', munchen: 'Munich', koeln: 'Cologne', koln: 'Cologne', wien: 'Vienna', roma: 'Rome', praha: 'Prague', lisboa: 'Lisbon', firenze: 'Florence', napoli: 'Naples', venezia: 'Venice', milano: 'Milan', geneve: 'Geneva', genf: 'Geneva', kobenhavn: 'Copenhagen', koebenhavn: 'Copenhagen', athen: 'Athens', moskau: 'Moscow', moskva: 'Moscow', warschau: 'Warsaw', warszawa: 'Warsaw', bruxelles: 'Brussels', bruessel: 'Brussels', brussel: 'Brussels', sevilla: 'Seville', zuerich: 'Zurich', turin: 'Turin', torino: 'Turin', mailand: 'Milan', rom: 'Rome', lissabon: 'Lisbon', prag: 'Prague', neapel: 'Naples', venedig: 'Venice', florenz: 'Florence', kairo: 'Cairo', peking: 'Beijing', tokio: 'Tokyo' });
/** airports matching a query, best first: a code (airport or city code) first, then a city or name that starts with it, then one that contains every word. Pure. */
export function searchAirports(idx, q, limit = 8) {
  const raw = String(q || '').trim(), f = fold_(raw); if (!f) return [];
  const up = raw.toUpperCase(), out = [], seen = new Set(), add = (a, s) => { if (a && !seen.has(a.iata)) { seen.add(a.iata); out.push({ a, s }); } };
  if (/^[A-Z]{3}$/.test(up)) { if (METRO[up]) METRO[up].forEach((c, i) => add(idx.byIata.get(c), 100 - i * 0.5)); add(idx.byIata.get(up), 99); }
  if (/^[A-Z]{4}$/.test(up)) add(idx.byIcao.get(up), 98);
  const alias = ALIAS[f]; if (alias) return searchAirports(idx, alias, limit);
  const words = f.split(' ');
  for (const [code, name] of Object.entries(METRO_NAME)) if (fold_(name).startsWith(f) && f.length >= 3) METRO[code].forEach((c, i) => add(idx.byIata.get(c), 90 - i * 0.5));
  for (const a of idx.list) {
    const city = fold_(a.city), name = fold_(a.name);
    if (city === f) add(a, 85 + a.size); else if (city.startsWith(f)) add(a, 70 + a.size * 3); else if (name.startsWith(f)) add(a, 60 + a.size * 3);
    else if (!(out.length && /^[A-Z]{3}$/.test(up)) && words.every((w) => a.key.includes(w))) add(a, 30 + a.size * 3);
  }
  out.sort((x, y) => y.s - x.s || y.a.size - x.a.size || x.a.iata.localeCompare(y.a.iata));
  return out.slice(0, limit).map((x) => x.a);
}
/** the airport for a code (IATA or ICAO) or null. */
export const airportOf = (idx, code) => { const c = String(code || '').trim().toUpperCase(); return idx.byIata.get(c) || idx.byIcao.get(c) || null; };
/** airports within radiusKm of a point, nearest first, never the airport itself. */
export function nearby(idx, a, radiusKm = 150, limit = 8) {
  return idx.list.filter((b) => b.iata !== a.iata).map((b) => ({ a: b, km: distanceKm(a, b) })).filter((x) => x.km <= radiusKm).sort((x, y) => x.km - y.km).slice(0, limit);
}
/** every airport that shares a metropolitan code with this one, as airports (not itself). */
export const sameCity = (idx, a) => { const out = []; for (const [m, cs] of Object.entries(METRO)) if (cs.includes(a.iata)) for (const c of cs) if (c !== a.iata && idx.byIata.get(c)) out.push(idx.byIata.get(c)); return out; };

// ---------- geometry ----------
/** great-circle distance in km (haversine on a sphere of the mean Earth radius). */
export function distanceKm(a, b) {
  const p1 = rad(a.lat), p2 = rad(b.lat), dp = p2 - p1, dl = rad(b.lon - a.lon);
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
/** the initial compass bearing from a to b in degrees (0 to 360). */
export function bearing(a, b) {
  const p1 = rad(a.lat), p2 = rad(b.lat), dl = rad(b.lon - a.lon);
  return (deg(Math.atan2(Math.sin(dl) * Math.cos(p2), Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl))) + 360) % 360;
}
/** n+1 points along the great circle from a to b (longitudes unwrapped so a path across the date line is continuous). */
export function pathPoints(a, b, n = 48) {
  const d = distanceKm(a, b) / R_KM, out = []; let prev = null;
  for (let i = 0; i <= n; i++) {
    const f = d === 0 ? 0 : i / n, A = Math.sin((1 - f) * d) / Math.sin(d || 1), B = Math.sin(f * d) / Math.sin(d || 1);
    const x = A * Math.cos(rad(a.lat)) * Math.cos(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.cos(rad(b.lon)), y = A * Math.cos(rad(a.lat)) * Math.sin(rad(a.lon)) + B * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon)), z = A * Math.sin(rad(a.lat)) + B * Math.sin(rad(b.lat));
    let lon = deg(Math.atan2(y, x)); const lat = deg(Math.atan2(z, Math.hypot(x, y)));
    if (prev !== null) while (lon - prev > 180) lon -= 360; while (prev !== null && prev - lon > 180) lon += 360;
    prev = lon; out.push({ lat, lon });
  }
  return out;
}
/** true when the great circle between two points crosses the 180th meridian. */
export const crossesDateLine = (a, b) => { const p = pathPoints(a, b, 96); return p.some((q) => q.lon > 180 || q.lon < -180); };
export const km2mi = (km) => km * KM_MI, km2nm = (km) => km * KM_NM;

// ---------- flight time ----------
export const CRUISE_KMH = 805; // about 500 mph
/**
 * A typical flight time in minutes: half an hour for taxi, climb and descent plus the great-circle distance at 805 km/h (500 mph), the way route calculators
 * estimate it. A timetable differs with the aircraft, the wind and the route flown (usually 3 to 8 percent longer than the great circle). Whole minutes, at least 25.
 */
export const flightMinutes = (km) => Math.max(25, Math.round(30 + (km / CRUISE_KMH) * 60));
/** the extra distance a real routing adds, as the CO2 methods of ICAO do: 50 km under 550 km, 100 km up to 5500 km, 125 km beyond. */
export const detourKm = (km) => (km < 550 ? 50 : km < 5500 ? 100 : 125);
/** 135 min as "2 h 15 min". */
export const hm = (min) => { const m = Math.round(Math.abs(min)); return m >= 60 ? Math.floor(m / 60) + ' h ' + pad(m % 60) + ' min' : m + ' min'; };

// ---------- time zones ----------
const fmtCache = new Map();
function dtf(tz) { let f = fmtCache.get(tz); if (!f) { f = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }); fmtCache.set(tz, f); } return f; }
/** the offset of a zone from UTC in minutes at a moment (UTC ms), DST included. */
export function offsetMin(tz, ms) {
  const p = Object.fromEntries(dtf(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return Math.round((Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(ms / 1000) * 1000) / 60000);
}
/** the UTC moment (ms) of a local wall-clock time in a zone ('2026-12-01T14:35'); the earlier moment when the clock repeats, the later when it skips. */
export function localToUtc(tz, local) {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local); if (!m) return NaN;
  const naive = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]); let t = naive - offsetMin(tz, naive) * 60000;
  t = naive - offsetMin(tz, t) * 60000; return t;
}
/** a UTC moment as the local wall clock of a zone: { date: 'YYYY-MM-DD', time: 'HH:MM', local: 'YYYY-MM-DDTHH:MM', off }. */
export function utcToLocal(tz, ms) {
  const p = Object.fromEntries(dtf(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value])), date = p.year + '-' + p.month + '-' + p.day, time = p.hour + ':' + p.minute;
  return { date, time, local: date + 'T' + time, off: offsetMin(tz, ms) };
}
export const offsetLabel = (min) => 'UTC' + (min < 0 ? '−' : '+') + pad(Math.floor(Math.abs(min) / 60)) + (Math.abs(min) % 60 ? ':' + pad(Math.abs(min) % 60) : '');
const dayNum = (d) => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5);

/**
 * Everything about one leg from airport a to airport b departing at a local time ('YYYY-MM-DDTHH:MM', default noon on the 15th of next month so the zone's DST is the
 * date's): distance in km, mi and nm, bearing, a typical flight time, the zone difference on that date, the local arrival time and the days it moves, whether the great
 * circle crosses the date line, and a CO2 estimate. Pure.
 */
export function legFacts(a, b, depLocal, opts = {}) {
  const km = distanceKm(a, b), minutes = flightMinutes(km), dep = depLocal || defaultDep(), depUtc = localToUtc(a.tz, dep);
  const arrUtc = depUtc + minutes * 60000, arr = utcToLocal(b.tz, arrUtc), diff = offsetMin(b.tz, depUtc) - offsetMin(a.tz, depUtc);
  return { km, mi: km2mi(km), nm: km2nm(km), bearing: bearing(a, b), minutes, flownKm: km + detourKm(km), dep, depUtc, arrUtc, arrLocal: arr.local, arrDate: arr.date, arrTime: arr.time, dayShift: dayNum(arr.date) - dayNum(dep.slice(0, 10)), diffMin: diff, dateLine: crossesDateLine(a, b), co2: co2(km, opts.cabin || 'economy', opts.pax || 1, !!opts.ret) };
}
export function defaultDep(now = new Date()) { const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-15T12:00'; }

// ---------- CO2 ----------
export const CABINS = Object.freeze({ economy: 'Economy', premium: 'Premium economy', business: 'Business', first: 'First' });
const CABIN_SHORT = { economy: 1, premium: 1, business: 1.5, first: 1.5 }, CABIN_LONG = { economy: 1, premium: 1.6, business: 2.9, first: 4 };
export const CO2 = Object.freeze({ fixedKg: 20, kgPerKm: 0.09, nonCo2: 1.9, longHaulKm: 3700 });
/**
 * An estimate of the CO2 one passenger's seat causes on a flight, in kg: a fixed 20 kg for taxi, take-off and landing plus 0.09 kg for each km flown (the great circle
 * plus ICAO's allowance for routing), the economy figure of a typical jet at about 80 percent full, times a cabin factor (1, 1.6, 2.9, 4 on long flights over 3,700 km;
 * 1 to 1.5 on short ones: a bigger seat takes more of the floor). It is an average, not an airline's figure: the real value is within about 25 percent either way. The
 * second figure multiplies by 1.9 for the warming of contrails and nitrogen oxides at altitude, the usual factor for "CO2 equivalent".
 */
export function co2(km, cabin = 'economy', pax = 1, ret = false) {
  const flown = km + detourKm(km), long = km > CO2.longHaulKm, f = (long ? CABIN_LONG : CABIN_SHORT)[cabin] || 1, legs = ret ? 2 : 1, n = Math.max(1, Math.round(pax) || 1);
  const kg = (CO2.fixedKg + CO2.kgPerKm * flown) * f * legs * n;
  return { kg, low: kg * 0.75, high: kg * 1.25, withNonCo2: kg * CO2.nonCo2, perKm: kg / (km * legs * n || 1) * 1000, cabinFactor: f, legs, pax: n };
}

// ---------- search across providers ----------
export const AIRLINES = Object.freeze({ BA: ['British Airways', 'https://www.britishairways.com/'], LH: ['Lufthansa', 'https://www.lufthansa.com/'], AF: ['Air France', 'https://www.airfrance.com/'], KL: ['KLM', 'https://www.klm.com/'], LX: ['SWISS', 'https://www.swiss.com/'], IB: ['Iberia', 'https://www.iberia.com/'], TP: ['TAP Air Portugal', 'https://www.flytap.com/'], EK: ['Emirates', 'https://www.emirates.com/'], QR: ['Qatar Airways', 'https://www.qatarairways.com/'], TK: ['Turkish Airlines', 'https://www.turkishairlines.com/'], DL: ['Delta', 'https://www.delta.com/'], AA: ['American Airlines', 'https://www.aa.com/'], UA: ['United', 'https://www.united.com/'], AC: ['Air Canada', 'https://www.aircanada.com/'], QF: ['Qantas', 'https://www.qantas.com/'], SQ: ['Singapore Airlines', 'https://www.singaporeair.com/'], NH: ['ANA', 'https://www.ana.co.jp/'], JL: ['Japan Airlines', 'https://www.jal.co.jp/'], FR: ['Ryanair', 'https://www.ryanair.com/'], U2: ['easyJet', 'https://www.easyjet.com/'], W6: ['Wizz Air', 'https://wizzair.com/'], DY: ['Norwegian', 'https://www.norwegian.com/'], AY: ['Finnair', 'https://www.finnair.com/'], SK: ['SAS', 'https://www.flysas.com/'], EI: ['Aer Lingus', 'https://www.aerlingus.com/'], VY: ['Vueling', 'https://www.vueling.com/'], WN: ['Southwest', 'https://www.southwest.com/'], B6: ['JetBlue', 'https://www.jetblue.com/'], AS: ['Alaska Airlines', 'https://www.alaskaair.com/'], VS: ['Virgin Atlantic', 'https://www.virginatlantic.com/'], EY: ['Etihad', 'https://www.etihad.com/'], OS: ['Austrian', 'https://www.austrian.com/'], SN: ['Brussels Airlines', 'https://www.brusselsairlines.com/'], LO: ['LOT Polish Airlines', 'https://www.lot.com/'], TG: ['Thai Airways', 'https://www.thaiairways.com/'], CX: ['Cathay Pacific', 'https://www.cathaypacific.com/'], KE: ['Korean Air', 'https://www.koreanair.com/'], AI: ['Air India', 'https://www.airindia.com/'], ET: ['Ethiopian', 'https://www.ethiopianairlines.com/'], SA: ['South African Airways', 'https://www.flysaa.com/'], LA: ['LATAM', 'https://www.latamairlines.com/'], AV: ['Avianca', 'https://www.avianca.com/'], NZ: ['Air New Zealand', 'https://www.airnewzealand.com/'], MS: ['EgyptAir', 'https://www.egyptair.com/'] });
/** a travel date as 'YYYY-MM-DD' or ''. */
export const isoDate = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); if (!m) return ''; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return d.getUTCFullYear() === +m[1] && d.getUTCMonth() === +m[2] - 1 && d.getUTCDate() === +m[3] ? m[0] : ''; };
const code3 = (s) => (/^[A-Za-z]{3}$/.test(String(s || '')) ? String(s).toUpperCase() : '');
/**
 * A search: { from, to, depart, ret, pax:{adults,children,infants}, cabin, oneWay }. Returns the six provider links, each { id, name, url, check, note }:
 * `check` says how sure the address pattern is ('confirmed' where the pattern was found in published documentation or a guide on 2026-10-26, else 'unconfirmed': the
 * provider may open its own front page with what it could read). The list is closed: no other host is ever built, every value is encoded or reduced to letters and digits.
 */
export function providerLinks(s) {
  const from = code3(s.from), to = code3(s.to), d1 = isoDate(s.depart), d2 = s.oneWay ? '' : isoDate(s.ret), ad = clamp(s.pax && s.pax.adults, 1, 9, 1), ch = clamp(s.pax && s.pax.children, 0, 8, 0), inf = clamp(s.pax && s.pax.infants, 0, ad, 0);
  const cabin = Object.keys(CABINS).includes(s.cabin) ? s.cabin : 'economy', e = encodeURIComponent;
  if (!from || !to || !d1) return [];
  const yymmdd = (d) => d.slice(2, 4) + d.slice(5, 7) + d.slice(8, 10), mdy = (d) => +d.slice(5, 7) + '/' + +d.slice(8, 10) + '/' + d.slice(0, 4);
  const cab = { economy: 'economy', premium: 'premiumeconomy', business: 'business', first: 'first' }[cabin];
  const kay = (host, seg) => 'https://' + host + seg + from + '-' + to + '/' + d1 + (d2 ? '/' + d2 : '') + '/' + (cabin !== 'economy' ? (cabin === 'premium' ? 'premium' : cabin) + '/' : '') + ad + 'adults' + (ch ? '/children' + '-11'.repeat(ch) : '') + '?sort=bestflight_a';
  const q = 'Flights from ' + from + ' to ' + to + ' on ' + d1 + (d2 ? ' through ' + d2 : ' one way') + (cabin !== 'economy' ? ' ' + CABINS[cabin].toLowerCase() + ' class' : '') + (ad + ch > 1 ? ' for ' + ad + ' adults' + (ch ? ' and ' + ch + ' children' : '') : '');
  const ex = (a, b, d) => 'from:' + a + ',to:' + b + ',departure:' + mdy(d) + 'TANYT';
  return [
    { id: 'google', name: 'Google Flights', url: 'https://www.google.com/travel/flights?q=' + e(q), check: 'unconfirmed', note: 'the search is written as a sentence in q' },
    { id: 'skyscanner', name: 'Skyscanner', url: 'https://www.skyscanner.net/transport/flights/' + from.toLowerCase() + '/' + to.toLowerCase() + '/' + yymmdd(d1) + '/' + (d2 ? yymmdd(d2) + '/' : '') + '?adultsv2=' + ad + (ch ? '&childrenv2=' + Array(ch).fill('10').join('%7C') : '') + '&cabinclass=' + cab + '&rtn=' + (d2 ? 1 : 0), check: 'partly', note: 'the path is confirmed; the passenger and cabin parameters are not' },
    { id: 'kayak', name: 'Kayak', url: kay('www.kayak.com', '/flights/'), check: 'partly', note: 'the route and dates are confirmed; the passenger part is not' },
    { id: 'momondo', name: 'Momondo', url: kay('www.momondo.com', '/flight-search/'), check: 'unconfirmed', note: 'built like Kayak\'s (the same company); not confirmed' },
    { id: 'expedia', name: 'Expedia', url: 'https://www.expedia.com/Flights-Search?flight-type=on&mode=search&trip=' + (d2 ? 'roundtrip' : 'oneway') + '&leg1=' + e(ex(from, to, d1)) + (d2 ? '&leg2=' + e(ex(to, from, d2)) : '') + '&options=cabinclass:' + e(cab) + '&passengers=' + e('adults:' + ad + ',children:' + ch + ',infantinlap:' + (inf ? 'Y' : 'N')), check: 'confirmed', note: 'the leg and passenger parameters are in a published guide' },
  ];
}
const clamp = (v, lo, hi, or) => { const n = Math.round(+v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : or; };
/** the airline's own site by two-character code, or null (never a code that is not in the closed list). */
export const airlineSite = (code) => { const a = AIRLINES[String(code || '').toUpperCase()]; return a ? { code: String(code).toUpperCase(), name: a[0], url: a[1] } : null; };

// ---------- price log ----------
/** a price entry cleaned: { id, route 'JFK-LIS', date, ret, price, cur, src, seen, note } or null. */
export function cleanFare(r) {
  if (!r || typeof r !== 'object') return null;
  const m = /^([A-Za-z]{3})\s*[-–>→ ]+\s*([A-Za-z]{3})$/.exec(String(r.route || '').trim()), price = Math.round(parseFloat(String(r.price).replace(',', '.')) * 100) / 100;
  if (!m || !(price > 0) || price > 1e7) return null;
  const seen = /^\d{4}-\d{2}-\d{2}/.test(String(r.seen || '')) ? String(r.seen).slice(0, 16) : new Date().toISOString().slice(0, 16);
  return { id: String(r.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 24) || Math.random().toString(36).slice(2, 10), route: m[1].toUpperCase() + '-' + m[2].toUpperCase(), date: isoDate(r.date), ret: isoDate(r.ret), price, cur: String(r.cur || 'EUR').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3) || 'EUR', src: String(r.src || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 40), seen, note: String(r.note || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) };
}
/** the lowest fare seen for a route (and optionally a travel date), in one currency; null when none. */
export function lowestSeen(fares, route, date, cur) {
  const rows = fares.filter((f) => f.route === route && (!date || f.date === date) && (!cur || f.cur === cur)); if (!rows.length) return null;
  return rows.reduce((m, f) => (f.price < m.price ? f : m));
}
/** the routes in the log with their lowest, latest and count, in a currency. */
export function routeSummary(fares) {
  const by = new Map(); for (const f of fares) { const k = f.route + ' ' + f.cur; by.set(k, (by.get(k) || []).concat(f)); }
  return [...by.values()].map((rows) => { rows.sort((a, b) => a.seen.localeCompare(b.seen)); const low = rows.reduce((m, f) => (f.price < m.price ? f : m)), last = rows[rows.length - 1]; return { route: rows[0].route, cur: rows[0].cur, n: rows.length, low, last, change: rows.length > 1 ? last.price - rows[rows.length - 2].price : 0 }; }).sort((a, b) => a.route.localeCompare(b.route));
}
/** watches that are met: a watch is { route, target, cur }; met when some fare of that route in that currency is at or under the target (the lowest is returned). */
export function metWatches(watches, fares) {
  return (watches || []).map((w) => { const low = lowestSeen(fares, w.route, '', w.cur); return low && low.price <= w.target ? { watch: w, fare: low } : null; }).filter(Boolean);
}
/** an inline SVG line chart of a route's fares over the days they were seen (price on y, seen date on x); '' when fewer than two. */
export function chartSvg(rows, w = 320, h = 120) {
  const pts = rows.slice().sort((a, b) => a.seen.localeCompare(b.seen)); if (pts.length < 2) return '';
  const xs = pts.map((p) => Date.parse(p.seen + 'Z')), lo = Math.min(...pts.map((p) => p.price)), hi = Math.max(...pts.map((p) => p.price)), x0 = Math.min(...xs), x1 = Math.max(...xs), padd = 18;
  const X = (t) => padd + (x1 === x0 ? 0.5 : (t - x0) / (x1 - x0)) * (w - 2 * padd), Y = (v) => h - padd - (hi === lo ? 0.5 : (v - lo) / (hi - lo)) * (h - 2 * padd);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + X(xs[i]).toFixed(1) + ' ' + Y(p.price).toFixed(1)).join(' '), best = pts.reduce((m, p) => (p.price < m.price ? p : m));
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Price chart"><path d="' + line + '" fill="none" stroke="currentColor" stroke-width="2"/>' + pts.map((p, i) => '<circle cx="' + X(xs[i]).toFixed(1) + '" cy="' + Y(p.price).toFixed(1) + '" r="' + (p === best ? 5 : 3) + '" fill="' + (p === best ? 'var(--ok)' : 'currentColor') + '"/>').join('') + '<text x="' + padd + '" y="12" font-size="11" fill="currentColor">' + hi + '</text><text x="' + padd + '" y="' + (h - 4) + '" font-size="11" fill="currentColor">' + lo + '</text></svg>';
}
const csvCell = (v) => { let s = String(v == null ? '' : v); if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
export const FARE_HEAD = ['route', 'travel_date', 'return_date', 'price', 'currency', 'source', 'seen', 'note'];
/** the fares as CSV text (a cell that starts with = + - or @ gets a leading apostrophe so a sheet never runs it). */
export const faresToCsv = (fares) => [FARE_HEAD.join(','), ...fares.map((f) => [f.route, f.date, f.ret, f.price, f.cur, f.src, f.seen, f.note].map(csvCell).join(','))].join('\n') + '\n';
/** fares from CSV text (the same columns; quoted cells and doubled quotes; bad rows are skipped). */
export function faresFromCsv(text) {
  const rows = []; let row = [], f = '', q = false; const s = String(text || '');
  for (let i = 0; i < s.length; i++) { const c = s[i]; if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; } if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; } else if (c === '\n') { row.push(f); f = ''; rows.push(row); row = []; } else if (c !== '\r') f += c; }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  const head = (rows.shift() || []).map((h) => h.trim().toLowerCase()), col = (r, n) => (r[head.indexOf(n)] || '').replace(/^'(?=[=+\-@])/, '');
  return rows.map((r) => cleanFare({ route: col(r, 'route'), date: col(r, 'travel_date'), ret: col(r, 'return_date'), price: col(r, 'price'), cur: col(r, 'currency'), src: col(r, 'source'), seen: col(r, 'seen'), note: col(r, 'note') })).filter(Boolean);
}

// ---------- itineraries ----------
const MONTHS = { jan: 1, january: 1, januar: 1, feb: 2, february: 2, februar: 2, mar: 3, march: 3, mär: 3, maerz: 3, märz: 3, mrz: 3, apr: 4, april: 4, may: 5, mai: 5, jun: 6, june: 6, juni: 6, jul: 7, july: 7, juli: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, okt: 10, oktober: 10, nov: 11, november: 11, dec: 12, december: 12, dez: 12, dezember: 12 };
const MON = '(jan(?:uary|uar)?|feb(?:ruary|ruar)?|m(?:a|ä)r(?:ch|z)?|mrz|apr(?:il)?|may|mai|jun(?:e|i)?|jul(?:y|i)?|aug(?:ust)?|sep(?:t(?:ember)?)?|o(?:c|k)t(?:ober)?|nov(?:ember)?|de(?:c|z)(?:ember)?)';
const DATE_RES = [
  [/\b(\d{4})-(\d{2})-(\d{2})\b/g, (m) => [+m[1], +m[2], +m[3]]],
  [new RegExp('\\b(\\d{1,2})(?:st|nd|rd|th)?\\.?\\s+(?:of\\s+)?' + MON + '\\.?,?(?:\\s+(\\d{4}))?\\b', 'gi'), (m) => [m[3] ? +m[3] : 0, MONTHS[m[2].toLowerCase()], +m[1]]],
  [new RegExp('\\b' + MON + '\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?(?:\\s+(\\d{4}))?\\b', 'gi'), (m) => [m[3] ? +m[3] : 0, MONTHS[m[1].toLowerCase()], +m[2]]],
  [/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g, (m) => [+m[3], +m[2], +m[1]]],
  [/\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, (m) => (+m[1] > 12 ? [+m[3], +m[2], +m[1]] : [+m[3], +m[2], +m[1]])],
];
const TIME_RE = /\b([01]?\d|2[0-3])[:h]([0-5]\d)\s?(am|pm|a\.m\.|p\.m\.)?(?![\d:])/gi;
const LOC_RE = /(?:booking\s*(?:reference|ref|code|number)|confirmation\s*(?:number|code|no\.?)|record\s*locator|reservation\s*(?:code|number)|PNR|buchungs?\s*(?:code|referenz|nummer)|buchungscode|reservierungs\s*code)\s*[:#]?\s*([A-Z0-9]{5,8})\b/i;
const FN_RE = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/g;
/** the dates in a text with their position: [{ at, y, m, d }] (y is 0 when the text does not say the year). */
export function datesIn(text) {
  const out = []; for (const [re, f] of DATE_RES) { re.lastIndex = 0; let m; while ((m = re.exec(text))) { const [y, mo, d] = f(m); if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) out.push({ at: m.index, end: m.index + m[0].length, y, m: mo, d }); } }
  return out.sort((a, b) => a.at - b.at).filter((x, i, a) => !i || x.at >= a[i - 1].end);
}
/** the clock times in a text: [{ at, hh, mm }] (12-hour times with am or pm turned into 24-hour). */
export function timesIn(text) {
  const out = []; TIME_RE.lastIndex = 0; let m;
  while ((m = TIME_RE.exec(text))) { let hh = +m[1]; const ap = (m[3] || '').toLowerCase().replace(/\./g, ''); if (ap === 'pm' && hh < 12) hh += 12; if (ap === 'am' && hh === 12) hh = 0; if (hh > 23) continue; out.push({ at: m.index, end: m.index + m[0].length, hh, mm: +m[2], plus: /^\s*\(?\+\s?(\d)\)?/.exec(text.slice(m.index + m[0].length, m.index + m[0].length + 6)) }); }
  return out;
}
/**
 * Reads a pasted confirmation (an email, a booking page copied) into flight segments. A flight is a known airline's two-character code and a number (or any code after
 * the word "flight"); each segment takes the first two airports after it (a code in brackets, or a three-letter code the index knows), the first date at or before it
 * (the year of `today` when the text leaves the year out), and the first two times; "+1" after a time moves the arrival a day. Nothing is invented: a segment that
 * lacks an airport or a time is returned with that part empty so the visitor fills it. { segments, locator }.
 */
export function parseItinerary(text, idx, today = new Date()) {
  const t = String(text || '').replace(/[  ]/g, ' ').replace(/[ \t]+/g, ' '), dates = datesIn(t), locM = LOC_RE.exec(t), found = [];
  FN_RE.lastIndex = 0; let m;
  while ((m = FN_RE.exec(t))) {
    const code = m[1], label = /(?:flight|flug|vol|vuelo|voo|volo)\s*[:#]?\s*$/i.test(t.slice(Math.max(0, m.index - 14), m.index));
    if (!(AIRLINES[code] || label)) continue; if (/\d/.test(code[0]) && !AIRLINES[code]) continue;
    if (dates.some((d) => m.index >= d.at && m.index < d.end)) continue;
    found.push({ at: m.index, end: m.index + m[0].length, al: code, no: m[2] });
  }
  const segs = [];
  found.forEach((f, i) => {
    const stop = i + 1 < found.length ? found[i + 1].at : Math.min(t.length, f.end + 700), win = t.slice(f.end, stop);
    const ports = []; for (const x of win.matchAll(/\b([A-Z]{3})\b/g)) { if (idx.byIata.has(x[1]) && !ports.includes(x[1])) ports.push(x[1]); if (ports.length === 2) break; }
    if (ports.length < 2) for (const x of t.slice(Math.max(0, f.at - 120), f.at).matchAll(/\b([A-Z]{3})\b/g)) { if (idx.byIata.has(x[1]) && !ports.includes(x[1]) && ports.length < 2) ports.push(x[1]); }
    const times = timesIn(win).slice(0, 2), prevEnd = i ? found[i - 1].end : 0;
    const bef = dates.filter((d) => d.end <= f.at && d.at >= prevEnd && f.at - d.end <= 160).pop(), aft = dates.find((d) => d.at >= f.end && d.at < stop);
    const own = bef || aft, own2 = times.length === 2 ? dates.find((d) => d !== own && d.at >= f.end + times[0].end && d.at <= f.end + times[1].at && d.at < stop) : null;
    const fill = (d) => { if (!d) return ''; let y = d.y; if (!y) { y = today.getUTCFullYear(); if (Date.UTC(y, d.m - 1, d.d) < Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - 7 * 864e5) y++; } return y + '-' + pad(d.m) + '-' + pad(d.d); };
    const date1 = fill(own), date2 = own2 ? fill(own2) : date1;
    const dep = date1 && times[0] ? date1 + 'T' + pad(times[0].hh) + ':' + pad(times[0].mm) : '';
    let arr = date2 && times[1] ? date2 + 'T' + pad(times[1].hh) + ':' + pad(times[1].mm) : '';
    if (arr && times[1].plus && date2 === date1) arr = shiftDay(arr, +times[1].plus[1]);
    const a = ports[0] && idx.byIata.get(ports[0]), b = ports[1] && idx.byIata.get(ports[1]);
    if (dep && arr && a && b && date2 === date1 && !(times[1] && times[1].plus)) { const u1 = localToUtc(a.tz, dep); let k = 0; while (localToUtc(b.tz, arr) <= u1 && k++ < 2) arr = shiftDay(arr, 1); }
    segs.push({ id: Math.random().toString(36).slice(2, 10), al: f.al, no: f.no, from: ports[0] || '', to: ports[1] || '', dep, arr, loc: locM ? locM[1].toUpperCase() : '', note: '' });
  });
  return { segments: segs, locator: locM ? locM[1].toUpperCase() : '' };
}
function shiftDay(local, n) { const d = new Date(Date.UTC(+local.slice(0, 4), +local.slice(5, 7) - 1, +local.slice(8, 10) + n)); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()) + local.slice(10); }
/** a segment cleaned up: codes in capitals, dates as 'YYYY-MM-DDTHH:MM' or ''. */
export function cleanSeg(s) {
  if (!s || typeof s !== 'object') return null;
  const ldt = (v) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(v || '')) && isoDate(String(v).slice(0, 10)) ? String(v) : '');
  return { id: String(s.id || '').replace(/[^a-z0-9]/gi, '').slice(0, 12) || Math.random().toString(36).slice(2, 10), al: String(s.al || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3), no: String(s.no || '').replace(/\D/g, '').slice(0, 4), from: code3(s.from), to: code3(s.to), dep: ldt(s.dep), arr: ldt(s.arr), loc: String(s.loc || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8), note: String(s.note || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 120) };
}
/** a segment's moments: { depUtc, arrUtc, minutes } using the airports' zones (NaN where something is missing). */
export function segTimes(idx, s) {
  const a = idx.byIata.get(s.from), b = idx.byIata.get(s.to), depUtc = a && s.dep ? localToUtc(a.tz, s.dep) : NaN, arrUtc = b && s.arr ? localToUtc(b.tz, s.arr) : NaN;
  return { depUtc, arrUtc, minutes: (arrUtc - depUtc) / 60000 };
}
/**
 * Checks a trip's segments in the order of departure: for each pair, the time between the arrival and the next departure at that airport, in minutes, and notes:
 * overlap (the next flight leaves before this one lands), a connection too short to be safe (under 45 minutes, or under 90 between flights that cross a border or
 * change terminals, which a page cannot know: so under 60 is "tight"), a long wait (8 hours or more), an overnight wait, a change of airport, a break in the route
 * (the next flight leaves from somewhere else than where you landed, and not in the same city), and a flight that lands before it leaves (a time or a zone to check).
 * [{ from: seg, to: seg, minutes, notes: [{ kind, ... }] }] and a list of notes for single segments.
 */
export function layovers(idx, segs) {
  const sorted = segs.map(cleanSeg).filter(Boolean).filter((s) => s.from && s.to).sort((x, y) => (x.dep || '').localeCompare(y.dep || '')), out = [], single = [];
  for (const s of sorted) { const t = segTimes(idx, s); if (Number.isFinite(t.minutes) && t.minutes <= 0) single.push({ seg: s, kind: 'lands-before-leaving' }); if (Number.isFinite(t.minutes) && t.minutes > 24 * 60) single.push({ seg: s, kind: 'very-long' }); }
  for (let i = 0; i + 1 < sorted.length; i++) {
    const p = sorted[i], n = sorted[i + 1], tp = segTimes(idx, p), tn = segTimes(idx, n), notes = []; let minutes = (tn.depUtc - tp.arrUtc) / 60000;
    if (!Number.isFinite(minutes)) { out.push({ from: p, to: n, minutes: NaN, notes: [{ kind: 'unknown' }] }); continue; }
    const same = p.to === n.from, A = idx.byIata.get(p.to), B = idx.byIata.get(n.from);
    if (!same) { const city = A && B && (sameCity(idx, A).some((x) => x.iata === B.iata) || distanceKm(A, B) < 60); notes.push({ kind: city ? 'airport-change' : 'route-break', km: A && B ? distanceKm(A, B) : NaN }); }
    if (minutes < 0) notes.push({ kind: 'overlap' }); else if (minutes < 45) notes.push({ kind: 'too-short' }); else if (minutes < 60) notes.push({ kind: 'tight' }); else if (minutes >= 24 * 60) notes.push({ kind: 'stay' }); else if (minutes >= 12 * 60) notes.push({ kind: 'overnight' }); else if (minutes >= 8 * 60) notes.push({ kind: 'long' });
    if (!same && minutes >= 0 && minutes < 4 * 60 && notes.some((x) => x.kind === 'airport-change')) notes.push({ kind: 'airport-change-short' });
    out.push({ from: p, to: n, minutes, notes });
  }
  return { gaps: out, single, sorted };
}
/** the whole trip as one iCalendar file: one event per flight from its departure to its arrival (absolute UTC times, so any calendar shows them in the viewer's zone), with the airports, the flight number and the locator. Reuses the calendar's line folding and escaping (lib/ics.js). null when no segment has both times. */
export function tripIcs(idx, segs, now = new Date()) {
  const u = (ms) => { const d = new Date(ms); return d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) + 'T' + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + 'Z'; };
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//a-to-mind//Verse flights//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']; let n = 0;
  for (const s of segs.map(cleanSeg).filter(Boolean)) {
    const t = segTimes(idx, s); if (!Number.isFinite(t.depUtc) || !Number.isFinite(t.arrUtc) || t.arrUtc <= t.depUtc) continue; n++;
    const a = idx.byIata.get(s.from), b = idx.byIata.get(s.to), fl = (s.al + (s.no ? ' ' + s.no : '')).trim();
    L.push('BEGIN:VEVENT', 'UID:' + s.id + '-' + u(t.depUtc) + '@a-to-mind.com', 'DTSTAMP:' + u(now.getTime()), 'DTSTART:' + u(t.depUtc), 'DTEND:' + u(t.arrUtc),
      'SUMMARY:' + escText('✈ ' + (fl ? fl + ' ' : '') + s.from + ' → ' + s.to), 'LOCATION:' + escText(a ? a.name + ' (' + s.from + ')' : s.from),
      'DESCRIPTION:' + escText([fl && 'Flight ' + fl, a && 'From ' + a.name + ' (' + s.from + ') ' + s.dep.replace('T', ' ') + ' local', b && 'To ' + b.name + ' (' + s.to + ') ' + s.arr.replace('T', ' ') + ' local', s.loc && 'Booking reference ' + s.loc, s.note].filter(Boolean).join('\n')), 'END:VEVENT');
  }
  if (!n) return null; L.push('END:VCALENDAR'); return L.map(fold).join('\r\n') + '\r\n';
}
const b64u = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => new TextDecoder().decode(Uint8Array.from(atob(String(s).replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));
/** a trip as a short text for a link (#trip=...): segments as arrays, base64url. */
export const tripToToken = (segs) => b64u(JSON.stringify(segs.map(cleanSeg).filter(Boolean).slice(0, 30).map((s) => [s.al, s.no, s.from, s.to, s.dep, s.arr, s.loc, s.note])));
/** the segments in a link's token; [] when it is not one. */
export function tripFromToken(tok) {
  try { const a = JSON.parse(unb64u(tok)); return Array.isArray(a) ? a.slice(0, 30).map((r) => cleanSeg({ al: r[0], no: r[1], from: r[2], to: r[3], dep: r[4], arr: r[5], loc: r[6], note: r[7] })).filter((s) => s && (s.from || s.to)) : []; } catch (_) { return []; }
}

// ---------- chained routes (the great-circle map) ----------
/** "JFK-LHR-SIN" or "jfk lhr, sin" into airports, in order, skipping codes the index does not know; also returns the codes it could not read. */
export function parseRoute(idx, text) {
  const ports = [], bad = []; for (const tok of String(text || '').split(/[\s,\-–>→;/]+/).filter(Boolean)) { const a = airportOf(idx, tok); if (a) ports.push(a); else bad.push(tok); }
  return { ports, bad };
}
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
/** the coastline strings of lib/flights-coast.js (tools/coast-build.mjs) back into lines of [lon, lat] in degrees. Pure. */
export function decodeCoast(lines, q = 4) {
  return (lines || []).map((s) => { const nums = []; let v = 0, sh = 0; for (const ch of s) { const d = B64.indexOf(ch); if (d < 0) continue; v += (d & 31) * 2 ** sh; if (d >= 32) { sh += 5; continue; } nums.push(v % 2 ? -(v + 1) / 2 : v / 2); v = 0; sh = 0; }
    const pts = []; let x = 0, y = 0; for (let i = 0; i + 1 < nums.length; i += 2) { x += nums[i]; y += nums[i + 1]; pts.push([x / q, y / q]); } return pts; });
}
/** an equirectangular map as SVG: the coastlines when given (Natural Earth, lines of [lon, lat]), a 30-degree graticule, the airports and the great-circle paths between them drawn over them (a path across the date line is drawn in two pieces). */
export function mapSvg(ports, w = 640, h = 320, coast = null) {
  if (!ports.length && !coast) return '';
  const X = (lon) => ((lon + 540) % 360) / 360 * w, Y = (lat) => (90 - lat) / 180 * h; let g = '';
  if (coast) { let d = ''; for (const l of coast) { let prev = null; for (const [lon, lat] of l) { const x = X(lon === 180 ? 179.999 : lon), y = Y(lat); d += (prev === null || Math.abs(x - prev) > w / 2 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1); prev = x; } } g += '<path class="coast" d="' + d + '" fill="none" stroke="var(--soft)" stroke-width="0.8" stroke-linejoin="round"/>'; }
  for (let lo = -180; lo <= 180; lo += 30) g += '<line x1="' + X(lo === 180 ? 179.999 : lo).toFixed(1) + '" y1="0" x2="' + X(lo === 180 ? 179.999 : lo).toFixed(1) + '" y2="' + h + '" stroke="var(--line)" stroke-width="1"/>';
  for (let la = -60; la <= 60; la += 30) g += '<line x1="0" y1="' + Y(la) + '" x2="' + w + '" y2="' + Y(la) + '" stroke="var(--line)" stroke-width="' + (la === 0 ? 1.6 : 1) + '"/>';
  let paths = '';
  for (let i = 0; i + 1 < ports.length; i++) {
    const pts = pathPoints(ports[i], ports[i + 1], 64); let d = '', prev = null;
    for (const p of pts) { const lon = ((p.lon + 540) % 360) - 180, x = X(lon), y = Y(p.lat); d += (prev === null || Math.abs(x - prev) > w / 2 ? 'M' : 'L') + x.toFixed(1) + ' ' + y.toFixed(1) + ' '; prev = x; }
    paths += '<path d="' + d + '" fill="none" stroke="var(--accent)" stroke-width="2"/>';
  }
  const dots = ports.map((p) => '<circle cx="' + X(p.lon).toFixed(1) + '" cy="' + Y(p.lat).toFixed(1) + '" r="4" fill="var(--ink)"/><text x="' + (X(p.lon) + 6).toFixed(1) + '" y="' + (Y(p.lat) - 6).toFixed(1) + '" font-size="12" fill="var(--ink)">' + p.iata + '</text>').join('');
  return '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Route map">' + g + paths + dots + '</svg>';
}

// ---------- where can I go ----------
export const AIRCRAFT = Object.freeze([['Regional jet (about 1,500 km)', 1500], ['Narrow-body (about 5,500 km)', 5500], ['Wide-body (about 9,000 km)', 9000], ['Ultra long haul (about 14,000 km)', 14000]]);
/** airports within a flight-time window of an origin, nearest first: [{ a, km, minutes }]; optional country code and size. */
export function reachable(idx, from, { minMin = 0, maxMin = 600, cc = '', big = false, limit = 60 } = {}) {
  const out = []; for (const b of idx.list) { if (b.iata === from.iata || (cc && b.cc !== cc) || (big && b.size < 1)) continue; const km = distanceKm(from, b), min = flightMinutes(km); if (min >= minMin && min <= maxMin) out.push({ a: b, km, minutes: min }); }
  return out.sort((x, y) => x.km - y.km).slice(0, limit);
}

// ---------- nonstop routes (OpenFlights, June 2014; flights/routes.json, tools/routes-build.mjs) ----------
/** the nonstop routes from an airport in the packed file: [{ to, airlines: [...] }]; [] when it has none. Pure. */
export function routesFrom(packed, code) {
  const row = packed && packed.r && packed.r[String(code || '').toUpperCase()]; if (!row) return [];
  return row.split(';').filter(Boolean).map((x) => { const [to, al] = x.split('.'); return { to, airlines: al ? al.split(',') : [] }; });
}
