/**
 * coral skill — two honest cards on Florida coral restoration (domains/void.growth.md, Next [think-tank]).
 * The reef-accretion card: planting staghorn offshore flipped the reef from shrinking to growing within a few years,
 * then the 2023 heatwave killed nearly all of it, so planting builds reef fast and heat tolerance decides whether it
 * lasts. The heat-survival card: what happened, what helps, what is being tried now, and one thing a visitor can do.
 * Every line carries its source and date; nothing beyond what the sources say; no planet-saving promise.
 * "coral restoration florida keys", "reef accretion potential", "can coral survive heatwaves", "flonduran coral".
 */
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

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ACCRETION_RE = /^(?:(?:tell me about|show(?:\s+me)?|what is|what's)\s+)?(?:coral\s+restoration(?:\s+(?:in\s+)?(?:the\s+)?(?:florida\s+keys|florida|keys))?|(?:the\s+)?florida\s+keys\s+(?:coral\s+)?(?:reef|reefs|coral)(?:\s+restoration)?|reef[\s-]accretion(?:\s+potential)?|does\s+(?:coral\s+)?(?:planting|restoration)\s+(?:coral\s+)?work|does\s+planting\s+coral\s+work)$/;
const HEAT_RE = /^(?:(?:tell me about|show(?:\s+me)?|what is|what's|what are)\s+)?(?:can\s+(?:coral|corals|coral\s+reefs|reefs)\s+survive\s+(?:a\s+)?(?:heatwaves?|heat\s+waves?|marine\s+heatwaves?|the\s+next\s+heatwave)|flonduran\s+corals?|heat[\s-]tolerant\s+corals?|coral\s+heat\s+(?:survival|tolerance)|coral\s+bleaching\s+(?:in\s+)?(?:florida|the\s+florida\s+keys))$/;

/** Which card an ask wants: 'accretion', 'heat' or null. */
export function coralOf(text) {
  const t = CLEAN(text);
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

function srcRef(s, esc) { return s.href ? '<a href="' + esc(s.href) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a> (' + esc(s.date) + ')' : esc(s.name) + ' (' + esc(s.date) + ')'; }
const SRC_STYLE = 'color:#8a8a92;font-size:12px';

export function accretionHtml(esc) {
  const c = accretionCard();
  return '<h2>' + esc(c.title) + '</h2><div class="sub">' + esc(c.sub) + '</div>'
    + c.lines.map(([line, i]) => '<p>' + esc(line) + ' <span style="' + SRC_STYLE + '">· ' + srcRef(c.sources[i], esc) + '</span></p>').join('')
    + '<p><b>' + esc(c.takeaway) + '</b> <a href="#" data-ask="can coral survive heatwaves">Can restored coral live through the next heatwave?</a></p>'
    + '<p style="' + SRC_STYLE + '">' + esc(c.soil) + '</p>'
    + '<div class="src">Dated sources: ' + c.sources.map((s) => srcRef(s, esc)).join(' · ') + '</div>';
}

export function heatHtml(esc) {
  const c = heatCard();
  return '<h2>' + esc(c.title) + '</h2><div class="sub">' + esc(c.sub) + '</div>'
    + c.parts.map(([head, lines]) => '<h3 style="margin:14px 0 4px;font-size:15px">' + esc(head) + '</h3>'
      + lines.map(([line, i]) => '<p>' + (i < 0 ? '<b>' + esc(line) + '</b>' : esc(line) + ' <span style="' + SRC_STYLE + '">· ' + srcRef(c.sources[i], esc) + '</span>') + '</p>').join('')).join('')
    + '<p>One thing you can do: <a href="' + esc(c.action.href) + '" target="_blank" rel="noopener">' + esc(c.action.text) + '</a>.</p>'
    + '<p style="' + SRC_STYLE + '">How the reef was built back first: <a href="#" data-ask="coral restoration florida keys">planting coral in the Florida Keys</a>.</p>'
    + '<div class="src">Dated sources: ' + c.sources.map((s) => srcRef(s, esc)).join(' · ') + '</div>';
}

async function run(text, api) {
  const which = coralOf(text);
  if (!which) return 'none';
  const { showPage, esc } = api;
  showPage((p) => { p.innerHTML = which === 'heat' ? heatHtml(esc) : accretionHtml(esc); });
  return 'coral';
}

export default {
  name: 'coral',
  examples: ['coral restoration florida keys', 'reef accretion potential', 'does planting coral work', 'can coral survive heatwaves', 'flonduran coral', 'heat tolerant coral'],
  nearMisses: ['what is coral', 'coral color', 'coral springs florida', 'define coral', 'great barrier reef', 'coral reef fish'],
  coralOf,
  accretionCard,
  heatCard,
  match(lower, text) { return !!coralOf(text); },
  run,
};
