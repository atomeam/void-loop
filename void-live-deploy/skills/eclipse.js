/**
 * eclipse — "next eclipse", "next total solar eclipse", "is there a lunar eclipse this year": the next eclipses from lib/eclipses.js (made with a precise
 * almanac, tools/astro-fixtures.mjs). For a lunar eclipse it says whether the moon is up for you at the peak (computed). For a solar one it says
 * where on earth the eclipse is greatest and whether the sun is even above your horizon then: the path of totality is not computed here, so it
 * points to where to check rather than guessing.
 */
import * as A from '../lib/astro.js';
import { LUNAR, SOLAR } from '../lib/eclipses.js';
import { dayWord, inWords, fmtTime, compassWord } from '../lib/skyfacts.js';
import { whereAmI, findPlace } from '../lib/where.js';
import { splitPlace, SKY_LINK } from '../lib/skyask.js';

// { which: 'any' | 'solar' | 'lunar', kind?: 'total' | 'annular' | 'partial' | 'penumbral', place, year? } or null
export function eclipseAsk(text) {
  const { core, place } = splitPlace(text); const t = core.replace(/['’]s\b/g, 's');
  let m = /^(?:when(?:s| is) |what(?:s| is) |what day is |tell me about )?(?:the )?(?:next|upcoming|coming|first|following)\s+(?:(total|annular|partial|penumbral|hybrid)\s+)?(?:(solar|lunar|sun|moon)\s+)?eclipses?(?: of the (?:sun|moon))?(?: date| time| dates| tonight| this year| in \d{4})*$/.exec(t)
    || /^(?:is there|are there)\s+(?:an?\s+|any\s+)?(?:(total|annular|partial)\s+)?(?:(solar|lunar)\s+)?eclipses?\s*(?:tonight|this year|this month|soon|coming up|today|next year|in \d{4})?$/.exec(t)
    || /^(?:solar|lunar|sun|moon)?\s*eclipses?\s*(?:tonight|this year|coming up|soon|calendar|schedule|dates|list|upcoming|\d{4})$/.exec(t) || /^(?:when is )?(?:the )?(?:total )?(solar|lunar) eclipse(?: this year| next| in \d{4}| tonight)?$/.exec(t);
  if (!m) return null;
  const hay = t, which = /solar|\bsun\b/.test(hay) ? 'solar' : /lunar|\bmoon\b/.test(hay) ? 'lunar' : 'any', kind = (/\b(total|annular|partial|penumbral|hybrid)\b/.exec(hay) || [])[1] || null, y = /\b(20\d\d)\b/.exec(hay);
  return { which, kind, place, year: y ? +y[1] : null };
}

export function nextEclipses(date, ask) {
  const rows = [];
  if (ask.which !== 'solar') for (const [at, kind, mins] of LUNAR) rows.push({ type: 'lunar', at: new Date(at), kind, mins });
  if (ask.which !== 'lunar') for (const [at, kind, lat, lon] of SOLAR) rows.push({ type: 'solar', at: new Date(at), kind, lat, lon });
  return rows.filter((r) => r.at > date && (!ask.kind || r.kind === ask.kind || (ask.kind === 'total' && r.kind === 'hybrid')) && (!ask.year || r.at.getUTCFullYear() === ask.year)).sort((a, b) => a.at - b.at);
}

// great-circle distance in km (a rough guide to whether the partial phase reaches a place: the penumbra is a few thousand km across)
export function greatCircleKm(lat1, lon1, lat2, lon2) {
  const r = (d) => d * Math.PI / 180, a = Math.sin(r(lat2 - lat1) / 2) ** 2 + Math.cos(r(lat1)) * Math.cos(r(lat2)) * Math.sin(r(lon2 - lon1) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}
export function eclipseLine(r, date, place) {
  const tz = place && place.tz, when = r.at.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', ...(tz ? { timeZone: tz } : { timeZone: 'UTC' }) });
  const head = `${r.kind[0].toUpperCase()}${r.kind.slice(1)} ${r.type === 'solar' ? 'solar' : 'lunar'} eclipse: ${when} (${inWords(r.at - date)}).`;
  if (!place) return head;
  if (r.type === 'lunar') {
    const h = A.moonHor(r.at, place.lat, place.lon);
    return `${head} Greatest at ${fmtTime(r.at, tz)} your time${r.kind === 'total' ? `, with the moon fully inside the shadow for about ${r.mins} minutes` : ''}. ${h.alt > 0 ? `At that moment the moon is ${Math.round(h.alt)}° up, to the ${compassWord(h.az)}: you can see it from here.` : 'At that moment the moon is below your horizon, so you will miss the peak (part of it may still be visible as it rises or sets).'}`;
  }
  const sun = A.sunHor(r.at, place.lat, place.lon), where = `${Math.abs(r.lat).toFixed(0)}° ${r.lat >= 0 ? 'N' : 'S'}, ${Math.abs(r.lon).toFixed(0)}° ${r.lon >= 0 ? 'E' : 'W'}`, km = greatCircleKm(place.lat, place.lon, r.lat, r.lon);
  const path = r.kind === 'total' || r.kind === 'hybrid' ? 'the path of totality' : r.kind === 'annular' ? 'the path of the ring' : 'where it is deepest';
  const verdict = sun.alt <= 0 ? 'The sun is below your horizon at that time, so it is not visible from where you are.'
    : km < 3500 ? `You are about ${Math.round(km / 100) * 100} km from where it is greatest and the sun is up for you then (${Math.round(sun.alt)}°), so you may see a partial eclipse; check an eclipse map for ${path}.`
      : `You are about ${Math.round(km / 100) * 100} km from where it is greatest, too far to expect to see it; an eclipse map shows ${path}.`;
  return `${head} It is greatest near ${where}, at ${r.at.toISOString().slice(11, 16)} UTC. ${verdict}`;
}

async function run(text, api) {
  const { showPage, esc, say, loopLog } = api, ask = eclipseAsk(text) || { which: 'any' };
  const el = showPage((p) => { p.innerHTML = '<h2>Eclipses</h2><div class="sub">…</div>'; });
  const place = ask.place ? await findPlace(ask.place) : await whereAmI().catch(() => null);
  if (!api._pageStill(el)) return 'eclipse';
  const date = new Date(), rows = nextEclipses(date, ask).slice(0, ask.which === 'any' && !ask.kind && !ask.year ? 4 : 3);
  el.innerHTML = `<h2>${esc(ask.which === 'any' ? 'Next eclipses' : ask.which === 'solar' ? 'Next solar eclipses' : 'Next lunar eclipses')}</h2><div class="sub">${esc(place ? place.name : 'worldwide')}</div>`
    + (rows.length ? rows.map((r) => `<p>${esc(eclipseLine(r, date, place))}</p>`).join('') : '<p>None in my table for that: it runs to the end of 2035.</p>')
    + `<p class="src">Dates and kinds from a precise almanac, computed ahead of time (instants of greatest eclipse, UTC); whether you can see the moon is computed for your place. For the path of a solar eclipse, check an eclipse map. <a href="#" data-ask="moon tonight">Tonight's moon</a></p>${SKY_LINK}`;
  say(''); loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'eclipse' });
  return 'eclipse';
}

export default {
  name: 'eclipse',
  eclipseAsk,
  examples: ['next eclipse', 'next solar eclipse', 'next lunar eclipse', 'when is the next total solar eclipse', 'upcoming eclipses', 'is there an eclipse tonight', 'next total lunar eclipse', 'when is the next eclipse', 'solar eclipse 2026', 'is there a lunar eclipse this year'],
  nearMisses: ['what is an eclipse', 'eclipse chrome browser', 'eclipse ide download', 'twilight eclipse', 'how does a solar eclipse work', 'can i look at the eclipse', 'eclipse glasses', 'eclipse of the heart lyrics', 'ford eclipse cross'],
  match(lower, text) { return !!eclipseAsk(text); },
  run,
};
