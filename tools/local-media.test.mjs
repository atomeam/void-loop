// /local/: the stations near a visitor (lib/local-media.js), the page's API (functions/api/local.js), the TV table (tools/local-tv.mjs)
// and the stage card's ask (skills/local-stations.js)
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as L from '../void-live-deploy/lib/local-media.js';
import { askIn, radioPaths, lookRadio, onRequestGet } from '../void-live-deploy/functions/api/local.js';
import { csvRows, csvObjects, m3uEntries, build } from './local-tv.mjs';
import skill from '../void-live-deploy/skills/local-stations.js';

test('a stream plays here only from https on the standard port and a host name; an http one is tried as https only without a port', () => {
  assert.equal(L.playableStream('https://wrti-live.streamguys1.com/classical-mp3'), true);
  const signed = 'https://cdn.example.com/live/' + ['eyJ' + 'hbGciOiJIUzI1', 'eyJ' + 'zdWIiOiJwYXRo', 'abcdefghij'].join('.') + '/index.m3u8';
  for (const bad of [signed, 'http://stream.example.com/a', 'https://23.239.31.26/aande/index.m3u8', 'https://cdn.example.com:8443/a.m3u8', 'https://localhost/a', 'https://user:pw@cdn.example.com/a', 'https://[::1]/a', 'nope', ''])
    assert.equal(L.playableStream(bad), false, bad);
  assert.equal(L.httpsOf('http://stream.laut.fm/80sexitos'), 'https://stream.laut.fm/80sexitos');
  assert.equal(L.httpsOf('http://s9.citrus3.com:8054/stream'), null, 'an Icecast port has no https twin');
  assert.equal(L.httpsOf('http://138.121.15.230:9002/A&E/index.m3u8'), null);
});

test('a TV station is its call sign carrying its network, or the channel itself for its main feed', () => {
  assert.deepEqual(L.stationTitle({ name: 'ABC' }, { name: 'WPVI-TV' }), { title: 'WPVI-TV', network: 'ABC' });
  assert.deepEqual(L.stationTitle({ name: 'PhillyCAM' }, { name: 'SD', is_main: 'TRUE' }), { title: 'PhillyCAM', network: '' });
  assert.deepEqual(L.stationTitle({ name: 'Telemundo' }, { name: 'WCAU' }), { title: 'WCAU', network: 'Telemundo' });
  assert.deepEqual(L.stationTitle({ name: 'Canal Sur' }, { name: 'Andalucía' }), { title: 'Canal Sur Andalucía', network: '' });
});

const FILE = { cc: 'US', regions: { 'US-PA': 'Pennsylvania', 'US-NJ': 'New Jersey' },
  cities: { USPHL: ['Philadelphia', 'US-PA', [39.95, -75.16]], USPIT: ['Pittsburgh', 'US-PA', [40.44, -80]], USTRT: ['Trenton', 'US-NJ', [40.22, -74.76]] },
  stations: [
    { id: 'ABC.us@WPVITV', t: 'WPVI-TV', n: 'ABC', a: ['ct/USPHL'] },
    { id: 'Fox.us@WTXFTV', t: 'WTXF-TV', n: 'Fox', a: ['ct/USPHL'], s: ['https://cdn.example.com/fox29.m3u8'] },
    { id: 'Buzzr.us@WTXFTV', t: 'WTXF-TV', n: 'Buzzr', a: ['ct/USPHL'] },
    { id: 'KDKA.us@KDKATV', t: 'KDKA-TV', n: 'CBS', a: ['ct/USPIT'] },
    { id: 'NJPBS.us@WNJT', t: 'WNJT', n: 'PBS', a: ['ct/USTRT'] },
    { id: 'PCN.us@SD', t: 'PCN', a: ['s/US-PA'], w: 'https://pcntv.com/' },
  ] };

