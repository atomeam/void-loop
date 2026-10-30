// What the big recipe sites have around a recipe and /recipes/ lacked (owner, 2026-10-25: "we have to have everything all the sites have";
// domains/features/recipes.json): nutrition per serving (Allrecipes, BBC Good Food, Yummly, Skinnytaste), diet and allergy filters and "without
// eggs" (Yummly, Tasty, Epicurious), a shopping list that collects from several recipes (Allrecipes, Yummly, BBC Good Food). All on the device.
// Nutrition is an ESTIMATE from a table of common ingredients (per 100 g, from the USDA's standard reference, rounded) and the quantities as
// written; the page says how many of the ingredients it could count, and never claims more. Pure. Tests: tools/kitchen.test.mjs.
import { numOf } from './recipes.js';

// [keywords, kcal, protein g, fat g, carbs g per 100 g, grams per ml (for cups and spoons), grams for one (an egg, a clove, an onion)]
const T = [
  ['flour|plain flour|all-purpose flour|all purpose flour|self-raising flour|self raising flour|bread flour', 364, 10, 1, 76, 0.53],
  ['wholemeal flour|whole wheat flour', 340, 13, 2.5, 72, 0.5], ['cornstarch|cornflour|corn starch', 381, 0.3, 0.1, 91, 0.53],
  ['cornmeal|polenta', 370, 8, 4, 77, 0.6], ['sugar|caster sugar|granulated sugar|white sugar', 387, 0, 0, 100, 0.85],
  ['brown sugar|light brown sugar|dark brown sugar|muscovado', 380, 0.1, 0, 98, 0.93], ['icing sugar|powdered sugar|confectioners sugar', 389, 0, 0, 100, 0.5],
  ['honey', 304, 0.3, 0, 82, 1.42], ['maple syrup|golden syrup|syrup', 260, 0, 0.1, 67, 1.32], ['jam', 278, 0.4, 0.1, 69, 1.33],
  ['butter|unsalted butter|salted butter|ghee', 717, 0.9, 81, 0.1, 0.96, 113], ['oil|olive oil|vegetable oil|sunflower oil|canola oil|rapeseed oil|sesame oil|coconut oil', 884, 0, 100, 0, 0.92],
  ['milk|whole milk|semi-skimmed milk|skimmed milk', 61, 3.2, 3.3, 4.8, 1.03], ['buttermilk', 40, 3.3, 0.9, 4.8, 1.03],
  ['cream|heavy cream|double cream|whipping cream', 340, 2.8, 36, 2.7, 1.0], ['single cream|light cream|half and half', 195, 2.6, 19, 4, 1.0],
  ['sour cream|creme fraiche|crème fraîche', 198, 2.4, 19, 4.6, 1.0], ['yogurt|yoghurt|natural yogurt|plain yogurt', 61, 3.5, 3.3, 4.7, 1.03],
  ['greek yogurt|greek yoghurt', 97, 9, 5, 4, 1.03], ['condensed milk|sweetened condensed milk', 321, 7.9, 8.7, 54, 1.3], ['evaporated milk', 134, 6.8, 7.6, 10, 1.05],
  ['cheese|cheddar|cheddar cheese|gruyere|gruyère|emmental|swiss cheese|monterey jack', 403, 25, 33, 1.3, 0.45, 25], ['parmesan|parmesan cheese|parmigiano|pecorino', 431, 38, 29, 4, 0.4],
  ['mozzarella', 280, 28, 17, 3, 0.45, 125], ['cream cheese|mascarpone', 342, 6, 34, 4, 1.0], ['feta|feta cheese|goat cheese|goats cheese', 264, 14, 21, 4, 0.5],
  ['ricotta', 174, 11, 13, 3, 1.0], ['egg|eggs|large egg|medium egg', 143, 12.6, 9.5, 0.7, 1.0, 50], ['egg yolk|egg yolks|yolk', 322, 16, 27, 3.6, 1.0, 17], ['egg white|egg whites', 52, 11, 0.2, 0.7, 1.0, 33],
  ['rice|white rice|long grain rice|basmati rice|jasmine rice|arborio rice|risotto rice', 365, 7.1, 0.7, 80, 0.85], ['brown rice', 370, 7.9, 2.9, 77, 0.8],
  ['pasta|spaghetti|penne|macaroni|fusilli|linguine|tagliatelle|lasagne sheets|lasagna noodles|rigatoni', 371, 13, 1.5, 75, 0.45], ['noodles|egg noodles|rice noodles', 384, 14, 4.4, 71, 0.4],
  ['oats|rolled oats|porridge oats|oatmeal', 389, 17, 7, 66, 0.38], ['bread|white bread|sourdough|bread slices', 265, 9, 3.2, 49, 0.3, 30], ['breadcrumbs|panko', 395, 13, 5, 72, 0.45],
  ['tortilla|tortillas|wrap|wraps', 310, 8, 8, 52, 0.5, 45], ['quinoa', 368, 14, 6, 64, 0.73], ['couscous', 376, 13, 0.6, 77, 0.73],
  ['chicken|chicken pieces|whole chicken', 215, 18.6, 15, 0, 1, 1500], ['chicken breast|chicken breasts|chicken fillet|chicken fillets', 120, 22.5, 2.6, 0, 1, 170], ['chicken thigh|chicken thighs', 177, 19, 11, 0, 1, 110],
  ['beef|minced beef|ground beef|beef mince', 254, 17, 20, 0, 1], ['steak|beef steak|sirloin|stewing beef|braising steak', 250, 26, 15, 0, 1, 250],
  ['pork|pork shoulder|pork loin|pork chops|minced pork|ground pork', 242, 27, 14, 0, 1, 200], ['bacon|streaky bacon|pancetta|lardons', 417, 13, 40, 1.4, 1, 25],
  ['ham', 145, 21, 6, 1.5, 1, 15], ['sausage|sausages|chorizo', 301, 12, 27, 2, 1, 75], ['lamb|lamb mince|minced lamb', 282, 17, 23, 0, 1], ['turkey|turkey breast|turkey mince', 135, 27, 2, 0, 1],
  ['salmon|salmon fillet|salmon fillets', 208, 20, 13, 0, 1, 150], ['tuna', 116, 26, 1, 0, 1, 145], ['cod|haddock|white fish|fish fillets|fish', 82, 18, 0.7, 0, 1, 150],
  ['prawns|shrimp|king prawns', 85, 20, 0.5, 0.2, 1, 15], ['tofu', 76, 8, 4.8, 1.9, 1], ['onion|onions|red onion|yellow onion|white onion|spring onion|spring onions|scallions|green onions', 40, 1.1, 0.1, 9.3, 0.65, 110],
  ['garlic|garlic clove|garlic cloves|cloves garlic', 149, 6.4, 0.5, 33, 0.6, 5], ['shallot|shallots', 72, 2.5, 0.1, 17, 0.65, 30],
  ['tomato|tomatoes|cherry tomatoes|plum tomatoes', 18, 0.9, 0.2, 3.9, 0.7, 120], ['chopped tomatoes|tinned tomatoes|canned tomatoes|crushed tomatoes|passata|tomato sauce', 25, 1.2, 0.2, 4.5, 1.0, 400],
  ['tomato paste|tomato puree|tomato purée', 82, 4.3, 0.5, 19, 1.1], ['potato|potatoes', 77, 2, 0.1, 17, 0.65, 170], ['sweet potato|sweet potatoes', 86, 1.6, 0.1, 20, 0.65, 130],
  ['carrot|carrots', 41, 0.9, 0.2, 10, 0.55, 60], ['celery|celery stalks|celery stick|celery sticks', 16, 0.7, 0.2, 3, 0.5, 40], ['pepper|bell pepper|red pepper|green pepper|yellow pepper|peppers', 26, 1, 0.3, 6, 0.5, 120],
  ['chilli|chili|chillies|chilies|jalapeno|jalapeño|red chilli|green chilli', 40, 2, 0.4, 9, 0.5, 15], ['mushroom|mushrooms', 22, 3.1, 0.3, 3.3, 0.3, 18],
  ['spinach|baby spinach', 23, 2.9, 0.4, 3.6, 0.13], ['lettuce|salad leaves|rocket|arugula', 15, 1.4, 0.2, 2.9, 0.2], ['broccoli', 34, 2.8, 0.4, 7, 0.38, 300], ['cauliflower', 25, 1.9, 0.3, 5, 0.4, 600],
  ['zucchini|courgette|courgettes', 17, 1.2, 0.3, 3.1, 0.5, 200], ['aubergine|eggplant', 25, 1, 0.2, 6, 0.35, 300], ['cucumber', 15, 0.7, 0.1, 3.6, 0.5, 300],
  ['peas|frozen peas|green peas', 81, 5.4, 0.4, 14, 0.6], ['sweetcorn|corn|corn kernels', 86, 3.3, 1.4, 19, 0.65], ['green beans|french beans|runner beans', 31, 1.8, 0.2, 7, 0.45], ['cabbage', 25, 1.3, 0.1, 6, 0.4, 900],
  ['avocado|avocados', 160, 2, 15, 9, 0.6, 150], ['lemon|lemons', 29, 1.1, 0.3, 9, 1, 85], ['lime|limes', 30, 0.7, 0.2, 11, 1, 45], ['lemon juice|lime juice', 22, 0.4, 0.2, 7, 1.03],
  ['apple|apples', 52, 0.3, 0.2, 14, 0.5, 180], ['banana|bananas|ripe bananas', 89, 1.1, 0.3, 23, 0.6, 118], ['orange|oranges', 47, 0.9, 0.1, 12, 0.6, 130], ['orange juice', 45, 0.7, 0.2, 10, 1.04],
  ['berries|blueberries|strawberries|raspberries|blackberries', 57, 0.7, 0.3, 14, 0.6], ['raisins|sultanas|currants|dried fruit', 299, 3, 0.5, 79, 0.6],
  ['chocolate|chocolate chips|dark chocolate|milk chocolate|chocolate chunks', 546, 4.9, 31, 61, 0.7], ['cocoa|cocoa powder', 228, 20, 14, 58, 0.36],
  ['almonds|ground almonds|almond', 579, 21, 50, 22, 0.6], ['walnuts|walnut|pecans|pecan|hazelnuts', 654, 15, 65, 14, 0.47], ['peanuts', 567, 26, 49, 16, 0.6], ['peanut butter', 588, 25, 50, 20, 1.03],
  ['cashews|cashew nuts|pine nuts|pistachios', 553, 18, 44, 30, 0.55], ['coconut milk|coconut cream', 230, 2.3, 24, 6, 0.97, 400], ['desiccated coconut|shredded coconut', 660, 7, 65, 24, 0.35],
  ['stock|chicken stock|beef stock|vegetable stock|broth|chicken broth|beef broth|vegetable broth', 10, 1.4, 0.3, 0.6, 1.0], ['stock cube|bouillon cube|stock cubes', 240, 10, 15, 20, 1, 10],
  ['baking powder', 53, 0, 0, 28, 0.9], ['bicarbonate of soda|baking soda|bicarb', 0, 0, 0, 0, 1.1], ['yeast|dried yeast|instant yeast', 325, 40, 7.6, 41, 0.6, 7],
  ['vanilla|vanilla extract|vanilla essence', 288, 0, 0, 13, 0.9], ['soy sauce|soya sauce', 53, 8, 0.6, 5, 1.1], ['vinegar|white wine vinegar|red wine vinegar|balsamic vinegar|cider vinegar|rice vinegar', 18, 0, 0, 0.1, 1.0],
  ['mustard|dijon mustard|wholegrain mustard', 66, 4, 4, 6, 1.0], ['mayonnaise|mayo', 680, 1, 75, 0.6, 0.92], ['ketchup', 112, 1.3, 0.2, 26, 1.15],
  ['beans|kidney beans|black beans|cannellini beans|butter beans|baked beans', 127, 8.7, 0.5, 23, 0.7, 240], ['chickpeas|garbanzo beans', 139, 7, 2.6, 23, 0.7, 240], ['lentils|red lentils|green lentils', 352, 25, 1, 63, 0.8],
  ['ginger|fresh ginger|ground ginger', 80, 1.8, 0.8, 18, 0.5, 10], ['herbs|basil|parsley|coriander|cilantro|mint|dill|chives|thyme|rosemary|oregano|bay leaf|bay leaves|sage', 30, 3, 0.6, 5, 0.1, 1],
  ['cumin|paprika|cinnamon|nutmeg|turmeric|curry powder|garam masala|chilli powder|chili powder|cayenne|mixed spice|allspice|cloves|spice|spices|chilli flakes|red pepper flakes', 300, 12, 10, 50, 0.5],
  ['wine|white wine|red wine', 85, 0.1, 0, 2.6, 1.0], ['beer|ale|stout', 43, 0.5, 0, 3.6, 1.0], ['water|ice|ice cubes|salt|sea salt|kosher salt|black pepper|pepper to taste|salt and pepper', 0, 0, 0, 0, 1.0],
].map(([k, kcal, protein, fat, carbs, density = 1, each = 0]) => ({ words: k.split('|'), kcal, protein, fat, carbs, density, each }));
const KEYS = T.flatMap((e) => e.words.map((w) => ({ w, e }))).sort((a, b) => b.w.length - a.w.length);
const clean = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/\([^)]*\)/g, ' ').replace(/[^a-z\s-]/g, ' ').replace(/\s+/g, ' ').trim();
/** the table's entry for an ingredient's name: the word that ends latest wins ("chicken stock" is stock), the longer one on a tie
 *  ("peanut butter" is not butter); null when it is not in the table. Pure. */
