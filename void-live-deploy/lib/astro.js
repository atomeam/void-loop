/**
 * astro — the almanac the sky world and the skills that answer with it (sunrise, moon tonight, the planets that are up) use. The positions of the
 * sun, moon and planets, precession and sidereal time come from lib/sky-math.js (Meeus's series and JPL's elements: the sun to 0.01 degrees, the moon
 * to 0.05, the planets to 0.1); this file adds what a sky needs on top: horizontal places for a time, rise and set, the moon's phase and the next
 * one, the sky's colour from the sun's altitude, and where the aurora reaches. Held to an independent almanac (astronomy-engine) in
 * tools/astro.test.mjs, with fixtures made by tools/astro-fixtures.mjs: that test checks sky-math's numbers as used here too.
 * All angles are degrees. A time is a Date or milliseconds. Longitude is east-positive; latitude north-positive.
 */
import * as M from './sky-math.js';

export const RAD = Math.PI / 180;
const sin = (d) => Math.sin(d * RAD), cos = (d) => Math.cos(d * RAD);
const asin = (x) => Math.asin(Math.max(-1, Math.min(1, x))) / RAD;
export const norm360 = M.norm360;
export const norm180 = (d) => norm360(d + 180) - 180;
const ms = (t) => (t instanceof Date ? t.getTime() : +t);
const date = (t) => (t instanceof Date ? t : new Date(+t));
const jdeOf = (t) => M.jde(date(t));                                    // Julian ephemeris day (TT), what the series want

export const jd = (t) => M.jd(date(t));                                  // Julian date (UT)
export const daysSinceJ2000 = (t) => jd(t) - 2451545.0;
export const obliquity = (t) => M.obliquity(jdeOf(t));

// Greenwich mean sidereal time and local sidereal time, degrees
export const gmst = (t) => M.gmst(jd(t));
export const lst = (t, lon) => norm360(gmst(t) + lon);

// the sun: apparent ecliptic longitude and the equatorial position of date
export function sunEq(t) { const s = M.sun(jdeOf(t)); return { lambda: s.lon, ra: s.ra, dec: s.dec }; }
// the moon: ecliptic position, equatorial position of date, horizontal parallax (from its distance) and the distance in km
export function moonEq(t) {
  const m = M.moon(jdeOf(t));
  return { lambda: m.lon, beta: m.lat, parallax: asin(6378.14 / m.dist), ra: m.ra, dec: m.dec, dist: m.dist };
}
// the five planets you can see without a telescope (sky-math also has Uranus and Neptune)
export const PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];
// a planet's geocentric equatorial position of date, and its distance in AU
export function planetEq(name, t) { const p = M.planet(name, jdeOf(t)); return { ra: p.ra, dec: p.dec, dist: p.dist }; }

// precess a J2000 position to the date of t (rigorous rotation: fine at the pole, where Polaris is)
export const precess = (ra, dec, t) => M.precess(ra, dec, jdeOf(t));

// equatorial (of date) -> horizontal for a place and time: altitude above the horizon, azimuth from north through east
export const eqToHor = (ra, dec, t, lat, lon) => M.horizontal(ra, dec, jd(t), lat, lon);
// the same for a catalog star (J2000), precessed to the date
export function starHor(ra, dec, t, lat, lon) { const p = precess(ra, dec, t); return eqToHor(p.ra, p.dec, t, lat, lon); }

export function sunHor(t, lat, lon) { const s = sunEq(t); return { ...eqToHor(s.ra, s.dec, t, lat, lon), dist: 1 }; }
// the moon's altitude is topocentric: the parallax (up to a degree) lowers it
export function moonHor(t, lat, lon) { const m = moonEq(t), h = eqToHor(m.ra, m.dec, t, lat, lon); return { ...h, alt: h.alt - m.parallax * cos(h.alt) }; }
export function planetHor(name, t, lat, lon) { const p = planetEq(name, t); return { ...eqToHor(p.ra, p.dec, t, lat, lon), dist: p.dist }; }

// the moon's phase: elongation from the sun along the ecliptic (0 new, 90 first quarter, 180 full, 270 last quarter), the lit fraction of the disc
export function moonPhase(t) {
  const e = jdeOf(t), m = M.moon(e), s = M.sun(e), elong = norm360(m.lon - s.lon), lit = M.moonPhase(e).fraction;
  const names = ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full moon', 'waning gibbous', 'last quarter', 'waning crescent'];
  const name = names[Math.floor(norm360(elong + 22.5) / 45) % 8];
  return { elongation: elong, fraction: elong / 360, illumination: lit, name, ageDays: elong / 360 * 29.530588, waxing: elong < 180 };
}
const PHASE_DEG = { new: 0, 'first quarter': 90, full: 180, 'last quarter': 270 };
// the next time (after t) the moon reaches a phase: 'new' | 'first quarter' | 'full' | 'last quarter'
export function nextPhase(t, which) {
  const target = PHASE_DEG[which]; if (target === undefined) return null;
  const f = (x) => norm180(moonPhase(x).elongation - target);                // negative before the phase, positive just after
  let a = ms(t), fa = f(a), step = 3 * 3600000;
  for (let i = 0; i < 24 * 31 / 3 + 4; i++) {
    const b = a + step, fb = f(b);
    if (fa < 0 && fb >= 0 && fb - fa < 90) { let lo = a, hi = b; for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (f(mid) < 0) lo = mid; else hi = mid; } return new Date((lo + hi) / 2); }
    a = b; fa = fb;
  }
  return null;
}

