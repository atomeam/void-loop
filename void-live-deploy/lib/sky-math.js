/**
 * sky-math — where the sun, the moon, the planets and the brightest stars are, from a date and a place. Pure: no DOM, no
 * network, no clock read (the caller passes the Date). The layer under skyOf (frontier #21) and the sky world.
 * Accuracy is what a naked-eye sky needs: the sun to about 0.01°, the moon to about 0.05°, the planets to about 0.1°
 * (light time is ignored), the stars to their catalogue places precessed to the date (proper motion is ignored).
 *
 * Sources (all recorded in docs/licenses.md): the formulas follow Jean Meeus, Astronomical Algorithms (2nd ed., 1998)
 * chapters 12, 13, 21, 22, 25, 47 and 48 (formulas are facts; this is our own code, and the tests use the book's worked
 * examples as fixed inputs); the planets use E. M. Standish's "Keplerian Elements for Approximate Positions of the Major
 * Planets" (JPL Solar System Dynamics, a US government work, public domain), table 1 (1800-2050); the stars are from the
 * Yale Bright Star Catalogue, 5th revised ed. (Hoffleit & Warren 1991, NASA ADC, public domain), J2000 places.
 *
 *   jd(date)                         Julian Day (UT) of a Date
 *   jde(date)                        Julian Ephemeris Day (TT = UT + ΔT)
 *   gmst(jdUT)                       mean sidereal time at Greenwich, degrees
 *   sun(jde)                         { ra, dec, lon, dist } apparent, degrees and AU
 *   moon(jde)                        { ra, dec, lon, lat, dist } degrees and km
 *   moonPhase(jde)                   { fraction, waxing, angle } illuminated fraction 0..1
 *   planet(name, jde)                { ra, dec, dist } geocentric, degrees and AU
 *   precess(ra, dec, jde)            J2000 → mean place of date
 *   horizontal(ra, dec, jdUT, lat, lonE)   { alt, az } degrees, azimuth from north through east
 *   sky(date, lat, lonE)             everything above for one moment and place
 */
const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const sin = (d) => Math.sin(d * RAD), cos = (d) => Math.cos(d * RAD), tan = (d) => Math.tan(d * RAD);
const atan2 = (y, x) => Math.atan2(y, x) * DEG, asin = (x) => Math.asin(Math.max(-1, Math.min(1, x))) * DEG;
export const norm360 = (a) => ((a % 360) + 360) % 360;
const AU_KM = 149597870.7;

// ---- time ----
export const jd = (date) => date.getTime() / 86400000 + 2440587.5;
/** ΔT = TT − UT in seconds: a line through the observed values (63.8 s in 2000, 69.2 s in 2020), within a few seconds
 * from 1990 to 2050, which moves the moon by about 0.001° */
export const deltaT = (year) => 63.8 + 0.27 * (Math.max(1990, Math.min(2050, year)) - 2000);
export const jde = (date) => jd(date) + deltaT(date.getUTCFullYear() + date.getUTCMonth() / 12) / 86400;
const T = (j) => (j - 2451545.0) / 36525;
/** Greenwich mean sidereal time, degrees (Meeus 12.4) */
export function gmst(jdUT) {
  const t = T(jdUT);
  return norm360(280.46061837 + 360.98564736629 * (jdUT - 2451545.0) + 0.000387933 * t * t - t * t * t / 38710000);
}
/** mean obliquity of the ecliptic, degrees (Meeus 22.2) */
export const obliquity = (jdE) => { const t = T(jdE); return 23.43929111 - (46.815 * t + 0.00059 * t * t - 0.001813 * t * t * t) / 3600; };
const toEquatorial = (lon, lat, eps) => ({
  ra: norm360(atan2(sin(lon) * cos(eps) - tan(lat) * sin(eps), cos(lon))),
  dec: asin(sin(lat) * cos(eps) + cos(lat) * sin(eps) * sin(lon)),
});

// ---- sun (Meeus ch. 25, low accuracy: about 0.01°) ----
export function sun(jdE) {
  const t = T(jdE);
  const L0 = norm360(280.46646 + 36000.76983 * t + 0.0003032 * t * t);
  const M = norm360(357.52911 + 35999.05029 * t - 0.0001537 * t * t);
  const e = 0.016708634 - 0.000042037 * t - 0.0000001267 * t * t;
  const C = (1.914602 - 0.004817 * t - 0.000014 * t * t) * sin(M) + (0.019993 - 0.000101 * t) * sin(2 * M) + 0.000289 * sin(3 * M);
  const trueLon = L0 + C, v = M + C, dist = 1.000001018 * (1 - e * e) / (1 + e * cos(v));
  const om = 125.04 - 1934.136 * t, lon = norm360(trueLon - 0.00569 - 0.00478 * sin(om));
  const eps = obliquity(jdE) + 0.00256 * cos(om);
  return { ...toEquatorial(lon, 0, eps), lon, dist };
}

