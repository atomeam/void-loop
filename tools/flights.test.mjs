// tests for the flights pages (lib/flights-core.js, lib/flight-sites.js, lib/flights-de.js, tools/airports-build.mjs, the table's pages): airport search, distance and time maths,
// time zones, the provider links, the price log, the itinerary reader and its layover checks, the German words, the asks that reach the pages and the floor's pages
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as C from '../void-live-deploy/lib/flights-core.js';
import { DE } from '../void-live-deploy/lib/flights-de.js';
import { FLIGHT_SITES, flightAskOf } from '../void-live-deploy/lib/flight-sites.js';
import { zoneOf, parseCsv, build } from './airports-build.mjs';
import { FLOORS, LANE_PAGES } from '../void-live-deploy/lib/tower.js';
import { probeFor } from './tower-probes.mjs';

const data = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/flights/airports.json', import.meta.url), 'utf8')), idx = C.makeIndex(data), A = (c) => C.airportOf(idx, c);

test('the airport index: about 4,000 airports with a code, a zone Intl knows, and the big ones present', () => {
  assert.ok(idx.list.length > 3500 && idx.list.length < 5000);
  for (const z of data.tz) assert.doesNotThrow(() => new Intl.DateTimeFormat('en', { timeZone: z }), z);
  for (const c of ['JFK', 'LHR', 'LIS', 'SIN', 'SYD', 'GRU', 'DXB', 'HND', 'FRA', 'YYZ']) assert.ok(A(c), c);
  assert.equal(A('LHR').icao, 'EGLL'); assert.equal(A('egll').iata, 'LHR'); assert.equal(A('LIS').tz, 'Europe/Lisbon'); assert.equal(A('DEN').tz, 'America/Denver'); assert.equal(A('HNL').tz, 'Pacific/Honolulu'); assert.equal(A('DPS').tz, 'Asia/Makassar');
  assert.equal(A('LPA').tz, 'Atlantic/Canary'); assert.equal(A('VVO').tz, 'Asia/Vladivostok'); assert.equal(A('YKS').tz, 'Asia/Yakutsk');
});
test('airport search by city, name, code, accents and city codes', () => {
  const s = (q) => C.searchAirports(idx, q, 6).map((a) => a.iata);
  assert.equal(s('lisbon')[0], 'LIS'); assert.equal(s('LIS')[0], 'LIS'); assert.equal(s('heathrow')[0], 'LHR'); assert.equal(s('EGLL')[0], 'LHR'); assert.equal(s('zürich')[0], 'ZRH'); assert.equal(s('Zuerich')[0], 'ZRH');
  assert.deepEqual(s('NYC').slice(0, 3), ['JFK', 'LGA', 'EWR']); assert.deepEqual(s('LON').slice(0, 2), ['LHR', 'LGW']); assert.equal(s('london')[0], 'LHR'); assert.equal(s('new york')[0], 'JFK');
  assert.equal(s('münchen')[0], 'MUC'); assert.equal(s('Wien')[0], 'VIE'); assert.deepEqual(s(''), []); assert.deepEqual(s('zzzzqqq'), []);
  assert.ok(s('frankfurt').includes('FRA'));
  // a city with its country (as the scores page asks for a game's ground) ranks like the bare city, and picks the right one of two cities
  assert.deepEqual(s('London United Kingdom').slice(0, 2), ['LHR', 'LGW']); assert.equal(s('Manchester')[0], 'MHT'); assert.equal(s('Manchester United Kingdom')[0], 'MAN');
  assert.equal(s('Paris France')[0], 'CDG'); assert.equal(s('Madrid Spain')[0], 'MAD'); assert.equal(s('Boston United States')[0], 'BOS');
});
test('nearby airports and airports of the same city', () => {
  const n = C.nearby(idx, A('LHR'), 60, 5).map((x) => x.a.iata); assert.ok(n.includes('LGW') && n.includes('LCY') && !n.includes('LHR'));
  assert.ok(C.sameCity(idx, A('JFK')).map((a) => a.iata).includes('EWR')); assert.deepEqual(C.sameCity(idx, A('LIS')), []);
});
test('great-circle distance, bearing and the date line', () => {
  const d = C.distanceKm(A('LHR'), A('JFK')); assert.ok(d > 5520 && d < 5560, d); assert.ok(Math.abs(C.distanceKm(A('JFK'), A('LHR')) - d) < 1e-6);
  assert.ok(Math.abs(C.distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 90 }) - 10007.5) < 1, 'a quarter of the equator'); assert.equal(C.distanceKm(A('LIS'), A('LIS')), 0);
  assert.ok(Math.abs(C.km2mi(100) - 62.137) < 0.01); assert.ok(Math.abs(C.km2nm(100) - 53.996) < 0.01);
  const b = C.bearing({ lat: 0, lon: 0 }, { lat: 0, lon: 10 }); assert.ok(Math.abs(b - 90) < 1e-6);
  assert.ok(C.crossesDateLine(A('SYD'), A('LAX'))); assert.ok(!C.crossesDateLine(A('JFK'), A('LHR'))); assert.ok(!C.crossesDateLine(A('LHR'), A('SIN')));
  const pts = C.pathPoints(A('SYD'), A('LAX'), 20); for (let i = 1; i < pts.length; i++) assert.ok(Math.abs(pts[i].lon - pts[i - 1].lon) < 30, 'a continuous path across the date line');
});
test('flight time: half an hour plus the distance at 805 km/h, by the worked numbers', () => {
  assert.equal(C.flightMinutes(805), 90); assert.equal(C.flightMinutes(0), 30); assert.equal(C.flightMinutes(8050), 630); assert.equal(C.hm(90), '1 h 30 min'); assert.equal(C.hm(45), '45 min'); assert.equal(C.hm(605), '10 h 05 min');
  const m = C.flightMinutes(C.distanceKm(A('LAX'), A('MSP'))); assert.ok(m > 205 && m < 225, m);
});
test('time zones: offsets with daylight saving, local to UTC and back, and the arrival of a leg', () => {
  assert.equal(C.offsetMin('America/New_York', Date.UTC(2026, 11, 1)), -300); assert.equal(C.offsetMin('America/New_York', Date.UTC(2026, 6, 1)), -240); assert.equal(C.offsetMin('Asia/Kolkata', Date.UTC(2026, 0, 1)), 330); assert.equal(C.offsetLabel(330), 'UTC+05:30'); assert.equal(C.offsetLabel(-300), 'UTC−05');
  const u = C.localToUtc('America/New_York', '2026-12-01T19:00'); assert.equal(new Date(u).toISOString(), '2026-12-02T00:00:00.000Z'); assert.equal(C.utcToLocal('Europe/London', u).local, '2026-12-02T00:00');
  const f = C.legFacts(A('JFK'), A('LHR'), '2026-12-01T19:00'); assert.equal(f.diffMin, 300); assert.equal(f.dayShift, 1); assert.ok(f.arrLocal.startsWith('2026-12-02T0')); assert.ok(!f.dateLine);
  const g = C.legFacts(A('SYD'), A('LAX'), '2026-12-01T10:00'); assert.equal(g.dayShift, 0); assert.ok(g.dateLine); assert.ok(g.diffMin < -17 * 60, 'Los Angeles is 19 hours behind Sydney in December');
  assert.equal(C.legFacts(A('LHR'), A('FRA'), '2026-12-01T10:00').diffMin, 60);
});
test('the zone of an airport in a country with several zones', () => {
  assert.deepEqual(zoneOf('US', 'US-TX', 31.8, -106.4), ['America/Denver', false]); assert.deepEqual(zoneOf('US', 'US-FL', 30.4, -87.2), ['America/Chicago', false]); assert.deepEqual(zoneOf('AU', 'AU-WA', -31.9, 115.9), ['Australia/Perth', false]);
  assert.deepEqual(zoneOf('BR', 'BR-AM', -3.0, -60.0), ['America/Manaus', false]); assert.deepEqual(zoneOf('CN', '', 40, 116), ['Asia/Shanghai', false]); assert.equal(zoneOf('RU', '', 56, 92)[1], true, 'a Russian airport is placed by position');
  assert.deepEqual(parseCsv('a,b\n1,"x, ""y"""\n'), [{ a: '1', b: 'x, "y"' }]);
  const small = build('"id","ident","type","name","latitude_deg","longitude_deg","iso_country","iso_region","municipality","scheduled_service","icao_code","iata_code"\n1,"EGLL","large_airport","London Heathrow Airport",51.47,-0.46,"GB","GB-ENG","London","yes","EGLL","LHR"\n2,"X","heliport","Pad",1,1,"GB","GB-ENG","","no","","H"\n', 'id,code,name\n1,GB,United Kingdom\n');
  assert.equal(small.a.length, 1); assert.equal(small.tz[small.a[0][7]], 'Europe/London'); assert.equal(small.countries.GB, 'United Kingdom');
});
test('CO2: the fixed part, the distance part, the cabin and the return trip', () => {
  const km = 1000, e = C.co2(km); assert.ok(Math.abs(e.kg - (20 + 0.09 * 1100)) < 1e-9); assert.ok(e.low < e.kg && e.high > e.kg); assert.equal(e.withNonCo2, e.kg * 1.9);
  assert.equal(C.co2(km, 'business').kg, e.kg * 1.5); const l = C.co2(6000); assert.equal(C.co2(6000, 'business').kg / l.kg, 2.9); assert.equal(C.co2(6000, 'first').kg / l.kg, 4); assert.equal(C.co2(km, 'economy', 2, true).kg, e.kg * 4);
  const lhrJfk = C.co2(C.distanceKm(A('LHR'), A('JFK'))).kg; assert.ok(lhrJfk > 450 && lhrJfk < 650, lhrJfk);
});
test('provider links: a closed list of hosts, every field encoded or reduced to letters and digits', () => {
  const s = { from: 'jfk', to: 'LIS', depart: '2026-12-01', ret: '2026-12-08', pax: { adults: 2, children: 1 }, cabin: 'business' }, links = C.providerLinks(s);
  assert.deepEqual(links.map((l) => l.id), ['google', 'skyscanner', 'kayak', 'momondo', 'expedia']);
  assert.deepEqual(links.map((l) => new URL(l.url).host), ['www.google.com', 'www.skyscanner.net', 'www.kayak.com', 'www.momondo.com', 'www.expedia.com']);
  assert.match(links[1].url, /\/transport\/flights\/jfk\/lis\/261201\/261208\/\?adultsv2=2/); assert.match(links[2].url, /\/flights\/JFK-LIS\/2026-12-01\/2026-12-08\/business\/2adults/); assert.match(links[4].url, /leg1=from%3AJFK%2Cto%3ALIS%2Cdeparture%3A12%2F1%2F2026TANYT/);
  assert.equal(C.providerLinks({ ...s, oneWay: true }).every((l) => !/2026-12-08|261208|12%2F8/.test(l.url)), true, 'a one-way search carries no return date');
  const evil = C.providerLinks({ from: 'J/K"', to: 'LIS', depart: '2026-12-01' }); assert.deepEqual(evil, []); assert.deepEqual(C.providerLinks({ from: 'JFK', to: 'LIS', depart: '2026-13-45' }), []);
  for (const l of links) { assert.match(l.url, /^https:\/\//); assert.ok(['confirmed', 'partly', 'unconfirmed'].includes(l.check)); assert.ok(!/[<>"' ]/.test(l.url), l.url); }
  assert.equal(C.airlineSite('tp').url, 'https://www.flytap.com/'); assert.equal(C.airlineSite('ZZ'), null);
  for (const [k, [n, u]] of Object.entries(C.AIRLINES)) { assert.match(k, /^[A-Z0-9]{2}$/); assert.match(u, /^https:\/\/[a-z0-9.-]+\/$/, n); }
});
test('the price log: clean, lowest seen, summary, watches, CSV round trip and CSV formula safety', () => {
  const f = [{ route: 'jfk-lis', date: '2026-12-01', price: '480', cur: 'eur', src: 'Kayak', seen: '2026-10-01T10:00' }, { route: 'JFK LIS', date: '2026-12-01', price: '420,50', cur: 'EUR', src: 'Skyscanner', seen: '2026-10-05T10:00' }, { route: 'JFK-LIS', date: '2026-12-01', price: '455', seen: '2026-10-09T10:00', note: '=HYPERLINK("x")' }, { route: 'bad', price: 5 }, { route: 'AAA-BBB', price: -1 }].map(C.cleanFare).filter(Boolean);
  assert.equal(f.length, 3); assert.equal(f[1].price, 420.5); assert.equal(f[0].route, 'JFK-LIS'); assert.equal(C.lowestSeen(f, 'JFK-LIS').price, 420.5); assert.equal(C.lowestSeen(f, 'JFK-LIS', '2027-01-01'), null);
  const sum = C.routeSummary(f)[0]; assert.equal(sum.n, 3); assert.equal(sum.low.price, 420.5); assert.equal(sum.last.price, 455); assert.equal(sum.change, 455 - 420.5);
  assert.equal(C.metWatches([{ route: 'JFK-LIS', target: 430, cur: 'EUR' }, { route: 'JFK-LIS', target: 400, cur: 'EUR' }], f).length, 1); assert.equal(C.metWatches([{ route: 'JFK-LIS', target: 430, cur: 'USD' }], f).length, 0);
  const csv = C.faresToCsv(f); assert.ok(csv.startsWith('route,travel_date')); assert.ok(/'=HYPERLINK/.test(csv), 'a cell starting with = is made harmless'); const back = C.faresFromCsv(csv); assert.equal(back.length, 3); assert.equal(back[2].note, '=HYPERLINK("x")'); assert.equal(back[1].price, 420.5);
  assert.match(C.chartSvg(f), /<svg[\s\S]*<path/); assert.equal(C.chartSvg(f.slice(0, 1)), '');
});
const CONFIRM = 'Your booking is confirmed. Booking reference: ABC123\nSaturday 12 December 2026\nBA 117 London Heathrow (LHR) 18:25 → New York JFK (JFK) 21:05\nReturn: 20 Dec 2026\nBA 178 JFK 22:00 LHR 09:50 +1';
test('the itinerary reader: flights, airports, dates, times, the +1 day and the booking reference', () => {
  const r = C.parseItinerary(CONFIRM, idx, new Date('2026-10-26')); assert.equal(r.locator, 'ABC123'); assert.equal(r.segments.length, 2);
  assert.deepEqual(r.segments.map((s) => [s.al, s.no, s.from, s.to, s.dep, s.arr]), [['BA', '117', 'LHR', 'JFK', '2026-12-12T18:25', '2026-12-12T21:05'], ['BA', '178', 'JFK', 'LHR', '2026-12-20T22:00', '2026-12-21T09:50']]);
  const de = C.parseItinerary('Buchungscode: XY12Z9\nFlug LH 400 Frankfurt (FRA) 10:30 - New York (JFK) 13:00\n3. März 2027', idx, new Date('2026-10-26')); assert.equal(de.locator, 'XY12Z9'); assert.equal(de.segments[0].from, 'FRA'); assert.equal(de.segments[0].dep, '2027-03-03T10:30');
  const pm = C.parseItinerary('Dec 12, 2026\nDL 100 JFK 2:35 PM LHR 9:10 PM', idx, new Date('2026-10-26')); assert.equal(pm.segments[0].dep, '2026-12-12T14:35'); assert.equal(pm.segments[0].arr, '2026-12-12T21:10');
  const night = C.parseItinerary('12 Dec 2026\nUA 904 JFK 22:50 LIS 10:40', idx, new Date('2026-10-26')); assert.equal(night.segments[0].arr, '2026-12-13T10:40', 'an arrival earlier on the clock than the departure is the next day');
  assert.equal(C.parseItinerary('hello there, nothing to read', idx).segments.length, 0); assert.equal(C.parseItinerary('Order 12 Jan 2026, item AB 12', idx).segments.length, 0, 'AB is not an airline');
  const part = C.parseItinerary('BA 117', idx); assert.equal(part.segments[0].from, ''); assert.equal(part.segments[0].dep, '');
});
test('layovers: too short, tight, long, overnight, a stay, an overlap, a change of airport, a break in the route', () => {
  const seg = (al, no, from, to, dep, arr) => ({ al, no, from, to, dep, arr });
  const gap = (b) => C.layovers(idx, [seg('BA', '1', 'LHR', 'JFK', '2027-03-12T10:00', '2027-03-12T13:00'), b]).gaps[0];
  const kinds = (g) => g.notes.map((n) => n.kind);
  assert.deepEqual(kinds(gap(seg('UA', '2', 'JFK', 'LIS', '2027-03-12T13:40', '2027-03-13T01:50'))), ['too-short']); assert.equal(gap(seg('UA', '2', 'JFK', 'LIS', '2027-03-12T13:40', '2027-03-13T01:50')).minutes, 40);
  assert.deepEqual(kinds(gap(seg('UA', '2', 'JFK', 'LIS', '2027-03-12T13:55', '2027-03-13T01:50'))), ['tight']); assert.deepEqual(kinds(gap(seg('UA', '2', 'JFK', 'LIS', '2027-03-12T15:00', '2027-03-13T03:00'))), []);
  assert.deepEqual(kinds(gap(seg('UA', '2', 'JFK', 'LIS', '2027-03-12T22:00', '2027-03-13T10:00'))), ['long']); assert.deepEqual(kinds(gap(seg('UA', '2', 'JFK', 'LIS', '2027-03-13T02:00', '2027-03-13T14:00'))), ['overnight']); assert.deepEqual(kinds(gap(seg('UA', '2', 'JFK', 'LIS', '2027-03-20T10:00', '2027-03-20T22:00'))), ['stay']);
  assert.ok(kinds(gap(seg('UA', '2', 'LGA', 'LIS', '2027-03-12T15:30', '2027-03-13T03:00'))).includes('airport-change')); assert.ok(kinds(gap(seg('UA', '2', 'BOS', 'LIS', '2027-03-12T15:30', '2027-03-13T03:00'))).includes('route-break'));
  const same = C.layovers(idx, [seg('BA', '1', 'LHR', 'JFK', '2027-03-12T10:00', '2027-03-12T13:00'), seg('UA', '2', 'JFK', 'LIS', '2027-03-12T11:00', '2027-03-12T20:00')]).gaps[0]; assert.ok(kinds(same).includes('overlap'));
  assert.equal(C.layovers(idx, [seg('BA', '1', 'LHR', 'JFK', '2027-03-12T10:00', '2027-03-12T04:00')]).single[0].kind, 'lands-before-leaving');
  assert.equal(C.layovers(idx, [seg('BA', '1', 'LHR', 'JFK', '2027-03-12T10:00', ''), seg('UA', '2', 'JFK', 'LIS', '2027-03-12T13:40', '')]).gaps[0].notes[0].kind, 'unknown');
});
test('the calendar file and the trip link', () => {
  const r = C.parseItinerary(CONFIRM, idx, new Date('2026-10-26')), ics = C.tripIcs(idx, r.segments, new Date('2026-10-26T12:00:00Z'));
  assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n')); assert.match(ics, /DTSTART:20261212T182500Z/); assert.match(ics, /DTEND:20261213T020500Z/); assert.match(ics, /SUMMARY:✈ BA 117 LHR → JFK/); assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 2); assert.ok(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75));
  assert.equal(C.tripIcs(idx, [{ al: 'BA', no: '1', from: 'LHR', to: 'JFK' }]), null);
  const back = C.tripFromToken(C.tripToToken(r.segments)); assert.deepEqual(back.map((s) => [s.al, s.no, s.from, s.to, s.dep, s.arr, s.loc]), r.segments.map((s) => [s.al, s.no, s.from, s.to, s.dep, s.arr, s.loc]));
  assert.deepEqual(C.tripFromToken('not a token!'), []); assert.deepEqual(C.tripFromToken(''), []);
  const hostile = C.cleanSeg({ al: '<BA', no: '12x34567', from: 'jfk<', to: 'LHR', dep: '2026-12-12T10:00', arr: 'nope', note: 'x'.repeat(500) }); assert.equal(hostile.al, 'BA'); assert.equal(hostile.no, '1234'); assert.equal(hostile.from, ''); assert.equal(hostile.arr, ''); assert.equal(hostile.note.length, 120);
});
test('a chain of airports and the map; where can I go', () => {
  const r = C.parseRoute(idx, 'jfk-lhr, SIN zzz'); assert.deepEqual(r.ports.map((a) => a.iata), ['JFK', 'LHR', 'SIN']); assert.deepEqual(r.bad, ['zzz']);
  const svg = C.mapSvg(r.ports); assert.match(svg, /<svg[\s\S]*<path[\s\S]*<path/); assert.equal(C.mapSvg([]), ''); assert.ok((C.mapSvg(C.parseRoute(idx, 'SYD-LAX').ports).match(/M/g) || []).length >= 2, 'a path across the date line is drawn in two pieces');
  const near = C.reachable(idx, A('LIS'), { maxMin: 90, big: true }); assert.ok(near.length > 3 && near.every((x) => x.minutes <= 90 && x.a.size >= 1)); assert.ok(C.reachable(idx, A('LIS'), { maxMin: 240, cc: 'ES' }).some((x) => x.a.iata === 'MAD'));
});
test('every sentence the screen says has a German one, and German keeps its numbers', () => {
  const src = fs.readFileSync(new URL('../void-live-deploy/lib/flights-ui.js', import.meta.url), 'utf8'), keys = new Set();
  for (const m of src.matchAll(/\bt\('((?:[^'\\]|\\.)*)'\)/g)) keys.add(m[1]); for (const m of src.matchAll(/(?:pane|picker)\('((?:[^'\\]|\\.)*)'/g)) keys.add(m[1]);
  for (const m of src.matchAll(/t\(([^()]*\?[^()]*)\)/g)) for (const k of m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)) keys.add(k[1]);
  const words = src.match(/const words = \{([\s\S]*?)\};/)[1]; for (const k of words.matchAll(/: '((?:[^'\\]|\\.)*)'/g)) keys.add(k[1]);
  const missing = [...keys].filter((k) => !DE[k] && k !== 'lands-before-leaving' && !/^[a-z-]+$/.test(k) || (/^[a-z-]+$/.test(k) && !DE[k] && ['day', 'days', 'flight', 'flights', 'miles', 'none', 'local', 'now'].includes(k))); assert.deepEqual(missing, []);
  for (const [k, v] of Object.entries(DE)) { assert.ok(v && v !== k || /^(Economy|Business|Airline|First)$/.test(k), k); for (const n of k.match(/\d[\d.,]*/g) || []) if (n.length > 1) assert.ok(v.includes(n) || v.includes(n.replace('.', ',')) || v.includes(n.replace(',', '.')), k + ' keeps ' + n); }
});
test('the table: one page for the leader and one for each site of the lane, each with its panels, its German and no other site named', () => {
  const lane = FLOORS.filter((f) => f.lane === 'travel'); assert.equal(lane.length, 7);
  for (const f of lane) { const page = LANE_PAGES[f.id]; assert.ok(page, f.id); assert.ok(FLIGHT_SITES.some((r) => r.path === page && r.lane === f.id), f.id + ' has a row'); assert.equal(f.page, page); assert.equal(probeFor(f.id).verse, page); assert.ok(probeFor(f.id).truth.length >= 3, f.id + ' has truths'); const parts = probeFor(f.id).askParts; for (const a of f.extra) assert.ok(parts[a], f.id + ' asks about ' + a); }
  assert.equal(FLIGHT_SITES.filter((r) => r.lane === 'travel').length, 1); assert.equal(FLOORS.find((f) => f.id === 'travel').page, '/flights/', 'the floor reads its page from the probe'); assert.equal(probeFor('travel').verse, '/flights/');
  for (const f of FLOORS.filter((x) => x.id === 'travel')) for (const a of f.extra) assert.ok(probeFor('travel').askParts[a], a);
  for (const r of FLIGHT_SITES) { assert.ok(r.panels.length && r.de && r.de.h1 && r.de.intro, r.path); assert.doesNotMatch(r.intro + r.does + r.asks.join(' ') + r.h1, /\.com\b|\.org\b|\.net\b|\.io\b|tripwaffle|clock7|myclimate|gcmap|flightconnections|aruljohn|airmiles/i, r.path + ' names no other site'); assert.ok(fs.existsSync(new URL('../void-live-deploy' + r.path + 'index.html', import.meta.url)), r.path); }
});
test('the asks that reach the pages', () => {
  const o = (q) => flightAskOf(q);
  assert.equal(o('flights to lisbon'), '/flights/?toq=lisbon'); assert.equal(o('cheap flights'), '/flights/'); assert.equal(o('flights from london to paris'), '/flights/?fromq=london&toq=paris'); assert.equal(o('flights to lisbon from new york'), '/flights/?fromq=new%20york&toq=lisbon');
  assert.equal(o('flight time london new york'), '/flights/time/?fromq=london&toq=new%20york'); assert.equal(o('how long is the flight from paris to tokyo'), '/flights/time/?fromq=paris&toq=tokyo'); assert.equal(o('distance from london to new york'), '/flights/distance/?fromq=london&toq=new%20york');
  assert.equal(o('airport codes'), '/flights/airports/'); assert.equal(o('layover calculator'), '/flights/trip/'); assert.equal(o('flight co2 calculator'), '/flights/co2/'); assert.equal(o('great circle map'), '/flights/map/');
  assert.equal(o('flight distance'), '/flights/distance/'); assert.equal(o('where can i fly'), '/flights/routes/'); assert.equal(o('where can i fly from berlin'), '/flights/routes/?fromq=berlin');
  assert.equal(o('destinations from lisbon'), '/flights/routes/?fromq=lisbon'); assert.equal(o('airports within 3 hours of london'), '/flights/routes/?fromq=london'); assert.equal(o('nonstop destinations'), '/flights/routes/');
  for (const no of ['fly to tokyo', 'flight', 'my flight is delayed', 'how do planes fly', 'merge pdf', 'distance to the moon', 'time in tokyo', 'destinations', 'where can i fly a drone']) assert.equal(o(no), '', no);
  for (const s of FLIGHT_SITES) assert.notEqual(o(s.card), '', 'the stage ask of ' + s.path + ' is a flight ask: ' + s.card);
});
test('coastlines: the encoder and the decoder agree, the file is small, and the map draws them under the route', async () => {
  const { linesOf, encodeLine, varint, Q } = await import('./coast-build.mjs'), { COAST, COAST_Q } = await import('../void-live-deploy/lib/flights-coast.js');
  const geo = { features: [{ geometry: { type: 'LineString', coordinates: [[-9.13, 38.72], [-9.13, 38.72], [2.35, 48.85], [179.9, -16.5], [-179.9, -16.6]] } }] }, lines = linesOf(geo);
  assert.deepEqual(lines[0].length, 4, 'a repeated point is dropped'); assert.deepEqual(C.decodeCoast(lines.map(encodeLine), Q)[0], lines[0].map(([x, y]) => [x / Q, y / Q]));
  for (const n of [1, -1, 15, -16, 16, 1000, -720]) assert.deepEqual(C.decodeCoast([varint(0) + varint(0) + varint(n) + varint(-n)], 1)[0][1], [n, -n]);
  assert.equal(COAST_Q, 4); assert.ok(COAST.length > 100 && JSON.stringify(COAST).length < 20000, 'about 11 KB');
  const world = C.decodeCoast(COAST, COAST_Q); assert.ok(world.every((l) => l.every(([x, y]) => x >= -180 && x <= 180 && y >= -90 && y <= 90)));
  const svg = C.mapSvg(C.parseRoute(idx, 'JFK-LHR').ports, 640, 320, world); assert.ok(svg.indexOf('class="coast"') < svg.indexOf('stroke="var(--accent)"'), 'the coast is drawn first, under the route');
});
test('nonstop routes: read from routes.dat, packed, and read back; the file credits OpenFlights under the ODbL and says June 2014', async () => {
  const { routesOf, pack } = await import('./routes-build.mjs');
  const dat = 'TP,1,LIS,1,MAD,2,,0,320\nIB,2,LIS,1,MAD,2,Y,0,320\nTP,1,LIS,1,OPO,3,,0,320\nXX,9,LIS,1,ZZZ,4,,0,320\nTP,1,LIS,1,JFK,5,,1,330\n', p = pack(routesOf(dat, new Set(['LIS', 'MAD', 'OPO', 'JFK'])));
  assert.deepEqual(C.routesFrom(p, 'LIS'), [{ to: 'MAD', airlines: ['IB', 'TP'] }, { to: 'OPO', airlines: ['TP'] }], 'nonstop only, known airports only'); assert.deepEqual(C.routesFrom(p, 'MAD'), []);
  const real = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/flights/routes.json', import.meta.url), 'utf8')); assert.equal(real.asOf, '2014-06'); assert.match(real.licence, /ODbL/); assert.match(real.licence, /OpenFlights/);
  const lis = C.routesFrom(real, 'LIS').map((r) => r.to); assert.ok(lis.includes('MAD') && lis.includes('OPO')); for (const r of C.routesFrom(real, 'LHR')) assert.ok(idx.byIata.has(r.to), r.to);
});
test('the stage card: takes flight asks, leaves distance asks to the distance skill, and links the page with the places in it', async () => {
  const skill = (await import('../void-live-deploy/skills/flights.js')).default;
  for (const a of ['flights to lisbon', 'cheap flights', 'flight time london new york', 'airport codes']) assert.ok(skill.match(a), a);
  for (const a of ['distance from london to new york', 'fly to tokyo', 'my flight is delayed']) assert.ok(!skill.match(a), a);
  for (const a of ['flight distance', 'where can i fly', 'great circle map']) assert.ok(skill.match(a), a);
  const names = JSON.parse(fs.readFileSync(new URL('../void-live-deploy/skills/index.json', import.meta.url), 'utf8')), mods = [];
  for (const n of names) { const sk = (await import(new URL('../void-live-deploy/skills/' + n + '.js', import.meta.url).href)).default; mods.push(...(sk.family ? sk.members : [sk])); }
  for (const s of FLIGHT_SITES) { const k = mods.find((m) => m.match(s.card.toLowerCase(), s.card)); assert.equal(k && k.name, 'flights', 'the stage gives the card ask of ' + s.path + ' to the flights card: ' + s.card); }
  let html = ''; const el = { dataset: {}, set innerHTML(v) { html = v; } }; assert.equal(skill.run('flights to lisbon', { showPage: (f) => f(el), esc: (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;') }), 'flights');
  assert.match(html, /href="\/flights\/\?toq=lisbon"/); assert.match(html, /no live fares/); assert.equal(el.dataset.page, '/flights/?toq=lisbon', 'the full page link keeps the places too');
  const { pageOfCard } = await import('../void-live-deploy/lib/card-frame.js'), api = { showPage: (f) => f(el), esc: (s) => String(s) };
  skill.run('where can i fly from berlin', api); assert.deepEqual(pageOfCard('flights', el.dataset.page)[0], '/flights/routes/?fromq=berlin', 'the full page opens on Berlin');
  skill.run('flights to sao paulo', api); assert.equal(el.dataset.page, '/flights/?toq=sao%20paulo');
  skill.run("flights to xi'an", api); assert.equal(el.dataset.page, '/flights/', 'a query card-frame would refuse drops to the plain page');
  skill.run('cheap flights', api); assert.equal(el.dataset.page, '/flights/');
});

test('the leg links: the landing moment in both cities with their zones, the weather at the arrival airport, and the flight as a calendar event', async () => {
  const a = { iata: 'JFK', city: 'New York', tz: 'America/New_York', country: 'United States', lat: 40.6413, lon: -73.7781 }, b = { iata: 'OGG', city: 'Kahului, Maui', cc: 'US', tz: 'Pacific/Honolulu', country: 'United States', lat: 20.8986, lon: -156.4305 };
  const f = C.legFacts(a, b, '2026-11-20T09:00'), l = C.legLinks(a, b, f), u = (s) => new URL(s, 'https://verse.test');
  const tm = u(l.time); assert.equal(tm.pathname, '/time/'); assert.equal(Date.parse(tm.searchParams.get('at')), f.arrUtc);
  assert.deepEqual(tm.searchParams.get('cities').split(','), ['New York@America/New_York', 'Kahului Maui@Pacific/Honolulu'], 'a comma in a city name never splits the list');
  const { placeAt } = await import('../void-live-deploy/lib/zones.js');
  assert.deepEqual(tm.searchParams.get('cities').split(',').map(placeAt), [{ name: 'New York', tz: 'America/New_York' }, { name: 'Kahului Maui', tz: 'Pacific/Honolulu' }]);
  const w = u(l.weather); assert.equal(w.searchParams.get('place'), 'Kahului Maui, United States'); assert.equal(w.searchParams.get('ll'), '20.8986,-156.4305');
  const { eventFromLink } = await import('../void-live-deploy/lib/calendar.js'), ev = eventFromLink(u(l.calendar).searchParams.get('e'));
  assert.equal(ev.title, 'Flight JFK → OGG'); assert.equal(ev.start, '2026-11-20T09:00'); assert.equal(ev.tz, 'America/New_York'); assert.equal(ev.location, 'New York');
  assert.equal(C.localToUtc('America/New_York', ev.end), f.arrUtc, 'the event ends when the flight lands'); assert.ok(ev.notes.includes(f.arrDate + ' ' + f.arrTime));
  const { placeFromLink } = await import('../void-live-deploy/lib/local-media.js'), lo = u(l.local);
  assert.equal(lo.pathname, '/local/'); assert.deepEqual(placeFromLink(lo.search), { city: 'Kahului Maui', region: '', regionCode: '', country: 'US', lat: 20.9, lon: -156.43 }, 'the stations are found at the arrival airport, with no name to look up');
  assert.equal(C.legLinks(a, { ...b, cc: '' }, f).local, '', 'no country, no local link');
  assert.equal(C.legLinks(a, { ...b, cc: 'gb' }, f).jobs, '/jobs/?cc=GB'); assert.equal(C.legLinks(a, { ...b, cc: '' }, f).jobs, '', 'no country, no jobs link');
  for (const s of ['Landing time in both cities', 'Weather where it lands', 'Add the flight to my calendar', 'Radio and TV where it lands']) assert.ok(DE[s], 'German for ' + s);
});

test('the airport near a place another page found: the nearest large one, else a medium one, never a small field or a far one', () => {
  const n = (lat, lon) => (C.airportNear(idx, lat, lon) || {}).iata || null;
  assert.equal(n(51.507, -0.128), 'LHR'); assert.equal(n(42.36, -71.06), 'BOS'); assert.equal(n(35.68, 139.69), 'HND');
  assert.equal(n(39.78, -89.65), 'SPI', 'no large airport within reach: the medium one of the town');
  assert.equal(n(30, -40), null, 'mid ocean: no airport, the page asks'); for (const bad of [NaN, 91, 'x']) assert.equal(n(bad, 0), null, String(bad)); assert.equal(n(0, 181), null);
});