test('TV near a place: its own city first, then cities within reach by distance, then what is broadcast to the whole region; nothing far', () => {
  const rows = L.tvNear(FILE, { city: 'Philadelphia', region: 'Pennsylvania', regionCode: 'PA', country: 'US', lat: 39.95, lon: -75.16 });
  assert.deepEqual(rows.map((r) => r.t), ['WTXF-TV', 'WPVI-TV', 'WTXF-TV', 'WNJT', 'PCN'], 'the playable one leads its city, Trenton (48 km) is near, PCN covers the state; Pittsburgh (410 km) is not');
  assert.equal(rows.find((r) => r.t === 'WNJT').why, 'near'); assert.ok(rows.find((r) => r.t === 'WNJT').km > 40 && rows.find((r) => r.t === 'WNJT').km < 60);
  assert.equal(rows.find((r) => r.t === 'PCN').why, 'region');
  const g = L.groupTv(rows); assert.deepEqual(g.map((x) => x.t), ['WTXF-TV', 'WPVI-TV', 'WNJT', 'PCN']);
  assert.deepEqual(g[0].subs.map((s) => s.n), ['Fox', 'Buzzr'], 'one call sign carries both networks, the playable first'); assert.equal(g[0].play, true); assert.equal(g[1].play, false);
  assert.equal(L.regionCodeOf(FILE, { country: 'US', region: 'new jersey' }), 'US-NJ', 'a region name from a geocoder finds its code');
  assert.deepEqual(L.tvNear(FILE, { city: 'Nowhere', country: 'US', lat: 0, lon: 0 }), []);
});

const RB = (o) => ({ stationuuid: 'u1', name: 'WRTI', url: 'https://wrti-live.streamguys1.com/classical-mp3', url_resolved: 'https://wrti-live.streamguys1.com/classical-mp3', homepage: 'https://www.wrti.org/', favicon: '', tags: 'classical,choral,jazz,news', codec: 'MP3', bitrate: 128, hls: 0, state: 'Pennsylvania', geo_distance: 196, votes: 10, ...o });
test('radio rows: the stream to play, the station\'s own page, each station once, nearest first', () => {
  const r = L.radioRow(RB({ name: 'WRTI <b>Classical</b>\u0007', favicon: 'http://x.example/i.png' }));
  assert.equal(r.name, 'WRTI <b>Classical</b>', 'text is kept as text (the page sets it with textContent), control characters gone');
  assert.equal(r.play, 'https://wrti-live.streamguys1.com/classical-mp3'); assert.equal(r.icon, '', 'an http picture is not shown on an https page'); assert.deepEqual(r.tags, ['classical', 'choral', 'jazz']); assert.equal(r.km, 0);
  assert.equal(L.radioRow(RB({ url_resolved: 'http://s9.citrus3.com:8054/stream' })).play, null, 'a stream on its own port cannot play here');
  assert.equal(L.radioRow({}), null);
  const m = L.mergeRadio([RB({ stationuuid: 'far', geo_distance: 50000, url_resolved: 'https://a.example/far' }), RB({ stationuuid: 'near', geo_distance: 1000, url_resolved: 'https://a.example/near' })],
    [RB({ stationuuid: 'near' }), RB({ stationuuid: 'dup', url_resolved: 'https://a.example/far/' }), RB({ stationuuid: 'noplace', geo_distance: null, url_resolved: 'https://a.example/x', votes: 99 })]);
  assert.deepEqual(m.map((x) => x.id), ['near', 'far', 'noplace'], 'the same id or the same stream counts once; a station with no place comes after');
});

test('places: from the connection rounded to a tenth, or from the geocoder; the link carries the place and the tab', () => {
  assert.deepEqual(L.placeFromCf({ city: 'Philadelphia', region: 'Pennsylvania', regionCode: 'PA', country: 'US', latitude: '39.95233', longitude: '-75.16379' }),
    { city: 'Philadelphia', region: 'Pennsylvania', regionCode: 'PA', country: 'US', lat: 40, lon: -75.2 });
  assert.equal(L.placeFromCf({ country: 'XX' }), null); assert.equal(L.placeFromCf(null), null);
  assert.deepEqual(L.placeFromGeocoder({ name: 'Boston', admin1: 'Massachusetts', country_code: 'US', latitude: 42.35843, longitude: -71.05977 }), { city: 'Boston', region: 'Massachusetts', regionCode: '', country: 'US', lat: 42.36, lon: -71.06 });
  assert.equal(L.placeName({ city: 'Madrid', region: 'Madrid', country: 'ES' }), 'Madrid (ES)');
  assert.equal(L.linkOf({ place: 'Los Angeles', tab: 'tv' }), '/local/?place=Los+Angeles&tab=tv'); assert.equal(L.linkOf({}), '/local/');
});

