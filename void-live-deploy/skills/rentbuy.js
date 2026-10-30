/**
 * rentbuy - the year buying a home gets ahead of renting, worked out on your own numbers (made with tools/new-skill.mjs, docs/UPGRADING.md). 2026-10-30: "should i rent or buy" got a written
 * answer that ended on an opinion with no source. This card works rent or buy out month by month on the visitor's own numbers: the year
 * buying gets ahead, and each side's wealth year by year. Numbers the ask gives ("$350k house", "rent is $1800", "at 6%", "staying 7 years")
 * are used; the rest are example values, marked as examples (lib/rentbuy.js). It opens the rent-vs-buy calculator of /calculators/ with
 * every number, so the visitor changes any of them. No opinion, no advice. Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 */
import { rentVsBuy } from '../lib/rentbuy.js';

const ASK = /\b(?:rent(?:ing)?\s+(?:or|vs\.?|versus)\s+(?:to\s+)?buy(?:ing)?|buy(?:ing)?\s+(?:or|vs\.?|versus)\s+(?:to\s+)?rent(?:ing)?)\b/;
// rent or buy what: a home is the question this card answers; a car, a dress or skis are not
const NOT_HOME = /\b(?:cars?|vehicles?|trucks?|vans?|bikes?|boats?|rvs?|textbooks?|books?|movies?|films?|games?|dvds?|skis?|snowboards?|tux(?:edo)?s?|suits?|dress(?:es)?|gowns?|cameras?|lens(?:es)?|equipment|gear|tools?|instruments?|pianos?|violins?|furniture|kayaks?|costumes?|software|servers?|gpus?|scaffolding|forklifts?|tents?)\b/;

function money(n, k) { const v = Number(String(n).replace(/,/g, '')); return Number.isFinite(v) ? v * (/^k$/i.test(k || '') ? 1e3 : /^m$/i.test(k || '') ? 1e6 : 1) : NaN; }
/** the numbers an ask gives: { price, rent, ratePct, years } (each only when given). Pure. */
export function rentBuyNumbers(text) {
  const t = String(text || '').toLowerCase().replace(/\s+/g, ' '), got = {};
  let m = t.match(/\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\s+(?:house|home|condo|townhouse|townhome|place|apartment|flat|property)\b/)
    || t.match(/\b(?:house|home|condo|place|apartment|flat|property|price)\s+(?:is\s+|of\s+|for\s+|costs?\s+|at\s+|worth\s+)*\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\b/)
    || t.match(/\bbuy(?:ing)?\s+(?:a|an|for)\s+\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|m)?\b/);
  if (m) { const v = money(m[1], m[2]); if (v >= 10000 && v <= 1e8) got.price = v; }
  m = t.match(/\brent(?:\s+is|\s+of|\s+at)?\s+\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\b/)
    || t.match(/\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:a|per|\/)\s*(?:month|mo)\s+(?:in\s+|for\s+)?rent/)
    || t.match(/\bpay(?:ing)?\s+\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k)?\s*(?:(?:a|per|\/)\s*(?:month|mo)\s+)?(?:in\s+|for\s+)?rent/);
  if (m) { const v = money(m[1], m[2]); if (v >= 100 && v <= 100000) got.rent = v; }
  m = t.match(/(\d{1,2}(?:\.\d+)?)\s*%/);
  if (m && +m[1] > 0 && +m[1] < 30) got.ratePct = +m[1];
  m = t.match(/\b(?:stay(?:ing)?|live\s+there|living\s+there|for|plan\s+to\s+stay)\s+(?:for\s+)?(\d{1,2})\s*(?:years?|yrs?)\b/);
  if (m && +m[1] >= 1 && +m[1] <= 50) got.years = +m[1];
  return got;
}
export function isRentBuy(lower) { const t = String(lower || ''); return ASK.test(t) && !NOT_HOME.test(t); }

const usd = (v) => '$' + Math.round(v).toLocaleString('en-US');

