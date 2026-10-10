/**
 * meteors — "meteor showers this month", "next meteor shower", "when are the Perseids", "shooting stars tonight": the showers active now and the next
 * peak, with the moon's light at the peak and whether the radiant is up tonight where you are. lib/showers.js is a typed-in table (good to a day);
 * the moon and the radiant are computed (lib/astro.js).
 */
import * as A from '../lib/astro.js';
import { SHOWERS, activeShowers, nextShower } from '../lib/showers.js';
import { compassWord, pct } from '../lib/skyfacts.js';
import { whereAmI, findPlace } from '../lib/where.js';
import { splitPlace, SKY_LINK } from '../lib/skyask.js';

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const NAME_KEYS = SHOWERS.map((s) => s[0].toLowerCase());
const ALT = { perseid: 'perseids', geminid: 'geminids', leonid: 'leonids', orionid: 'orionids', lyrid: 'lyrids', quadrantid: 'quadrantids', draconid: 'draconids', taurid: 'taurids', ursid: 'ursids', 'eta aquarid': 'eta aquariids', 'delta aquarid': 'southern delta aquariids', 'eta aquariid': 'eta aquariids' };

// { kind: 'month' | 'next' | 'one', shower?, place } or null
export function meteorAsk(text) {
  const { core, place } = splitPlace(text); const t = core.replace(/['’]s\b/g, 's');
  if (/^(?:meteor showers?|shooting stars?|falling stars?)(?: this month| tonight| now| today| this week| right now| coming up| this year| to see| to watch| happening)?$/.test(t) || /^(?:what|which) meteor showers? (?:is|are) (?:on|active|happening|coming)(?: this month| tonight| now| today| this week| right now)?$/.test(t)
    || /^(?:are there|is there) (?:any |a )?(?:meteor showers?|shooting stars?)(?: on| happening| active)?(?: this month| tonight| now| today| this week)?$/.test(t) || /^(?:will|can) (?:i|we) (?:see|spot) (?:any |a )?(?:meteors?|shooting stars?)(?: tonight| this month| today)?$/.test(t)) return { kind: /tonight|now|today/.test(t) ? 'tonight' : 'month', place };
  if (/^(?:when(?:s| is) |what(?:s| is) )?(?:the )?next (?:meteor shower|shooting stars?)$/.test(t) || /^(?:when is|when(?:s)?) the next meteor shower$/.test(t)) return { kind: 'next', place };
  let m = /^(?:when(?:s| is| are| will be)?|what(?:s| is| day is)|tell me about|how (?:good|big) (?:is|are)|best time to see|how to see|where to look for|when to see|can i see)\s+(?:the\s+)?([a-z ]+?)(?: meteor shower| meteors| shower| peak)?(?: peak| this year| tonight| best| date| dates| this month)*$/.exec(t) || /^(?:the\s+)?([a-z ]+?) meteor shower(?: peak| this year| tonight| date| dates| this month)*$/.exec(t) || /^(?:the\s+)?(perseids?|geminids?|leonids?|orionids?|lyrids?|quadrantids?|draconids?|taurids?|ursids?|eta aquari+ds?|delta aquari+ds?)(?: peak| this year| tonight| date| dates| meteor shower)*$/.exec(t);
  if (m) { const k = m[1].trim().replace(/\s+/g, ' '), name = NAME_KEYS.includes(k) ? k : ALT[k] || ALT[k.replace(/s$/, '')]; if (name) return { kind: 'one', shower: name, place }; }
  return null;
}

// the answer: the showers active on a date and the next peak, each with the moon's light at its peak
function peakInfo(date, shower, place) {
  const at = new Date(Date.UTC(date.getUTCFullYear(), shower.peak[0] - 1, shower.peak[1], 3)), when = at < date ? new Date(Date.UTC(date.getUTCFullYear() + 1, shower.peak[0] - 1, shower.peak[1], 3)) : at;
  const ph = A.moonPhase(when), light = ph.illumination;
  return { when, moon: ph, verdict: light < 0.25 ? 'dark skies: the moon will hardly show' : light < 0.6 ? 'some moonlight' : 'bright moonlight will hide the fainter ones' };
}
export function meteorAnswer(date, place, ask) {
  const tz = place && place.tz, lines = [];
  const fmt = (d) => d.toLocaleDateString([], { month: 'long', day: 'numeric', timeZone: 'UTC' });
  if (ask.kind === 'one') {
    const s = SHOWERS.find((x) => x[0].toLowerCase() === ask.shower); const sh = { name: s[0], peak: s[3], zhr: s[4], ra: s[5], dec: s[6], note: s[7] }, pk = peakInfo(date, sh, place);
    lines.push(`${s[0]} peak around ${fmt(pk.when)}, up to about ${s[4]} meteors an hour under a dark clear sky (fewer in practice). Active ${MONTHS[s[1][0] - 1][0].toUpperCase() + MONTHS[s[1][0] - 1].slice(1)} ${s[1][1]} to ${MONTHS[s[2][0] - 1][0].toUpperCase() + MONTHS[s[2][0] - 1].slice(1)} ${s[2][1]}.`);
    lines.push(`The moon at the peak: ${pct(pk.moon.illumination)} lit (${pk.moon.name}), so ${pk.verdict}.`);
    lines.push(`${s[7][0].toUpperCase()}${s[7].slice(1)}.`);
    if (place) { const h = A.starHor(s[5], s[6], date, place.lat, place.lon); lines.push(h.alt > 0 ? `The radiant is ${Math.round(h.alt)}° up, to the ${compassWord(h.az)}, right now: meteors seem to spread from there, but look anywhere a little off it.` : 'The radiant is below your horizon right now; it is best to watch when it is up (usually after midnight).'); }
    return { lines };
  }
  const act = activeShowers(date);
  if (act.length) {
    for (const s of act.slice(0, 4)) lines.push(`${s.name}: ${s.daysToPeak === 0 ? 'peaking today' : s.daysToPeak > 0 ? `peak in ${s.daysToPeak} day${s.daysToPeak === 1 ? '' : 's'}` : `peaked ${-s.daysToPeak} day${s.daysToPeak === -1 ? '' : 's'} ago`}, up to about ${s.zhr} an hour at best.`);
  } else lines.push('No major meteor shower is active right now.');
  const upcoming = nextShower(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1)));
  if (upcoming && !act.some((a) => a.name === upcoming.name)) { const sh = SHOWERS.find((x) => x[0] === upcoming.name), pk = peakInfo(date, { peak: sh[3] }, place); lines.push(`Next peak: ${upcoming.name} on ${fmt(upcoming.date)} (up to about ${upcoming.zhr} an hour); the moon will be ${pct(pk.moon.illumination)} lit, so ${pk.verdict}.`); }
  return { lines };
}