// ---- moon (Meeus ch. 47, the larger terms of tables 47.A and 47.B: about 0.05°) ----
// [D, M, M', F, Σl (1e-6 °), Σr (1e-3 km)]
const MOON_LR = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968], [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149], [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733], [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0], [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210], [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824], [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403], [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056], [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
];
// [D, M, M', F, Σb (1e-6 °)]
const MOON_B = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237], [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198], [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324], [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211], [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
];
export function moon(jdE) {
  const t = T(jdE), t2 = t * t, t3 = t2 * t, t4 = t3 * t;
  const Lp = norm360(218.3164477 + 481267.88123421 * t - 0.0015786 * t2 + t3 / 538841 - t4 / 65194000);
  const D = norm360(297.8501921 + 445267.1114034 * t - 0.0018819 * t2 + t3 / 545868 - t4 / 113065000);
  const M = norm360(357.5291092 + 35999.0502909 * t - 0.0001536 * t2 + t3 / 24490000);
  const Mp = norm360(134.9633964 + 477198.8675055 * t + 0.0087414 * t2 + t3 / 69699 - t4 / 14712000);
  const F = norm360(93.272095 + 483202.0175233 * t - 0.0036539 * t2 - t3 / 3526000 + t4 / 863310000);
  const A1 = 119.75 + 131.849 * t, A2 = 53.09 + 479264.29 * t, A3 = 313.45 + 481266.484 * t;
  const E = 1 - 0.002516 * t - 0.0000074 * t2, eF = (m) => (m === 0 ? 1 : Math.abs(m) === 1 ? E : E * E);
  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, l, r] of MOON_LR) { const arg = d * D + m * M + mp * Mp + f * F; sl += l * eF(m) * sin(arg); sr += r * eF(m) * cos(arg); }
  for (const [d, m, mp, f, b] of MOON_B) sb += b * eF(m) * sin(d * D + m * M + mp * Mp + f * F);
  sl += 3958 * sin(A1) + 1962 * sin(Lp - F) + 318 * sin(A2);
  sb += -2235 * sin(Lp) + 382 * sin(A3) + 175 * sin(A1 - F) + 175 * sin(A1 + F) + 127 * sin(Lp - Mp) - 115 * sin(Lp + Mp);
  const lon = norm360(Lp + sl / 1e6), lat = sb / 1e6, dist = 385000.56 + sr / 1000;
  return { ...toEquatorial(lon, lat, obliquity(jdE)), lon, lat, dist };
}
/** illuminated fraction of the moon's disc (Meeus ch. 48), and whether it is waxing */
export function moonPhase(jdE) {
  const s = sun(jdE), m = moon(jdE);
  const psi = Math.acos(cos(m.lat) * cos(m.lon - s.lon)) * DEG; // geocentric elongation
  const R = s.dist * AU_KM, i = atan2(R * sin(psi), m.dist - R * cos(psi));
  return { fraction: (1 + cos(i)) / 2, waxing: norm360(m.lon - s.lon) < 180, angle: norm360(m.lon - s.lon) };
}

