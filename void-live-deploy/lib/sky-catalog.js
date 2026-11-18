// Real equatorial catalog positions for the cosmic map. Static, tiny, no network.
// Sources, licenses and the exact provenance of every number: lib/SKY-CATALOG-CREDITS.md (repo file, never served).
// Pure maths only: no DOM, no clock, no random at import time.
const DEG = Math.PI / 180, PC_LY = 3.26156;
export const SEED = 0x5eed2026;
export const GALACTIC_TILT = 62.6;      // degrees, orientation of the galactic plane on the sky
export const GALACTIC_INCLINE = 60.2;   // degrees, inclination of the disk to the equatorial frame
export const SOL_GALACTOCENTRIC_LY = 26000; // Sun to Sagittarius A* (Orion-Cygnus Arm)
export const ARM_COUNT = 4, BAR_LENGTH_LY = 9000;

// [name, RA hours, Dec degrees, distance parsecs, B-V, spectral class] — from the HYG v3.8 bright-star rows.
export const STARS = [
  ['Sirius', 6.752481, -16.716116, 2.6371, 0.009, 'A0'], ['Canopus', 6.399195, -52.695660, 94.7867, 0.164, 'F0'],
  ['Rigil Kentaurus', 14.660765, -60.833976, 1.3248, 0.710, 'G2'], ['Arcturus', 14.261030, 19.182410, 11.2575, 1.239, 'K2'],
  ['Vega', 18.615640, 38.783692, 7.6787, -0.001, 'A0'], ['Capella', 5.278150, 45.997991, 13.1234, 0.795, 'G8'],
  ['Rigel', 5.242298, -8.201640, 264.5503, -0.030, 'B8'], ['Procyon', 7.655033, 5.224993, 3.5142, 0.432, 'F5'],
  ['Betelgeuse', 5.919529, 7.407063, 152.6718, 1.500, 'M2'], ['Achernar', 1.628556, -57.236757, 42.7533, -0.158, 'B3'],
  ['Hadar', 14.063729, -60.373039, 120.1923, -0.231, 'B1'], ['Altair', 19.846388, 8.868322, 5.1295, 0.221, 'A7'],
  ['Acrux', 12.443311, -63.099092, 98.7167, -0.243, 'B0'], ['Aldebaran', 4.598677, 16.509301, 20.4332, 1.538, 'K5'],
  ['Spica', 13.419883, -11.161322, 76.5697, -0.235, 'B1'], ['Antares', 16.490128, -26.432002, 169.7793, 1.865, 'M1'],
  ['Pollux', 7.755277, 28.026199, 10.3584, 0.991, 'K0'], ['Deneb', 20.690532, 45.280338, 432.9004, 0.092, 'A2'],
  ['Regulus', 10.139532, 11.967207, 24.3132, -0.087, 'B7'], ['Polaris', 2.529750, 89.264109, 132.6260, 0.636, 'F7'],
  ['Proxima Centauri', 14.495985, -62.679485, 1.2959, 1.807, 'M5']
];
// [name, RA hours, Dec degrees, light-years, kind, ask] — positions from OpenNGC, distances from the cited reference.
export const LANDMARKS = [
  ['Orion Nebula', 5.587911, -5.389667, 1267, 'nebula', 'tell me about the Orion Nebula'],
  ['Andromeda', 0.712319, 41.269056, 2452693, 'galaxy', 'tell me about the Andromeda Galaxy'],
  ['Crab Nebula', 5.575547, 22.014472, 6500, 'nebula', 'tell me about the Crab Nebula'],
  ['Pillars of Creation', 18.313381, -13.807222, 5700, 'nebula', 'tell me about the Pillars of Creation'],
  ['Whirlpool Galaxy', 13.497975, 47.195167, 23548463, 'galaxy', 'tell me about the Whirlpool Galaxy'],
  ['Sombrero Galaxy', 12.666508, -11.623056, 31147898, 'galaxy', 'tell me about the Sombrero Galaxy'],
  ['Pleiades', 3.791278, 24.105278, 444, 'cluster', 'tell me about the Pleiades']
];

export const R0 = 180; // world units per decade of logarithmic distance
export const radiusOf = (ly) => R0 * Math.log10(1 + Math.max(0, +ly || 0));
export const lyOf = (r) => Math.pow(10, r / R0) - 1;
/** Equatorial (RA hours, Dec degrees, distance ly) to a deterministic, log-scaled 3D address. */
export function project(raH, decDeg, ly) {
  const a = (+raH / 24) * Math.PI * 2, d = (+decDeg) * DEG, r = radiusOf(ly);
  return [r * Math.cos(d) * Math.cos(a), r * Math.sin(d), r * Math.cos(d) * Math.sin(a)];
}
/** Inverse projection, for the live coordinate readout. */
export function raDecOf(x, y, z) {
  const r = Math.hypot(x, y, z); let h = Math.atan2(z, x) / (Math.PI * 2); if (h < 0) h += 1;
  return { ra: h * 24, dec: Math.asin((r ? y / r : 0)) / DEG, ly: lyOf(r) };
}
export const hms = (h) => { let m = Math.round((h % 24 + 24) % 24 * 60); return String(Math.floor(m / 60)).padStart(2, '0') + 'h ' + String(m % 60).padStart(2, '0') + 'm'; };
export const dms = (d) => (d < 0 ? '\u2212' : '+') + String(Math.abs(d) | 0).padStart(2, '0') + '\u00b0 ' + String(Math.round((Math.abs(d) % 1) * 60)).padStart(2, '0') + '\u2032';
export const fmtLy = (ly) => (ly >= 1e6 ? (ly / 1e6).toFixed(2) + ' Mly' : ly >= 1000 ? Math.round(ly).toLocaleString('en-US') + ' ly' : Math.round(ly) + ' ly');

/** mulberry32: one fixed seed, so the procedural field is identical on every load and viewport. */
export function rng(seed = SEED) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const CBV = [[-0.4, .55, .68, 1], [0, .78, .86, 1], [.35, 1, .96, .82], [.7, 1, .86, .55], [1.2, 1, .66, .36], [2, 1, .43, .28]];
/** O/B/A/F/G/K/M temperature colour from the measured B-V index. */
export function bvColor(v) { v = Math.max(-0.4, Math.min(2, v)); for (let i = 1; i < CBV.length; i++) if (v <= CBV[i][0]) { const a = CBV[i - 1], b = CBV[i], f = (v - a[0]) / (b[0] - a[0]); return [a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f, a[3] + (b[3] - a[3]) * f]; } return [1, .43, .28]; }

/** A point on one of four logarithmic spiral arms, relative to the galactic centre. Pure. */
export function armPoint(arm, t, jitter, spread = 1) {
  const ang = arm * Math.PI / 2 + t * 4.6 + jitter * 0.5;
  const rad = BAR_LENGTH_LY * 0.4 + t * SOL_GALACTOCENTRIC_LY * 1.5;
  return [Math.cos(ang) * rad, (jitter - 0.5) * 900 * spread * Math.sin(t * Math.PI), Math.sin(ang) * rad];
}
