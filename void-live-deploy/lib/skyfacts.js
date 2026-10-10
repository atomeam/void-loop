/**
 * skyfacts — the sky at a place and time as plain facts (what the sky card's "right now" row, and the moon, sunrise and planet answers, say).
 * Built on lib/astro.js. Times are formatted in the place's own time zone when it is known, else the browser's.
 */
import * as A from './astro.js';

const NAMES16 = ['north', 'north-northeast', 'northeast', 'east-northeast', 'east', 'east-southeast', 'southeast', 'south-southeast', 'south', 'south-southwest', 'southwest', 'west-southwest', 'west', 'west-northwest', 'northwest', 'north-northwest'];
const SHORT16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
export const compass = (az) => SHORT16[Math.round(A.norm360(az) / 22.5) % 16];
export const compassWord = (az) => NAMES16[Math.round(A.norm360(az) / 22.5) % 16];
export const PLANET_LABEL = { mercury: 'Mercury', venus: 'Venus', mars: 'Mars', jupiter: 'Jupiter', saturn: 'Saturn' };

// how dark it is, from the sun's altitude (degrees)
export function lightName(sunAlt) {
  return sunAlt > -0.833 ? 'day' : sunAlt > -6 ? 'civil twilight' : sunAlt > -12 ? 'nautical twilight' : sunAlt > -18 ? 'astronomical twilight' : 'night';
}

export function skyNow(date, lat, lon) {
  const sun = A.sunHor(date, lat, lon), mh = A.moonHor(date, lat, lon), phase = A.moonPhase(date);
  return {
    sun: { alt: sun.alt, az: sun.az }, light: lightName(sun.alt),
    moon: { alt: mh.alt, az: mh.az, up: mh.alt > 0, ...phase },
    planets: A.PLANETS.map((name) => { const h = A.planetHor(name, date, lat, lon); return { name, label: PLANET_LABEL[name], alt: h.alt, az: h.az, up: h.alt > 2 }; }),
  };
}
// planets worth looking for: above the horizon and the sky dark enough (sun below -3 degrees), brightest first
export function planetsToSee(now) {
  if (now.sun.alt > -3) return [];
  const order = { venus: 0, jupiter: 1, mars: 2, saturn: 3, mercury: 4 };
  return now.planets.filter((p) => p.alt > 5).sort((a, b) => order[a.name] - order[b.name]);
}

// the sun's or moon's last and next rise and set around a time: { lastRise, lastSet, nextRise, nextSet, state }
// state: 'up' or 'down' at that moment, or 'always up' / 'always down' when there is no rise or set within two days (polar day or night)
export function events(body, date, lat, lon) {
  const t = date.getTime(), list = A.crossings(body, t - 30 * 3600000, t + 54 * 3600000, lat, lon), out = { lastRise: null, lastSet: null, nextRise: null, nextSet: null };
  for (const c of list) {
    if (c.t.getTime() <= t) out[c.type === 'rise' ? 'lastRise' : 'lastSet'] = c.t;
    else if (!out[c.type === 'rise' ? 'nextRise' : 'nextSet']) out[c.type === 'rise' ? 'nextRise' : 'nextSet'] = c.t;
  }
  const up = (body === 'moon' ? A.moonHor(date, lat, lon).alt : A.sunHor(date, lat, lon).alt) + 0.833 > 0;
  out.state = !list.length ? (up ? 'always up' : 'always down') : up ? 'up' : 'down';
  return out;
}

export function fmtTime(date, tz) {
  if (!date) return '';
  try { return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', ...(tz ? { timeZone: tz } : {}) }); } catch (_) { return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
}
export function fmtDay(date, tz) {
  try { return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', ...(tz ? { timeZone: tz } : {}) }); } catch (_) { return date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }); }
}
// "today", "tomorrow" or the date, as seen in the place's time zone
export function dayWord(date, now, tz) {
  const key = (d) => { try { return d.toLocaleDateString('en-CA', tz ? { timeZone: tz } : {}); } catch (_) { return d.toLocaleDateString('en-CA'); } };
  const a = key(date), b = key(now), c = key(new Date(now.getTime() + 86400000)), z = key(new Date(now.getTime() - 86400000));
  return a === b ? 'today' : a === c ? 'tomorrow' : a === z ? 'yesterday' : fmtDay(date, tz);
}

// "in 3 days", "in 5 hours", "in 40 minutes"
export function inWords(ms) {
  const m = Math.round(ms / 60000), h = Math.round(ms / 3600000), d = Math.round(ms / 86400000);
  return m < 90 ? `in ${Math.max(1, m)} minute${m === 1 ? '' : 's'}` : h < 36 ? `in ${h} hours` : `in ${d} days`;
}

// "5 hours ago", "12 minutes ago", "3 days ago" (ms is how long ago, positive)
export function agoWords(ms) {
  const m = Math.round(ms / 60000), h = Math.round(ms / 3600000), d = Math.round(ms / 86400000);
  return m < 2 ? 'just now' : m < 90 ? `${m} minutes ago` : h < 36 ? `${h} hours ago` : `${d} days ago`;
}
export const pct = (x) => Math.round(x * 100) + '%';