// ---- planets (Standish, JPL, table 1, 1800-2050): [a, e, I, L, ϖ, Ω] and their rates per century ----
const EL = {
  mercury: [[0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593], [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081]],
  venus: [[0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255], [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418]],
  earth: [[1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0], [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0]],
  mars: [[1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891], [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343]],
  jupiter: [[5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909], [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106]],
  saturn: [[9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448], [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794]],
  uranus: [[19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503], [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589]],
  neptune: [[30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574], [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664]],
};
export const PLANETS = ['mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
/** heliocentric ecliptic x, y, z (AU, J2000 ecliptic) of a body from its elements */
export function helio(name, jdE) {
  const t = T(jdE), [b, r] = EL[name], [a, e, I, L, w, O] = b.map((v, k) => v + r[k] * t);
  const M = norm360(L - w + 180) - 180, om = w - O;
  let Ea = M + (e * DEG) * sin(M); // Kepler's equation, degrees
  for (let k = 0; k < 10; k++) { const dM = M - (Ea - (e * DEG) * sin(Ea)); const dE = dM / (1 - e * cos(Ea)); Ea += dE; if (Math.abs(dE) < 1e-8) break; }
  const xp = a * (cos(Ea) - e), yp = a * Math.sqrt(1 - e * e) * sin(Ea);
  return [
    (cos(om) * cos(O) - sin(om) * sin(O) * cos(I)) * xp + (-sin(om) * cos(O) - cos(om) * sin(O) * cos(I)) * yp,
    (cos(om) * sin(O) + sin(om) * cos(O) * cos(I)) * xp + (-sin(om) * sin(O) + cos(om) * cos(O) * cos(I)) * yp,
    (sin(om) * sin(I)) * xp + (cos(om) * sin(I)) * yp,
  ];
}
/** geocentric place of a planet; the elements are J2000, so the place is precessed to the date */
export function planet(name, jdE) {
  if (!EL[name] || name === 'earth') throw new Error('No planet called ' + name);
  const p = helio(name, jdE), g = helio('earth', jdE), x = p[0] - g[0], y = p[1] - g[1], z = p[2] - g[2];
  const dist = Math.hypot(x, y, z), lon = norm360(atan2(y, x)), lat = asin(z / dist);
  const eq = toEquatorial(lon, lat, 23.4392911); // J2000 obliquity: the elements are referred to J2000
  return { ...precess(eq.ra, eq.dec, jdE), dist };
}

// ---- precession J2000 → date (Meeus 21.2-21.4, rigorous) ----
export function precess(ra, dec, jdE) {
  const t = T(jdE), s = (a) => a / 3600;
  const zeta = s(2306.2181 * t + 0.30188 * t * t + 0.017998 * t ** 3), z = s(2306.2181 * t + 1.09468 * t * t + 0.018203 * t ** 3), th = s(2004.3109 * t - 0.42665 * t * t - 0.041833 * t ** 3);
  const A = cos(dec) * sin(ra + zeta), B = cos(th) * cos(dec) * cos(ra + zeta) - sin(th) * sin(dec), C = sin(th) * cos(dec) * cos(ra + zeta) + cos(th) * sin(dec);
  return { ra: norm360(atan2(A, B) + z), dec: asin(C) };
}

// ---- the brightest stars (Yale Bright Star Catalogue 5, J2000; ra and dec in degrees, visual magnitude) ----
const hms = (h, m, s) => (h + m / 60 + s / 3600) * 15, dms = (d, m, s) => Math.sign(d || 1) * (Math.abs(d) + m / 60 + s / 3600);
export const STARS = [
  ['Sirius', hms(6, 45, 8.9), dms(-16, 42, 58), -1.46], ['Canopus', hms(6, 23, 57.1), dms(-52, 41, 45), -0.74],
  ['Rigil Kentaurus', hms(14, 39, 36.5), dms(-60, 50, 2), -0.27], ['Arcturus', hms(14, 15, 39.7), dms(19, 10, 57), -0.05],
  ['Vega', hms(18, 36, 56.3), dms(38, 47, 1), 0.03], ['Capella', hms(5, 16, 41.4), dms(45, 59, 53), 0.08],
  ['Rigel', hms(5, 14, 32.3), dms(-8, 12, 6), 0.13], ['Procyon', hms(7, 39, 18.1), dms(5, 13, 30), 0.34],
  ['Achernar', hms(1, 37, 42.8), dms(-57, 14, 12), 0.46], ['Betelgeuse', hms(5, 55, 10.3), dms(7, 24, 25), 0.5],
  ['Hadar', hms(14, 3, 49.4), dms(-60, 22, 23), 0.61], ['Altair', hms(19, 50, 47.0), dms(8, 52, 6), 0.77],
  ['Acrux', hms(12, 26, 35.9), dms(-63, 5, 57), 0.77], ['Aldebaran', hms(4, 35, 55.2), dms(16, 30, 33), 0.85],
  ['Antares', hms(16, 29, 24.5), dms(-26, 25, 55), 0.96], ['Spica', hms(13, 25, 11.6), dms(-11, 9, 41), 0.97],
  ['Pollux', hms(7, 45, 18.9), dms(28, 1, 34), 1.14], ['Fomalhaut', hms(22, 57, 39.0), dms(-29, 37, 20), 1.16],
  ['Deneb', hms(20, 41, 25.9), dms(45, 16, 49), 1.25], ['Mimosa', hms(12, 47, 43.3), dms(-59, 41, 19), 1.25],
  ['Regulus', hms(10, 8, 22.3), dms(11, 58, 2), 1.35], ['Polaris', hms(2, 31, 49.1), dms(89, 15, 51), 1.98],
].map(([name, ra, dec, mag]) => ({ name, ra, dec, mag }));

// ---- to the observer's sky ----
/** altitude and azimuth (from north through east) of a place on the sky, seen from latitude lat, east longitude lonE */
export function horizontal(ra, dec, jdUT, lat, lonE) {
  const H = norm360(gmst(jdUT) + lonE - ra);
  const alt = asin(sin(lat) * sin(dec) + cos(lat) * cos(dec) * cos(H));
  const az = norm360(atan2(sin(H), cos(H) * sin(lat) - tan(dec) * cos(lat)) + 180);
  return { alt, az };
}

/** everything in the sky for one moment and place: the sun, the moon and its phase, the planets, the stars */
export function sky(date, lat, lonE) {
  const u = jd(date), e = jde(date), at = (o) => ({ ...o, ...horizontal(o.ra, o.dec, u, lat, lonE) });
  // the moon is close enough that where you stand moves it: its horizontal parallax (up to about 1°) lowers it from the
  // place seen from the Earth's centre, the same correction lib/astro.js moonHor makes, so both draw it in one place
  const seen = (m) => { const h = at(m), par = asin(6378.14 / m.dist); return { ...h, alt: h.alt - par * cos(h.alt) }; };
  return {
    sun: at(sun(e)),
    moon: { ...seen(moon(e)), ...moonPhase(e) },
    planets: PLANETS.map((name) => ({ name, ...at(planet(name, e)) })),
    stars: STARS.map((s) => ({ name: s.name, mag: s.mag, ...at(precess(s.ra, s.dec, e)) })),
  };
}
