/**
 * swaps skill - kitchen substitutions: "substitute for buttermilk", "what can i use instead of eggs", "baking powder
 * substitute", "out of brown sugar", "how to make self rising flour", "can i use yogurt instead of sour cream".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * A built-in table of the usual kitchen equivalents, so the answer is instant. An ingredient not in the table ("instead of
 * google", "substitute teacher") is left to the other skills; weights and conversions are calc's, recipes are recipe's.
 */
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
      + '<ol style="padding-left:20px;line-height:1.6">' + s.swaps.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ol>'
      + (s.note ? '<p style="color:#8a8a8a">' + esc(s.note) + '</p>' : '')
      + '<div class="src">The usual kitchen equivalents. Any swap changes the taste or texture a little; the first one listed is the closest.</div>';
  });
  return 'swaps';
}

export default {
  name: 'swaps',
  examples: ['substitute for buttermilk', 'what can i use instead of eggs in baking', 'baking powder substitute', 'out of brown sugar', 'how to make self rising flour', 'can i use greek yogurt instead of sour cream'],
  nearMisses: ['substitute teacher', 'what can i use instead of google', 'substitution method', 'how to make bread', 'egg timer', 'replacement windows'],
  match(lower, text) { return !!swapAsk(text || lower); },
  run
};