export function entryOf(name) {
  const s = ' ' + clean(name) + ' '; let best = null;
  for (const { w, e } of KEYS) { const at = s.search(new RegExp(' ' + w.replace(/[-]/g, '\\-') + '(?:e?s)? ')); if (at < 0) continue; const end = at + w.length; if (!best || end > best.end || (end === best.end && w.length > best.w.length)) best = { e, end, w }; }
  return best ? best.e : null;
}
const UNIT = [[/^(?:cups?|c)\b\.?/i, 'ml', 240], [/^(?:tablespoons?|tbsps?|tbls?|tbs|tbl|T)\b\.?/, 'ml', 15], [/^(?:teaspoons?|tsps?|t)\b\.?/, 'ml', 5], [/^(?:kg|kilos?|kilograms?)\b/i, 'g', 1000],
  [/^(?:g|grams?|gr|grammes?)\b\.?/i, 'g', 1], [/^(?:ml|millilit(?:re|er)s?)\b/i, 'ml', 1], [/^(?:l|lit(?:re|er)s?)\b/i, 'ml', 1000], [/^(?:dl)\b/i, 'ml', 100], [/^(?:fl\.? ?oz|fluid ounces?)\b/i, 'ml', 29.6],
  [/^(?:oz|ounces?)\b\.?/i, 'g', 28.35], [/^(?:lbs?|pounds?)\b\.?/i, 'g', 453.6], [/^(?:pinch(?:es)?|dash(?:es)?|sprinkl\w*)\b/i, 'g', 0.4],
  [/^(?:cans?|tins?)\b/i, 'can', 1], [/^(?:sticks?)\b/i, 'stick', 1], [/^(?:handfuls?)\b/i, 'g', 30], [/^(?:bunch(?:es)?)\b/i, 'g', 30], [/^(?:slices?|rashers?|strips?)\b/i, 'each', 1],
  [/^(?:cloves?|pieces?|whole|large|medium|small|heads?|stalks?|sticks?|fillets?|breasts?|thighs?)\b/i, 'each', 1]];
