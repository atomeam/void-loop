/**
 * The major annual meteor showers, as the International Meteor Organization's calendar lists them: when each is active, the day it
 * peaks (the same day every year, give or take one: it follows the earth's place on its orbit, not the calendar), the best rate an
 * observer under a dark, clear sky could see at the peak (ZHR, meteors per hour; a real sky shows fewer), and where in the sky the
 * meteors seem to come from (the radiant: right ascension and declination, degrees, J2000).
 * These are the long-standing published values, typed in by hand, not computed: treat them as good to a day and a rough rate.
 * Row: [name, active from [month, day], active to, peak [month, day], ZHR, radiant RA, radiant Dec, note].
 */
export const SHOWERS = [
  ['Quadrantids', [12, 28], [1, 12], [1, 3], 110, 230, 49, 'a sharp peak of a few hours, so the timing matters'],
  ['Lyrids', [4, 14], [4, 30], [4, 22], 18, 271, 34, 'occasional bright bursts'],
  ['Eta Aquariids', [4, 19], [5, 28], [5, 6], 50, 338, -1, 'better from the southern hemisphere and the tropics, from Halley\'s comet'],
  ['Southern Delta Aquariids', [7, 12], [8, 23], [7, 30], 25, 339, -16, 'steady and faint, best from the south'],
  ['Perseids', [7, 17], [8, 24], [8, 12], 100, 48, 58, 'the favourite: warm nights, many bright ones'],
  ['Draconids', [10, 6], [10, 10], [10, 8], 10, 262, 54, 'usually quiet, now and then a storm; best in the evening'],
  ['Orionids', [10, 2], [11, 7], [10, 21], 20, 95, 16, 'fast, from Halley\'s comet'],
  ['Taurids', [9, 28], [12, 2], [11, 5], 5, 52, 14, 'few, but slow bright fireballs'],
  ['Leonids', [11, 6], [11, 30], [11, 17], 15, 152, 22, 'fast; a storm about every 33 years'],
  ['Geminids', [12, 4], [12, 20], [12, 14], 150, 112, 33, 'the strongest of the year, and the only big one that starts in the evening'],
  ['Ursids', [12, 17], [12, 26], [12, 22], 10, 217, 76, 'a quiet one for the far north'],
];
const dayOfYear = (m, d) => Math.round((Date.UTC(2001, m - 1, d) - Date.UTC(2001, 0, 1)) / 86400000); // 2001: a plain year, so the same table serves every year
const span = (a, b, x) => (a <= b ? x >= a && x <= b : x >= a || x <= b);                             // a span may run over New Year (the Quadrantids)

// the showers active on a date, strongest first, each with the days to its peak (negative: the peak has passed)
export function activeShowers(date) {
  const x = dayOfYear(date.getUTCMonth() + 1, date.getUTCDate());
  return SHOWERS.filter((s) => span(dayOfYear(...s[1]), dayOfYear(...s[2]), x))
    .map((s) => { let d = dayOfYear(...s[3]) - x; if (d > 183) d -= 365; if (d < -182) d += 365; return { name: s[0], zhr: s[4], peak: s[3], daysToPeak: d, ra: s[5], dec: s[6], note: s[7] }; })
    .sort((a, b) => b.zhr - a.zhr);
}
// the next peak on or after a date: { name, date (UTC midnight), zhr, ... }
export function nextShower(date) {
  const y = date.getUTCFullYear(), day0 = Date.UTC(y, date.getUTCMonth(), date.getUTCDate());
  let best = null;
  for (const s of SHOWERS) for (const yy of [y, y + 1]) {
    const at = Date.UTC(yy, s[3][0] - 1, s[3][1]);
    if (at >= day0 && (!best || at < best.at)) best = { at, s };
  }
  return best && { name: best.s[0], date: new Date(best.at), zhr: best.s[4], ra: best.s[5], dec: best.s[6], note: best.s[7] };
}
