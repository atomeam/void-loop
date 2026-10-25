/**
 * sun-day: sunrise, sunset, solar noon, the three twilights, golden hour, and the moon's rise, set and phase for a place on its own day (the
 * /time/ page, the tower's timeanddate.com floor). The sky skills' own almanac does the astronomy (lib/astro.js: riseSet, sunHor, moonPhase, held to
 * an independent almanac in tools/astro.test.mjs); where the city stands comes from lib/zones.js coordsOf, which never guesses. Kept apart from
 * lib/zones.js so /time/ loads its clock first and fetches this after. Pure. Tests: tools/zones.test.mjs.
 */
import { riseSet, sunHor, moonPhase } from './astro.js';
import { coordsOf, instantIn, ymdIn } from './zones.js';

/** sunrise, sunset and the day's length for a place on its own day `ymd` ([y, mo0, d], today there by default), computed here from the sun's
 *  position (lib/astro.js riseSet: the upper edge with the usual refraction, held to an independent almanac): { rise, set (Dates or null),
 *  dayMin, state ('always up' | 'always down' | null) }, or null when the place has no coordinate. Pure. */
export function sunDay(place, ymd, now = new Date()) {
  const c = coordsOf(place); if (!c) return null;
  const [y, mo, d] = ymd || ymdIn(place.tz, now), start = instantIn(place.tz, y, mo, d, 0, 0).getTime(), r = riseSet('sun', start, c.lat, c.lon);
  const dayMin = r.rise && r.set && r.set > r.rise ? Math.round((r.set - r.rise) / 60000) : r.state === 'always up' ? 1440 : r.state === 'always down' ? 0 : null;
  // the sun crossing other altitudes the same way: twilight ends at -6 (civil), -12 (nautical), -18 (astronomical); golden hour is the sun between -4 and 6
  const at = (h) => riseSet('sun', start, c.lat, c.lon, h), civil = at(-6), nautical = at(-12), astro = at(-18), low = at(-4), high = at(6);
  // solar noon: the sun at its highest, found on ten-minute steps then narrowed to the second
  const alt = (t) => sunHor(t, c.lat, c.lon).alt; let best = start, top = -99;
  for (let t = start; t <= start + 86400000; t += 600000) { const a = alt(t); if (a > top) { top = a; best = t; } }
  let lo = best - 600000, hi = best + 600000; for (let k = 0; k < 40; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (alt(m1) < alt(m2)) lo = m1; else hi = m2; }
  const moon = riseSet('moon', start, c.lat, c.lon), phase = moonPhase(new Date(start + 43200000));
  return { ...c, rise: r.rise, set: r.set, dayMin, state: r.state, noon: new Date(Math.round((lo + hi) / 2)), noonAlt: Math.round(top * 10) / 10,
    civil: { dawn: civil.rise, dusk: civil.set }, nautical: { dawn: nautical.rise, dusk: nautical.set }, astronomical: { dawn: astro.rise, dusk: astro.set },
    golden: { morning: [low.rise, high.rise], evening: [high.set, low.set] },
    moon: { rise: moon.rise, set: moon.set, state: moon.state, name: phase.name, illumination: Math.round(phase.illumination * 1000) / 10 } };
}
