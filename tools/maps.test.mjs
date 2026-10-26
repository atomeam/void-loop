// The maps floor (lib/maps-core.js, lib/maps-sites.js, skills/maps.js, the place card's link): coordinates in every common form, distances and areas, the
// link that holds a place or a route, Nominatim and OSRM read and spoken in English and German, the services' addresses and their one-a-second gate, saved
// places, GPX and GeoJSON both ways, the same place and route on the big map sites, and the pages registered where the tower and the toolkit look.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as C from '../void-live-deploy/lib/maps-core.js';
import { MAPS_SITES } from '../void-live-deploy/lib/maps-sites.js';
import maps, { routeAsk } from '../void-live-deploy/skills/maps.js';
import { FLOORS } from '../void-live-deploy/lib/tower.js';
import { TOOLS, RELATED, CARD_ASK } from '../void-live-deploy/lib/toolkit.js';
import { pageOf, appOf } from './maps-search-pages.mjs';
const site = new URL('../void-live-deploy', import.meta.url).pathname;
const mem = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; };

test('coordinates are read in every form people paste, and nothing else is', () => {
  const near = (p, lat, lon) => p && Math.abs(p.lat - lat) < 1e-4 && Math.abs(p.lon - lon) < 1e-4;
  assert.ok(near(C.parseCoords('38.7223, -9.1393'), 38.7223, -9.1393));
  assert.ok(near(C.parseCoords('38°43\'20"N 9°8\'21"W'), 38.72222, -9.13917));
  assert.ok(near(C.parseCoords('38°43′20″N 9°08′21″W'), 38.72222, -9.13917));
  assert.ok(near(C.parseCoords('40.7128° N, 74.0060° W'), 40.7128, -74.006));
  assert.ok(near(C.parseCoords('S 33.8688 E 151.2093'), -33.8688, 151.2093));
  assert.ok(near(C.parseCoords('geo:38.7,-9.1'), 38.7, -9.1));
  assert.ok(near(C.parseCoords('https://www.google.com/maps/place/Lisbon/@38.7436214,-9.1952226,12z'), 38.7436214, -9.1952226));
  assert.ok(near(C.parseCoords('https://www.openstreetmap.org/#map=15/38.7223/-9.1393'), 38.7223, -9.1393));
  assert.ok(near(C.parseCoords('https://www.openstreetmap.org/?mlat=38.7&mlon=-9.1#map=15/38.7/-9.1'), 38.7, -9.1));
  assert.ok(near(C.parseCoords('https://maps.apple.com/?ll=38.7,-9.1&q=x'), 38.7, -9.1));
  for (const s of ['Lisbon', '91, 10', '10, 181', '', 'call 555 1234', '2026-10-26']) assert.equal(C.parseCoords(s), null, s);
  assert.equal(C.toDms(38.7223, -9.1393), '38°43′20.3″N 9°08′21.5″W');
  assert.equal(C.toDms(-33.8688, 151.2093), '33°52′07.7″S 151°12′33.5″E');
});
test('distances, areas, circles and times are right and said in both units', () => {
  // Lisbon to Porto as the crow flies is about 274 km; London to Paris about 344 km
  assert.ok(Math.abs(C.haversine({ lat: 38.7223, lon: -9.1393 }, { lat: 41.1579, lon: -8.6291 }) - 274.3) < 1);
  assert.ok(Math.abs(C.haversine({ lat: 51.5074, lon: -0.1278 }, { lat: 48.8566, lon: 2.3522 }) - 343.6) < 1.5);
  // a 1 by 1 degree square at the equator is about 12,364 km²
  assert.ok(Math.abs(C.areaKm2([{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }, { lat: 1, lon: 1 }, { lat: 1, lon: 0 }]) - 12364) < 60);
  const ring = C.circleRing({ lat: 38.7, lon: -9.1 }, 10, 36); assert.equal(ring.length, 37);
  for (const [lon, lat] of ring) assert.ok(Math.abs(C.haversine({ lat: 38.7, lon: -9.1 }, { lat, lon }) - 10) < 0.01);
  assert.equal(C.fmtKm(274.3), '274 km · 170 mi'); assert.equal(C.fmtKm(5.25), '5.25 km · 3.26 mi'); assert.equal(C.fmtKm(0.4), '400 m · 1,312 ft'); assert.equal(C.fmtKm(12.5, true), '12,5 km · 7,8 mi');
  assert.equal(C.fmtMin(183), '3 h 03 min'); assert.equal(C.fmtMin(12.4), '12 min');
  assert.deepEqual(C.climb([10, 11, 20, 15, 15.5, 30]), { up: 25, down: 5 });
});
test('the link holds a search, a place, a route with stops and a mode, a circle and a path, and reads back the same', () => {
  const s = { from: 'Lisbon', via: ['Coimbra'], to: 'Porto', mode: 'bike' };
  const link = C.stateLink('/maps/', s); assert.equal(link, 'https://a-to-mind.com/maps/?from=Lisbon&via=Coimbra&to=Porto&mode=bike');
  assert.deepEqual(C.readState(new URL(link).search), s);
  assert.deepEqual(C.readState('?ll=38.70775,-9.13659&z=16&name=Lisboa'), { ll: { lat: 38.70775, lon: -9.13659 }, z: 16, name: 'Lisboa' });
  assert.deepEqual(C.readState('?ll=38.7,-9.1&r=5').r, 5);
  assert.equal(C.readState('?pts=38.7,-9.1;38.8,-9.2;nonsense').pts.length, 2);
  assert.deepEqual(C.readState('?mode=plane&z=99&ll=200,0'), {}, 'nonsense is dropped, not trusted');
  assert.equal(C.stateLink('/maps/', { mode: 'car', q: 'x' }, ''), '/maps/?q=x', 'car is the default and is not written');
});
test('Nominatim: asked on submit with the page language, read into a name, an address, a kind and a box', () => {
  assert.equal(C.searchUrl('Lisbon', 'de'), 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=8&accept-language=de&q=Lisbon');
  assert.match(C.reverseUrl({ lat: 38.7, lon: -9.1 }), /^https:\/\/nominatim\.openstreetmap\.org\/reverse\?format=jsonv2&addressdetails=1&zoom=18&accept-language=en&lat=38\.700000&lon=-9\.100000$/);
  const p = C.placeOf({ lat: '38.7077507', lon: '-9.1365919', name: 'Lisboa', display_name: 'Lisboa, Portugal', type: 'city', boundingbox: ['38.69', '38.79', '-9.22', '-9.08'], osm_type: 'relation', osm_id: 5400890, address: { city: 'Lisboa', country: 'Portugal' } });
  assert.deepEqual(p, { lat: 38.707751, lon: -9.136592, name: 'Lisboa', where: 'Portugal', full: 'Lisboa, Portugal', kind: 'city', bbox: [-9.22, 38.69, -9.08, 38.79], osm: 'R5400890' });
  assert.deepEqual(C.placesOf({ error: 'x' }), []); assert.deepEqual(C.placesOf([{ lat: 'x', lon: '1' }]), []);
});
test('OSRM: the right router for each mode, every point in order, and each step said in English and German', () => {
  const pts = [{ lat: 38.7, lon: -9.1 }, { lat: 40.2, lon: -8.4 }, { lat: 41.15, lon: -8.61 }];
  assert.equal(C.routeUrl(pts, 'foot'), 'https://routing.openstreetmap.de/routed-foot/route/v1/driving/-9.100000,38.700000;-8.400000,40.200000;-8.610000,41.150000?overview=full&geometries=geojson&steps=true');
  assert.match(C.routeUrl(pts.slice(0, 2), 'car'), /routed-car.*&alternatives=true$/);
  const st = (type, modifier, name, exit) => ({ maneuver: { type, modifier, exit }, name });
  assert.equal(C.stepText(st('turn', 'left', 'Rua Augusta')), 'Turn left onto Rua Augusta');
  assert.equal(C.stepText(st('turn', 'slight right', '')), 'Turn slightly right');
  assert.equal(C.stepText(st('roundabout', undefined, 'A1', 3)), 'At the roundabout take exit 3 onto A1');
  assert.equal(C.stepText(st('arrive', 'left', '')), 'Arrive: it is on the left');
  assert.equal(C.stepText(st('depart', 'straight', 'Av. da Liberdade')), 'Head off on Av. da Liberdade');
  assert.equal(C.stepText(st('turn', 'left', 'Rua Augusta'), true), 'Links abbiegen auf Rua Augusta');
  assert.equal(C.stepText(st('roundabout', undefined, 'A1', 2), true), 'Im Kreisverkehr die 2. Ausfahrt nehmen auf A1');
  assert.equal(C.stepText(st('continue', 'straight', 'IC2'), true), 'Weiter geradeaus auf IC2');
  const r = C.routesOf({ code: 'Ok', routes: [{ distance: 313400, duration: 10980, geometry: { coordinates: [[-9.1, 38.7], [-8.6, 41.1]] }, legs: [{ steps: [{ distance: 1200, maneuver: { type: 'depart', location: [-9.1, 38.7] }, name: 'A' }] }] }] });
  assert.equal(r[0].km, 313.4); assert.equal(r[0].min, 183); assert.equal(r[0].steps[0].text, 'Head off on A'); assert.deepEqual(r[0].steps[0].at, { lon: -9.1, lat: 38.7 });
  assert.equal(C.routesOf({ code: 'NoRoute' }), null);
});
test('the gate lets one call through a second at most', async () => {
  let t = 0; const slept = []; const gate = C.makeGate(1100, () => t, async (ms) => { slept.push(ms); t += ms; });
  await gate(); await gate(); t += 300; await gate();
  assert.deepEqual(slept, [1100, 800], 'the first goes at once, the second waits a full gap, the third the rest of its gap');
});
test('answers are kept on the device and old ones expire; saved places add, merge, rename and go', () => {
  const s = mem(); C.cachePut('u', { a: 1 }, s, 1000); assert.deepEqual(C.cacheGet('u', s, 2000), { a: 1 }); assert.equal(C.cacheGet('u', s, 1000 + 31 * 864e5), null);
  let l = C.savePlace({ lat: 38.7, lon: -9.1, name: 'Home' }, s, 1); assert.equal(l.length, 1);
  l = C.savePlace({ lat: 38.700001, lon: -9.100001, name: 'Home again' }, s, 2); assert.equal(l.length, 1, 'the same point is one place'); assert.equal(l[0].name, 'Home again');
  l = C.savePlace({ lat: 41.1, lon: -8.6 }, s, 3); assert.equal(l[0].name, '41.10000, -8.60000');
  l = C.renamePlace(l[0].id, 'Porto', s); assert.equal(l[0].name, 'Porto'); l = C.removePlace(l[0].id, s); assert.deepEqual(l.map((p) => p.name), ['Home again']);
  assert.equal(C.savePlace({ lat: 99, lon: 0 }, s).length, 1, 'an impossible point is not saved');
});
test('GPX and GeoJSON go out and come back, escaped, with heights', () => {
  const gpx = C.gpxOf({ places: [{ lat: 38.7, lon: -9.1, name: 'Tom & <Jerry>' }], line: [[-9.1, 38.7, 12], [-8.6, 41.1]], name: 'Trip' });
  assert.match(gpx, /<name>Tom &amp; &lt;Jerry&gt;<\/name>/); assert.match(gpx, /<trkpt lat="38\.700000" lon="-9\.100000"><ele>12<\/ele><\/trkpt>/);
  const back = C.readGeoFile(gpx); assert.deepEqual(back.places, [{ lat: 38.7, lon: -9.1, name: 'Tom & <Jerry>' }]); assert.deepEqual(back.line, [[-9.1, 38.7, 12], [-8.6, 41.1]]);
  const gj = C.readGeoFile(C.geojsonOf({ places: [{ lat: 1, lon: 2, name: 'A' }], line: [[2, 1], [3, 4]] })); assert.deepEqual(gj.places, [{ lat: 1, lon: 2, name: 'A' }]); assert.deepEqual(gj.line, [[2, 1], [3, 4]]);
  assert.deepEqual(C.readGeoFile('{not json'), { places: [], line: [] });
  assert.deepEqual(C.readGeoFile('<gpx><rte><rtept lat="1" lon="2"/></rte></gpx>').line, [[2, 1]]);
});
test('the same place and route open on Google Maps, OpenStreetMap and Apple Maps; traffic and transit go to Google', () => {
  const p = { lat: 38.70775, lon: -9.13659, name: 'Lisboa' };
  const l = Object.fromEntries(C.placeLinks(p).map((x) => [x.id, x.url]));
  assert.equal(l.google, 'https://www.google.com/maps/search/?api=1&query=38.707750,-9.136590');
  assert.equal(l.osm, 'https://www.openstreetmap.org/?mlat=38.707750&mlon=-9.136590#map=16/38.70775/-9.13659');
  assert.equal(l.apple, 'https://maps.apple.com/?ll=38.707750,-9.136590&q=Lisboa'); assert.equal(l.geo, 'geo:38.707750,-9.136590?q=38.707750,-9.136590(Lisboa)');
  const r = Object.fromEntries(C.routeLinks([p, { lat: 40.2, lon: -8.4 }, { lat: 41.15, lon: -8.61 }], 'bike').map((x) => [x.id, x.url]));
  assert.equal(r.google, 'https://www.google.com/maps/dir/?api=1&origin=38.707750,-9.136590&destination=41.150000,-8.610000&waypoints=40.200000,-8.400000&travelmode=bicycling');
  assert.match(r.osm, /^https:\/\/www\.openstreetmap\.org\/directions\?engine=fossgis_osrm_bike&route=38\.70775%2C-9\.13659%3B40\.20000%2C-8\.40000%3B41\.15000%2C-8\.61000$/);
  assert.equal(r.apple, 'https://maps.apple.com/?saddr=38.707750,-9.136590&daddr=41.150000,-8.610000&dirflg=c');
  assert.equal(C.trafficLink(p), 'https://www.google.com/maps/@38.70775,-9.13659,13z/data=!5m1!1e1');
  assert.match(C.transitLink(p, p), /travelmode=transit$/);
});
test('the maps floor names /maps/, the page exists with its share picture, and the stage card for a route opens it', () => {
  const f = FLOORS.find((x) => x.id === 'maps'); assert.equal(f.page, '/maps/?q=Lisbon');
  for (const r of MAPS_SITES) {
    assert.ok(fs.existsSync(site + r.path + 'index.html') && fs.existsSync(site + '/og/' + r.path.replace(/^\/|\/$/g, '').replace(/\//g, '-') + '.png'), r.path);
    const html = fs.readFileSync(site + r.path + 'index.html', 'utf8'); assert.ok(html.includes('og:image:width" content="1200"') && html.includes('<h1>' + r.h1 + '</h1>'), r.path + ' share card and heading');
    assert.equal(fs.readFileSync(site + r.path + 'app.js', 'utf8'), appOf(r)); assert.ok(pageOf(r).length < 14000, r.path + ' stays small for a fast first paint');
  }
  assert.ok(TOOLS['/maps/'] && RELATED['/maps/'].length && CARD_ASK['/maps/'] === 'map of lisbon');
  assert.ok(fs.readFileSync(site + '/sw.js', 'utf8').includes("'/maps/'"));
  assert.deepEqual(routeAsk('directions from lisbon to porto by bike'), { from: 'lisbon', to: 'porto', mode: 'bike' });
  assert.deepEqual(routeAsk('walking directions from the louvre to notre dame'), { from: 'louvre', to: 'notre dame', mode: 'foot' });
  for (const n of maps.nearMisses) assert.equal(maps.match(n.toLowerCase(), n), false, n);
  let html = ''; maps.run('directions from Lisbon to Porto', { showPage: (fn) => { const el = { dataset: {} }; fn(el); html = el.innerHTML; assert.equal(el.dataset.page, '/maps/'); }, esc: (s) => String(s).replace(/</g, '&lt;') });
  assert.match(html, /href="\/maps\/\?from=Lisbon&to=Porto"/); assert.match(html, /no live traffic/);
  assert.match(fs.readFileSync(site + '/skills/place.js', 'utf8'), /Open on the maps page/);
});
