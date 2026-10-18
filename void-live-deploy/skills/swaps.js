/**
 * swaps skill - kitchen substitutions: "substitute for buttermilk", "what can i use instead of eggs", "baking powder
 * substitute", "out of brown sugar", "how to make self rising flour", "can i use yogurt instead of sour cream".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * A built-in table of the usual kitchen equivalents, so the answer is instant. An ingredient not in the table ("instead of
 * google", "substitute teacher") is left to the other skills; weights and conversions are calc's, recipes are recipe's.
 * Each swap says what else to adjust (asked by Void, ask-20261015-0250-2: "when a user selects a swap, the stage can suggest
 * relevant adjustments to other ingredients (e.g., adding more liquid if swapping flour)"): IMPACT, one line per swap, from
 * what the swap changes (water, fat, acid, sugar, salt), and the card ends with the cook-flow timer chip (lib/cook-flow.js).
 */
import { cookChip } from '../lib/cook-flow.js';
// each: the ingredient, the words that name it, the amount the swaps replace, the swaps (closest first), a note
export const SWAPS = [
  { name: 'buttermilk', re: 'buttermilk', amount: '1 cup', swaps: ['1 tbsp lemon juice or white vinegar, plus milk to make 1 cup; stand 5–10 minutes', '¾ cup plain yogurt + ¼ cup milk', '1 cup kefir'] },
  { name: 'eggs', re: 'an?\\s+eggs?|eggs?', amount: '1 egg', swaps: ['1 tbsp ground flaxseed + 3 tbsp water; stand 5 minutes', '¼ cup unsweetened applesauce', '¼ cup mashed ripe banana', '3 tbsp aquafaba (the liquid from a can of chickpeas)'], note: 'Works in cakes, muffins, pancakes and cookies; for dishes built on eggs (quiche, custard, meringue) there is no good swap.' },
  { name: 'baking powder', re: 'baking\\s+powder', amount: '1 tsp', swaps: ['¼ tsp baking soda + ½ tsp cream of tartar', '¼ tsp baking soda + ½ cup buttermilk or yogurt (take ½ cup liquid out of the recipe)'] },
  { name: 'baking soda', re: 'baking\\s+soda|bicarb(?:onate)?(?:\\s+of)?(?:\\s+soda)?', amount: '1 tsp', swaps: ['3 tsp baking powder (and leave out any salt the recipe adds)'], note: 'Baking powder is about a third as strong, and the bake comes out a little paler and more cake-like.' },
  { name: 'self-rising flour', re: 'self[\\s-]?ra?ising\\s+flour', amount: '1 cup', swaps: ['1 cup all-purpose flour + 1½ tsp baking powder + ¼ tsp salt'] },
  { name: 'cake flour', re: 'cake\\s+flour', amount: '1 cup', swaps: ['1 cup all-purpose flour, take out 2 tbsp, add 2 tbsp cornstarch; sift together twice'] },
  { name: 'brown sugar', re: '(?:light\\s+|dark\\s+)?brown\\s+sugar', amount: '1 cup', swaps: ['1 cup white sugar + 1 tbsp molasses (2 tbsp for dark brown)', '1 cup coconut sugar', '1 cup white sugar alone (crisper, less caramel)'] },
  { name: 'powdered sugar', re: '(?:powdered|icing|confectioners\'?)\\s+sugar', amount: '1 cup', swaps: ['1 cup granulated sugar + 1 tbsp cornstarch, blended until fine'] },
  { name: 'heavy cream', re: '(?:heavy|double|whipping)\\s+cream|cream', amount: '1 cup', swaps: ['¾ cup milk + ¼ cup melted butter (for cooking and baking; it won\'t whip)', '1 cup full-fat coconut milk', '1 cup evaporated milk'] },
  { name: 'sour cream', re: 'sour\\s+cream', amount: '1 cup', swaps: ['1 cup plain Greek yogurt', '1 cup crème fraîche', '1 cup blended cottage cheese + 1 tbsp lemon juice'] },
  { name: 'butter', re: '(?:unsalted\\s+|salted\\s+)?butter', amount: '1 cup in baking', swaps: ['¾ cup vegetable oil (moister, less rise)', '1 cup coconut oil', '½ cup oil + ½ cup applesauce, for quick breads and muffins'] },
  { name: 'oil', re: '(?:vegetable\\s+|canola\\s+)?oil', amount: '1 cup in baking', swaps: ['1 cup melted butter', '1 cup unsweetened applesauce (for up to half the oil in muffins and quick breads)'] },
  { name: 'milk', re: '(?:whole\\s+)?milk', amount: '1 cup', swaps: ['½ cup evaporated milk + ½ cup water', '1 cup soy, oat or almond milk', '¼ cup milk powder + 1 cup water'] },
  { name: 'cornstarch', re: 'corn\\s*starch|cornflour', amount: '1 tbsp, to thicken', swaps: ['2 tbsp all-purpose flour', '1 tbsp arrowroot or potato starch'] },
  { name: 'lemon juice', re: 'lemon\\s+juice|lemons?', amount: '1 tsp', swaps: ['1 tsp lime juice', '½ tsp white or cider vinegar'] },
  { name: 'cream of tartar', re: 'cream\\s+of\\s+tartar', amount: '½ tsp', swaps: ['1 tsp lemon juice or white vinegar'] },
  { name: 'honey', re: 'honey', amount: '1 cup', swaps: ['1 cup maple syrup', '1¼ cups sugar + ¼ cup water (or the recipe\'s liquid)'] },
  { name: 'maple syrup', re: 'maple\\s+syrup', amount: '1 cup', swaps: ['1 cup honey (stronger, browns faster)', '1 cup brown sugar + ¼ cup water'] },
  { name: 'molasses', re: 'molasses|treacle', amount: '1 cup', swaps: ['1 cup dark corn syrup, honey or maple syrup (lighter flavour)'] },
  { name: 'vanilla extract', re: 'vanilla(?:\\s+extract|\\s+essence)?', amount: '1 tsp', swaps: ['1 tsp maple syrup', '1 tsp bourbon, brandy or dark rum', 'seeds of ½ vanilla bean'] },
  { name: 'fresh herbs', re: 'fresh\\s+herbs', amount: '1 tbsp fresh', swaps: ['1 tsp of the same herb, dried'] },
  { name: 'garlic', re: '(?:a\\s+)?(?:fresh\\s+)?garlic(?:\\s+cloves?)?|(?:a\\s+)?cloves?\\s+of\\s+garlic', amount: '1 clove', swaps: ['⅛ tsp garlic powder', '½ tsp jarred minced garlic'] },
  { name: 'onion', re: '(?:an?\\s+)?onions?', amount: '1 medium onion', swaps: ['1 tbsp onion powder', '¼ cup dried minced onion', '2–3 shallots or 1 leek'] },
  { name: 'breadcrumbs', re: 'bread\\s*crumbs|panko', amount: '1 cup', swaps: ['1 cup crushed crackers', '1 cup rolled oats', '¾ cup crushed cornflakes'] },
  { name: 'mayonnaise', re: 'mayo(?:nnaise)?', amount: '1 cup', swaps: ['1 cup plain Greek yogurt', '1 cup sour cream', '1 cup mashed avocado (in sandwiches and dips)'] },
  { name: 'tomato paste', re: 'tomato\\s+(?:paste|puree)', amount: '1 tbsp', swaps: ['3 tbsp tomato sauce, simmered down by two thirds', '1 tbsp ketchup (sweeter)'] },
  { name: 'wine', re: '(?:red\\s+|white\\s+|cooking\\s+)?wine', amount: '1 cup in cooking', swaps: ['1 cup broth + 1 tbsp vinegar (red wine vinegar for red, white wine or cider vinegar for white)', '1 cup grape juice + 1 tbsp vinegar'] },
  { name: 'ricotta', re: 'ricotta(?:\\s+cheese)?', amount: '1 cup', swaps: ['1 cup cottage cheese, blended smooth', '1 cup mascarpone (richer)'] }
];
// What else to adjust for each swap, in SWAPS order (one line per swap, '' when nothing else changes). Pure data: the water, fat,
// acid, sugar and salt a swap brings or takes away decide the line. A swap with no line here still shows; the check in
// tools/swaps.test.mjs keeps the two tables the same shape.
export const IMPACT = {
  buttermilk: ['Keep the baking soda the recipe calls for: the acid in the swap is what it reacts with', 'Thicker than buttermilk, so add 1–2 tbsp milk if the batter looks stiff', ''],
  eggs: ['Denser and less rise: add ¼ tsp extra baking powder per egg replaced', 'Adds moisture and a little sweetness: cut the sugar by 1 tbsp per egg and bake 2–3 minutes longer', 'Adds banana flavour and sugar: cut the sugar by 1 tbsp per egg', 'Whip it first for lift; it brings no fat, so the crumb is lighter and a little drier'],
  'baking powder': ['Use it straight away: the soda starts reacting as soon as it is wet', 'Take ½ cup of the recipe\'s other liquid out, since the buttermilk or yogurt is liquid too'],
  'baking soda': ['Leave out any salt the recipe adds, and expect a paler, more cake-like bake'],
  'self-rising flour': ['Drop any extra baking powder and salt the recipe lists: they are in the mix now'],
  'cake flour': ['Sift twice so the cornstarch spreads; the crumb comes out a touch less tender than real cake flour'],
  'brown sugar': ['', 'Coarser and less sweet: the bake is a little drier, so take it out of the oven 1–2 minutes sooner', 'Drier and crisper, and cookies spread more: add 1–2 tsp liquid, or chill the dough first'],
  'powdered sugar': ['Blend until it is a fine powder, or frosting comes out grainy'],
  'heavy cream': ['Thinner, so a sauce needs a few more minutes of simmering to thicken', 'Tastes of coconut; it whips only when chilled overnight', 'Sweeter and thinner: cut any sugar a little and simmer sauces longer'],
  'sour cream': ['Tangier and leaner: stir it in off the heat, since it splits if boiled', '', 'Leaner: add 1 tsp oil per cup in a bake'],
  butter: ['Oil carries no water, so add 2–3 tbsp milk or water per cup of butter replaced; no creaming means less rise', 'Melt and cool it first; the bake sets firmer and tastes faintly of coconut', 'Moister and denser; cut the sugar by 1 tbsp since applesauce is sweet'],
  oil: ['Butter is about a sixth water, so the bake is a little drier: add 1 tbsp liquid per cup, or use 1¼ cups butter', 'Less fat, so the crumb is denser and it dries out sooner; cut the sugar by 1 tbsp'],
  milk: ['', 'Thinner and leaner: add 1 tsp oil per cup in a bake, and whisk oat milk in slowly', 'Whisk the powder into the dry ingredients first so it does not clump'],
  cornstarch: ['Twice as much, and simmer 2–3 minutes longer to cook out the raw-flour taste; the sauce stays cloudier', 'Add it at the end: arrowroot thins again if boiled long'],
  'lemon juice': ['', 'Half the amount: vinegar is sharper and brings no citrus taste'],
  'cream of tartar': ['Fine in meringue and whipped cream; in snickerdoodles the tang is lost'],
  honey: ['Thinner: cut the recipe\'s other liquid by 2 tbsp per cup', 'Sugar is dry: the ¼ cup water replaces honey\'s own, and the bake browns a little slower'],
  'maple syrup': ['Browns faster: lower the oven 25 °F (15 °C) and check early', 'Brown sugar is dry: the ¼ cup water replaces the syrup\'s own'],
  molasses: ['Less bitter and less acid: if the recipe leans on baking soda for lift, swap ¼ tsp of it for ½ tsp baking powder'],
  'vanilla extract': ['', 'Adds a little alcohol flavour; use it in the same amount', 'Scrape the seeds into the sugar and rub them in so they spread'],
  'fresh herbs': ['Add dried herbs early so they soften; fresh ones would go in at the end'],
  garlic: ['Add the powder with the liquid, not into hot oil, or it burns', 'Already in oil or water: cut the salt a pinch if the jar is salted'],
  onion: ['Fresh onion brings water: add 1–2 tbsp water or stock', 'Soak it 5 minutes first, or it stays crunchy', 'Milder and sweeter; cook a minute less'],
  breadcrumbs: ['Crackers are salted: cut the recipe\'s salt by half', 'Oats soak more liquid: add 1–2 tbsp milk in meatballs or meatloaf', 'Cornflakes are sweeter and crisper; crush them fine'],
  mayonnaise: ['Thinner and tangier: add 1 tsp oil and a pinch of sugar for a dressing', 'Looser: chill it 10 minutes before serving', 'Browns: add a squeeze of lemon and serve the same day'],
  'tomato paste': ['Brings more liquid: cut the recipe\'s other liquid by 2 tbsp per tbsp of paste, or simmer longer', 'Sweeter and tangier: cut any sugar and taste before salting'],
  wine: ['Less acid and no sweetness: taste at the end and add a pinch of sugar if it is flat', 'Sweeter: cut any sugar, and finish with a squeeze of lemon'],
  ricotta: ['Wetter: drain it 10 minutes in a sieve first', 'Richer and softer: use a little less, and it needs no draining']
};
/** what else to adjust for swap `i` of `item` ('' when nothing). Pure. */
export function impactOf(item, i) { const r = IMPACT[item && item.name]; return (r && r[i]) || ''; }