function run(text, api) {
  const { showPage, esc } = api, given = rentBuyNumbers(text), q = { ...given }, o = rentVsBuy(q);
  if (!o) return 'none';
  const I = o.inputs, Y = I.years;
  const href = '/calculators/?calc=rent-vs-buy&price=' + I.price + '&down=' + I.downPct + '&rate=' + I.ratePct + '&term=' + I.termYears + '&rent=' + I.rent
    + '&rg=' + I.rentGrowthPct + '&hg=' + I.homeGrowthPct + '&own=' + I.ownPct + '&buyc=' + I.buyPct + '&sellc=' + I.sellPct + '&inv=' + I.investPct + '&stay=' + Y;
  const yours = (k) => (k in given ? '' : ' <span style="color:#8a8a8a">(example)</span>');
  const head = o.breakEven
    ? 'Buying gets ahead after ' + o.breakEven + (o.breakEven === 1 ? ' year' : ' years')
    : 'Renting stays ahead for all ' + Y + (Y === 1 ? ' year' : ' years');
  const after = o.breakEven && o.aheadAtEnd === 'rent' ? ' Renting is ahead again by year ' + Y + '.' : '';
  const show = o.years.filter((y) => [1, 3, 5, 10, 15, 20, 25, 30, 40, 50].includes(y.year) || y.year === Y || y.year === o.breakEven);
  showPage((el) => {
    el.dataset.page = href; // the card's full-page link opens the calculator on these numbers
    el.innerHTML = '<h2>Rent or buy</h2>'
      + '<div class="sub">' + esc(usd(I.price)) + ' home or ' + esc(usd(I.rent)) + ' a month in rent, worked out month by month</div>'
      + '<div style="font-size:26px;font-weight:300;line-height:1.25;margin:6px 0 4px">' + esc(head) + '</div>'
      + '<p>With these numbers, buying costs ' + esc(usd(o.buyFirst)) + ' the first month (' + esc(usd(o.pay)) + ' mortgage and ' + esc(usd(o.ownFirst)) + ' tax, insurance and upkeep). Renting costs ' + esc(usd(o.rentFirst)) + '.' + esc(after) + '</p>'
      + '<table style="border-collapse:collapse;width:100%;font-size:.92em"><tr><th style="text-align:left;padding:3px 6px 3px 0">After</th><th style="text-align:right;padding:3px 6px">Buyer’s wealth</th><th style="text-align:right;padding:3px 0">Renter’s wealth</th></tr>'
      + show.map((y) => '<tr><td style="padding:3px 6px 3px 0">' + esc(y.year + (y.year === 1 ? ' year' : ' years')) + '</td><td style="padding:3px 6px;text-align:right;' + (y.buy >= y.rent ? 'font-weight:600' : '') + '">' + esc(usd(y.buy)) + '</td><td style="padding:3px 0;text-align:right;' + (y.rent > y.buy ? 'font-weight:600' : '') + '">' + esc(usd(y.rent)) + '</td></tr>').join('')
      + '</table>'
      + '<ul style="font-size:.92em">'
      + '<li>Home price ' + esc(usd(I.price)) + yours('price') + ', ' + esc(String(I.downPct)) + '% down, ' + esc(String(I.ratePct)) + '% for ' + esc(String(I.termYears)) + ' years' + yours('ratePct') + '</li>'
      + '<li>Rent ' + esc(usd(I.rent)) + ' a month' + yours('rent') + ', rising ' + esc(String(I.rentGrowthPct)) + '% a year</li>'
      + '<li>Home value rises ' + esc(String(I.homeGrowthPct)) + '% a year; tax, insurance and upkeep ' + esc(String(I.ownPct)) + '% of it a year; buying costs ' + esc(String(I.buyPct)) + '%, selling costs ' + esc(String(I.sellPct)) + '%</li>'
      + '<li>Money not spent on the home earns ' + esc(String(I.investPct)) + '% a year; you stay ' + esc(String(Y)) + ' years' + yours('years') + '</li>'
      + '</ul>'
      + '<p style="color:#8a8a8a">The values marked (example) are not today’s market: put in your own. Income tax is left out.</p>'
      + '<p><a href="' + esc(href) + '" style="font-weight:600">Change any number in the rent-or-buy calculator →</a></p>'
      + '<div class="src">Each month the renter invests the down payment, the buying costs and whatever buying costs more than rent; the buyer invests whatever rent costs more. Buyer’s wealth = home value less selling costs, less the loan still owed, plus investments · same sum as the rent-or-buy calculator of /calculators/</div>'; // void-review: ok: every value goes through esc()
  });
  return 'rentbuy';
}

export default {
  name: 'rentbuy',
  examples: [
    'should i rent or buy',
    'is it better to rent or buy a house',
    'rent vs buy',
    'should i rent or buy a $350k house if my rent is $1800',
    'buying vs renting a home at 6%',
    'rent or buy if i am staying 5 years',
  ],
  nearMisses: [
    'rent or buy a car',
    'should i buy bitcoin',
    'should i rent or buy skis',
    'how much is rent in boston',
    'what is a mortgage',
  ],
  match(lower) { return isRentBuy(lower); },
  run
};
