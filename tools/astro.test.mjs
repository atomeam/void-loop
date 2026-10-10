// lib/astro.js against an independent almanac (tools/astro.fixtures.json: astronomy-engine, recorded by tools/astro-fixtures.mjs), against
// facts that can be worked out by hand (noon sun at a known latitude, Polaris near the pole), against moon phases on recorded dates, and
// the data tables (stars, eclipses, showers) for sense.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import * as A from '../void-live-deploy/lib/astro.js';
import { STARS, CONSTELLATIONS, FIGURES } from '../void-live-deploy/lib/stars.js';
import { LUNAR, SOLAR } from '../void-live-deploy/lib/eclipses.js';
import { SHOWERS, activeShowers, nextShower } from '../void-live-deploy/lib/showers.js';

const F = JSON.parse(readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), 'astro.fixtures.json'), 'utf8'));
const dAz = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got} vs ${want} (tolerance ${tol})`);

test('the fixtures come from the oracle and cover what is compared', () => {
  assert.match(F.oracle, /^astronomy-engine \d/);
  assert.ok(F.bodies.length >= 30 && F.stars.length >= 50 && F.riseSet.length >= 30);
});

test('sun, planets and stars sit where the independent almanac puts them', () => {
  for (const r of F.bodies) {
    const t = new Date(r.when), s = A.sunHor(t, r.lat, r.lon);
    near(s.alt, r.sun.alt, 0.03, `sun altitude ${r.place} ${r.when}`);
    if (r.sun.alt > -85) near(dAz(s.az, r.sun.az), 0, 0.05, `sun azimuth ${r.place} ${r.when}`);
    for (const p of A.PLANETS) near(A.planetHor(p, t, r.lat, r.lon).alt, r[p].alt, 0.12, `${p} altitude ${r.place} ${r.when}`);
    const m = A.moonHor(t, r.lat, r.lon);
    near(m.alt, r.moon.alt, 0.05, `moon altitude ${r.place} ${r.when}`);
    near(dAz(m.az, r.moon.az), 0, 0.05, `moon azimuth ${r.place} ${r.when}`);
  }
  for (const r of F.stars) near(A.starHor(r.ra, r.dec, new Date(r.when), r.lat, r.lon).alt, r.alt, 0.03, `${r.name} altitude ${r.place} ${r.when}`);
});

test('sunrise, sunset, moonrise and moonset agree with the almanac to within a minute', () => {
  let n = 0;
  for (const r of F.riseSet) {
    const day = Date.parse(r.day), o = A.riseSet(r.body, day, r.lat, r.lon), tol = 1;
    for (const k of ['rise', 'set']) {
      if (r[k] && Date.parse(r[k]) < day + 86400000 - 30 * 60000 && Date.parse(r[k]) > day + 30 * 60000) { assert.ok(o[k], `${r.place} ${r.day} ${r.body} ${k} found`); near(Math.abs(+o[k] - Date.parse(r[k])) / 60000, 0, tol, `${r.place} ${r.day} ${r.body} ${k} (minutes)`); n++; }
    }
  }
  assert.ok(n > 40, 'compared ' + n);
});

test('the sun at local noon on the equinox and the solstice is 90 - latitude + declination (worked by hand)', () => {
  // Greenwich, 51.48 N: the sun crosses the meridian within a few minutes of 12:00 UTC
  const noon = (iso, lat) => { let best = -99; const t0 = Date.parse(iso); for (let m = -30; m <= 30; m++) best = Math.max(best, A.sunHor(new Date(t0 + m * 60000), lat, 0).alt); return best; };
  near(noon('2024-03-20T12:00:00Z', 51.48), 90 - 51.48 + 0.0, 0.5, 'equinox noon, Greenwich');
  near(noon('2024-06-21T12:00:00Z', 51.48), 90 - 51.48 + 23.44, 0.1, 'June solstice noon, Greenwich');
  near(noon('2024-12-21T12:00:00Z', 51.48), 90 - 51.48 - 23.44, 0.1, 'December solstice noon, Greenwich');
  near(noon('2024-03-20T12:00:00Z', 0), 90, 0.5, 'equinox noon on the equator is overhead');
});

test('Polaris stands at the altitude of the latitude, within a degree, from anywhere north of the equator', () => {
  const pol = STARS.find((s) => s[3] === 'Polaris');
  assert.ok(pol);
  for (const lat of [10, 30, 45, 51.5, 60, 70, 80]) for (const iso of ['2024-03-20T00:00:00Z', '2025-06-21T09:00:00Z', '2026-10-10T21:00:00Z', '2026-12-01T03:30:00Z']) {
    const h = A.starHor(pol[0], pol[1], new Date(iso), lat, 12);
    near(h.alt, lat, 1, `Polaris altitude at ${lat} N, ${iso}`);
  }
  assert.ok(A.starHor(pol[0], pol[1], new Date('2026-01-01T00:00:00Z'), -30, 0).alt < 0, 'below the horizon in the south');
});

test('the moon\'s phase matches recorded dates', () => {
  const full = (iso) => A.moonPhase(new Date(iso)), at = (iso) => full(iso);
  assert.ok(at('2024-10-17T11:26:00Z').illumination > 0.995, 'full moon (the supermoon) of 2024-10-17 11:26 UTC');
  assert.equal(at('2024-10-17T11:26:00Z').name, 'full moon');
  assert.ok(at('2024-10-02T18:49:00Z').illumination < 0.005, 'new moon (the annular eclipse) of 2024-10-02 18:49 UTC');
  assert.equal(at('2024-10-02T18:49:00Z').name, 'new moon');
  assert.ok(at('2025-03-14T06:55:00Z').illumination > 0.995, 'full moon (a total lunar eclipse) of 2025-03-14 06:55 UTC');
  assert.ok(at('2025-09-21T19:54:00Z').illumination < 0.01, 'new moon (a partial solar eclipse) of 2025-09-21');
  assert.equal(at('2024-10-07T12:00:00Z').name, 'waxing crescent', 'five days after the new moon');
  assert.equal(at('2024-10-10T12:00:00Z').name, 'first quarter', 'seven hours before the first quarter of 2024-10-10 18:55 UTC');
  assert.equal(at('2024-10-21T12:00:00Z').name, 'waning gibbous', 'four days after the full moon');
  assert.equal(at('2024-10-24T12:00:00Z').name, 'last quarter', 'four hours after the last quarter of 2024-10-24 08:03 UTC');
  for (const r of F.moon) { near(A.moonPhase(new Date(r.when)).elongation, r.elongation, 0.05, `elongation ${r.when}`); near(A.moonPhase(new Date(r.when)).illumination, r.illumination, 0.002, `illumination ${r.when}`); }
});

test('the next full moon, new moon and quarters land within 3 minutes of the almanac', () => {
  for (const r of F.phases) near(Math.abs(+A.nextPhase(new Date(r.from), r.phase) - Date.parse(r.at)) / 60000, 0, 3, `${r.phase} after ${r.from} (minutes)`);
  assert.equal(A.nextPhase(new Date(), 'blue'), null);
});

test('polar day and night: no rise or set, said plainly', () => {
  assert.equal(A.riseSet('sun', Date.UTC(2024, 5, 21), 69.65, 18.96).state, 'always up', 'Tromsø at midsummer');
  assert.equal(A.riseSet('sun', Date.UTC(2024, 11, 21), 69.65, 18.96).state, 'always down', 'Tromsø at midwinter');
  const lon = A.riseSet('sun', Date.UTC(2024, 5, 21), 51.5, -0.12);
  assert.ok(lon.rise && lon.set && lon.state === null);
  assert.ok(lon.set - lon.rise > 16 * 3600000 && lon.set - lon.rise < 17 * 3600000, 'London\'s longest day is about 16 h 38 min');
});

test('the sky\'s colour follows the sun: bright blue at noon, dark at night, a warm horizon at dusk', () => {
  const noon = A.skyColors(60), dusk = A.skyColors(-3), night = A.skyColors(-30);
  assert.ok(noon.zenith[2] > 180 && noon.starVisibility === 0);
  assert.ok(night.zenith.every((c) => c < 20) && night.starVisibility === 1);
  assert.ok(dusk.horizon[0] > dusk.horizon[2], 'the horizon is warmer than blue at sunset');
  assert.ok(A.skyColors(-9).starVisibility > 0.2 && A.skyColors(-9).starVisibility < 0.8, 'stars come out in twilight');
});

test('aurora: the oval reaches lower latitudes as Kp rises, and the geomagnetic latitude is the dipole\'s', () => {
  assert.equal(A.auroraEdge(0), 66.5); assert.equal(A.auroraEdge(9), 48.1);
  for (let k = 1; k <= 9; k++) assert.ok(A.auroraEdge(k) < A.auroraEdge(k - 1));
  near(A.geomagLat(80.7, -72.7), 90, 0.01, 'the geomagnetic pole');
  assert.ok(A.geomagLat(69.65, 18.96) > 65 && A.geomagLat(69.65, 18.96) < 69, 'Tromsø sits under the oval');
  assert.ok(Math.abs(A.geomagLat(0, 10)) < 12);
});

test('the star table: 300 stars, the brightest first, with names and constellations, and figures that name real constellations', () => {
  assert.equal(STARS.length, 300);
  assert.equal(STARS[0][3], 'Sirius'); near(STARS[0][2], -1.44, 0.01, 'Sirius magnitude');
  for (let i = 1; i < STARS.length; i++) assert.ok(STARS[i][2] >= STARS[i - 1][2]);
  assert.ok(STARS.filter((s) => !/^HIP /.test(s[3])).length >= 290);
  for (const [ra, dec, mag, name, c] of STARS) { assert.ok(ra >= 0 && ra < 360 && dec >= -90 && dec <= 90 && mag < 4 && name && CONSTELLATIONS[c], name); }
  assert.equal(Object.keys(CONSTELLATIONS).length, 88);
  for (const c of Object.keys(FIGURES)) assert.ok(CONSTELLATIONS[c], c);
  const rigel = STARS.find((s) => s[3] === 'Rigel'); assert.ok(rigel && rigel[4] === 'Ori');
  const beta = A.starHor(rigel[0], rigel[1], new Date('2026-01-15T22:00:00Z'), 40, 0); assert.ok(beta.alt > 35, 'Rigel crosses the meridian near 22:00 on a mid-January night at 40 N, about 90 - 40 + 8 high');
});

test('the eclipse table holds the famous ones', () => {
  assert.ok(LUNAR.some((e) => e[0].startsWith('2026-03-03') && e[1] === 'total'), 'the total lunar eclipse of 3 March 2026');
  assert.ok(SOLAR.some((e) => e[0].startsWith('2026-08-12') && e[1] === 'total'), 'the total solar eclipse of 12 August 2026');
  assert.ok(SOLAR.some((e) => e[0].startsWith('2027-08-02') && e[1] === 'total'), 'the long total eclipse of 2 August 2027');
  for (const l of [LUNAR, SOLAR]) for (let i = 1; i < l.length; i++) assert.ok(l[i][0] > l[i - 1][0]);
});

test('the meteor showers: valid dates, the right shower on the right day, and the next peak', () => {
  for (const s of SHOWERS) { assert.equal(s.length, 8, s[0]); for (const k of [1, 2, 3]) assert.ok(new Date(Date.UTC(2001, s[k][0] - 1, s[k][1])).getUTCDate() === s[k][1], s[0]); }
  assert.equal(activeShowers(new Date('2025-08-12T00:00:00Z'))[0].name, 'Perseids');
  assert.equal(activeShowers(new Date('2025-08-12T00:00:00Z'))[0].daysToPeak, 0);
  assert.equal(activeShowers(new Date('2025-12-14T00:00:00Z'))[0].name, 'Geminids');
  assert.ok(activeShowers(new Date('2026-01-02T00:00:00Z')).some((s) => s.name === 'Quadrantids' && s.daysToPeak === 1), 'a span that runs over New Year');
  assert.equal(activeShowers(new Date('2025-03-01T00:00:00Z')).length, 0, 'none active in early March');
  assert.equal(nextShower(new Date('2025-08-13T00:00:00Z')).name, 'Draconids');
  assert.equal(nextShower(new Date('2025-12-30T00:00:00Z')).name, 'Quadrantids');
  assert.equal(nextShower(new Date('2025-12-30T00:00:00Z')).date.toISOString().slice(0, 10), '2026-01-03');
});