/** the time a swap's "then" line moves the cook by, read off the line itself (no number is made up here): { lo, hi, sign: 1 longer | -1 sooner }, or null.
 *  "bake 2–3 minutes longer" -> 2..3 longer; "take it out 1–2 minutes sooner" -> 1..2 sooner; "cook a minute less" -> 1 sooner. Pure.
 *  Asked by Verse: "Integrate the 'cook-flow' logic into the 'swaps' card to automate time-change calculations during ingredient substitution." */
export function timeShift(line) {
  const t = String(line || '').toLowerCase().replace(/\s+/g, ' ');
  const m = t.match(/\b(?:(\d+)(?:\s?[–-]\s?(\d+))?|a)\s+minutes?\s+(longer|more|sooner|earlier|less)\b/);
  if (!m) return null;
  const lo = m[1] ? +m[1] : 1, hi = m[2] ? +m[2] : lo;
  if (!(lo >= 1) || hi < lo || hi > 60) return null;
  return { lo, hi, sign: /longer|more/.test(m[3]) ? 1 : -1 };
}
/** the recipe's own time (minutes) moved by a swap's shift: { lo, hi } minutes to cook now, or null. Pure. */
export function shiftedTime(minutes, shift) {
  const n = +minutes;
  if (!shift || !(n >= 1) || n > 600) return null;
  const lo = Math.max(1, n + shift.sign * shift.lo), hi = Math.max(1, n + shift.sign * shift.hi);
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
}
/** "+2–3 min" / "−1–2 min" for a shift, or ''. Pure. */
export function shiftWords(shift) {
  return shift ? (shift.sign > 0 ? '+' : '\u2212') + (shift.lo === shift.hi ? shift.lo : shift.lo + '\u2013' + shift.hi) + ' min' : '';
}

