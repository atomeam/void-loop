/**
 * sky card rules — frontier #21, sky PR C: what the card says about one thing in the sky (the sun, the moon, a planet, one
 * of the bright stars) for one moment and place. Pure: the date and the place come in, so the tests can pin them.
 *   bodyOf(name)                  the body a name means, or null
 *   look(key, date, lat, lonE)    { now: altitude, direction, distance, phase…, next rise and set }
 *   take(look)                    one sentence about seeing it now, and the evidence (the numbers) each part rests on
 *   card(key, date, lat, lonE)    { title, definition, take, evidence, now: [rows], chips: [asks] }
 * The definitions are our own short lines; every number in the take comes from lib/sky-math.js and is shown with it.
 */
import { sky, STARS, PLANETS } from '../lib/sky-math.js';

const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const DEFINITIONS = {
  sun: 'The star at the centre of the solar system, about 150 million km away; its light takes about 8 minutes to reach us.',
  moon: "Earth's only natural satellite, about 384,000 km away; it shines by reflected sunlight, so we see its phases.",
  mercury: 'The smallest planet and the closest to the Sun; it never strays far from the Sun in our sky.',
  venus: 'The second planet from the Sun and the brightest point of light in the sky after the Moon, wrapped in thick cloud.',
  mars: 'The fourth planet, a cold desert world; its reddish colour comes from iron oxide dust.',
  jupiter: 'The largest planet, a gas giant fifth from the Sun, often the brightest point in the night sky after Venus.',
  saturn: 'The sixth planet, a gas giant known for its bright rings, which a small telescope can show.',
  uranus: 'The seventh planet, an ice giant at the edge of naked-eye visibility under dark skies.',
  neptune: 'The eighth and farthest planet, an ice giant that needs binoculars or a telescope.',
  star: (s) => s.name + ' is one of the brightest stars in the sky (magnitude ' + s.mag.toFixed(2) + '): a sun of its own, far beyond the solar system.',
};
const STAR_KEYS = new Map(STARS.map((s) => [s.name.toLowerCase(), s]));
/** the body a name means: 'sun', 'moon', a planet name, or 'star:<name>' */
export function bodyOf(name) {
  const n = String(name || '').trim().toLowerCase().replace(/^the\s+/, '');
  if (n === 'sun' || n === 'moon' || PLANETS.includes(n)) return n;
  if (STAR_KEYS.has(n)) return 'star:' + STAR_KEYS.get(n).name;
  if (n === 'north star' || n === 'pole star') return 'star:Polaris';
  return null;
}
const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const direction = (az) => COMPASS[Math.round(((az % 360) + 360) % 360 / 22.5) % 16];
const pick = (s, key) => key === 'sun' ? s.sun : key === 'moon' ? s.moon : key.startsWith('star:') ? s.stars.find((x) => x.name === key.slice(5)) : s.planets.find((p) => p.name === key);
// the horizon a body crosses when it rises or sets: the sun's and the moon's upper limb with refraction, a point for the rest
const HORIZON = { sun: -0.833, moon: 0.125 };

/** where it is now, and when it next rises and sets (found every 10 minutes over the next day, then narrowed to a minute) */
export function look(key, date, lat, lonE) {
  const at = (d) => pick(sky(d, lat, lonE), key), now = at(date), h0 = HORIZON[key] ?? 0;
  let rise = null, set = null, prev = now.alt - h0;
  for (let m = 10; m <= 1440 && !(rise && set); m += 10) {
    const d = new Date(date.getTime() + m * 60000), v = at(d).alt - h0;
    if ((prev < 0) !== (v < 0)) {
      let lo = m - 10, hi = m; // narrow the crossing to a minute
      while (hi - lo > 1) { const mid = (lo + hi) >> 1, mv = at(new Date(date.getTime() + mid * 60000)).alt - h0; if ((mv < 0) === (prev < 0)) lo = mid; else hi = mid; }
      const t = new Date(date.getTime() + hi * 60000);
      if (prev < 0 && !rise) rise = t; else if (prev >= 0 && !set) set = t;
    }
    prev = v;
  }
  const s = sky(date, lat, lonE);
  return { key, alt: now.alt, az: now.az, dir: direction(now.az), dist: now.dist ?? null, mag: now.mag ?? null, fraction: now.fraction ?? null, waxing: now.waxing ?? null,
    sunAlt: s.sun.alt, up: now.alt > h0, rise, set, circumpolar: !rise && !set && now.alt > h0, neverUp: !rise && !set && now.alt <= h0 };
}