test('the API: three asks and nothing else; the radio searches go to fixed hosts with the point rounded', async () => {
  const u = (q) => 'https://a-to-mind.com/api/local' + q;
  assert.deepEqual(askIn(u('')), { kind: 'here' }); assert.deepEqual(askIn(u('?place=Boston')), { kind: 'place', name: 'Boston' });
  assert.deepEqual(askIn(u('?lat=39.9523&lon=-75.1638&cc=us&region=Pennsylvania')), { kind: 'radio', lat: 40, lon: -75.2, cc: 'US', region: 'Pennsylvania' });
  for (const bad of ['?place=<script>', '?place=' + 'a'.repeat(61), '?lat=91&lon=0', '?lat=x&lon=1', '?lat=1', '?lat=1&lon=1&cc=USA', '?other=1']) assert.equal(askIn(u(bad)), null, bad);
  assert.deepEqual(radioPaths({ lat: 40, lon: -75.2, cc: 'US', region: 'Pennsylvania' }), [
    '/json/stations/search?hidebroken=true&order=votes&reverse=true&limit=60&geo_lat=40&geo_long=-75.2&geo_distance=100000',
    '/json/stations/search?hidebroken=true&order=votes&reverse=true&limit=60&countrycode=US&state=Pennsylvania']);
  const asked = [], fetchFn = async (url, init) => { asked.push([url, init.headers['user-agent']]); if (url.includes('de1.')) return new Response('down', { status: 503 }); return Response.json([RB({})]); };
  const out = await lookRadio({ lat: 40, lon: -75.2, cc: 'US', region: 'Pennsylvania' }, fetchFn);
  assert.equal(out.ok, true); assert.equal(out.stations.length, 1, 'both searches found the same station: listed once');
  assert.ok(asked.every(([url, ua]) => /^https:\/\/(?:de1|all)\.api\.radio-browser\.info\/json\/stations\/search\?/.test(url) && /^VerseBot/.test(ua)), 'only Radio Browser, named');
  assert.deepEqual(await lookRadio({ lat: 1, lon: 1 }, async () => new Response('x', { status: 500 })), { ok: false, kind: 'away' });
  const here = await onRequestGet({ request: Object.assign(new Request(u('')), { cf: { country: 'US', city: 'Tulsa', region: 'Oklahoma', regionCode: 'OK', latitude: '36.15', longitude: '-95.99' } }), env: {} });
  assert.equal(here.headers.get('cache-control'), 'private, no-store', 'one visitor\'s place is never cached for another');
  assert.equal((await here.json()).place.city, 'Tulsa');
  assert.equal((await onRequestGet({ request: new Request(u('?x=1')), env: {} })).status, 400);
});

test('the TV table: CSV with quotes, playlists with their header needs, and only local feeds with streams that play from their own host', () => {
  assert.deepEqual(csvRows('a,b\n"x, y","say ""hi"""\n'), [['a', 'b'], ['x, y', 'say "hi"']]);
  const e = m3uEntries('#EXTM3U\n#EXTINF:-1 tvg-id="Fox.us@WTXFTV",FOX 29 (720p)\nhttps://cdn.example.com/fox.m3u8\n#EXTINF:-1 tvg-id="AE.us@East",A&E\n#EXTVLCOPT:http-referrer=https://x.example/\nhttps://cdn.example.com/ae.m3u8\n#EXTINF:-1 tvg-id="X.us@SD",X\nhttp://23.239.31.26:8989/x/index.m3u8\n');
  assert.deepEqual(e.map((x) => [x.id, x.feed, x.referrer]), [['Fox.us', 'WTXFTV', false], ['AE.us', 'East', true], ['X.us', 'SD', false]]);
  const csv = (rows) => csvObjects(rows.join('\n'));
  const { countries, index } = build({
    channels: csv(['id,name,alt_names,network,owners,country,categories,is_nsfw,launched,closed,replaced_by,website', 'Fox.us,Fox,,,,US,general,FALSE,,,,https://www.fox.com/', 'AE.us,A&E,,,,US,,FALSE,,,,', 'X.us,X,,,,US,,FALSE,,,,', 'Adult.us,Adult,,,,US,,TRUE,,,,', 'Gone.us,Gone,,,,US,,FALSE,,2020-01-01,,', 'Blocked.us,Blocked,,,,US,,FALSE,,,,']),
    feeds: csv(['channel,id,name,alt_names,is_main,broadcast_area,timezones,languages,format', 'Fox.us,WTXFTV,WTXF-TV,,FALSE,ct/USPHL,America/New_York,eng,720p', 'AE.us,East,East,,TRUE,c/US,,eng,720p', 'X.us,SD,SD,,TRUE,s/US-PA,,eng,480i', 'Adult.us,SD,SD,,TRUE,ct/USPHL,,eng,480i', 'Gone.us,SD,SD,,TRUE,ct/USPHL,,eng,480i', 'Blocked.us,SD,SD,,TRUE,ct/USPHL,,eng,480i']),
    cities: csv(['country,subdivision,code,name,wikidata_id', 'US,US-PA,USPHL,Philadelphia,Q1345']), subdivisions: csv(['country,code,name,parent', 'US,US-PA,Pennsylvania,']),
    blocklist: csv(['channel,reason,ref', 'Blocked.us,dmca,https://example.com/']), entries: e,
    geo: [{ name: 'Philadelphia', lat: '32.77', lng: '-89.11', country: 'US', admin1: 'MS' }, { name: 'Philadelphia', lat: '39.95233', lng: '-75.16379', country: 'US', admin1: 'PA' }] });
  assert.deepEqual(countries.US.stations.map((s) => [s.t, s.n || '', s.s || []]), [['WTXF-TV', 'Fox', ['https://cdn.example.com/fox.m3u8']], ['X', '', []]],
    'A&E is national (left out); the bare-IP stream is dropped; nsfw, closed and blocked channels are gone');
  assert.deepEqual(countries.US.cities.USPHL, ['Philadelphia', 'US-PA', [39.95, -75.16]], 'the Pennsylvania Philadelphia, not the Mississippi one');
  assert.deepEqual(index.countries.US, { stations: 2, playable: 1 });
});

