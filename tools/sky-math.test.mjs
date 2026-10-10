// The sky math (void-live-deploy/lib/sky-math.js) against fixed inputs: the worked examples in Meeus, Astronomical
// Algorithms (2nd ed.), each with its published answer, and a few checks that need no book.
// Run: node --test tools/sky-math.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as S from '../void-live-deploy/lib/sky-math.js';

const near = (got, want, tol, what) => assert.ok(Math.abs(got - want) <= tol, `${what}: ${got} vs ${want} (±${tol})`);
const nearAngle = (got, want, tol, what) => near(((got - want + 540) % 360) - 180, 0, tol, what + ' (' + got + ' vs ' + want + ')');

test('sky-math: sidereal time at Greenwich (Meeus example 12.a, 1987 April 10, 0h UT: 13h10m46.3668s)', () => {
  nearAngle(S.gmst(2446895.5), (13 + 10 / 60 + 46.3668 / 3600) * 15, 0.0001, 'GMST');
});

test('sky-math: the sun (Meeus example 25.a, 1992 October 13, 0h TD: RA 13h13m31.4s, Dec −7°47′06″, R 0.99766 AU)', () => {
  const s = S.sun(2448908.5);
  nearAngle(s.ra, 198.38083, 0.002, 'RA'); near(s.dec, -7.78507, 0.002, 'Dec'); near(s.dist, 0.99766, 0.0001, 'distance');
});

test('sky-math: the moon (Meeus example 47.a, 1992 April 12, 0h TD: λ 133.162655°, β −3.229126°, Δ 368409.7 km)', () => {
  const m = S.moon(2448724.5);
  nearAngle(m.lon, 133.162655, 0.02, 'longitude'); near(m.lat, -3.229126, 0.02, 'latitude'); near(m.dist, 368409.7, 150, 'distance');
  nearAngle(m.ra, 134.688470, 0.03, 'RA'); near(m.dec, 13.768368, 0.03, 'Dec');
});

test('sky-math: the moon\'s phase (Meeus example 48.a, the same moment: 0.6786 lit, waxing)', () => {
  const p = S.moonPhase(2448724.5);
  near(p.fraction, 0.6786, 0.005, 'illuminated fraction'); assert.equal(p.waxing, true);
});

test('sky-math: a planet (Meeus example 33.a, Venus 1992 December 20, 0h TD: RA 21h04m41.454s, Dec −18°53′16.84″)', () => {
  const v = S.planet('venus', 2448976.5);
  nearAngle(v.ra, 316.17273, 0.1, 'RA'); near(v.dec, -18.88801, 0.1, 'Dec'); near(v.dist, 0.910845, 0.002, 'distance');
});

test('sky-math: precession from J2000 (Meeus example 21.b, θ Persei to 2028 November 13.19 TD, its proper motion taken out)', () => {
  // the book's answer, 41.547214° and 49.348483°, includes 28.86 years of proper motion (+0.00203° in RA, −0.00083° in Dec)
  const p = S.precess(41.054063, 49.227750, 2462088.69);
  nearAngle(p.ra, 41.547214 - 0.00203, 0.003, 'RA'); near(p.dec, 49.348483 + 0.00083, 0.003, 'Dec');
});

test('sky-math: altitude and azimuth (Meeus example 13.b, Venus from Washington, 1987 April 10, 19:21 UT: h 15.1249°, A 68.0337° from south)', () => {
  const jdUT = 2446895.5 + (19 + 21 / 60) / 24, lat = 38 + 55 / 60 + 17 / 3600, lonE = -(77 + 3 / 60 + 56 / 3600);
  const h = S.horizontal((23 + 9 / 60 + 16.641 / 3600) * 15, -(6 + 43 / 60 + 11.61 / 3600), jdUT, lat, lonE);
  near(h.alt, 15.1249, 0.01, 'altitude'); nearAngle(h.az, 68.0337 + 180, 0.01, 'azimuth from north');
});

test('sky-math: checks that need no book (noon sun, the pole star, a full moon, every planet in its orbit)', () => {
  // the June solstice at local noon on the equator puts the sun about 23.4° north of the zenith; Polaris sits at the latitude
  const solstice = new Date(Date.UTC(2026, 5, 21, 12, 0)), sky = S.sky(solstice, 0, -1.0);
  near(sky.sun.alt, 90 - 23.44, 0.6, 'equator noon sun at the solstice'); nearAngle(sky.sun.az, 0, 8, 'it is due north'); // 23° from the zenith the azimuth swings fast; 12:00 UT is a few minutes off true noon (the equation of time)
  const london = S.sky(new Date(Date.UTC(2026, 0, 15, 22, 0)), 51.5, -0.13);
  near(london.stars.find((s) => s.name === 'Polaris').alt, 51.5, 1, 'Polaris at London stands at London\'s latitude');
  assert.ok(london.sun.alt < -18, 'a winter night in London is dark (sun ' + london.sun.alt.toFixed(1) + '°)');
  // the full moon of 2026 March 3 (11:38 UT, a total lunar eclipse) is almost fully lit; a new moon of 2026 March 19 is dark
  near(S.moonPhase(S.jde(new Date(Date.UTC(2026, 2, 3, 11, 38)))).fraction, 1, 0.01, 'full moon');
  near(S.moonPhase(S.jde(new Date(Date.UTC(2026, 2, 19, 1, 23)))).fraction, 0, 0.01, 'new moon');
  for (const p of london.planets) assert.ok(p.dist > 0.2 && p.dist < 32 && p.alt >= -90 && p.alt <= 90, p.name);
  assert.equal(london.stars.length, S.STARS.length); assert.equal(london.planets.length, 7);
  assert.throws(() => S.planet('pluto', 2451545), /No planet called pluto/);
});

test('sky-math: the moon is drawn where you see it, not from the Earth\'s centre: at totality over Dallas (2024 April 8, 18:42 UT) it covers the sun', () => {
  const d = S.sky(new Date("2024-04-08T18:42:00Z"), 32.78, -96.8), r = Math.PI / 180;
  const sep = Math.acos(Math.min(1, Math.sin(d.sun.alt * r) * Math.sin(d.moon.alt * r) + Math.cos(d.sun.alt * r) * Math.cos(d.moon.alt * r) * Math.cos((d.sun.az - d.moon.az) * r))) / r;
  assert.ok(sep < 0.1, 'the moon on the sun at totality, ' + sep.toFixed(3) + '°'); // from the Earth's centre it sits 0.43° off: no eclipse
});