const QTY = /^\s*(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?\s?[¼½¾⅓⅔⅛]|[¼½¾⅓⅔⅛]|\d+(?:[.,]\d+)?)(?:\s*(?:-|–|to)\s*(\d+(?:[.,]\d+)?))?\s*/;
/** one ingredient line in grams: { grams, entry, name } (grams null when the line says no amount: "salt to taste"); entry null when unknown. Pure. */
export function gramsOf(line) {
  const raw = String(line || ''), paren = /\((\d+(?:[.,]\d+)?)\s*(g|grams?|ml)\)/i.exec(raw);
  let s = raw.replace(/\([^)]*\)/g, ' ').trim(), qty = null, unit = 'each', per = 1;
  const one = /^(?:a|an|one)\s+/i.exec(s); if (one) { qty = 1; s = s.slice(one[0].length); }
  const m = one ? null : QTY.exec(s); if (m) { const a = numOf(m[1].replace(/\s+(?=[¼½¾⅓⅔⅛])/, '')), b = m[2] ? numOf(m[2]) : NaN; qty = Number.isFinite(b) ? (a + b) / 2 : a; s = s.slice(m[0].length); }
  const g0 = /^(\d+(?:[.,]\d+)?)(g|kg|ml|l)\b/i.exec(raw.trim()); // TheMealDB writes "100g", "300ml"
  if (g0) { qty = parseFloat(g0[1].replace(',', '.')); s = raw.trim().slice(g0[0].length); unit = /^k/i.test(g0[2]) ? 'g' : /^m/i.test(g0[2]) ? 'ml' : /^l/i.test(g0[2]) ? 'ml' : 'g'; per = /^k|^l/i.test(g0[2]) ? 1000 : 1; }
  else for (const [re, u, k] of UNIT) { const x = re.exec(s.trim()); if (x) { unit = u; per = k; s = s.trim().slice(x[0].length); break; } }
  const name = s.replace(/^\s*(?:of\s+)?/, '').replace(/,.*$/, '').trim(), entry = entryOf(name) || entryOf(raw);
  if (paren && entry) { const v = parseFloat(paren[1].replace(',', '.')); return { grams: /ml/i.test(paren[2]) ? v * entry.density : v, entry, name }; }
  if (qty == null || !Number.isFinite(qty)) return { grams: entry && entry.kcal === 0 ? 0 : null, entry, name };
  if (!entry) return { grams: null, entry: null, name };
  const g = unit === 'g' ? qty * per : unit === 'ml' ? qty * per * entry.density : unit === 'can' ? qty * (entry.each >= 200 ? entry.each : 400) : unit === 'stick' ? qty * (entry.each || 113) : qty * (entry.each || 100);
  return { grams: g, entry, name };
}
/** an estimate for one serving: { kcal, protein, fat, carbs, counted, of } from the lines a recipe for `servings` has; counted is how many lines
 *  the table could read (a line with no amount and no calories, like salt, counts as read). Pure. */