// sunrise and sunset (or moonrise and moonset) from the start of a day: the crossings of the horizon. The upper limb with the usual refraction is
// 0.833 degrees below the horizon for the sun's centre, and for the moon's centre too once its parallax is taken off (moonHor does). dayStart is UTC ms.
export function riseSet(body, dayStart, lat, lon) {
  const h0 = -0.833;
  const alt = (x) => (body === 'moon' ? moonHor(x, lat, lon).alt : sunHor(x, lat, lon).alt) - h0;
  const out = { rise: null, set: null, state: null };
  let a = dayStart, fa = alt(a);
  out.state = fa > 0 ? 'up' : 'down';
  for (let i = 0; i < 24 * 6; i++) {
    const b = a + 600000, fb = alt(b);
    if ((fa < 0) !== (fb < 0)) {
      let lo = a, hi = b; for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if ((alt(mid) < 0) === (fa < 0)) lo = mid; else hi = mid; }
      const when = new Date((lo + hi) / 2);
      if (fb >= 0) { if (!out.rise) out.rise = when; } else if (!out.set) out.set = when;
    }
    a = b; fa = fb;
  }
  if (!out.rise && !out.set) out.state = fa > 0 ? 'always up' : 'always down';
  else out.state = null;
  return out;
}

// every crossing of the horizon between two times: [{ t: Date, type: 'rise' | 'set' }], oldest first (ten-minute steps, then bisection)
export function crossings(body, from, to, lat, lon) {
  const h0 = -0.833, out = [];
  const alt = (x) => (body === 'moon' ? moonHor(x, lat, lon).alt : sunHor(x, lat, lon).alt) - h0;
  let a = ms(from), fa = alt(a); const end = ms(to);
  while (a < end) {
    const b = Math.min(a + 600000, end), fb = alt(b);
    if ((fa < 0) !== (fb < 0)) {
      let lo = a, hi = b; for (let k = 0; k < 30; k++) { const mid = (lo + hi) / 2; if ((alt(mid) < 0) === (fa < 0)) lo = mid; else hi = mid; }
      out.push({ t: new Date((lo + hi) / 2), type: fb >= 0 ? 'rise' : 'set' });
    }
    a = b; fa = fb;
  }
  return out;
}
// the sky's colour from the sun's altitude: [zenith, horizon] as rgb arrays, blending through twilight to night
const STOPS = [
  [-18, [3, 5, 16], [6, 9, 26]], [-12, [8, 14, 42], [28, 36, 78]], [-6, [24, 40, 96], [214, 120, 98]], [-1, [58, 96, 168], [244, 168, 112]],
  [6, [74, 134, 206], [188, 214, 236]], [30, [60, 128, 214], [168, 208, 240]],
];
export function skyColors(sunAlt) {
  const x = Math.max(STOPS[0][0], Math.min(STOPS[STOPS.length - 1][0], sunAlt));
  let i = 0; while (i < STOPS.length - 2 && x > STOPS[i + 1][0]) i++;
  const [a0, z0, h0] = STOPS[i], [a1, z1, h1] = STOPS[i + 1], u = (x - a0) / (a1 - a0), mix = (p, q) => p.map((v, k) => Math.round(v + (q[k] - v) * u));
  return { zenith: mix(z0, z1), horizon: mix(h0, h1), starVisibility: Math.max(0, Math.min(1, (-4 - sunAlt) / 14)) };
}

// the great-circle angle between two horizontal directions (for "is that tap on this star")
export function angularDistance(alt1, az1, alt2, az2) { return Math.acos(Math.max(-1, Math.min(1, sin(alt1) * sin(alt2) + cos(alt1) * cos(alt2) * cos(az1 - az2)))) / RAD; }

// dipole geomagnetic latitude (pole near 80.7 N, 72.7 W) and the equatorward edge of the auroral oval by Kp
export function geomagLat(lat, lon) { const p = 80.7, pl = -72.7; return asin(sin(lat) * sin(p) + cos(lat) * cos(p) * cos(lon - pl)); }
const OVAL = [66.5, 64.5, 62.4, 60.4, 58.3, 56.3, 54.2, 52.2, 50.1, 48.1];
export const auroraEdge = (kp) => OVAL[Math.max(0, Math.min(9, Math.round(kp)))];
