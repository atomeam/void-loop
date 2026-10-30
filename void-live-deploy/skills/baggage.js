/**
 * baggage skill - made with tools/new-skill.mjs (docs/UPGRADING.md); 2026-10-30: "how much luggage weight allowed" was a benchmark ask that fell to
 * the article answer, which only said "check your carrier". This card gives the usual bag limits from two airlines' own pages.
 * They were read on 2026-10-30, and the card says plainly that the ticket decides. Nothing is fetched and nothing is kept. Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
const BAG = /\b(?:luggage|baggage|suitcases?|checked bags?|check(?:ed)?[- ]in bags?|carry[- ]?ons?|hand luggage|cabin bags?|personal items?)\b/;
const ASKS = /\b(?:weigh|weight|heavy|heavier|limits?|allowances?|allowed|allow|max(?:imum)?|size|sizes|big|dimensions?|how much|how many kg|kg|lbs?|pounds)\b/;
// read on 2026-10-30 from aa.com (checked bag policy, bag limitations, carry-on bags) and britishairways.com (baggage essentials)
const ROWS = [
  ['Checked bag, economy', '23 kg (50 lb) a bag', 'American and British Airways'],
  ['Checked bag, business or first', '32 kg (70 lb) a bag', 'American and British Airways'],
  ['Heaviest bag you can bring', '32 kg (70 lb)', 'American: 51 to 70 lb costs extra in economy'],
  ['Checked bag size', '158 cm (62 in), length + width + height', 'American'],
  ['Carry-on size', '56 x 36 x 23 cm (22 x 14 x 9 in)', 'American; British Airways allows 56 x 45 x 25 cm'],
  ['Personal item size', '45 x 35 x 20 cm (18 x 14 x 8 in)', 'American'],
];
const SOURCES = [['American: checked bags', 'https://www.aa.com/web/i18n/travel-info/baggage/checked-baggage-policy.html'], ['American: carry-on bags', 'https://www.aa.com/web/i18n/travel-info/baggage/carry-on-baggage.html'], ['British Airways: baggage', 'https://www.britishairways.com/content/information/baggage-essentials']];

function run(text, api) {
  const { showPage, esc } = api;
  showPage((el) => {
    el.innerHTML = '<h2>Baggage limits</h2>'
      + '<p>Airlines such as American and British Airways allow <b>23 kg (50 lb)</b> a checked bag in economy and <b>32 kg (70 lb)</b> in business or first. Your fare decides how many bags are included, so check it before you pack.</p>' // void-review: ok: fixed text
      + '<table style="border-collapse:collapse;width:100%;font-size:.92em">' + ROWS.map(([a, b, c]) => '<tr><td style="padding:3px 6px 3px 0;vertical-align:top">' + esc(a) + '</td><td style="padding:3px 6px;font-weight:600;vertical-align:top">' + esc(b) + '</td><td style="padding:3px 0;color:#8a8a8a;vertical-align:top">' + esc(c) + '</td></tr>').join('') + '</table>' // void-review: ok: fixed rows, escaped
      + '<p>Neither airline gives a carry-on weight on these pages: they set a size. Check your own airline before you fly.</p>' // void-review: ok: fixed text
      + '<p><a href="/flights/" style="font-weight:600">Find your flight on the flights page →</a></p>'
      + '<div class="src">Source: ' + SOURCES.map(([n, u]) => '<a href="' + esc(u) + '" target="_blank" rel="noopener">' + esc(n) + '</a>').join(' · ') + ' · read 2026-10-30</div>';
  });
  return 'baggage';
}

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
  match(lower) { const t = String(lower || '').trim(); return BAG.test(t) && ASKS.test(t) && !/\b(?:lost|missing|delayed|damaged|track|pack|packing|list)\b/.test(t); },
  run,
};
