/**
 * suntimes — "sunrise and sunset", "when is sunset", "what time does the sun rise in Tokyo", "how long is the day": the sun's rise and set (and the
 * length of the day, and twilight) for where you are or a named place. lib/astro.js; the polar day and night are said plainly.
 */
import * as A from '../lib/astro.js';
import { events, fmtTime, dayWord, inWords, skyNow, lightName } from '../lib/skyfacts.js';
import { whereAmI, findPlace } from '../lib/where.js';
import { splitPlace, SKY_LINK } from '../lib/skyask.js';

export function sunAsk(text) {
  const { core, place } = splitPlace(text); const t = core.replace(/['’]s\b/g, 's');
  if (/^(?:what(?:s| is) )?(?:the )?(?:time of |time for )?(?:sunrise|sunset|sunrise and sunset|sunrise and sunset times?|sunset and sunrise|sunrise sunset|sun rise|sun set)(?: times?| time)?(?: today| tonight| tomorrow| now)?$/.test(t)
    || /^(?:when|what time)(?:s| is| does| will)? (?:the )?(?:sunrise|sunset|sunrise and sunset|sunset and sunrise|sun rise|sun set|sun go down|sun come up)(?: today| tonight| tomorrow)?$/.test(t)
    || /^(?:when|what time) (?:does|will) (?:the )?sun (?:rise|set|go down|come up)(?: today| tonight| tomorrow)?$/.test(t)
    || /^how long (?:is|will be) (?:the )?(?:day|daylight)(?: today| tomorrow)?$/.test(t) || /^(?:daylight hours|day length|length of (?:the )?day)(?: today| tomorrow)?$/.test(t)) return { place, text: t };
  return null;
}

// the facts: last and next sunrise and sunset, today's day length, and how dark it is now
export function sunAnswer(date, place) {
  const ev = events('sun', date, place.lat, place.lon), tz = place.tz, n = skyNow(date, place.lat, place.lon), lines = [];
  if (ev.state === 'always up') lines.push('The sun does not set here at this time of year: it is polar day.');
  else if (ev.state === 'always down') lines.push('The sun does not rise here at this time of year: it is polar night.');
  else {
    const rows = [['Sunrise', ev.lastRise, ev.nextRise], ['Sunset', ev.lastSet, ev.nextSet]];
    for (const [name, last, next] of rows) { const x = next && next - date < 30 * 3600000 ? next : last; if (x) lines.push(`${name}: ${dayWord(x, date, tz)}, ${fmtTime(x, tz)}${x > date ? ` (${inWords(x - date)})` : ''}.`); }
    const pairRise = ev.lastRise && ev.nextSet && ev.nextSet > ev.lastRise ? [ev.lastRise, ev.nextSet] : ev.nextRise && ev.nextSet && ev.nextSet > ev.nextRise ? [ev.nextRise, ev.nextSet] : ev.nextRise && ev.lastSet && ev.lastSet > ev.nextRise ? [ev.nextRise, ev.lastSet] : null;
    if (pairRise) { const mins = Math.round((pairRise[1] - pairRise[0]) / 60000); lines.push(`The day is ${Math.floor(mins / 60)} hour${Math.floor(mins / 60) === 1 ? '' : 's'} ${mins % 60} minute${mins % 60 === 1 ? '' : 's'} long.`); }
  }
  lines.push(`Right now it is ${n.light} (the sun is ${Math.abs(Math.round(n.sun.alt))}° ${n.sun.alt > 0 ? 'above' : 'below'} the horizon).`);
  return { lines, ev, n };
}

async function run(text, api) {
  const { showPage, esc, say, loopLog } = api, ask = sunAsk(text) || {};
  const el = showPage((p) => { p.innerHTML = '<h2>Sunrise and sunset</h2><div class="sub">…</div>'; });
  const place = ask.place ? await findPlace(ask.place) : await whereAmI();
  if (!api._pageStill(el)) return 'suntimes';
  if (!place) { el.innerHTML = `<h2>Sunrise and sunset</h2><p>${ask.place ? `I couldn't find "${esc(ask.place)}".` : 'I need a place for this: try "sunset in Oslo", or open the sky and set your location.'}</p>${SKY_LINK}`; return ask.place ? 'none' : 'suntimes'; }
  const a = sunAnswer(new Date(), place);
  el.innerHTML = `<h2>Sunrise and sunset</h2><div class="sub">${esc(place.name)}</div>${a.lines.map((l) => `<p>${esc(l)}</p>`).join('')}<p class="src">Computed from the sun's position (good to a minute); the sun's upper edge, with the usual refraction. <a href="#" data-ask="moon tonight">Tonight's moon</a></p>${SKY_LINK}`;
  say(''); loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'suntimes' });
  return 'suntimes';
}

export default {
  name: 'suntimes',
  sunAsk,
  examples: ['sunrise and sunset', 'sunrise', 'sunset', 'when is sunset', 'what time is sunrise tomorrow', 'what time does the sun set', 'sunset time', 'how long is the day', 'what time is sunset today'],
  nearMisses: ['sunset boulevard', 'sunrise bank', 'sunset beach song lyrics', 'sunrise yoga', 'why is the sunset red', 'sunrise sunset lyrics fiddler on the roof', 'sun tzu', 'how far is the sun'],
  match(lower, text) { return !!sunAsk(text); },
  run,
};
