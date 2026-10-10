/**
 * moontonight — "moon tonight", "tonight's moon", "next full moon", "when is the next new moon", "moonrise": the moon's phase, how lit it is,
 * when it rises and sets, and the next full and new moon, for where you are (or "in Oslo"). lib/astro.js, no network but the place lookup.
 * The lesson skill (skills/moon.js, "explain moon phases") is a different thing and keeps its own asks.
 */
import * as A from '../lib/astro.js';
import { events, fmtTime, dayWord, inWords, pct, compassWord } from '../lib/skyfacts.js';
import { whereAmI, findPlace } from '../lib/where.js';
import { splitPlace, moonSvg, SKY_LINK } from '../lib/skyask.js';

const PHASE = { full: 'full', new: 'new', 'first quarter': 'first quarter', 'last quarter': 'last quarter' };
// what is asked: { kind: 'tonight' | 'next', phase?, place? } or null
export function moonAsk(text) {
  const { core, place } = splitPlace(text); const t = core.replace(/['’]s\b/g, 's').replace(/\s+/g, ' ');
  let m = /^(?:when(?:s| is| will be)? |what(?:s| is) |what day is |what date is )?(?:the )?next (full|new|first quarter|last quarter|third quarter) moon(?: be| happen)?(?: date| time)?$/.exec(t)
    || /^when(?:s| is)? the (full|new) moon$/.exec(t) || /^(full|new) moon (?:date|dates|next|coming up)$/.exec(t) || /^when(?:s| is| will) (?:the )?(full|new) moon(?: be)?(?: next)?$/.exec(t) || /^next (full|new) moon$/.exec(t);
  if (m) return { kind: 'next', phase: m[1] === 'third quarter' ? 'last quarter' : m[1], place };
  if (/^(?:moon tonight|tonights moon|the moon tonight|moon phase(?: tonight| today| now| right now)?|(?:what(?:s| is) )?(?:the )?(?:moon phase|phase of the moon)(?: tonight| today| now| right now)?|what phase is the moon(?: in)?(?: tonight| today| now)?|what does the moon look like(?: tonight| today)?|(?:is|will) (?:it|the moon) (?:be )?(?:a )?full(?: moon)?(?: tonight| today)?|is there a (?:full|new) moon(?: tonight| today)?|(?:what(?:s| is) )?(?:the )?(?:current )?moon (?:phase )?(?:right )?now|(?:what(?:s| is) )?the moon (?:doing )?tonight|moon today|how much of the moon is lit(?: tonight| today)?|moonrise|moonset|moonrise and moonset|when does the moon (?:rise|set)(?: tonight| today)?|what time is moonrise|what time (?:does )?the moon (?:rise|set))$/.test(t)) return { kind: 'tonight', place };
  return null;
}

// the lines of the answer, from the almanac (pure: tests read these)
export function moonAnswer(date, place) {
  const ph = A.moonPhase(date), ev = events('moon', date, place.lat, place.lon), tz = place.tz, mh = A.moonHor(date, place.lat, place.lon);
  const lines = [`${ph.name[0].toUpperCase()}${ph.name.slice(1)}: ${pct(ph.illumination)} of the moon is lit, ${ph.ageDays.toFixed(0)} days into the cycle.`];
  lines.push(mh.alt > 0 ? `It is ${Math.round(mh.alt)}° above the horizon now, to the ${compassWord(mh.az)}.` : 'It is below the horizon now.');
  if (ev.state === 'always up' || ev.state === 'always down') lines.push(ev.state === 'always up' ? 'It stays above the horizon all day here.' : 'It stays below the horizon all day here.');
  else { const bits = []; if (ev.nextRise) bits.push(`rises ${dayWord(ev.nextRise, date, tz)} at ${fmtTime(ev.nextRise, tz)}`); if (ev.nextSet) bits.push(`sets ${dayWord(ev.nextSet, date, tz)} at ${fmtTime(ev.nextSet, tz)}`); bits.sort(); if (ev.nextRise && ev.nextSet && ev.nextSet < ev.nextRise) bits.reverse(); lines.push('The next time it ' + bits.join(', then ') + '.'); }
  const full = A.nextPhase(date, 'full'), neu = A.nextPhase(date, 'new');
  lines.push(`Next full moon: ${dayWord(full, date, tz)}, ${fmtTime(full, tz)} (${inWords(full - date)}). Next new moon: ${dayWord(neu, date, tz)}, ${fmtTime(neu, tz)} (${inWords(neu - date)}).`);
  return { lines, ph, full, neu };
}
export function nextPhaseAnswer(date, place, phase) {
  const when = A.nextPhase(date, phase), tz = place.tz, after = A.nextPhase(new Date(when.getTime() + 3 * 86400000), phase);
  const name = `${phase} moon`;
  const dw = dayWord(when, date, tz), soon = /^(today|tomorrow|yesterday)$/.test(dw) ? dw + ', ' : '';
  return { when, lines: [`The next ${name} is ${soon}${when.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', ...(tz ? { timeZone: tz } : {}) })}, at ${fmtTime(when, tz)} (${inWords(when - date)}).`, `The one after that: ${after.toLocaleDateString([], { month: 'long', day: 'numeric', ...(tz ? { timeZone: tz } : {}) })}.`] };
}

async function run(text, api) {
  const { showPage, esc, say, loopLog } = api, ask = moonAsk(text) || { kind: 'tonight' };
  const el = showPage((p) => { p.innerHTML = '<h2>The moon</h2><div class="sub">…</div>'; });
  const place = ask.place ? await findPlace(ask.place) : await whereAmI();
  if (!api._pageStill(el)) return 'moontonight';
  if (!place) { el.innerHTML = `<h2>The moon</h2><p>${ask.place ? `I couldn't find "${esc(ask.place)}".` : 'I need a place for this: try "moon tonight in Oslo", or open the sky and set your location.'}</p>${SKY_LINK}`; return ask.place ? 'none' : 'moontonight'; }
  const date = new Date();
  if (ask.kind === 'next') {
    const a = nextPhaseAnswer(date, place, ask.phase), ph = A.moonPhase(date);
    el.innerHTML = `${moonSvg(ph.illumination, ph.waxing, place.lat < 0)}<h2>Next ${esc(ask.phase)} moon</h2><div class="sub">${esc(place.name)}</div>${a.lines.map((l) => `<p>${esc(l)}</p>`).join('')}<p class="src">Computed from the moon's orbit (good to about 15 minutes). <a href="#" data-ask="moon tonight">Tonight's moon</a></p>`;
  } else {
    const a = moonAnswer(date, place);
    el.innerHTML = `${moonSvg(a.ph.illumination, a.ph.waxing, place.lat < 0)}<h2>The moon tonight</h2><div class="sub">${esc(place.name)}</div>${a.lines.map((l) => `<p>${esc(l)}</p>`).join('')}<p class="src">Computed from the moon's orbit (good to about 15 minutes). <a href="#" data-ask="next full moon">Next full moon</a></p>${SKY_LINK}`;
  }
  say(''); loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'moontonight' });
  return 'moontonight';
}

export default {
  name: 'moontonight',
  moonAsk,
  examples: ['moon tonight', 'tonight\'s moon', 'what is the moon phase today', 'moon phase tonight', 'what phase is the moon in', 'is it a full moon tonight', 'when is the next full moon', 'next new moon', 'when is the next new moon', 'moonrise', 'what time does the moon rise', 'next full moon in Oslo', 'how much of the moon is lit'],
  nearMisses: ['how far is the moon', 'moon river', 'fly me to the moon', 'explain moon phases', 'how do moon phases work', 'why does the moon have phases', 'moon landing', 'sailor moon', 'new moon movie', 'when is the next blue moon in the film'],
  match(lower, text) { return !!moonAsk(text); },
  run,
};