async function run(text, api) {
  const { showPage, esc, say, loopLog } = api, ask = meteorAsk(text) || { kind: 'month' };
  const el = showPage((p) => { p.innerHTML = '<h2>Meteor showers</h2><div class="sub">…</div>'; });
  const place = ask.place ? await findPlace(ask.place) : await whereAmI().catch(() => null);
  if (!api._pageStill(el)) return 'meteors';
  const a = meteorAnswer(new Date(), place, ask), title = ask.kind === 'one' ? ask.shower.replace(/\b\w/g, (c) => c.toUpperCase()) : 'Meteor showers';
  el.innerHTML = `<h2>${esc(title)}</h2><div class="sub">${esc(place ? place.name : 'anywhere')}</div>${a.lines.map((l) => `<p>${esc(l)}</p>`).join('')}<p class="src">Peak dates are the long-standing published ones (good to a day); the moon's light is computed. A meteor shower is best watched from a dark place, lying back, after midnight. <a href="#" data-ask="moon tonight">Tonight's moon</a></p>${SKY_LINK}`;
  say(''); loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'meteors' });
  return 'meteors';
}

export default {
  name: 'meteors',
  meteorAsk,
  examples: ['meteor showers this month', 'next meteor shower', 'when is the next meteor shower', 'when are the perseids', 'geminids meteor shower', 'shooting stars tonight', 'are there any meteor showers tonight', 'meteor showers', 'when is the leonid meteor shower', 'best time to see the perseids', 'can i see meteors tonight'],
  nearMisses: ['meteor shower wallpaper', 'meteor garden', 'meteorology degree', 'shooting star lyrics', 'shooting stars bk', 'what causes a meteor shower', 'how fast is a meteor', 'meteor crater arizona', 'the meteors'],
  match(lower, text) { return !!meteorAsk(text); },
  run,
};
