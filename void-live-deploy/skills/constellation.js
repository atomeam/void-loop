/**
 * constellation — "what's that constellation", "which constellations are up tonight", "where is Orion", "when can I see the Big Dipper": the
 * constellations above your horizon now (with the bright stars that mark them), and for a named one where it is, which way to face, and
 * when in the year it stands highest in the evening. lib/astro.js plus the star table (loaded only when this is asked). To name a star you
 * can see, open the sky and tap it.
 */
import * as A from '../lib/astro.js';
import { compassWord, skyNow } from '../lib/skyfacts.js';
import { whereAmI, findPlace } from '../lib/where.js';
import { splitPlace, SKY_LINK } from '../lib/skyask.js';

// the 88 names (the same as lib/stars.js CONSTELLATIONS, which tools/constellation.test.mjs checks), kept here so matching an ask loads no star table
export const NAMES = { And: 'Andromeda', Ant: 'Antlia', Aps: 'Apus', Aqr: 'Aquarius', Aql: 'Aquila', Ara: 'Ara', Ari: 'Aries', Aur: 'Auriga', Boo: 'Boötes', Cae: 'Caelum', Cam: 'Camelopardalis', Cnc: 'Cancer', CVn: 'Canes Venatici', CMa: 'Canis Major', CMi: 'Canis Minor', Cap: 'Capricornus', Car: 'Carina', Cas: 'Cassiopeia', Cen: 'Centaurus', Cep: 'Cepheus', Cet: 'Cetus', Cha: 'Chamaeleon', Cir: 'Circinus', Col: 'Columba', Com: 'Coma Berenices', CrA: 'Corona Australis', CrB: 'Corona Borealis', Crv: 'Corvus', Crt: 'Crater', Cru: 'Crux', Cyg: 'Cygnus', Del: 'Delphinus', Dor: 'Dorado', Dra: 'Draco', Equ: 'Equuleus', Eri: 'Eridanus', For: 'Fornax', Gem: 'Gemini', Gru: 'Grus', Her: 'Hercules', Hor: 'Horologium', Hya: 'Hydra', Hyi: 'Hydrus', Ind: 'Indus', Lac: 'Lacerta', Leo: 'Leo', LMi: 'Leo Minor', Lep: 'Lepus', Lib: 'Libra', Lup: 'Lupus', Lyn: 'Lynx', Lyr: 'Lyra', Men: 'Mensa', Mic: 'Microscopium', Mon: 'Monoceros', Mus: 'Musca', Nor: 'Norma', Oct: 'Octans', Oph: 'Ophiuchus', Ori: 'Orion', Pav: 'Pavo', Peg: 'Pegasus', Per: 'Perseus', Phe: 'Phoenix', Pic: 'Pictor', Psc: 'Pisces', PsA: 'Piscis Austrinus', Pup: 'Puppis', Pyx: 'Pyxis', Ret: 'Reticulum', Sge: 'Sagitta', Sgr: 'Sagittarius', Sco: 'Scorpius', Scl: 'Sculptor', Sct: 'Scutum', Ser: 'Serpens', Sex: 'Sextans', Tau: 'Taurus', Tel: 'Telescopium', Tri: 'Triangulum', TrA: 'Triangulum Australe', Tuc: 'Tucana', UMa: 'Ursa Major', UMi: 'Ursa Minor', Vel: 'Vela', Vir: 'Virgo', Vol: 'Volans', Vul: 'Vulpecula' };
const ALIAS = { 'big dipper': 'UMa', 'the plough': 'UMa', plough: 'UMa', 'great bear': 'UMa', 'little dipper': 'UMi', 'little bear': 'UMi', 'southern cross': 'Cru', 'orions belt': 'Ori', 'the hunter': 'Ori', 'great dog': 'CMa', 'little dog': 'CMi', 'the swan': 'Cyg', 'northern cross': 'Cyg', 'the scorpion': 'Sco', 'the twins': 'Gem', 'the bull': 'Tau', 'the lion': 'Leo', 'the seven sisters': 'Tau' };
const BYNAME = Object.fromEntries(Object.entries(NAMES).map(([k, v]) => [v.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''), k]));
const plain = (x) => String(x).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/['’]s\b/g, 's').replace(/\s+/g, ' ').trim();

// { kind: 'list', place } or { kind: 'one', abbr, place } or null
export function constAsk(text) {
  const { core, place } = splitPlace(text); const t = plain(core);
  if (/^(?:what(?:s| is) )?(?:that|this|the) constellation$|^(?:identify|find|spot) (?:that|this|the|a) constellation$|^(?:which|what) constellations? (?:are|is|can i see|do i see)(?: up| visible| out| in the sky| above)?(?: tonight| now| right now| today| overhead)?$|^constellations?(?: tonight| now| right now| overhead| above me| i can see| visible tonight| up tonight)?$|^(?:what|which) constellation(?:s)? (?:is|are) (?:that|those|overhead|above me)$/.test(t)) return { kind: 'list', place };
  let m = /^(?:where is|where are|where(?:s| is) the|when can i see|when (?:is|are)|find|show me|is|are|how do i find|how to find|look for|spot)\s+(?:the\s+)?(.+?)(?: constellation)?(?: visible| up| out| tonight| in the sky| rising| tonight| now| right now| overhead)*$/.exec(t) || /^(?:the\s+)?(.+?) constellation(?: tonight| now| visible| tonight| in the sky)*$/.exec(t) || /^constellation (.+?)$/.exec(t);
  if (m) { const key = plain(m[1]).replace(/^the\s+/, ''); const abbr = ALIAS[key] || ALIAS['the ' + key] || BYNAME[key]; if (abbr && (/constellation|where|when can i|how do i find|how to find|look for|find|spot|visible|up|out|tonight|now/.test(t) || ALIAS[key])) return { kind: 'one', abbr, place }; }
  return null;
}

// a constellation's middle (a circular mean of its figure's points), from the star table
async function centre(abbr) {
  const { FIGURES, STARS } = await import('../lib/stars.js'), pts = (FIGURES[abbr] || []).flat();
  if (pts.length) { let x = 0, y = 0, d = 0; for (const [ra, dec] of pts) { x += Math.cos(ra * A.RAD); y += Math.sin(ra * A.RAD); d += dec; } return { ra: A.norm360(Math.atan2(y, x) / A.RAD), dec: d / pts.length, stars: STARS.filter((s) => s[4] === abbr) }; }
  const st = STARS.filter((s) => s[4] === abbr); if (!st.length) return null;
  return { ra: st[0][0], dec: st[0][1], stars: st };
}
// when in the year a spot at this right ascension crosses the meridian at 9 pm and at midnight (local solar time), as dates in a given year:
// the local sidereal time is the sun's right ascension plus the hours since noon, so the sun must stand at ra - 135 degrees at 9 pm and ra - 180 at midnight
export function seasonOf(ra, year = new Date().getUTCFullYear()) {
  const find = (target) => { let best = null, bd = 1e9; for (let d = 0; d < 366; d++) { const t = new Date(Date.UTC(year, 0, 1 + d, 12)); const dd = Math.abs(A.norm180(A.sunEq(t).ra - target)); if (dd < bd) { bd = dd; best = t; } } return best; };
  return { midnight: find(A.norm360(ra + 180)), nine: find(A.norm360(ra - 135)) };
}
const monthDay = (d) => d.toLocaleDateString([], { month: 'long', day: 'numeric', timeZone: 'UTC' });

// can this place ever see a spot at this declination: 'circumpolar' | 'rises' | 'never'
export function reachOf(lat, dec) {
  const top = 90 - Math.abs(lat - dec), low = (lat >= 0 ? lat + dec : -lat - dec) - 90;
  return low > 0 ? 'circumpolar' : top > 0 ? 'rises' : 'never';
}

export async function listAnswer(date, place) {
  const { STARS, CONSTELLATIONS } = await import('../lib/stars.js'), n = skyNow(date, place.lat, place.lon), lines = [];
  if (n.sun.alt > -6) return { lines: [`It is ${n.light} where you are, so no constellation is showing yet. Come back after dark, or open the sky to see where they will be.`], rows: [] };
  const by = {};
  for (const s of STARS) { const h = A.starHor(s[0], s[1], date, place.lat, place.lon); if (h.alt < 8) continue; (by[s[4]] ||= []).push({ name: s[3], mag: s[2], ...h }); }
  const rows = Object.entries(by).filter(([, v]) => v.some((x) => x.mag < 2.6)).map(([abbr, v]) => { const top = v.slice().sort((a, b) => a.mag - b.mag)[0], avg = v.reduce((a, x) => a + x.alt, 0) / v.length; return { abbr, name: CONSTELLATIONS[abbr], star: top, alt: top.alt, az: top.az, score: avg }; }).sort((a, b) => a.star.mag - b.star.mag).slice(0, 8);
  for (const r of rows) lines.push(`${r.name}: ${r.star.name} is ${Math.round(r.alt)}° up, to the ${compassWord(r.az)}.`);
  if (!rows.length) lines.push('No bright constellation is high enough right now.');
  return { lines, rows };
}

export async function oneAnswer(date, place, abbr) {
  const c = await centre(abbr), name = NAMES[abbr]; if (!c) return { lines: [`I don't have ${name}.`] };
  const reach = reachOf(place.lat, c.dec), h = A.starHor(c.ra, c.dec, date, place.lat, place.lon), n = skyNow(date, place.lat, place.lon), s = seasonOf(c.ra, date.getUTCFullYear()), lines = [];
  const bright = c.stars.slice().sort((a, b) => a[2] - b[2]).slice(0, 3).map((x) => x[3]).join(', ');
  if (bright) lines.push(`${name}: look for ${bright}.`);
  if (reach === 'never') lines.push(`${name} never rises above the horizon from here: it lies too far ${place.lat >= 0 ? 'south' : 'north'}.`);
  else {
    lines.push(reach === 'circumpolar' ? `From here ${name} never sets: it circles the pole all night, all year.` : `From here ${name} rises and sets.`);
    lines.push(h.alt > 5 ? `Right now it is ${Math.round(h.alt)}° up, to the ${compassWord(h.az)}${n.sun.alt > -6 ? ', but the sky is too bright to see it' : ''}.` : `Right now it is ${h.alt > 0 ? 'almost on' : 'below'} the horizon.`);
    lines.push(`It stands highest at 9 pm around ${monthDay(s.nine)}, and at midnight around ${monthDay(s.midnight)} (on the same date every year); it is in the evening sky for a few months either side.`);
  }
  return { lines, c, h, reach };
}

async function run(text, api) {
  const { showPage, esc, say, loopLog } = api, ask = constAsk(text) || { kind: 'list' };
  const el = showPage((p) => { p.innerHTML = '<h2>Constellations</h2><div class="sub">…</div>'; });
  const place = ask.place ? await findPlace(ask.place) : await whereAmI();
  if (!api._pageStill(el)) return 'constellation';
  if (!place) { el.innerHTML = `<h2>Constellations</h2><p>I need a place for this: try "constellations in Oslo", or open the sky and set your location.</p>${SKY_LINK}`; return 'constellation'; }
  const date = new Date(), a = ask.kind === 'one' ? await oneAnswer(date, place, ask.abbr) : await listAnswer(date, place);
  if (!api._pageStill(el)) return 'constellation';
  el.innerHTML = `<h2>${esc(ask.kind === 'one' ? NAMES[ask.abbr] : 'Constellations up now')}</h2><div class="sub">${esc(place.name)}</div>${a.lines.map((l) => `<p>${esc(l)}</p>`).join('')}${ask.kind === 'list' ? '<p>To name a star you can see, open the sky and tap it.</p>' : ''}<p class="src">Computed from the Hipparcos star catalog. <a href="#" data-ask="meteor showers this month">Meteor showers</a></p>${SKY_LINK}`;
  say(''); loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'constellation' });
  return 'constellation';
}

export default {
  name: 'constellation',
  constAsk,
  examples: ['what\'s that constellation', 'which constellations are up tonight', 'constellations tonight', 'where is Orion', 'when can I see the Big Dipper', 'find the southern cross', 'orion constellation', 'is cassiopeia visible tonight', 'constellations I can see', 'where is ursa major'],
  nearMisses: ['orion pictures', 'orion car insurance', 'cassiopeia the movie', 'constellation brands stock', 'constellation energy', 'what is a constellation', 'is the big dipper a constellation', 'orion nebula distance', 'taurus personality traits', 'leo horoscope today'],
  match(lower, text) { return !!constAsk(text); },
  run,
};