test('the committed TV table is readable and every stream in it passes the play rule', () => {
  const dir = new URL('../void-live-deploy/local/tv/', import.meta.url), idx = JSON.parse(fs.readFileSync(new URL('index.json', dir), 'utf8'));
  assert.ok(Object.keys(idx.countries).includes('US'));
  for (const cc of Object.keys(idx.countries)) {
    const f = JSON.parse(fs.readFileSync(new URL(cc + '.json', dir), 'utf8'));
    assert.equal(f.stations.length, idx.countries[cc].stations, cc);
    for (const s of f.stations) for (const u of s.s || []) assert.ok(L.playableStream(u), cc + ' ' + s.id + ' ' + u);
  }
});

test('the stage ask: local radio and TV, near me or in a place; questions and look-alikes are not taken', () => {
  assert.deepEqual(L.localAsk('local radio'), { kind: 'radio', place: '' });
  assert.deepEqual(L.localAsk('TV stations in Denver?'), { kind: 'tv', place: 'denver' });
  assert.deepEqual(L.localAsk('what radio stations are near me'), { kind: 'radio', place: '' });
  assert.deepEqual(L.localAsk('local tv and radio'), { kind: 'both', place: '' });
  assert.deepEqual(L.localAsk('boston radio stations'), { kind: 'radio', place: 'boston' });
  for (const n of skill.nearMisses) assert.equal(L.localAsk(n), null, n);
  for (const x of skill.examples) assert.ok(skill.match(x.toLowerCase(), x), x);
  assert.equal(skill.suite().ok, true);
});

test('a place handed over in the link (a flight\'s arrival airport): the exact point and country, or nothing when a part is off', () => {
  assert.deepEqual(L.placeFromLink('?place=Heathrow&ll=51.4700,-0.4543&cc=gb'), { city: 'Heathrow', region: '', regionCode: '', country: 'GB', lat: 51.47, lon: -0.45 });
  for (const bad of ['?place=London', '?place=London&ll=51.5,-0.1', '?place=London&ll=51.5&cc=GB', '?place=London&ll=91,0&cc=GB', '?place=London&ll=51.5,x&cc=GB', '?place=London&ll=,&cc=GB', '?ll=51.5,-0.1&cc=GB', '?place=London&ll=51.5,-0.1&cc=GBR'])
    assert.equal(L.placeFromLink(bad), null, bad);
});

test('flights to the place shown: its point in the link for /flights/ to pick the airport, or nothing without one', () => {
  assert.equal(L.flightsLink({ city: 'London', lat: 51.50735, lon: -0.12776 }), '/flights/?tonear=51.5074,-0.1278');
  for (const bad of [null, {}, { city: 'London' }, { lat: 51.5 }, { lat: 'x', lon: 0 }, { lat: 91, lon: 0 }, { lat: 0, lon: 181 }]) assert.equal(L.flightsLink(bad), null, JSON.stringify(bad));
});
