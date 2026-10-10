/**
 * astro — a small, dependency-free almanac for the sky world and the skills that answer with it (sunrise, moon tonight, the planets
 * that are up). Low-precision formulas (the Astronomical Almanac's, Meeus's, JPL's "approximate positions of the major planets"):
 * good to a fraction of a degree, which is what a drawn sky and a sunrise to the minute need. Checked against astronomy-engine, an
 * independent implementation, in tools/astro.test.mjs (fixtures from tools/astro-fixtures.mjs).
 * All angles are degrees. A time is a Date or milliseconds. Longitude is east-positive; latitude north-positive.
 */
export const RAD = Math.PI / 180;
const sin = (d) => Math.sin(d * RAD), cos = (d) => Math.cos(d * RAD), tan = (d) => Math.tan(d * RAD);
const asin = (x) => Math.asin(Math.max(-1, Math.min(1, x))) / RAD, atan2 = (y, x) => Math.atan2(y, x) / RAD;
export const norm360 = (d) => ((d % 360) + 360) % 360;
export const norm180 = (d) => norm360(d + 180) - 180;
const ms = (t) => (t instanceof Date ? t.getTime() : +t);

export const jd = (t) => ms(t) / 86400000 + 2440587.5;                 // Julian date
export const daysSinceJ2000 = (t) => jd(t) - 2451545.0;
const T = (t) => daysSinceJ2000(t) / 36525;                            // Julian centuries since J2000
export const obliquity = (t) => 23.439291 - 0.0130042 * T(t);

// Greenwich mean sidereal time and local sidereal time, degrees
export const gmst = (t) => norm360(280.46061837 + 360.98564736629 * daysSinceJ2000(t));
export const lst = (t, lon) => norm360(gmst(t) + lon);

// ecliptic (lon, lat) -> equatorial (ra, dec)
export function eclToEq(lon, lat, eps) {
  const x = cos(lat) * cos(lon), y = cos(lat) * sin(lon) * cos(eps) - sin(lat) * sin(eps), z = cos(lat) * sin(lon) * sin(eps) + sin(lat) * cos(eps);
  return { ra: norm360(atan2(y, x)), dec: asin(z) };
}

// the sun: apparent ecliptic longitude and the equatorial position (Astronomical Almanac, 0.01 degree)
export function sunEq(t) {
  const n = daysSinceJ2000(t), L = norm360(280.460 + 0.9856474 * n), g = norm360(357.528 + 0.9856003 * n);
  const lambda = norm360(L + 1.915 * sin(g) + 0.020 * sin(2 * g)), eps = obliquity(t);
  return { lambda, ...eclToEq(lambda, 0, eps) };
}

// the moon (Astronomical Almanac, about 0.3 degree): ecliptic position, equatorial position and horizontal parallax
export function moonEq(t) {
  const c = T(t);
  const lambda = norm360(218.32 + 481267.881 * c + 6.29 * sin(135.0 + 477198.87 * c) - 1.27 * sin(259.3 - 413335.36 * c) + 0.66 * sin(235.7 + 890534.22 * c) + 0.21 * sin(269.9 + 954397.74 * c) - 0.19 * sin(357.5 + 35999.05 * c) - 0.11 * sin(186.5 + 966404.03 * c));
  const beta = 5.13 * sin(93.3 + 483202.02 * c) + 0.28 * sin(228.2 + 960400.89 * c) - 0.28 * sin(318.3 + 6003.15 * c) - 0.17 * sin(217.6 - 407332.21 * c);
  const parallax = 0.9508 + 0.0518 * cos(135.0 + 477198.87 * c) + 0.0095 * cos(259.3 - 413335.36 * c) + 0.0078 * cos(235.7 + 890534.22 * c) + 0.0028 * cos(269.9 + 954397.74 * c);
  return { lambda, beta, parallax, ...eclToEq(lambda, beta, obliquity(t)) };
}