export function nutritionOf(lines, servings = 1) {
  const n = { kcal: 0, protein: 0, fat: 0, carbs: 0 }; let counted = 0; const list = Array.isArray(lines) ? lines : [];
  for (const l of list) { const g = gramsOf(l); if (g.entry && g.grams != null) { counted++; for (const k of Object.keys(n)) n[k] += g.entry[k] * g.grams / 100; } }
  const per = Math.max(1, +servings || 1);
  return { kcal: Math.round(n.kcal / per), protein: Math.round(n.protein / per), fat: Math.round(n.fat / per), carbs: Math.round(n.carbs / per), counted, of: list.length };
}

// diets and allergies: what an ingredient line says it contains (the words people write), so a recipe can be kept or left out
const HAS = {
  meat: /\b(?:chicken|beef|pork|bacon|ham|lamb|mutton|turkey|duck|sausages?|chorizo|pancetta|lardons|salami|pepperoni|prosciutto|veal|venison|mince|steak|gelatine?|anchov\w*|meat)\b/,
  fish: /\b(?:fish|salmon|tuna|cod|haddock|prawns?|shrimps?|crab|lobster|mussels|clams|squid|anchov\w*|sardines?|mackerel|fish sauce|oyster sauce|scallops?|trout)\b/,
  egg: /\b(?:eggs?|egg yolks?|yolks?|egg whites?|mayonnaise|mayo|meringue)\b/,
  dairy: /\b(?:milk|buttermilk|butter|cheese|cheddar|parmesan|mozzarella|ricotta|feta|cream|creme fraiche|yogh?urt|ghee|whey|custard|mascarpone|gruyere|paneer)\b/,
  gluten: /\b(?:flour|wheat|bread|breadcrumbs|panko|pasta|spaghetti|penne|macaroni|noodles|couscous|barley|rye|semolina|tortillas?|wraps?|pastry|biscuits?|crackers|beer|soy sauce|soya sauce|seitan|bulgur)\b/,
  nuts: /\b(?:almonds?|walnuts?|pecans?|cashews?|hazelnuts?|pistachios?|peanuts?|peanut butter|pine nuts|macadamias?|brazil nuts|nuts|praline|marzipan|nutella)\b/,
  honey: /\bhoney\b/,
};
// what is not gluten though it says flour or noodles: rice flour, corn flour, gluten-free pasta, rice noodles
const NOT_GLUTEN = /\b(?:rice flour|corn ?flour|cornstarch|gluten[- ]free \w+|rice noodles|almond flour|coconut flour|chickpea flour|buckwheat|tamari)\b/g;
const NOT_DAIRY = /\b(?:peanut butter|almond butter|cocoa butter|coconut milk|coconut cream|almond milk|oat milk|soy milk|soya milk|cream of tartar|ice cream)\b/g; // ice cream is dairy, but "ice cream" alone stays (below)
/** what a recipe contains of the things diets and allergies leave out: a Set of 'meat', 'fish', 'egg', 'dairy', 'gluten', 'nuts', 'honey'. Pure. */
export function containsOf(recipe) {
  const out = new Set();
  for (const raw of (recipe && recipe.ingredients) || []) {
    const l = ' ' + clean(raw).replace(/-/g, ' ') + ' ';
    for (const [k, re] of Object.entries(HAS)) {
      const t = k === 'gluten' ? l.replace(NOT_GLUTEN, ' ') : k === 'dairy' ? l.replace(NOT_DAIRY, ' ') + (/ ice cream /.test(l) ? ' cream ' : '') : k === 'egg' ? l.replace(/\beggplants?\b/g, ' ') : l;
      if (re.test(t)) out.add(k);
    }
  }
  return out;
}
export const DIETS = Object.freeze({ vegetarian: ['meat', 'fish'], vegan: ['meat', 'fish', 'egg', 'dairy', 'honey'], 'gluten-free': ['gluten'], 'dairy-free': ['dairy'], 'egg-free': ['egg'], 'nut-free': ['nuts'] });
/** the diets a recipe fits ("vegetarian", "gluten-free", ...). Pure. */
export const dietsOf = (recipe) => { const c = containsOf(recipe); return Object.keys(DIETS).filter((d) => DIETS[d].every((x) => !c.has(x))); };
/** "pancakes without eggs", "vegan curry", "chicken soup no dairy", "Pfannkuchen ohne Ei": { dish, without: [words], diets: [names] }. Pure. */
export function askOf(text) {
  let s = ' ' + String(text || '').toLowerCase().replace(/\s+/g, ' ').trim() + ' '; const without = [], diets = [];
  s = s.replace(/\b(?:without|no|minus|free of|ohne|kein|keine)\s+([a-zäöüß ,&-]+?)(?=\s+(?:and\s+)?(?:without|no|ohne|for|with)\b|$|[.?!])/g, (_, w) => { for (const x of w.split(/,|&|\band\b|\bor\b|\boder\b|\bund\b/)) { const t = x.trim().replace(/^(?:any|eggs? and)\s+/, ''); if (t) without.push(t); } return ' '; });
  s = s.replace(/\b(dairy|gluten|egg|nut|meat)[- ]free\b/g, (_, w) => { diets.push(w === 'meat' ? 'vegetarian' : w + '-free'); return ' '; });
  s = s.replace(/\b(vegetarian|vegan|veggie|vegetarisch|vegane?)\b/g, (_, w) => { diets.push(/^veg(?:etari|gie)/.test(w) ? 'vegetarian' : w.startsWith('vegan') ? 'vegan' : 'vegetarian'); return ' '; });
  return { dish: s.replace(/\s+/g, ' ').trim(), without: [...new Set(without)], diets: [...new Set(diets)] };
}
// a word people leave out, as what it means: "eggs" is egg, "milk" and "cheese" are dairy only when they say dairy, "nuts" is nuts
const LEAVE = { egg: 'egg', eggs: 'egg', ei: 'egg', eier: 'egg', dairy: 'dairy', milchprodukte: 'dairy', lactose: 'dairy', gluten: 'gluten', wheat: 'gluten', weizen: 'gluten', nut: 'nuts', nuts: 'nuts', nüsse: 'nuts', meat: 'meat', fleisch: 'meat', fish: 'fish', fisch: 'fish', seafood: 'fish', honey: 'honey' };
/** whether a recipe keeps out what was asked: every `without` word (a group like "dairy", or any ingredient word like "onion") and every diet. Pure. */
export function fits(recipe, { without = [], diets = [] } = {}) {
  const c = containsOf(recipe), lines = ((recipe && recipe.ingredients) || []).map((l) => ' ' + clean(l) + ' ');
  for (const d of diets) if ((DIETS[d] || []).some((x) => c.has(x))) return false;
  for (const w0 of without) { const w = clean(w0); if (!w) continue; if (LEAVE[w]) { if (c.has(LEAVE[w])) return false; continue; }
    const stem = w.replace(/(?:es|s)$/, ''); if (lines.some((l) => new RegExp(' ' + stem.replace(/[-]/g, '\\-') + '(?:e?s)? ').test(l))) return false; }
  return true;
}

