/**
 * coral skill — two honest cards on Florida coral restoration (domains/void.growth.md, Next [think-tank]).
 * The reef-accretion card: planting staghorn offshore flipped the reef from shrinking to growing within a few years,
 * then the 2023 heatwave killed nearly all of it, so planting builds reef fast and heat tolerance decides whether it
 * lasts. The heat-survival card: what happened, what helps, what is being tried now, and one thing a visitor can do.
 * Every line carries its source and date; nothing beyond what the sources say; no planet-saving promise.
 * The heat-test card: how scientists find heat-tough coral before planting (the CBASS rig), what it predicts well and
 * where it is weaker; both preprints are labelled as preprints.
 * "coral restoration florida keys", "reef accretion potential", "can coral survive heatwaves", "flonduran coral",
 * "how do you test coral heat tolerance", "cbass coral".
 */
import { liveLine } from '../lib/reefwatch.js';
import { cleanLower } from '../lib/ask-text.js';
import { doseForecast, doseLines, MARINE_URL, WX_URL, KEYS } from '../lib/heat-dose.js'; // asked by Verse: the 48-hour projected dose

export const ACCRETION_SOURCES = [
  { date: '2025', name: 'Toth et al., Scientific Reports', href: 'https://doi.org/10.1038/s41598-025-04818-3' },
  { date: '2025', name: 'USGS data release (CC0)', href: 'https://doi.org/10.5066/P13HMEON' },
  { date: '2025-10-23', name: 'Manzello et al., Science', href: 'https://doi.org/10.1126/science.adx7825' },
];
export const HEAT_SOURCES = [
  { date: '2025-10-23', name: 'Manzello et al., Science', href: 'https://doi.org/10.1126/science.adx7825' },
  { date: '2025', name: 'Conservation Biology', href: 'https://doi.org/10.1111/cobi.70168' },
  { date: '2025-04-22', name: 'Coral Reefs', href: 'https://doi.org/10.1007/s00338-025-02652-7' },
  { date: '2025-07-15', name: 'University of Miami', href: null },
  { date: '2026-05-19', name: 'University of Miami', href: null },
];
export const TEST_SOURCES = [
  { date: '2023', name: 'Evensen et al., Limnology and Oceanography: Methods', href: 'https://doi.org/10.1002/lom3.10555' },
  { date: '2024-10-08', name: 'Coral Reefs', href: 'https://doi.org/10.1007/s00338-024-02577-7' },
  { date: '2025-11-20', name: 'Research Square', href: 'https://doi.org/10.21203/rs.3.rs-7863661/v1', preprint: true },
  { date: '2026-05-16', name: 'bioRxiv', href: 'https://doi.org/10.64898/2026.05.14.725291', preprint: true },
];