// the planets: JPL's Keplerian elements for 1800 to 2050 [a, e, I, L, long.peri, long.node] and their rates per century
const EL = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255], [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0]],
  mars: [[1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
};
export const PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn'];

function helio(name, c) { // heliocentric ecliptic-plane coordinates (x, y, z), AU, J2000 ecliptic
  const [e0, r] = EL[name], a = e0[0] + r[0] * c, e = e0[1] + r[1] * c, I = e0[2] + r[2] * c, L = e0[3] + r[3] * c, wb = e0[4] + r[4] * c, node = e0[5] + r[5] * c;
  const w = wb - node, M = norm180(L - wb);
  let E = M + e / RAD * sin(M);                       // Kepler's equation by Newton's method
  for (let i = 0; i < 12; i++) { const dE = (M - (E - e / RAD * sin(E))) / (1 - e * cos(E)); E += dE; if (Math.abs(dE) < 1e-9) break; }
  const xp = a * (cos(E) - e), yp = a * Math.sqrt(1 - e * e) * sin(E);
  return {
    x: (cos(w) * cos(node) - sin(w) * sin(node) * cos(I)) * xp + (-sin(w) * cos(node) - cos(w) * sin(node) * cos(I)) * yp,
    y: (cos(w) * sin(node) + sin(w) * cos(node) * cos(I)) * xp + (-sin(w) * sin(node) + cos(w) * cos(node) * cos(I)) * yp,
    z: sin(w) * sin(I) * xp + cos(w) * sin(I) * yp,
  };
}
// a planet's geocentric equatorial position (J2000 equator, no light-time: a few hundredths of a degree) and its distance in AU
export function planetEq(name, t) {
  const c = T(t), p = helio(name, c), e = helio('earth', c), x = p.x - e.x, y = p.y - e.y, z = p.z - e.z, eps = 23.43928;
  const xe = x, ye = y * cos(eps) - z * sin(eps), ze = y * sin(eps) + z * cos(eps);
  return { ra: norm360(atan2(ye, xe)), dec: asin(ze / Math.sqrt(xe * xe + ye * ye + ze * ze)), dist: Math.sqrt(x * x + y * y + z * z) };
}

// precess a J2000 position to the date of t (Meeus 21.2, rigorous rotation: fine at the pole, where Polaris is)
export function precess(ra, dec, t) {
  const c = T(t), zeta = (2306.2181 * c + 0.30188 * c * c) / 3600, z = (2306.2181 * c + 1.09468 * c * c) / 3600, th = (2004.3109 * c - 0.42665 * c * c) / 3600;
  const A = cos(dec) * sin(ra + zeta), B = cos(th) * cos(dec) * cos(ra + zeta) - sin(th) * sin(dec), C = sin(th) * cos(dec) * cos(ra + zeta) + cos(th) * sin(dec);
  return { ra: norm360(atan2(A, B) + z), dec: asin(C) };
}

// equatorial (of date) -> horizontal for a place and time: altitude above the horizon, azimuth from north through east
export function eqToHor(ra, dec, t, lat, lon) {
  const H = lst(t, lon) - ra;
  const alt = asin(sin(dec) * sin(lat) + cos(dec) * cos(lat) * cos(H));
  const az = norm360(atan2(-cos(dec) * sin(H), sin(dec) * cos(lat) - cos(dec) * sin(lat) * cos(H)));
  return { alt, az };
}
// the same for a catalog star (J2000), precessed to the date
export function starHor(ra, dec, t, lat, lon) { const p = precess(ra, dec, t); return eqToHor(p.ra, p.dec, t, lat, lon); }

export function sunHor(t, lat, lon) { const s = sunEq(t); return { ...eqToHor(s.ra, s.dec, t, lat, lon), dist: 1 }; }
// the moon's altitude is topocentric: the parallax (up to a degree) lowers it
export function moonHor(t, lat, lon) { const m = moonEq(t), h = eqToHor(m.ra, m.dec, t, lat, lon); return { ...h, alt: h.alt - m.parallax * cos(h.alt) }; }
export function planetHor(name, t, lat, lon) { const p = planetEq(name, t), q = precess(p.ra, p.dec, t); return { ...eqToHor(q.ra, q.dec, t, lat, lon), dist: p.dist }; }

// the moon's phase: elongation from the sun along the ecliptic (0 new, 90 first quarter, 180 full, 270 last quarter)
export function moonPhase(t) {
  const m = moonEq(t), s = sunEq(t), elong = norm360(m.lambda - s.lambda);
  const psi = Math.acos(cos(m.lambda - s.lambda) * cos(m.beta)) / RAD;       // the angle between them in the sky
  const illumination = (1 - cos(psi)) / 2;                                   // the lit fraction of the disc
  const names = ['new moon', 'waxing crescent', 'first quarter', 'waxing gibbous', 'full moon', 'waning gibbous', 'last quarter', 'waning crescent'];
  const name = names[Math.floor(norm360(elong + 22.5) / 45) % 8];
  return { elongation: elong, fraction: elong / 360, illumination, name, ageDays: elong / 360 * 29.530588, waxing: elong < 180 };
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

// sunrise and sunset (or moonrise and moonset) for the local day containing t: the crossings of the horizon (the sun's upper limb with
// refraction is -0.833 degrees; the moon's is its parallax-corrected centre at +0.125). dayStart/dayEnd are UTC ms; the caller picks the day.
export function riseSet(body, dayStart, lat, lon) {
  const h0 = body === 'moon' ? 0.125 : -0.833;
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
  const h0 = body === 'moon' ? 0.125 : -0.833, out = [];
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