const TAIL = /\s+(?:to\s+thicken(?:\s+\w+)?|for\s+thickening|(?:in|for)\s+(?:gravy|soup|stew|a\s+stew|baking|a\s+cake|cakes?|cookies|muffins|brownies|bread|pancakes|a\s+recipe|recipes?|cooking|a\s+sauce))$/;
const of = (s) => {
  s = s.trim().replace(TAIL, '').replace(/^(?:some|the|any)\s+/, '');
  return SWAPS.find((x) => new RegExp('^(?:' + x.re + ')$').test(s)) || null;
};

// "substitute for buttermilk" -> { item: buttermilk, use: '' }; "can i use yogurt instead of sour cream" -> use 'yogurt'
export function swapAsk(text) {
  const t = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ').replace(/’/g, "'");
  if (!t || t.length > 80) return null;
  let m = t.match(/^can\s+(?:i|you|we)\s+(?:use|substitute|swap)\s+(.+?)\s+(?:instead\s+of|for|in\s+place\s+of)\s+(.+)$/);
  if (m) { const item = of(m[2]); return item ? { item, use: m[1].replace(/^(?:an?|some)\s+/, '') } : null; }
  m = t.match(/^(?:(?:what(?:'s|\s+is|\s+are)?|whats)\s+(?:a\s+|an\s+|the\s+|some\s+|good\s+|best\s+)*)?(?:substitutes?|substitutions?|replacements?|alternatives?|swaps?)\s+(?:for|to)\s+(.+)$/)
    || t.match(/^(?:what\s+(?:can|could|should|do)\s+(?:i|you|we)\s+(?:use|substitute|swap|put\s+in)|what\s+to\s+use|what\s+else\s+can\s+i\s+use)\s+(?:instead\s+of|in\s+place\s+of|for|to\s+replace)\s+(.+)$/)
    || t.match(/^(?:how\s+(?:do\s+i|to|can\s+i)\s+)?(?:substitute|replace)\s+(.+)$/)
    || t.match(/^(.+?)\s+(?:substitutes?|substitution|replacements?|alternatives?|swaps?)$/)
    || t.match(/^(?:i(?:'m|\s+am)\s+)?(?:out\s+of|(?:i\s+)?ran\s+out\s+of|(?:i\s+)?have\s+no|no)\s+(.+?)(?:,?\s+what\s+(?:can|do|should)\s+i\s+use(?:\s+instead)?|,?\s+what\s+now)?$/)
    || t.match(/^(?:how\s+(?:do\s+i|to|can\s+i)\s+)?make\s+(?:my\s+own\s+|homemade\s+)?(buttermilk|self[\s-]?ra?ising\s+flour|cake\s+flour|brown\s+sugar|(?:powdered|icing|confectioners'?)\s+sugar)(?:\s+at\s+home)?$/);
  if (!m) return null;
  const item = of(m[1]);
  return item ? { item, use: '' } : null;
}

// the swap a "can i use X instead of Y" names, or -1
export function swapHit(item, use) {
  const w = String(use || '').toLowerCase().replace(/(?:es|s)$/, '');
  return w.length < 3 ? -1 : item.swaps.findIndex((s) => s.toLowerCase().includes(w));
}

function run(text, api) {
  const { showPage, esc } = api, a = swapAsk(text);
  if (!a) return 'none';
  const s = a.item, hit = a.use ? swapHit(s, a.use) : -1;
  const lead = a.use ? (hit >= 0 ? 'Yes: ' + s.swaps[hit] + '.' : 'That isn\'t one of the usual swaps for ' + s.name + '. These are:') : '';
  showPage((el) => {
    el.innerHTML = '<h2>Instead of ' + esc(s.name) + '</h2><div class="sub">for ' + esc(s.amount) + '</div>'
      + (lead ? '<p style="font-size:20px;margin:8px 0">' + esc(lead) + '</p>' : '')
      + '<ol style="padding-left:20px;line-height:1.6">' + s.swaps.map((w, i) => '<li>' + esc(w) + (impactOf(s, i) ? '<div class="swap-then" style="color:#8a8a8a;font-size:14px;line-height:1.4">then: ' + esc(impactOf(s, i)) + (timeShift(impactOf(s, i)) ? ' <b class="swap-time" data-lo="' + timeShift(impactOf(s, i)).lo + '" data-hi="' + timeShift(impactOf(s, i)).hi + '" data-sign="' + timeShift(impactOf(s, i)).sign + '">' + shiftWords(timeShift(impactOf(s, i))) + '</b>' : '') + '</div>' : '') + '</li>').join('') + '</ol>'
      + (s.swaps.some((w, i) => timeShift(impactOf(s, i))) ? '<p class="swap-clock" style="color:#8a8a8a;font-size:14px">The recipe says <input class="swap-mins" type="number" min="1" max="600" inputmode="numeric" placeholder="30" aria-label="the recipe\'s time in minutes" style="width:4em;font:inherit;background:transparent;color:inherit;border:1px solid #444;border-radius:4px;padding:2px 4px"> minutes: the swaps that change the time say the new one.</p>' : '')
      + (s.note ? '<p style="color:#8a8a8a">' + esc(s.note) + '</p>' : '')
      + '<div class="src">The usual kitchen equivalents. Any swap changes the taste or texture a little; the first one listed is the closest.</div>'
      + cookChip('substitute for ' + s.name, esc);
    const inp = el.querySelector && el.querySelector('.swap-mins');
    if (inp) inp.addEventListener('input', () => el.querySelectorAll('.swap-time').forEach((b) => {
      const t = shiftedTime(inp.value, { lo: +b.dataset.lo, hi: +b.dataset.hi, sign: +b.dataset.sign });
      b.textContent = (t ? (t.lo === t.hi ? t.lo : t.lo + '\u2013' + t.hi) + ' min now' : shiftWords({ lo: +b.dataset.lo, hi: +b.dataset.hi, sign: +b.dataset.sign }));
    }));
  });
  return 'swaps';
}

export default {
  name: 'swaps',
  meta: { version: 2 }, // 2: the time a swap moves the cook by (version history, owner's note 2026-10-17)
  examples: ['substitute for buttermilk', 'what can i use instead of eggs in baking', 'baking powder substitute', 'out of brown sugar', 'how to make self rising flour', 'can i use greek yogurt instead of sour cream'],
  nearMisses: ['substitute teacher', 'what can i use instead of google', 'substitution method', 'how to make bread', 'egg timer', 'replacement windows'],
  match(lower, text) { return !!swapAsk(text || lower); },
  run
};
