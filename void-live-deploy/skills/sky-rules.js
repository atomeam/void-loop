// The sky over the empty stage (frontier #21): the stage tint follows the sun's altitude where the visitor is and the season, with no
// network call and no permission prompt. Pure functions of a Date and a place. Colours follow the physics loosely (Rayleigh scattering):
// a blue-grey glow by day, a warm red one at the horizon where the light crosses the most air, violet in twilight, deep indigo at night.
// The page applies them as --sky-glow / --sky-bg; the visitor's own look (--void-glow / --void-bg) always wins over them.
// `daylight` (0 night … 1 full day) is the one shared time-of-day value: the page publishes it as window.__voidSky and as the
// `void:sky` event, and anything that wants to follow the real sky (the sound piece) reads it from there.
const RAD = Math.PI / 180;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const hex = (n) => '#' + [n >> 16, (n >> 8) & 255, n & 255].map((v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('');
const rgb = (h) => { const n = parseInt(String(h).slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };

/** The sun's altitude and azimuth (degrees) for a place (lat, lon in degrees, east positive) and a moment; accurate to about half a degree. */
export function sunPosition(date, lat, lon) {
  const d = new Date(date).getTime() / 864e5 - 10957.5; // days since J2000
  const L = (280.460 + 0.9856474 * d) % 360, g = ((357.528 + 0.9856003 * d) % 360) * RAD; // mean longitude, anomaly
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD; // ecliptic longitude
  const eps = (23.439 - 0.0000004 * d) * RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam)); // declination
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)); // right ascension
  const gmst = (280.46061837 + 360.98564736629 * d) % 360; // sidereal angle at Greenwich
  const H = (((gmst + lon) * RAD - ra) % (2 * Math.PI) + 3 * Math.PI) % (2 * Math.PI) - Math.PI; // hour angle, -π..π
  const phi = lat * RAD;
  const alt = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
  const az = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(dec) * Math.cos(phi)); // from the south, west positive
  return { altitude: alt / RAD, azimuth: az / RAD + 180, declination: dec / RAD, morning: H < 0 };
}

/** The season at a place: the sun's declination decides how far into summer (k = 1) or winter (k = -1), flipped south of the equator. */
export function seasonOf(declination, lat) {
  const k = clamp(declination / 23.44, -1, 1) * (lat >= 0 ? 1 : -1);
  return { k, name: Math.abs(k) > 0.8 ? (k > 0 ? 'summer' : 'winter') : Math.abs(k) < 0.25 ? 'equinox' : (k > 0 ? 'warming' : 'cooling') };
}

// [sun altitude in degrees, glow, background]: dark enough to stay a void, different enough to be seen
const STOPS = [
  [-18, '#080a17', '#04040a'], // night
  [-12, '#0b0d20', '#050509'], // astronomical dusk
  [-6, '#1b1232', '#07060d'], // twilight: violet
  [-1, '#2e1819', '#0b0707'], // the horizon: long path through air, red
  [4, '#2b1d18', '#0a0807'], // low sun: amber
  [14, '#162231', '#070a0e'],
  [35, '#102339', '#06090e'], // day: blue
];

/** Everything the page needs for one moment: { altitude, azimuth, phase, season, daylight, glow, bg }. */
export function skyOf(date, place) {
  const lat = clamp(Number(place && place.lat) || 0, -90, 90), lon = clamp(Number(place && place.lon) || 0, -180, 180);
  const sun = sunPosition(date, lat, lon), alt = sun.altitude, season = seasonOf(sun.declination, lat);
  let i = 0; while (i < STOPS.length - 2 && alt > STOPS[i + 1][0]) i += 1;
  const [a0, g0, b0] = STOPS[i], [a1, g1, b1] = STOPS[i + 1];
  const t = clamp((alt - a0) / (a1 - a0), 0, 1), s = t * t * (3 - 2 * t); // smoothstep
  const mix = (c0, c1) => { // between two stops; summer a little brighter and warmer, winter dimmer and cooler
    const A = rgb(c0), B = rgb(c1), k = season.k, scale = 1 + 0.1 * k;
    const ch = (n) => A[n] + (B[n] - A[n]) * s;
    return hex(((clamp(ch(0) * scale + 2 * k, 0, 255) << 16) | (clamp(ch(1) * scale, 0, 255) << 8) | clamp(ch(2) * scale - 2 * k, 0, 255)));
  };
  const phase = alt < -12 ? 'night' : alt < 8 ? (sun.morning ? 'dawn' : 'dusk') : 'day';
  return { altitude: Math.round(alt * 10) / 10, azimuth: Math.round(sun.azimuth), phase, season, daylight: Math.round(clamp((alt + 12) / 40, 0, 1) * 100) / 100, glow: mix(g0, g1), bg: mix(b0, b1) };
}

const SOUTH = /^(Australia|Antarctica)\/|^Pacific\/(Auckland|Fiji|Tongatapu|Chatham|Apia)|^America\/(Sao_Paulo|Argentina|Santiago|Lima|La_Paz|Asuncion|Montevideo|Bogota_South)|^Africa\/(Johannesburg|Maputo|Harare|Lusaka|Windhoek|Gaborone)|^Indian\/(Reunion|Mauritius|Antananarivo)/;
/** A rough place with no permission prompt: longitude from the clock's offset from UTC (15 degrees an hour), latitude 40 north or 33 south by time zone name. */
export function guessPlace(timeZone, offsetMinutes) {
  return { lat: SOUTH.test(String(timeZone || '')) ? -33 : 40, lon: clamp(-(Number(offsetMinutes) || 0) / 4, -180, 180) + 0 };
}