// the shopping list: lines from several recipes, each remembering which recipe it came for; ticked off in the shop
/** the list with a recipe's lines added (a line already on it for the same recipe is not added twice). Pure. */
export function withLines(list, recipeName, lines, now = Date.now()) {
  const out = Array.isArray(list) ? [...list] : [];
  for (const t of lines || []) { const text = String(t || '').trim().slice(0, 200); if (!text || out.some((x) => x.text === text && x.from === recipeName)) continue; out.push({ id: now.toString(36) + out.length.toString(36) + Math.random().toString(36).slice(2, 6), text, from: String(recipeName || '').slice(0, 120), done: false }); }
  return out.slice(-300);
}
/** the list as text to paste: grouped by recipe, ticked ones left out. Pure. */
export function listText(list) {
  const by = new Map(); for (const x of list || []) { if (x.done) continue; if (!by.has(x.from)) by.set(x.from, []); by.get(x.from).push(x.text); }
  return [...by].map(([from, l]) => (from ? from + '\n' : '') + l.map((t) => '☐ ' + t).join('\n')).join('\n\n');
}

/** the page's words for what is here (English, German). Pure. */
export function wordsFor(lang) {
  const de = /^de\b/i.test(String(lang || ''));
  return de ? {
    saved: 'Gespeichert', list: 'Einkaufsliste', diets: 'Ernährung', dietsH: 'Ernährung und Allergien', withoutL: 'Ohne (z. B. Zwiebeln, Nüsse)', vegetarian: 'Vegetarisch', vegan: 'Vegan', 'gluten-free': 'Glutenfrei', 'dairy-free': 'Ohne Milchprodukte', 'egg-free': 'Ohne Ei', 'nut-free': 'Ohne Nüsse',
    perServing: 'Pro Portion (geschätzt)', kcal: 'kcal', protein: 'Eiweiß', fat: 'Fett', carbs: 'Kohlenhydrate', fromN: (n, m) => 'aus ' + n + ' von ' + m + ' Zutaten', save: 'Speichern', savedOn: 'Gespeichert', noColl: 'Keine Sammlung', newColl: 'Neue Sammlung …', collName: 'Name der Sammlung',
    toList: 'Auf die Einkaufsliste', added: 'Auf der Einkaufsliste', copyAll: 'Liste kopieren', clearDone: 'Abgehakte entfernen', clearAll: 'Alles leeren', listEmpty: 'Die Liste ist leer: „Auf die Einkaufsliste“ bei einem Rezept füllt sie.', items: 'Dinge',
    savedEmpty: 'Noch nichts gespeichert: „Speichern“ bei einem Rezept legt es hier ab.', all: 'Alle', rating: 'Deine Bewertung', stars: (n) => n + (n === 1 ? ' Stern' : ' Sterne'), notes: 'Deine Notizen', notesPh: 'Was du nächstes Mal anders machst', fitNone: 'Keines passt zu', showing: 'Nur Rezepte', remove: 'Entfernen', unchecked: 'nicht geprüft',
    plan: 'Essensplan', planFor: 'Für einen Tag planen …', today: 'Heute', tomorrow: 'Morgen', planned: 'Geplant', weekToList: 'Die Woche auf die Einkaufsliste', weekToCal: 'Die Woche in meinen Kalender', planEmpty: 'Nichts geplant: „Für einen Tag planen“ bei einem Rezept legt es hier ab.', impBtn: 'Importieren', impH: 'Ein Rezept importieren', fromLink: 'Von einem Link', linkPh: 'Adresse einer Rezeptseite (https://…)', impGo: 'Importieren', fromPhoto: 'Von einem Foto', pasteL: 'Oder den Text einfügen', pastePh: 'Titel, dann Zutaten, dann Zubereitung', impText: 'Text importieren', reading: 'Ich lese …', imported: 'Importiert', noRecipe: 'Kein Rezept gefunden', photoRead: 'Vom Foto gelesen: prüfen, dann „Text importieren“', photoFail: 'Das Foto ließ sich nicht lesen', linkNote: 'Verse liest die Rezeptdaten, die eine Seite für Suchmaschinen veröffentlicht; nur das Rezept kommt zurück, nichts von der Seite sonst.', photoNote: 'Ein Foto wird auf Verses Server von einem Bilderkennungsmodell gelesen und danach verworfen; nichts wird gespeichert.', checkIt: 'Mengen bitte prüfen', time: 'Zeit', timeAny: 'Jede Dauer', timeUnder: (n) => 'bis ' + n + ' Minuten', occasion: 'Anlass', occAny: 'Jeder Anlass', timeNone: 'Keines der Rezepte, deren Zeit ich kenne, passt', timeNote: 'Zeiten kenne ich von den eingebauten, gespeicherten und geöffneten Rezepten; der Katalog nennt keine', min: 'Min.', occBreakfast: 'Frühstück und Brunch', occWeeknight: 'Schnell unter der Woche (bis 30 Minuten)', occStarter: 'Vorspeisen und Partyessen', occDessert: 'Nachtisch und Backen', occSide: 'Beilagen', occVeg: 'Ohne Fleisch', occVegan: 'Vegan', occSeafood: 'Fisch und Meeresfrüchte', voice: 'Sprache', voiceOn: 'Ich höre zu', voiceOff: 'Sprache aus', voiceNote: 'Sprachsteuerung nutzt die Spracherkennung deines Browsers; manche Browser schicken das Audio dazu an die Server ihres Herstellers. Verse selbst bekommt kein Audio.', voiceHelp: 'Sag: weiter, zurück, wiederholen, Timer starten, Timer stopp, Zutaten, schließen', voiceDenied: 'Das Mikrofon ist nicht erlaubt', heard: 'Gehört', shopAt: 'Einkaufen bei', find: 'Suchen', storeNote: 'Nur Links: die Suche des Ladens öffnet sich in einem neuen Tab; es wird nichts gesendet oder angemeldet', costL: 'Kosten (grob geschätzt)', perServ: 'pro Portion', forAll: 'für das Rezept', priceNote: 'typische US-Supermarktpreise', onCal: 'Im Kalender', meal: 'Essen', browse: 'Stöbern', cuisine: 'Küche', category: 'Kategorie', pick: 'Wählen …', found: 'Rezepte',
  } : {
    saved: 'Saved', list: 'Shopping list', diets: 'Diets', dietsH: 'Diet and allergies', withoutL: 'Without (e.g. onion, nuts)', vegetarian: 'Vegetarian', vegan: 'Vegan', 'gluten-free': 'Gluten-free', 'dairy-free': 'Dairy-free', 'egg-free': 'Egg-free', 'nut-free': 'Nut-free',
    perServing: 'Per serving (estimate)', kcal: 'kcal', protein: 'protein', fat: 'fat', carbs: 'carbs', fromN: (n, m) => 'from ' + n + ' of ' + m + ' ingredients', save: 'Save', savedOn: 'Saved', noColl: 'No collection', newColl: 'New collection…', collName: 'Collection name',
    toList: 'Add to shopping list', added: 'On the shopping list', copyAll: 'Copy list', clearDone: 'Clear ticked', clearAll: 'Clear all', listEmpty: 'The list is empty: "Add to shopping list" on a recipe fills it.', items: 'items',
    savedEmpty: 'Nothing saved yet: "Save" on a recipe keeps it here.', all: 'All', rating: 'Your rating', stars: (n) => n + (n === 1 ? ' star' : ' stars'), notes: 'Your notes', notesPh: 'What you would change next time', fitNone: 'None fits', showing: 'Only recipes', remove: 'Remove', unchecked: 'not checked',
    plan: 'Meal plan', planFor: 'Plan for a day…', today: 'Today', tomorrow: 'Tomorrow', planned: 'Planned', weekToList: 'Add the week to the shopping list', weekToCal: 'Put the week on my calendar', planEmpty: 'Nothing planned: "Plan for a day" on a recipe puts it here.', impBtn: 'Import', impH: 'Import a recipe', fromLink: 'From a link', linkPh: 'Address of a recipe page (https://…)', impGo: 'Import', fromPhoto: 'From a photo', pasteL: 'Or paste the text', pastePh: 'Title, then Ingredients, then Method', impText: 'Import text', reading: 'Reading…', imported: 'Imported', noRecipe: 'No recipe found', photoRead: 'Read from the photo: check it, then Import text', photoFail: 'The photo could not be read', linkNote: 'Verse reads the recipe data a page publishes for search engines; only the recipe comes back, nothing else of the page.', photoNote: 'A photo is read by a vision model on Verse\'s server and then dropped; nothing is kept.', checkIt: 'Check the amounts', time: 'Time', timeAny: 'Any time', timeUnder: (n) => 'under ' + n + ' minutes', occasion: 'Occasion', occAny: 'Any occasion', timeNone: 'None of the recipes whose time I know fits', timeNote: 'Times are known for the built-in, saved and opened recipes; the catalogue gives none', min: 'min', occBreakfast: 'Breakfast and brunch', occWeeknight: 'Quick weeknight (under 30 minutes)', occStarter: 'Starters and party food', occDessert: 'Dessert and baking', occSide: 'Side dishes', occVeg: 'Meat-free', occVegan: 'Vegan', occSeafood: 'Seafood', voice: 'Voice', voiceOn: 'Listening', voiceOff: 'Voice off', voiceNote: 'Voice control uses your browser\'s speech recognition; some browsers send the audio to their maker\'s servers to turn it into words. Verse itself receives no audio.', voiceHelp: 'Say: next, back, repeat, start timer, stop timer, ingredients, close', voiceDenied: 'The microphone is not allowed', heard: 'Heard', shopAt: 'Shop at', find: 'Find', storeNote: 'Links only: the store\'s own search opens in a new tab; nothing is sent or signed in', costL: 'Cost (rough estimate)', perServ: 'per serving', forAll: 'for the recipe', priceNote: 'typical US supermarket prices', onCal: 'On your calendar', meal: 'Meal', browse: 'Browse', cuisine: 'Cuisine', category: 'Category', pick: 'Choose…', found: 'recipes',
  };
}