const CLEAN = cleanLower; // shared: lib/ask-text.js
const ACCRETION_RE = /^(?:(?:tell me about|show(?:\s+me)?|what is|what's)\s+)?(?:coral\s+restoration(?:\s+(?:in\s+)?(?:the\s+)?(?:florida\s+keys|florida|keys))?|(?:the\s+)?florida\s+keys\s+(?:coral\s+)?(?:reef|reefs|coral)(?:\s+restoration)?|reef[\s-]accretion(?:\s+potential)?|does\s+(?:coral\s+)?(?:planting|restoration)\s+(?:coral\s+)?work|does\s+planting\s+coral\s+work)$/;
const HEAT_RE = /^(?:(?:tell me about|show(?:\s+me)?|what is|what's|what are)\s+)?(?:can\s+(?:coral|corals|coral\s+reefs|reefs)\s+survive\s+(?:a\s+)?(?:heatwaves?|heat\s+waves?|marine\s+heatwaves?|the\s+next\s+heatwave)|flonduran\s+corals?|heat[\s-]tolerant\s+corals?|coral\s+heat\s+(?:survival|tolerance)|coral\s+bleaching\s+(?:in\s+)?(?:florida|the\s+florida\s+keys)|(?:coral\s+|reef\s+|florida\s+keys\s+)?heat[\s-]dose(?:\s+(?:ruler|forecast|card))?|(?:coral|reef)\s+heat\s+forecast|(?:the\s+)?(?:coral|reef)\s+(?:heat\s+)?dose\s+forecast)$/;
const TEST_RE = /^(?:(?:tell me about|show(?:\s+me)?|what is|what's)\s+)?(?:how\s+(?:do\s+(?:you|scientists|they)|can\s+(?:you|scientists))\s+(?:test|measure|find)\s+(?:coral|corals)(?:'s)?\s+heat\s+(?:tolerance|resistance)|(?:find|finding|pick|picking)\s+heat[\s-](?:tough|tolerant|resistant)\s+corals?(?:\s+before\s+planting)?|cbass(?:\s+(?:coral|corals|test|rig|assay))?|coral\s+cbass|coral\s+heat[\s-](?:test|tests|testing|assay|ed50)|coral\s+heat\s+tolerance\s+(?:test|tests|testing|assay)|coral\s+ed50|test(?:ing)?\s+coral\s+(?:for\s+)?heat\s+tolerance)$/;

/** Which card an ask wants: 'accretion', 'heat', 'test' or null. */
export function coralOf(text) {
  const t = CLEAN(text);
  if (TEST_RE.test(t)) return 'test';
  if (ACCRETION_RE.test(t)) return 'accretion';
  if (HEAT_RE.test(t)) return 'heat';
  return null;
}

export function accretionCard() {
  return {
    title: 'Planting coral in the Florida Keys',
    sub: 'Lower Florida Keys · reef-accretion potential',
    lines: [
      ['Offshore, outplanting staghorn coral (Acropora cervicornis) turned the reef’s accretion potential from −0.84 mm a year (wearing away) to +2.80 mm a year (building) within 2 to 6 years, with more than 16 times the gross carbonate production and about 5% more coral cover.', 0],
      ['Inshore, planting massive corals made no measurable difference.', 0],
      ['The measurements are open data (CC0).', 1],
      ['Then the 2023 marine heatwave killed 97.8–100% of the Acropora in the Florida Keys and the Dry Tortugas.', 2],
    ],
    takeaway: 'Planting builds reef fast. Whether it lasts depends on whether the corals survive the heat.',
    soil: 'Companion dataset for the soils side of the same land–sea picture: GSOCS-LULCC.',
    sources: ACCRETION_SOURCES,
  };
}

export function heatCard() {
  return {
    title: 'Can restored coral live through the next heatwave?',
    sub: 'Florida elkhorn and staghorn · loss, rescue, the field test now',
    parts: [
      ['What happened', [
        ['In 2023 the water stayed at or above 31 °C for about 41 days, and 97.8–100% of elkhorn and staghorn in the Florida Keys and Dry Tortugas died.', 0],
        ['Gene banks on land kept both species alive.', 1],
      ]],
      ['What helps', [
        ['Elkhorn hosting Durusdinium symbionts tested 1.9 °C more heat tolerant.', 2],
      ]],
      ['What is being tried now', [
        ['“Flonduran” elkhorns, Florida × Honduras crosses, the first permitted cross-border coral outplant, have been on a Miami reef since July 2025.', 3],
        ['Since April 2026 they grow side by side with Florida-only siblings at three Dry Tortugas sites.', 4],
        ['Survival results against the Florida-only controls are not published yet; first Dry Tortugas check is due about October 2026.', -1],
      ]],
    ],
    action: { text: 'Report bleaching you see through Mote BleachWatch', href: 'https://mote.org/bleachwatch' },
    sources: HEAT_SOURCES,
  };
}

export function testCard() {
  return {
    title: 'How scientists find heat-tough coral before planting',
    sub: 'The CBASS heat test · what it predicts, and its limit',
    parts: [
      ['How it works', [
        ['A portable rig of four or eight small tanks heats coral fragments on an 18-hour schedule and finds the temperature at which each one loses half its photosynthetic health (its ED50).', 0],
        ['Eight tanks cost under US$4,000, and the build files are open (barshislab/CBASS_Manual on GitHub).', 0],
      ]],
      ['What it gets right', [
        ['Its scores predicted how corals did in an 8-day bleaching run (R = 0.74) and reliably pick out the toughest and weakest corals in a nursery.', 1],
        ['On the Great Barrier Reef its scores predicted which corals survived the 2024 heatwave.', 2],
      ]],
      ['Where it is weaker', [
        ['Across 2,068 colonies in Malaysia, the scores explained only part of which corals survived a severe heat event.', 3],
      ]],
    ],
    takeaway: 'In severe summers, symbiont type and new parentage matter alongside the test score.',
    sources: TEST_SOURCES,
  };
}

function srcRef(s, esc) { const tag = s.preprint ? ', preprint' : ''; return s.href ? '<a href="' + esc(s.href) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a> (' + esc(s.date + tag) + ')' : esc(s.name) + ' (' + esc(s.date + tag) + ')'; }
const SRC_STYLE = 'color:#8a8a92;font-size:12px';

export function accretionHtml(esc) {
  const c = accretionCard();
  return '<h2>' + esc(c.title) + '</h2><div class="sub">' + esc(c.sub) + '</div>'
    + c.lines.map(([line, i]) => '<p>' + esc(line) + ' <span style="' + SRC_STYLE + '">· ' + srcRef(c.sources[i], esc) + '</span></p>').join('')
    + '<p><b>' + esc(c.takeaway) + '</b> <a href="#" data-ask="can coral survive heatwaves">Can restored coral live through the next heatwave?</a></p>'
    + '<p style="' + SRC_STYLE + '">' + esc(c.soil) + '</p>'
    + '<div class="src">Dated sources: ' + c.sources.map((s) => srcRef(s, esc)).join(' · ') + '</div>';
}

// live: lib/reefwatch.js liveLine() from the served reading (the reef watch keeps it daily), or null for the card without it
export function heatHtml(esc, live = null, dose = null) {
  const c = heatCard();
  const L = doseLines(dose);
  return '<h2>' + esc(c.title) + '</h2><div class="sub">' + esc(c.sub) + '</div>'
    + (L.length ? '<div data-coral-dose><h3 style="margin:14px 0 4px;font-size:15px">' + esc(L[0]) + '</h3><p>' + esc(L[1]) + '</p><p>' + esc(L[2]) + '</p><p><b>' + esc(L[3]) + '</b></p><p style="' + SRC_STYLE + '">Water: <a href="https://open-meteo.com/en/docs/marine-weather-api" target="_blank" rel="noopener">Open-Meteo marine forecast</a> at ' + esc(KEYS.name) + '; UV and air: Open-Meteo forecast. NOAA\'s own maths: a HotSpot is water over the summer maximum (MMM), degree heating weeks add HotSpots of 1 °C and more. A projection, not a reading: the station\'s number is the record.</p></div>' : '')
    + (live ? '<div data-coral-live><h3 style="margin:14px 0 4px;font-size:15px">Right now</h3><p>' + esc(live.text) + ' <span style="' + SRC_STYLE + '">· <a href="' + esc(live.href) + '" target="_blank" rel="noopener">the station</a></span></p><p style="' + SRC_STYLE + '">' + esc(live.note) + '</p></div>' : '')
    + c.parts.map(([head, lines]) => '<h3 style="margin:14px 0 4px;font-size:15px">' + esc(head) + '</h3>'
      + lines.map(([line, i]) => '<p>' + (i < 0 ? '<b>' + esc(line) + '</b>' : esc(line) + ' <span style="' + SRC_STYLE + '">· ' + srcRef(c.sources[i], esc) + '</span>') + '</p>').join('')).join('')
    + '<p>One thing you can do: <a href="' + esc(c.action.href) + '" target="_blank" rel="noopener">' + esc(c.action.text) + '</a>.</p>'
    + '<p style="' + SRC_STYLE + '">How restoration picks heat-tough corals first: <a href="#" data-ask="how do you test coral heat tolerance">the coral heat test</a>.</p>'
    + '<p style="' + SRC_STYLE + '">How the reef was built back first: <a href="#" data-ask="coral restoration florida keys">planting coral in the Florida Keys</a>.</p>'
    + '<div class="src">Dated sources: ' + c.sources.map((s) => srcRef(s, esc)).join(' · ') + '</div>';
}

export function testHtml(esc) {
  const c = testCard();
  return '<h2>' + esc(c.title) + '</h2><div class="sub">' + esc(c.sub) + '</div>'
    + c.parts.map(([head, lines]) => '<h3 style="margin:14px 0 4px;font-size:15px">' + esc(head) + '</h3>'
      + lines.map(([line, i]) => '<p>' + esc(line) + ' <span style="' + SRC_STYLE + '">· ' + srcRef(c.sources[i], esc) + '</span></p>').join('')).join('')
    + '<p><b>' + esc(c.takeaway) + '</b></p>'
    + '<p style="' + SRC_STYLE + '">Rig plans: <a href="https://github.com/barshislab/CBASS_Manual" target="_blank" rel="noopener">CBASS manual</a>. What happens to planted coral in a heatwave: <a href="#" data-ask="can coral survive heatwaves">can restored coral live through the next heatwave?</a></p>'
    + '<div class="src">Dated sources: ' + c.sources.map((s) => srcRef(s, esc)).join(' · ') + '</div>';
}

async function run(text, api) {
  const which = coralOf(text);
  if (!which) return 'none';
  const { showPage, esc } = api;
  const el = showPage((p) => { p.innerHTML = which === 'heat' ? heatHtml(esc) : which === 'test' ? testHtml(esc) : accretionHtml(esc); });
  if (which === 'heat') { // the live level from the reef watch's served reading, and the 48-hour dose coming; the card stands without either
    const get = (u) => fetch(u).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    Promise.all([get('/reefwatch.json'), get(MARINE_URL), get(WX_URL)]).then(([snap, marine, wx]) => {
      const live = liveLine(snap), dose = doseForecast(marine, wx);
      if ((live || dose) && el && el.isConnected) el.innerHTML = heatHtml(esc, live, dose); // void-review: ok: heatHtml escapes every value
    });
  }
  return 'coral';
}

export default {
  name: 'coral',
  examples: ['coral restoration florida keys', 'reef accretion potential', 'does planting coral work', 'can coral survive heatwaves', 'flonduran coral', 'heat tolerant coral', 'coral heat dose', 'how do you test coral heat tolerance', 'cbass coral', 'find heat tough coral'],
  nearMisses: ['what is coral', 'coral color', 'coral springs florida', 'define coral', 'great barrier reef', 'coral reef fish'],
  coralOf,
  accretionCard,
  heatCard,
  testCard,
  match(lower, text) { return !!coralOf(text); },
  run,
};
