/**
 * sky — "sky", "the night sky", "what's in the sky tonight": the stage becomes the real sky overhead (skills/sky-world.js) and a card sits
 * on top of it with a definition, a take that adds a checkable fact, "Right now, where you are", and chips that run real skills (the moon,
 * sunrise and sunset, the aurora, constellations, meteor showers, eclipses). The first skill to own the stage through the `world` hook:
 * api.world(card, factory) hands the skill a canvas behind the stage for as long as the card is open, and the stage goes back to the void
 * when the card closes. Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import * as A from '../lib/astro.js';
import { skyNow, planetsToSee, events, fmtTime, dayWord, inWords, compassWord, lightName, pct } from '../lib/skyfacts.js';
import { whereAmI, findPlace, savePlace, latLonText } from '../lib/where.js';

const PLACE = '(.+?)';
// "sky", "the night sky", "show me the sky tonight", "what's in the sky", "sky over Tokyo": a place may follow
const SKY = [
  /^(?:(?:show|open|give)\s+(?:me\s+)?|let\s+me\s+see\s+)?(?:the\s+|my\s+)?(?:night\s+)?sky(?:\s+(?:tonight|now|right now|today|overhead|above|above me|above us|here))?$/,
  /^(?:what'?s|what is|what do i see)\s+(?:in|up in|on)\s+(?:the\s+|my\s+)?(?:night\s+)?sky(?:\s+(?:tonight|now|right now|today|above me|overhead))?$/,
  /^(?:show\s+(?:me\s+)?)?(?:the\s+stars|stars\s+(?:tonight|now|right now|overhead|above me)|star map|star chart|sky map|planetarium)(?:\s+(?:tonight|now|right now|overhead|above me))?$/,
  /^look\s+up$/,
];
const SKY_AT = /^(?:show\s+(?:me\s+)?)?(?:the\s+)?(?:night\s+)?sky\s+(?:over|above|in|at|from)\s+(.+)$/;
export function skyOf(text) {
  const t = String(text || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t || t.length > 80) return null;
  for (const re of SKY) if (re.test(t)) return { place: null };
  const m = SKY_AT.exec(t); if (m && !/^(?:the\s+)?(?:morning|evening|night|dark|wild|west|east|north|south)$/.test(m[1])) return { place: m[1].replace(/^the\s+/, '') };
  return null;
}

export const DEFINITION = 'The sky is everything you can see above the horizon: the sun by day, then the moon, the planets and the stars, all of them wheeling as the Earth turns.';

// a take that carries a fact anyone can check: the celestial pole stands as high as your latitude, and the stars come back 3 min 56 s earlier each night
export function takeFor(lat) {
  const north = lat >= 0, h = Math.abs(lat);
  const siderealGain = Math.round(86400 - 86400 / (1 + 1 / 365.2422));          // seconds the stars gain on the clock each day
  const m = Math.floor(siderealGain / 60), s = siderealGain % 60;
  return {
    html: `The sky is a clock and a map you can read without either. The point it turns around stands ${h.toFixed(0)}° above your ${north ? 'north' : 'south'} horizon, exactly as high as your latitude${north ? ', and Polaris sits within a degree of it' : ' (no bright star marks it in the south)'}. And any star comes back to the same spot ${m} minutes ${s} seconds earlier each night: check it by marking where a star stands over a roof or a branch at the same clock time two nights running.`,
    siderealGain,
  };
}

export function chips() {
  return [['Tonight\'s moon', 'moon tonight'], ['Next full moon', 'next full moon'], ['Sunrise and sunset', 'sunrise and sunset'], ['Aurora', 'aurora forecast'],
    ['What\'s that constellation', 'what\'s that constellation'], ['Meteor showers', 'meteor showers this month'], ['Next eclipse', 'next eclipse']];
}

// the lines of "Right now, where you are": plain facts about this moment, from lib/astro.js
export function nowLines(date, place) {
  const n = skyNow(date, place.lat, place.lon), lines = [], tz = place.tz;
  const sunDeg = Math.abs(Math.round(n.sun.alt));
  lines.push(n.sun.alt > 0 ? `The sun is ${sunDeg}° up, to the ${compassWord(n.sun.az)} (${n.light}).` : `The sun is ${sunDeg}° below the horizon (${n.light}).`);
  const mo = n.moon;
  lines.push(`The moon is ${mo.name}, ${pct(mo.illumination)} lit, ${mo.up ? `${Math.round(mo.alt)}° up, to the ${compassWord(mo.az)}` : 'below the horizon'}.`);
  const see = planetsToSee(n);
  lines.push(see.length ? `Planets to look for: ${see.map((p) => `${p.label} (${Math.round(p.alt)}° up, ${compassWord(p.az)})`).join(', ')}.` : n.sun.alt > -3 ? 'No planets to look for yet: the sky is still too bright.' : 'No planet is above the horizon right now.');
  const ev = events('sun', date, place.lat, place.lon);
  if (ev.state === 'always up') lines.push('The sun does not set here at this time of year.');
  else if (ev.state === 'always down') lines.push('The sun does not rise here at this time of year.');
  else if (n.sun.alt > -0.833 && ev.nextSet) lines.push(`Sunset ${dayWord(ev.nextSet, date, tz)} at ${fmtTime(ev.nextSet, tz)}, ${inWords(ev.nextSet - date)}.`);
  else if (ev.nextRise) lines.push(`Sunrise ${dayWord(ev.nextRise, date, tz)} at ${fmtTime(ev.nextRise, tz)}, ${inWords(ev.nextRise - date)}.`);
  return { lines, now: n };
}

export function cardHtml(esc, { place, date, rows, note }) {
  const tz = place.tz, when = date.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', ...(tz ? { timeZone: tz } : {}) });
  const t = takeFor(place.lat);
  return `<style>.skyc .skychips{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 4px}.skyc .skychips a{border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:5px 11px;font-size:13px;color:#e8ecff;text-decoration:none;background:rgba(255,255,255,.05)}.skyc .skychips a:hover,.skyc .skychips a:focus-visible{background:rgba(255,255,255,.14);outline:2px solid #ffe2a1;outline-offset:1px}`
    + `.skyc .skyctl{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.skyc .skyctl button,.skyc .skyplace button{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.18);color:#e8ecff;border-radius:8px;padding:5px 10px;font:inherit;font-size:13px;cursor:pointer}.skyc .skyctl button:focus-visible,.skyc .skyplace button:focus-visible,.skyc .skyplace input:focus-visible{outline:2px solid #ffe2a1;outline-offset:1px}`
    + `.skyc .skynow{margin:10px 0;padding:10px 12px;border-radius:12px;background:rgba(255,255,255,.05)}.skyc .skynow h3{margin:0 0 4px;font-size:13px;font-weight:600;letter-spacing:.02em;color:#ffe2a1}.skyc .skynow p{margin:2px 0}`
    + `@media (max-width:480px){.skyc{display:flex;flex-direction:column}.skyc .skychips{order:1}.skyc .skynow{order:2}.skyc .skyctl,.skyc .skypick{order:3}.skyc .skytake{order:4}.skyc .skyplace{order:5}.skyc .src{order:6}.skyc p{margin-bottom:6px}}`
    + `.skyc .skyplace{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0 0}.skyc .skyplace input{flex:1 1 140px;min-width:0;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.18);color:#fff;border-radius:8px;padding:6px 9px;font:inherit;font-size:13px}.skyc .skypick{min-height:1.4em;color:#ffe2a1;font-size:13px;margin:4px 0}</style>`
    + `<h2>Sky</h2><div class="sub">${esc(place.name)} (${esc(latLonText(place.lat, place.lon))}) · ${esc(when)} · a simulation</div>`
    + `<p>${esc(DEFINITION)}</p>`
    + `<p class="skytake"><b>A take.</b> ${esc(t.html)}</p>`
    + `<div class="skynow" role="group" aria-label="Right now, where you are"><h3>Right now, where you are</h3>${rows.map((l) => `<p>${esc(l)}</p>`).join('')}</div>`
    + `<div class="skychips" role="group" aria-label="Ask about the sky">${chips().map(([label, ask]) => `<a href="#" data-ask="${esc(ask)}">${esc(label)}</a>`).join('')}</div>`
    + `<div class="skyctl" role="group" aria-label="Look around the sky"><button type="button" data-look="left" aria-label="Look left">◀ left</button><button type="button" data-look="right" aria-label="Look right">right ▶</button><button type="button" data-look="up" aria-label="Look up">▲ up</button><button type="button" data-look="down" aria-label="Look down">▼ down</button><button type="button" data-look="in" aria-label="Zoom in">+</button><button type="button" data-look="out" aria-label="Zoom out">−</button></div>`
    + `<div class="skypick" aria-live="polite">${note ? esc(note) : 'Drag the sky to look around; tap a star for its name.'}</div>`
    + `<form class="skyplace" aria-label="Change location"><input name="where" type="text" autocomplete="off" placeholder="change location: a city" aria-label="Change location, type a city"><button type="submit">Go</button></form>`
    + `<div class="src">A simulation, not a photograph: stars from the Hipparcos catalog, the sun, moon and planets computed for ${esc(place.name)} (${esc(latLonText(place.lat, place.lon))}) at the moment above.</div>`;
}

async function run(text, api) {
  const { showPage, esc, say, loopLog } = api;
  const ask = skyOf(text) || { place: null };
  const el = showPage((p) => { p.classList.add('skyc'); p.innerHTML = '<h2>Sky</h2><div class="sub">finding where you are…</div>'; });
  let place = ask.place ? await findPlace(ask.place) : await whereAmI();
  if (!api._pageStill(el)) return 'sky';
  if (!place) {
    el.innerHTML = `<h2>Sky</h2><p>${ask.place ? `I couldn't find "${esc(ask.place)}". Try a city name, like "sky over Oslo".` : 'I need to know where you are to draw your sky.'}</p><form class="skyplace" aria-label="Change location"><input name="where" type="text" autocomplete="off" placeholder="a city" aria-label="Type a city"><button type="submit">Go</button></form>`;
    wirePlaceForm(el, null, api, () => {});
    return ask.place ? 'none' : 'sky';
  }
  let date = new Date(), ctl = null, rows = nowLines(date, place);
  const render = (note) => { el.innerHTML = cardHtml(esc, { place, date, rows: rows.lines, note }); wire(note); };
  const wire = () => {
    const pickEl = el.querySelector('.skypick');
    el.querySelectorAll('[data-look]').forEach((b) => b.addEventListener('click', () => {
      if (!ctl) return; const d = b.getAttribute('data-look');
      if (d === 'left') ctl.lookBy(-12, 0); else if (d === 'right') ctl.lookBy(12, 0); else if (d === 'up') ctl.lookBy(0, 10); else if (d === 'down') ctl.lookBy(0, -10); else if (d === 'in') ctl.zoomBy(0.8); else ctl.zoomBy(1.25);
    }));
    el.addEventListener('keydown', (e) => {                       // arrow keys on the card look around; plus and minus zoom
      if (!ctl || e.target.closest('input, textarea')) return; const k = e.key;
      if (k === 'ArrowLeft') ctl.lookBy(-8, 0); else if (k === 'ArrowRight') ctl.lookBy(8, 0); else if (k === 'ArrowUp') ctl.lookBy(0, 6); else if (k === 'ArrowDown') ctl.lookBy(0, -6); else if (k === '+' || k === '=') ctl.zoomBy(0.8); else if (k === '-') ctl.zoomBy(1.25); else return;
      e.preventDefault();
    });
    wirePlaceForm(el, place, api, async (p) => { place = p; date = new Date(); rows = nowLines(date, place); ctl && ctl.setPlace(p.lat, p.lon, p.tz); render(`Now showing ${p.name}.`); });
    void pickEl;
  };
  render();
  const first = A.sunHor(date, place.lat, place.lon);
  const mod = await import('./sky-world.js');                    // the drawing code (and 300 stars) load only when someone asks for the sky
  if (!api._pageStill(el)) return 'sky';
  const view = mod.initialView(first.alt, first.az, place.lat);
  ctl = api.world ? api.world(el, (host) => {
    return mod.createSky(host, { lat: place.lat, lon: place.lon, date, view, onPick: (info) => {
      const n = el.querySelector('.skypick'); if (!n) return;
      n.textContent = info.kind === 'star' ? `${info.name}${info.constellation ? ', in ' + info.constellation : ''} · magnitude ${info.mag.toFixed(1)} · ${info.alt > 0 ? Math.round(info.alt) + '° up, ' + compassWord(info.az) : 'below the horizon'}`
        : `${info.name}${info.detail ? ', ' + info.detail : ''} · ${info.alt > 0 ? Math.round(info.alt) + '° up, ' + compassWord(info.az) : 'below the horizon'}`;
    } });
  }) : null;
  say('');
  loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'sky' });
  return 'sky';
}

function wirePlaceForm(el, place, api, done) {
  const f = el.querySelector('.skyplace'); if (!f) return;
  f.addEventListener('submit', async (e) => {
    e.preventDefault(); const q = f.querySelector('input').value.trim(); if (!q) return;
    const p = await findPlace(q);
    if (!p) { const n = el.querySelector('.skypick') || f; n.textContent = `I couldn't find "${q}".`; return; }
    savePlace(p); done(p);
  });
}

export default {
  name: 'sky',
  skyOf,
  examples: ['sky', 'the sky', 'show me the sky', 'the night sky', 'sky tonight', 'what\'s in the sky tonight', 'show me the stars', 'star map', 'look up', 'sky over Tokyo', 'night sky above me'],
  nearMisses: ['why is the sky blue', 'sky news', 'sky sports', 'sky blue', 'skyrim', 'is the sky clear tonight', 'sky ticket', 'the sky is falling', 'weather sky', 'stars', 'dancing with the stars'],
  match(lower, text) { return !!skyOf(text); },
  run,
};