/** the next `n` days from `now` as { key: 'YYYY-MM-DD', date }. Pure. */
export function nextDays(now = new Date(), n = 7) {
  const p = (x) => String(x).padStart(2, '0');
  return Array.from({ length: n }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i); return { key: d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()), date: d }; });
}
/** the plan with a recipe put on a day (one recipe once a day), days before `today` dropped. Pure. */
export function withPlanned(plan, day, recipe, servings, today = '') {
  const keep = (Array.isArray(plan) ? plan : []).filter((x) => x && (!today || x.day >= today) && !(x.day === day && x.id === recipe.id));
  return [...keep, { day, id: recipe.id, name: recipe.name, recipe, servings: Math.max(1, +servings || recipe.servings || 1) }].sort((a, b) => a.day.localeCompare(b.day)).slice(0, 200);
}

// cost per serving (Budget Bytes): an ESTIMATE from rough typical US supermarket prices per kilogram (2026, mid-range, rounded), by the same ingredient table as the
// nutrition; an ingredient the table reads but has no price for counts at 6 dollars a kilogram; one it cannot read is left out and counted out loud. Pure.
const PRICE_PER_KG = Object.fromEntries(('flour:1.6,wholemeal flour:2.4,cornstarch:3.5,cornmeal:2.2,sugar:1.8,brown sugar:2.8,icing sugar:3,honey:11,maple syrup:14,jam:6,butter:11,oil:5.5,milk:1.1,buttermilk:2.2,cream:7,single cream:6,sour cream:5,yogurt:3.5,greek yogurt:6,condensed milk:5,evaporated milk:4,'
  + 'cheese:12,parmesan:24,mozzarella:10,cream cheese:9,feta:14,ricotta:8,egg:5,egg yolk:5,egg white:5,rice:2.2,brown rice:2.8,pasta:2.5,noodles:4,oats:3.2,bread:4.5,breadcrumbs:6,tortilla:6,quinoa:9,couscous:4.5,chicken:5,chicken breast:8,chicken thigh:5.5,beef:11,steak:20,pork:8,bacon:14,ham:12,sausage:9,lamb:16,turkey:7,'
  + 'salmon:22,tuna:15,cod:18,prawns:22,tofu:6,onion:1.8,garlic:9,shallot:6,tomato:4.5,chopped tomatoes:2.2,tomato paste:6,potato:1.6,sweet potato:2.6,carrot:1.6,celery:2.5,pepper:5,chilli:10,mushroom:7,spinach:8,lettuce:6,broccoli:4,cauliflower:3.5,zucchini:3,aubergine:4,cucumber:3.5,peas:3.5,sweetcorn:3.5,green beans:5,cabbage:1.6,'
  + 'avocado:6,lemon:4.5,lime:5,lemon juice:5,apple:3.5,banana:1.6,orange:3,orange juice:3,berries:12,raisins:8,chocolate:12,cocoa:14,almonds:16,walnuts:18,peanuts:7,peanut butter:6,cashews:20,coconut milk:4,desiccated coconut:9,stock:1.5,stock cube:25,baking powder:8,bicarbonate of soda:3,yeast:25,vanilla:90,soy sauce:6,vinegar:3,mustard:7,mayonnaise:5,ketchup:4,beans:3,chickpeas:3,lentils:3.5,ginger:8,herbs:25,cumin:40,wine:10,beer:3,water:0').split(',').map((x) => { const i = x.lastIndexOf(':'); return [x.slice(0, i), +x.slice(i + 1)]; }));