/** one sentence about seeing it now; each claim is made only when its evidence holds, and the evidence is returned with it */
export function take(L) {
  const name = L.key.startsWith('star:') ? L.key.slice(5) : L.key === 'sun' || L.key === 'moon' ? 'The ' + L.key : cap(L.key);
  const ev = [], up = L.alt.toFixed(0) + '°';
  ev.push('altitude ' + L.alt.toFixed(1) + '°', 'direction ' + L.dir + ' (azimuth ' + L.az.toFixed(0) + '°)');
  if (L.key === 'sun') {
    if (L.up) return { text: name + ' is up, ' + up + ' above the ' + L.dir + ' horizon. Never look at it directly.', evidence: ev };
    ev.push('sun ' + L.alt.toFixed(1) + '° below the horizon');
    return { text: name + ' has set' + (L.alt > -6 ? '; it is twilight.' : '; it is night here.'), evidence: ev };
  }
  if (L.neverUp) return { text: name + ' does not rise here today.', evidence: ev };
  if (!L.up) return { text: name + ' is below the horizon right now' + (L.rise ? '; it rises in about ' + Math.max(1, Math.round((L.rise - L.when) / 3600000)) + ' h.' : '.'), evidence: ev };
  const dark = L.sunAlt < -6, low = L.alt < 10;
  ev.push('sun ' + L.sunAlt.toFixed(1) + '°' + (dark ? ' (dark enough)' : ' (the sky is bright)'));
  if (L.key === 'moon') {
    ev.push(Math.round(L.fraction * 100) + '% lit, ' + (L.waxing ? 'waxing' : 'waning'));
    if (L.fraction < 0.03) return { text: name + ' is up, ' + up + ' in the ' + L.dir + ', but it is new: almost none of its lit side faces us, and it sits near the Sun, so you cannot see it.', evidence: ev };
    return { text: name + ' is up, ' + up + ' in the ' + L.dir + ', ' + Math.round(L.fraction * 100) + '% lit' + (low ? ', low, so hills and buildings may hide it.' : '.'), evidence: ev };
  }
  const seeable = dark || L.key === 'venus' || L.key === 'jupiter' && L.sunAlt < 0;
  const faint = L.key === 'neptune' || L.key === 'uranus';
  if (!seeable) return { text: name + ' is above the horizon, ' + up + ' in the ' + L.dir + ', but the sky is too bright to see it now.', evidence: ev };
  return { text: name + ' is up, ' + up + ' in the ' + L.dir + (faint ? ': you will need binoculars or a telescope.' : low ? ': low, so find a clear horizon.' : ': a good time to look.'), evidence: ev };
}

const hhmm = (d) => d ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—';
/** everything the card shows */
export function card(key, date, lat, lonE) {
  const L = { ...look(key, date, lat, lonE), when: date }, star = key.startsWith('star:') ? STARS.find((s) => s.name === key.slice(5)) : null;
  const t = take(L), title = star ? star.name : key === 'sun' || key === 'moon' ? 'The ' + cap(key) : cap(key);
  const now = [['Altitude', L.alt.toFixed(1) + '°'], ['Direction', L.dir + ' (' + L.az.toFixed(0) + '°)']];
  if (key === 'moon') now.push(['Phase', Math.round(L.fraction * 100) + '% lit, ' + (L.waxing ? 'waxing' : 'waning')], ['Distance', Math.round(L.dist).toLocaleString('en') + ' km']);
  else if (L.dist != null) now.push(['Distance', (key === 'sun' ? L.dist.toFixed(3) : L.dist.toFixed(2)) + ' AU']);
  if (star) now.push(['Magnitude', star.mag.toFixed(2)]);
  now.push(L.circumpolar ? ['Rises / sets', 'never sets here'] : L.neverUp ? ['Rises / sets', 'does not rise today'] : ['Rises / sets', hhmm(L.rise) + ' / ' + hhmm(L.set)]);
  const others = ['moon', 'jupiter', 'venus', 'mars', 'saturn'].filter((k) => k !== key).slice(0, 3);
  return { key, title, definition: star ? DEFINITIONS.star(star) : DEFINITIONS[key], take: t.text, evidence: t.evidence, now,
    chips: ['show me the sky', ...others.map((k) => 'where is ' + (k === 'moon' ? 'the moon' : k))] };
}
