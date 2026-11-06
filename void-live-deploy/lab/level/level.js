// The spirit level's sums (lab/level/): what the phone's gravity reading says about the surface under it or the edge against it. Pure.
// The lab's tilt experiments steered particles with this same reading; here it levels a shelf, a picture frame or a drain run.
const DEG = 180 / Math.PI;
const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d;

/** gravity (accelerationIncludingGravity x, y, z in m/s²) -> { x, y } tilt in degrees of a phone lying flat: x across the screen, y along it. */
export function flatTilt(g) {
  const { x = 0, y = 0, z = 0 } = g || {};
  return { x: Math.atan2(x, Math.hypot(y, z)) * DEG, y: Math.atan2(y, Math.hypot(x, z)) * DEG };
}
/** gravity -> the angle in degrees of a phone stood on its long edge against something: 0 when the edge is level, positive when it rises to the right. */
export function edgeAngle(g) {
  const { x = 0, y = 0 } = g || {};
  // standing on its long side the screen faces you; gravity runs along y when level (either way up)
  let a = Math.atan2(x, Math.abs(y)) * DEG;
  if (y > 0) a = -a;
  return a;
}
/** how flat the phone lies: 'flat' when gravity is mostly through the screen, else 'edge'. */
export const poseOf = (g) => (Math.abs((g && g.z) || 0) > 6.5 ? 'flat' : 'edge');
/** an angle with a zero point taken off (calibration), kept in -180..180. */
export function minusZero(a, zero = 0) { let v = a - zero; while (v > 180) v -= 360; while (v < -180) v += 360; return v; }
/** degrees -> slope: { percent, perMetre (mm of rise per metre), perFoot (inches of rise per foot), ratio ('1 in 48') }. */
export function slopeOf(deg) {
  const t = Math.tan(Math.abs(deg) / DEG);
  return { percent: round(t * 100, 2), perMetre: Math.round(t * 1000), perFoot: round(t * 12, 2), ratio: t < 1e-4 ? 'level' : '1 in ' + Math.round(1 / t) };
}
/** rise and run (any one unit) -> the angle in degrees. */
export const angleOf = (rise, run) => (Number(run) ? Math.atan2(Number(rise) || 0, Number(run)) * DEG : NaN);
/** is it level: within tol degrees. */
export const isLevel = (deg, tol = 0.3) => Math.abs(deg) <= tol;
/** a smoother for a jittery sensor: exponential, a = 0..1 (more is steadier). */
export function smoother(a = 0.85) { let s = null; return (v) => (s = s == null ? v : s * a + v * (1 - a)); }
/** the reading as one line to copy: "Level (0.1°)" or "2.4° (4.19%, 42 mm per metre, 1 in 24)". */
export function sayOf(deg) {
  const d = round(deg, 1), s = slopeOf(deg);
  return isLevel(deg) ? 'Level (' + Math.abs(d).toFixed(1) + '°)' : Math.abs(d).toFixed(1) + '° ' + (d > 0 ? 'up' : 'down') + ' (' + s.percent + '%, ' + s.perMetre + ' mm per metre, ' + s.ratio + ')';
}
