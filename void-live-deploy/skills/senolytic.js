/**
 * senolytic skill — an honest card on the phase-2 senolytic trial in fibrotic MASH (fatty liver disease with scarring)
 * (domains/void.growth.md, Next [think-tank]). Intermittent dasatinib + quercetin: fibrosis improved in 47% vs 7% on
 * placebo, MASH resolved in 53% vs 7%. The authors' own caveat is shown with it: the results generate a hypothesis,
 * they do not prove a treatment. Neighbouring results are linked as context, not as the same claim. No cure claim.
 * "senolytics for fatty liver", "dasatinib quercetin mash trial".
 */
export const SOURCES = [
  { date: '2026-10-01', name: 'Nature Metabolism (the trial report)', href: null },
  { date: 'registered', name: 'ClinicalTrials.gov NCT05506488', href: 'https://clinicaltrials.gov/study/NCT05506488' },
  { date: '2025-04-04', name: 'Aging (PEARL rapamycin safety)', href: null },
  { date: '2026-05-19', name: 'Nature Communications (semaglutide and epigenetic aging)', href: null },
];

const CLEAN = (s) => String(s || '').trim().toLowerCase().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
const ASK_RE = /^(?:(?:tell me about|show(?:\s+me)?|what is|what's|what about)\s+(?:the\s+)?)?(?:senolytics?|senolytic\s+(?:drugs?|therapy|treatment)|dasatinib\s+(?:and|\+|&)?\s*quercetin|d\s*\+\s*q)\s+(?:for|in|and)\s+(?:fatty\s+liver(?:\s+disease)?|mash|nash|masld|liver\s+fibrosis|the\s+liver)(?:\s+trial)?$|^(?:the\s+)?(?:senolytic\s+(?:liver|mash|nash)\s+trial|dasatinib\s+(?:and\s+|\+\s*)?quercetin\s+(?:mash|nash|liver)\s+trial|mash\s+senolytic\s+trial)$/;

export function senolyticOf(text) { return ASK_RE.test(CLEAN(text)); }

export function senolyticCard() {
  return {
    title: 'A senolytic trial in fatty liver disease',
    sub: 'phase 2 · intermittent dasatinib + quercetin · fibrotic MASH',
    lines: [
      ['Fibrosis improved (the main endpoint) in 47% on the drugs vs 7% on placebo.', 0],
      ['MASH resolved in 53% vs 7%.', 0],
      ['The trial is registered as NCT05506488.', 1],
    ],
    caveat: 'The authors call these results hypothesis-generating: a signal worth testing, not a proven treatment. It needs confirming before anyone can call it one.',
    context: [
      ['Rapamycin in healthy older adults (PEARL) reported on safety, not on liver disease.', 2],
      ['Semaglutide was linked to slower epigenetic aging in a separate study.', 3],
    ],
    sources: SOURCES,
  };
}

function srcRef(s, esc) { return s.href ? '<a href="' + esc(s.href) + '" target="_blank" rel="noopener">' + esc(s.name) + '</a> (' + esc(s.date) + ')' : esc(s.name) + ' (' + esc(s.date) + ')'; }
const SRC_STYLE = 'color:#8a8a92;font-size:12px';

export function senolyticHtml(esc) {
  const c = senolyticCard();
  return '<h2>' + esc(c.title) + '</h2><div class="sub">' + esc(c.sub) + '</div>'
    + c.lines.map(([line, i]) => '<p>' + esc(line) + ' <span style="' + SRC_STYLE + '">· ' + srcRef(c.sources[i], esc) + '</span></p>').join('')
    + '<p><b>' + esc(c.caveat) + '</b></p>'
    + '<h3 style="margin:14px 0 4px;font-size:15px">Nearby, and not the same claim</h3>'
    + c.context.map(([line, i]) => '<p>' + esc(line) + ' <span style="' + SRC_STYLE + '">· ' + srcRef(c.sources[i], esc) + '</span></p>').join('')
    + '<div class="src">Dated sources: ' + c.sources.map((s) => srcRef(s, esc)).join(' · ') + '. Not medical advice; no cure is claimed.</div>';
}

async function run(text, api) {
  if (!senolyticOf(text)) return 'none';
  const { showPage, esc } = api;
  showPage((p) => { p.innerHTML = senolyticHtml(esc); });
  return 'senolytic';
}

export default {
  name: 'senolytic',
  examples: ['senolytics for fatty liver', 'dasatinib quercetin mash trial', 'senolytic liver trial', 'dasatinib and quercetin for mash', 'senolytics in nash'],
  nearMisses: ['what is fatty liver', 'quercetin foods', 'dasatinib side effects', 'what is a senolytic', 'liver trial'],
  senolyticOf,
  senolyticCard,
  match(lower, text) { return senolyticOf(text); },
  run,
};
