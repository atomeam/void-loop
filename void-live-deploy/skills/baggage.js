/**
 * baggage skill - made with tools/new-skill.mjs (docs/UPGRADING.md); 2026-10-30: "how much luggage weight allowed" was a benchmark ask that fell to
 * the article answer, which only said "check your carrier". This card gives the usual bag limits from two airlines' own pages.
 * They were read on 2026-10-30, and the card says plainly that the ticket decides. Nothing is fetched and nothing is kept. Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const BAG = /\b(?:luggage|baggage|suitcases?|checked bags?|check(?:ed)?[- ]in bags?|carry[- ]?ons?|hand luggage|cabin bags?|personal items?)\b/;
const ASKS = /\b(?:weigh|weight|heavy|heavier|limits?|allowances?|allowed|allow|max(?:imum)?|size|sizes|big|dimensions?|how much|how many kg|kg|lbs?|pounds)\b/;
// read on 2026-10-30 from aa.com (checked bag policy, oversize and overweight bags, carry-on bags) and britishairways.com (baggage essentials);
// tools/baggage-live.mjs reads the same pages once a day and checks that each figure below is still on them (findings/baggage/)
export const ROWS = [
  ['Checked bag, economy', '23 kg (50 lb) a bag', 'American and British Airways'],
  ['Checked bag, business or first', '32 kg (70 lb) a bag', 'American and British Airways'],
  ['Heaviest bag American takes', '45 kg (100 lb)', 'over 23 kg (50 lb) costs extra, and more over 32 kg (70 lb)'],
  ['Checked bag size', '158 cm (62 in), length + width + height', 'American'],
  ['Carry-on size', '56 x 36 x 23 cm (22 x 14 x 9 in)', 'American; British Airways allows 56 x 45 x 25 cm'],
  ['Personal item size', '45 x 35 x 20 cm (18 x 14 x 8 in)', 'American'],
];
export const SOURCES = [['American: checked bags', 'https://www.aa.com/web/i18n/travel-info/baggage/checked-baggage-policy.html'], ['American: heavy bags', 'https://www.aa.com/web/i18n/travel-info/baggage/oversize-and-overweight-baggage.html'], ['American: carry-on bags', 'https://www.aa.com/web/i18n/travel-info/baggage/carry-on-baggage.html'], ['British Airways: baggage', 'https://www.britishairways.com/content/information/baggage-essentials']];

/** the card's markup: the usual limits, every row of ROWS, the carry-on note, the flights link and every source with the day it was read (pure) */
export function cardHtml(esc) {
  return '<h2>Baggage limits</h2>'
      + '<p>Airlines such as American and British Airways allow <b>23 kg (50 lb)</b> a checked bag in economy and <b>32 kg (70 lb)</b> in business or first. Your fare decides how many bags are included, so check it before you pack.</p>' // void-review: ok: fixed text
      + '<table style="border-collapse:collapse;width:100%;font-size:.92em">' + ROWS.map(([a, b, c]) => '<tr><td style="padding:3px 6px 3px 0;vertical-align:top">' + esc(a) + '</td><td style="padding:3px 6px;font-weight:600;vertical-align:top">' + esc(b) + '</td><td style="padding:3px 0;color:#8a8a8a;vertical-align:top">' + esc(c) + '</td></tr>').join('') + '</table>' // void-review: ok: fixed rows, escaped
      + '<p>Neither airline gives a carry-on weight on these pages: they set a size. Check your own airline before you fly.</p>' // void-review: ok: fixed text
      + '<p><a href="/flights/" style="font-weight:600">Find your flight on the flights page →</a></p>'
      + '<div class="src">Source: ' + SOURCES.map(([n, u]) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(n) + '</a>').join(' · ') + ' · read 2026-10-30</div>';
}

function run(text, api) {
  const { showPage, esc } = api;
  showPage((el) => { el.innerHTML = cardHtml(esc); }); // void-review: ok: fixed rows and sources, each escaped
  return 'baggage';
}

// the daily smoke test runs this (tools/skills-check.mjs; asked by Verse, 2026-10-31: "Address the least-checked skills: video-gen and baggage"):
// the card itself, not only which asks reach it. Every row and every source is on the card, every source is the airline's own https page,
// the figures agree with each other (23 kg is 50 lb, 32 kg is 70 lb, 45 kg is 100 lb, 158 cm is 62 in), and lost or packing asks stay off (pure)
export function suite() {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const h = cardHtml(esc), kgLb = (kg, lb) => Math.abs(kg * 2.20462 - lb) / lb < 0.02;
  const pairs = ROWS.flatMap(([, b]) => [...b.matchAll(/(\d+) kg \((\d+) lb\)/g)].map((m) => [+m[1], +m[2]]));
  const checks = [
    ['rows', ROWS.every(([a, b, c]) => h.includes(esc(a)) && h.includes(esc(b)) && h.includes(esc(c)))],
    ['sources', SOURCES.length === 4 && SOURCES.every(([n, u]) => /^https:\/\/www\.(?:aa|britishairways)\.com\//.test(u) && h.includes('href="' + esc(u) + '"') && h.includes(esc(n)))],
    ['figures', pairs.length === 3 && pairs.every(([kg, lb]) => kgLb(kg, lb)) && Math.abs(158 / 2.54 - 62) < 0.5],
    ['fare', /Your fare decides/.test(h) && /read 2026-10-30/.test(h)],
    ['asks', ['checked bag weight limit', 'carry on size limit'].every((a) => MATCH(a)) && !['my luggage is lost', 'pack my bag for a beach trip', 'what is 23 kg in pounds'].some((a) => MATCH(a))],
  ];
  const bad = checks.filter(([, ok]) => !ok).map(([n]) => n);
  return { ok: !bad.length, got: bad.join(', ') };
}
const MATCH = (lower) => { const t = String(lower || '').trim(); return BAG.test(t) && ASKS.test(t) && !/\b(?:lost|missing|delayed|damaged|track|pack|packing|list)\b/.test(t); };

export default {
  name: 'baggage',
  examples: [
    'how much luggage weight allowed',
    'checked bag weight limit',
    'how heavy can my suitcase be',
    'carry on size limit',
    'what is the baggage allowance',
  ],
  nearMisses: [
    'how much does my dog weigh',
    'what is 23 kg in pounds',
    'pack my bag for a beach trip',
    'my luggage is lost',
  ],
  suite,
  match: MATCH,
  run,
};