/** the rough price of an ingredient per kilogram, in US dollars (by the first name its table row has). Pure. */
export const pricePerKg = (entry) => (entry ? (PRICE_PER_KG[entry.words[0]] ?? 6) : null);
/** an estimate of what a recipe costs: { total, perServing, counted, of } in US dollars from the lines the table can read. Pure. */
export function costOf(lines, servings = 1) {
  let total = 0, counted = 0; const list = Array.isArray(lines) ? lines : [];
  for (const l of list) { const g = gramsOf(l); if (g.entry && g.grams != null) { counted++; total += pricePerKg(g.entry) * g.grams / 1000; } }
  const per = Math.max(1, +servings || 1);
  return { total: Math.round(total * 100) / 100, perServing: Math.round(total / per * 100) / 100, counted, of: list.length };
}

// the shopping list handed to a shop, as links only: each item opens the store's own search in a new tab. Fixed addresses (no address ever comes from a recipe),
// no account, no key, no tracking parameter; Verse sends nothing and learns nothing. Pure.
export const STORES = Object.freeze([
  { id: 'walmart', name: 'Walmart', url: 'https://www.walmart.com/search?q=', regions: ['US'] },
  { id: 'instacart', name: 'Instacart', url: 'https://www.instacart.com/store/s?k=', regions: ['US', 'CA'] },
  { id: 'amazonfresh', name: 'Amazon Fresh', url: 'https://www.amazon.com/s?i=amazonfresh&k=', regions: ['US'] },
  { id: 'target', name: 'Target', url: 'https://www.target.com/s?searchTerm=', regions: ['US'] },
  { id: 'tesco', name: 'Tesco', url: 'https://www.tesco.com/groceries/en-GB/search?query=', regions: ['GB'] },
  { id: 'ocado', name: 'Ocado', url: 'https://www.ocado.com/search?entry=', regions: ['GB'] },
  { id: 'sainsburys', name: "Sainsbury's", url: 'https://www.sainsburys.co.uk/gol-ui/SearchResults/', regions: ['GB'], path: true },
  { id: 'rewe', name: 'REWE', url: 'https://www.rewe.de/suche/produkte?search=', regions: ['DE', 'AT'] },
  { id: 'amazonde', name: 'Amazon Fresh (DE)', url: 'https://www.amazon.de/s?i=amazonfresh&k=', regions: ['DE', 'AT'] },
  { id: 'amazonuk', name: 'Amazon Fresh (UK)', url: 'https://www.amazon.co.uk/s?i=amazonfresh&k=', regions: ['GB'] },
]);
/** the store a country starts with (the first listed for its region, Walmart when none). Pure. */
export function defaultStore(lang) { const m = /[-_]([A-Za-z]{2})\b/.exec(String(lang || '')); const c = m ? m[1].toUpperCase() : /^de\b/i.test(String(lang || '')) ? 'DE' : 'US'; return (STORES.find((x) => x.regions.includes(c)) || STORES[0]).id; }
/** what to search for from a list line: the amounts and "chopped, to serve" left off ("1 ½ cups all-purpose flour (190 g)" -> "all-purpose flour"). Pure. */
export function searchName(line) {
  const g = gramsOf(line); let n = String(g.name || line || '').replace(/\b(?:chopped|diced|sliced|minced|grated|melted|softened|finely|roughly|thinly|fresh|freshly|to serve|to taste|optional|for serving|plus more)\b/gi, ' ').replace(/[^\p{L}\p{N}\s'-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return (n || String(line || '').replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ').trim()).slice(0, 60);
}
/** the link that opens a store's search for an item, or null for an unknown store or an empty search. Pure. */
export function storeLink(storeId, line) {
  const st = STORES.find((x) => x.id === storeId), q = searchName(line); if (!st || !q) return null;
  return st.url + (st.path ? encodeURIComponent(q).replace(/%20/g, '%20') : encodeURIComponent(q).replace(/%20/g, '+'));
}

