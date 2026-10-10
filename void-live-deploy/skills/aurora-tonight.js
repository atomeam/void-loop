/**
 * aurora — "aurora forecast", "can I see the northern lights tonight": NOAA's planetary Kp index against how far from the geomagnetic pole you
 * are, with the sun and the moon from lib/astro.js. The Kp comes from /api/aurora (functions/api/aurora.js: one cached read of NOAA's feed, so the
 * visitor's browser never talks to NOAA). If it cannot be read, the card says so and still says how the aurora works for your latitude.
 * The sky card's tint helpers (parseKp for the feed, auroraStrength, tintWithAurora) live in skills/aurora.js and are not skills.
 */
import * as A from '../lib/astro.js';
import { events, fmtTime, skyNow, agoWords } from '../lib/skyfacts.js';
import { whereAmI, findPlace } from '../lib/where.js';
import { splitPlace, SKY_LINK } from '../lib/skyask.js';


export function auroraAsk(text) {
  const { core, place } = splitPlace(text); const t = core.replace(/['’]s\b/g, 's');
  if (/^(?:the )?(?:aurora|northern lights|southern lights|aurora borealis|aurora australis)(?: forecast| tonight| today| now| chances?| prediction| alert| report| probability| activity| tomorrow)*$/.test(t)
    || /^(?:aurora|northern lights|southern lights) (?:forecast|tonight|today|now|prediction|report)$/.test(t)
    || /^(?:can|could|will|might) (?:i|we) (?:see|spot|catch) (?:the )?(?:aurora(?: borealis| australis)?|northern lights|southern lights)(?: tonight| tomorrow| today| now| here| from here)*$/.test(t)
    || /^(?:is there|are there) (?:an )?(?:aurora|northern lights|southern lights)(?: tonight| tomorrow| today| now| here)*$/.test(t)
    || /^(?:what(?:s| is) )?(?:the )?(?:current |latest |planetary )?kp(?: index| value| level)?(?: now| right now| today| tonight)?$/.test(t)
    || /^(?:will there be|is there going to be) (?:an? )?(?:aurora|northern lights|southern lights)(?: tonight| tomorrow)*$/.test(t)) return { place };
  return null;
}

// can the aurora reach this latitude: { gm, need (the Kp whose oval reaches overhead), low (the Kp for the poleward horizon) }
export function reach(lat, lon) {
  const gm = Math.abs(A.geomagLat(lat, lon)); let overhead = null, horizon = null;
  for (let k = 0; k <= 9; k++) { if (overhead === null && A.auroraEdge(k) <= gm) overhead = k; if (horizon === null && A.auroraEdge(k) - 6 <= gm) horizon = k; }
  return { gm, overhead, horizon };
}

export function auroraAnswer(date, place, nowRows, forecastRows) {
  const r = reach(place.lat, place.lon), sn = skyNow(date, place.lat, place.lon), south = place.lat < 0, name = south ? 'southern lights (aurora australis)' : 'northern lights (aurora borealis)', lines = [];
  const past = nowRows.filter((x) => x.t <= date), cur = past.length ? past[past.length - 1] : nowRows[0], future = forecastRows.filter((x) => x.t > date && x.t - date < 72 * 3600000);
  const peak = future.reduce((b, x) => (!b || x.kp > b.kp ? x : b), null);
  if (!cur && !peak) lines.push('I could not read NOAA\'s space-weather feed just now, so I cannot say what the aurora is doing tonight.');
  else {
    if (cur) lines.push(`Kp ${cur.predicted ? 'estimated' : 'measured'} ${agoWords(date - cur.t)}: ${cur.kp.toFixed(1)} (NOAA's planetary index, 0 quiet to 9 extreme).`);
    if (peak) lines.push(`The forecast peaks at Kp ${peak.kp.toFixed(1)} in the next three days (${peak.t.toLocaleString([], { weekday: 'short', hour: 'numeric', ...(place.tz ? { timeZone: place.tz } : {}) })}).`);
  }
  const best = Math.max(cur ? cur.kp : 0, peak ? peak.kp : 0);
  lines.push(`Your geomagnetic latitude is about ${r.gm.toFixed(0)}° (the aurora follows the magnetic poles, not the geographic ones). ${r.overhead === null ? `Even a Kp 9 storm barely reaches overhead this far from the pole (the ${south ? 'southern' : 'northern'} oval's edge falls to ${A.auroraEdge(9)}°), and on the poleward horizon it would take about Kp ${r.horizon === null ? '9 or more' : r.horizon}.` : `The oval reaches overhead at Kp ${r.overhead}, and low on the ${south ? 'southern' : 'northern'} horizon from about Kp ${r.horizon}.`}`);
  const verdict = r.overhead !== null && best >= r.overhead ? 'Yes: overhead if it is dark and clear.' : r.horizon !== null && best >= r.horizon ? `Possibly: low on the ${south ? 'south' : 'north'} horizon, if it is dark and clear.` : 'Unlikely from here at that level.';
  if (cur || peak) lines.push(`Can you see it from here? ${verdict}`);
  const ev = events('sun', date, place.lat, place.lon);
  if (sn.sun.alt > -12) lines.push(ev.nextSet && sn.sun.alt > -0.833 ? `It is daylight now; it gets dark enough after about ${fmtTime(new Date(ev.nextSet.getTime() + 90 * 60000), place.tz)}.` : 'The sky is still too bright; wait for full dark (the sun more than 12° down).');
  if (sn.moon.up && sn.moon.illumination > 0.6) lines.push(`The moon is up and ${Math.round(sn.moon.illumination * 100)}% lit, which washes out faint aurora.`);
  return { lines, cur, peak, reach: r, name };
}

// { kp, at } from our own /api/aurora, as the one reading row auroraAnswer wants; [] when the route has nothing
async function readNow(fetchFn) {
  try { const r = await fetchFn('/api/aurora'); const j = r && r.ok ? await r.json() : null; const t = j && j.kp != null ? new Date(j.at) : null; return t && !isNaN(t) ? [{ t, kp: Number(j.kp), predicted: false }] : []; } catch (_) { return []; }
}

async function run(text, api) {
  const { showPage, esc, say, loopLog } = api, ask = auroraAsk(text) || {};
  const el = showPage((p) => { p.innerHTML = '<h2>Aurora</h2><div class="sub">reading the Kp index…</div>'; });
  const place = ask.place ? await findPlace(ask.place) : await whereAmI();
  if (!api._pageStill(el)) return 'aurora-tonight';
  if (!place) { el.innerHTML = `<h2>Aurora</h2><p>${ask.place ? `I couldn't find "${esc(ask.place)}".` : 'I need a place for this: try "aurora forecast for Tromsø", or open the sky and set your location.'}</p>${SKY_LINK}`; return ask.place ? 'none' : 'aurora-tonight'; }
  const rows = await readNow(fetch);
  if (!api._pageStill(el)) return 'aurora-tonight';
  const ans = auroraAnswer(new Date(), place, rows, []);
  el.innerHTML = `<h2>${esc(ans.name.charAt(0).toUpperCase() + ans.name.slice(1))}</h2><div class="sub">${esc(place.name)}</div>${ans.lines.map((l) => `<p>${esc(l)}</p>`).join('')}<p class="src">Kp from <a href="https://www.swpc.noaa.gov/products/planetary-k-index" target="_blank" rel="noopener">NOAA SWPC</a>; how far the oval reaches by Kp is the usual rule of thumb, so treat the verdict as a guide, not a promise.</p>${SKY_LINK}`;
  say(''); loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'aurora-tonight' });
  return 'aurora-tonight';
}

export default {
  name: 'aurora-tonight',
  auroraAsk,
  examples: ['aurora forecast', 'northern lights tonight', 'can i see the northern lights', 'aurora tonight', 'will i see the aurora', 'what is the kp index', 'southern lights tonight', 'aurora forecast for Tromsø', 'is there an aurora tonight', 'aurora borealis forecast'],
  nearMisses: ['aurora the disney princess', 'aurora illinois weather', 'aurora borealis facts for kids', 'what causes the northern lights', 'northern lights hotel', 'aurora health care', 'northern lights song'],
  match(lower, text) { return !!auroraAsk(text); },
  run,
};