// voice cook mode (Epicurious, Delish: hands free with the hands in the dough): what was said in step mode, as a command. The words are the browser's speech recognition's,
// not Verse's; this only reads them. English and German. Pure.
/** 'next', 'prev', 'repeat', 'timer', 'stopTimer', 'stop', 'ingredients', 'close', or null for anything else. */
export function voiceCommand(said) {
  const t = ' ' + String(said || '').toLowerCase().replace(/ß/g, 'ss').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z\s]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
  if (t.trim().length < 2 || t.length > 80) return null;
  if (/ (?:stop|cancel|end|turn off|stopp|stoppe|beende|aus) (?:the |den |das )?(?:timer|wecker) | (?:timer|wecker) (?:stop|stopp|cancel|off|aus|beenden) /.test(t)) return 'stopTimer';
  if (/ (?:start|set|begin|starte|starten|stell|stelle|setz)\w* .*(?:timer|wecker) | (?:timer|wecker) (?:start|starten|an|ein) | (?:the |den )?(?:timer|wecker) $/.test(t)) return 'timer';
  if (/ (?:close|exit|quit|stop cooking|finish cooking|i am done cooking|schliessen|schliesse|beenden|fertig gekocht|kochen beenden|ende) /.test(t)) return 'close';
  if (/ (?:back|previous|go back|last step|one back|zuruck|vorherige\w*|vorheriger schritt|schritt zuruck) /.test(t)) return 'prev';
  if (/ (?:repeat|again|say that again|say it again|read it|read that|read the step|wiederhol\w*|nochmal|noch einmal|vorlesen|lies vor|wie bitte) /.test(t)) return 'repeat';
  if (/ (?:ingredients?|what do i need|zutaten|was brauche ich) /.test(t)) return 'ingredients';
  if (/ (?:stop|stopp|halt) $/.test(t)) return 'stop';
  if (/ (?:next|forward|continue|go on|go ahead|okay|ok|done|ready|weiter|nachste\w*|nachster schritt|fertig|bereit) /.test(t)) return 'next';
  return null;
}

// browsing by time and occasion (Allrecipes, Tasty, Yummly, BBC Good Food): TheMealDB gives no cooking times, so a time filter works over the recipes whose time Verse knows
// (the built-in ones and anything saved or opened); an occasion is one of TheMealDB's own categories, or the quick-weeknight time filter. Pure.
export const TIMES = Object.freeze([15, 30, 45, 60]);
export const OCCASIONS = Object.freeze([
  { id: 'breakfast', word: 'occBreakfast', c: 'Breakfast' }, { id: 'weeknight', word: 'occWeeknight', time: 30 }, { id: 'starter', word: 'occStarter', c: 'Starter' }, { id: 'dessert', word: 'occDessert', c: 'Dessert' },
  { id: 'side', word: 'occSide', c: 'Side' }, { id: 'veg', word: 'occVeg', c: 'Vegetarian' }, { id: 'vegan', word: 'occVegan', c: 'Vegan' }, { id: 'seafood', word: 'occSeafood', c: 'Seafood' },
]);
/** the recipes (each once, by id) whose time is known and at most `max` minutes, quickest first. Pure. */
export function byTime(recipes, max) {
  const seen = new Set(), out = [];
  for (const r of recipes || []) { if (!r || !r.id || seen.has(r.id) || !(r.time > 0) || r.time > max) continue; seen.add(r.id); out.push(r); }
  return out.sort((a, b) => a.time - b.time || a.name.localeCompare(b.name));
}
