// Recipes (Versus' Allrecipes floor and its lane, /recipes/): the pure half, shared by the page and /api/recipes. A dozen classics are built in
// with their quantities, so "pancakes" answers at once and with the network cut; everything else comes from TheMealDB's free public catalogue
// (fromMeal() turns one of its records into the page's own shape). The maths a recipe page needs and the big sites do by hand or not at all:
// scale(): every quantity in a line (numbers, ½ ¼ ¾, mixed numbers, ranges) multiplied for a new number of servings; swapUnits(): cups, spoons,
// ounces, pounds, °F and inches into ml, g, °C and cm and back; timersIn(): the "for 10 minutes" in a step as a countdown to tap. Pure throughout.
// Tests: tools/recipes.test.mjs.

const VULGAR = { '¼': 1 / 4, '½': 1 / 2, '¾': 3 / 4, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 1 / 8, '⅜': 3 / 8, '⅝': 5 / 8, '⅞': 7 / 8 };
const FRACS = [[1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [3 / 8, '⅜'], [1 / 2, '½'], [5 / 8, '⅝'], [2 / 3, '⅔'], [3 / 4, '¾'], [7 / 8, '⅞']];
const VCH = '[¼½¾⅓⅔⅛⅜⅝⅞]';
// one quantity as people write it: 2, 1.5, 1,5, 1/2, 1 1/2, ½, 1½, 1 ½
const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?\s?${VCH}|${VCH}|\d+(?:[.,]\d+)?)`;
// a quantity or a range of two (2-3, 2 to 3, 2–3), not inside a word or another number
const QTY = new RegExp(String.raw`(?<![\w.,/#])(${NUM})(?:\s*(?:-|–|to)\s*(${NUM}))?(?!\s*(?:\/|[.,]\d))`, 'g');
// what a number is NOT a quantity of: a temperature, a percentage, a pan size, a step number
const NOT_QTY = /^\s*(?:°|º|degrees?\b|%|-?inch\b|"|″|cm\b|x\s?\d|×\s?\d|st\b|nd\b|rd\b|th\b)/i;

/** the number a written quantity means (1 ½ → 1.5, 1/2 → 0.5, 1,5 → 1.5); NaN when it is not one. Pure. */
export function numOf(s) {
  const t = String(s || '').trim(); if (!t) return NaN;
  let m = t.match(new RegExp(`^(\\d+(?:[.,]\\d+)?)?\\s?(${VCH})$`)); if (m) return (m[1] ? parseFloat(m[1].replace(',', '.')) : 0) + VULGAR[m[2]];
  m = t.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/); if (m) return +m[3] ? (m[1] ? +m[1] : 0) + +m[2] / +m[3] : NaN;
  m = t.match(/^\d+(?:[.,]\d+)?$/); if (m) return parseFloat(t.replace(',', '.'));
  return NaN;
}
/** a number written the way a recipe writes it: 2, 1 ½, ¾, 0.4; never 1.5000001. Pure. */
export function fmtQty(v) {
  if (!Number.isFinite(v) || v < 0) return ''; if (v === 0) return '0';
  const whole = Math.floor(v + 1e-9), frac = v - whole;
  if (frac < 0.03 || frac > 0.97) return String(Math.round(v));
  const near = FRACS.find(([f]) => Math.abs(f - frac) < 0.02);
  if (near) return (whole ? whole + ' ' : '') + near[1];
  const r = Math.round(v * 100) / 100; return String(r >= 10 ? Math.round(r * 10) / 10 : r);
}
/** a line with every quantity in it multiplied: "1 ½ cups flour (190 g)" × 2 is "3 cups flour (380 g)"; temperatures, pan sizes and
 *  percentages are left alone; a range scales both ends. Pure. */
export function scale(line, factor) {
  const f = +factor; if (!Number.isFinite(f) || f <= 0 || f === 1) return String(line || '');
  return String(line || '').replace(QTY, (whole, a, b, at, src) => {
    if (NOT_QTY.test(src.slice(at + whole.length))) return whole;
    const lo = numOf(a), hi = b ? numOf(b) : NaN; if (!Number.isFinite(lo)) return whole;
    return fmtQty(lo * f) + (Number.isFinite(hi) ? ' to ' + fmtQty(hi * f) : '');
  });
}

// units: what they are called and what one of them is in the other system
const US = [[/cups?|c\./i, 'ml', 240], [/tablespoons?|tbsps?\.?|tbl\./i, 'ml', 15], [/teaspoons?|tsps?\.?/i, 'ml', 5], [/fl\.?\s?oz\.?|fluid ounces?/i, 'ml', 29.57], [/ounces?|oz\.?/i, 'g', 28.35], [/pounds?|lbs?\.?/i, 'g', 453.6], [/inch(?:es)?|"|″/i, 'cm', 2.54], [/quarts?|qt\.?/i, 'ml', 946], [/pints?|pt\.?/i, 'ml', 473]];
const METRIC = [[/millilit(?:er|re)s?|ml/i, 'ml'], [/lit(?:er|re)s?|l/i, 'l'], [/kilograms?|kg/i, 'kg'], [/grams?|g/i, 'g'], [/centimet(?:er|re)s?|cm/i, 'cm']];
const alt = (list) => list.map(([re]) => re.source).join('|');
const UQ = (units) => new RegExp(String.raw`(?<![\w.,/#])(${NUM})(?:\s*(?:-|–|to)\s*(${NUM}))?\s?(${units})(?![a-zA-Z])`, 'g');
const US_RE = UQ(alt(US)), METRIC_RE = UQ(alt(METRIC)), TEMP = /(?<![\w.])(\d{2,3})\s?(?:°|º|degrees?\s?)\s?([FC])\b/g;
const PAREN_METRIC = /^\s*(?:about |around |approx\.? )?(\d[\d.,]*\s?(?:kg|g|ml|l))\s*(?:,\s*([^)]*))?$/i;
// a bracket that gives both, "(about 1 lb, 450 g)" or "(2 oz, 60 g)": in metric only the metric half is wanted
const PAREN_BOTH = new RegExp(String.raw`\((?:about |around |approx\.? )?${NUM}(?:\s*(?:-|–|to)\s*${NUM})?\s?(?:${alt(US)}),\s*(\d[\d.,]*\s?(?:kg|g|ml|l))\)`, 'gi');
const round5 = (v) => (v >= 20 ? Math.round(v / 5) * 5 : Math.round(v));
const dec1 = (v) => String(Math.round(v * 10) / 10);
const metricOf = (v, to, per) => { const x = v * per; if (to === 'g' && x >= 1000) return dec1(x / 1000) + ' kg'; if (to === 'ml' && x >= 1000) return dec1(x / 1000) + ' l'; return (to === 'cm' ? dec1(x) : String(round5(x))) + ' ' + to; };
const usOf = (v, unit) => {
  if (unit === 'ml') return v >= 60 ? fmtQty(v / 240) + ' cup' + (v / 240 > 1.03 ? 's' : '') : v >= 15 ? fmtQty(v / 15) + ' tbsp' : fmtQty(v / 5) + ' tsp';
  if (unit === 'l') return fmtQty(v * 4.167) + ' cups';
  if (unit === 'g') return v >= 454 ? dec1(v / 453.6) + ' lb' : dec1(v / 28.35) + ' oz';
  if (unit === 'kg') return dec1(v * 2.205) + ' lb';
  return dec1(v / 2.54) + ' inch';
};
/** a line in the other system: to 'metric', cups, spoons, ounces, pounds, °F and inches become ml, g, °C and cm (a line that already carries its
 *  metric weight in brackets, "1 ½ cups flour (190 g)", uses that: "190 g flour"); to 'us', the way back. Anything else is left as written. Pure. */
export function swapUnits(line, to = 'metric') {
  let s = String(line || '');
  if (to === 'metric') {
    const lead = s.match(new RegExp(String.raw`^(${NUM})(?:\s*(?:-|–|to)\s*(${NUM}))?\s?(?:${alt(US)})(?![a-zA-Z])\s+(.*?)\s*\(([^)]*)\)(.*)$`));
    if (lead && PAREN_METRIC.test(lead[4])) { const pm = lead[4].match(PAREN_METRIC); return pm[1] + ' ' + lead[3] + (pm[2] ? ' (' + pm[2] + ')' : '') + lead[5]; }
    s = s.replace(PAREN_BOTH, '($1)').replace(US_RE, (whole, a, b, u) => { const def = US.find(([re]) => new RegExp('^(?:' + re.source + ')$', 'i').test(u)); const lo = numOf(a), hi = b ? numOf(b) : NaN; if (!def || !Number.isFinite(lo)) return whole; return metricOf(lo, def[1], def[2]) + (Number.isFinite(hi) ? ' to ' + metricOf(hi, def[1], def[2]) : ''); });
    return s.replace(TEMP, (whole, d, u) => (u === 'F' ? round5((+d - 32) * 5 / 9) + '°C' : whole));
  }
  if (new RegExp(String.raw`^${NUM}(?:\s*(?:-|–|to)\s*${NUM})?\s?(?:${alt(US)})(?![a-zA-Z])`, 'i').test(s)) return s; // led by a US measure already: the bracketed weight stays as a hint
  s = s.replace(METRIC_RE, (whole, a, b, u) => { const def = METRIC.find(([re]) => new RegExp('^(?:' + re.source + ')$', 'i').test(u)); const lo = numOf(a), hi = b ? numOf(b) : NaN; if (!def || !Number.isFinite(lo)) return whole; return usOf(lo, def[1]) + (Number.isFinite(hi) ? ' to ' + usOf(hi, def[1]) : ''); });
  return s.replace(TEMP, (whole, d, u) => (u === 'C' ? round5(+d * 9 / 5 + 32) + '°F' : whole));
}

const TIME = new RegExp(String.raw`(?<![\w.,/])(${NUM})(?:\s*(?:-|–|to|or)\s*(${NUM}))?\s?(seconds?|secs?|minutes?|mins?|hours?|hrs?|h\b|min\b)(?![a-zA-Z])`, 'gi');
/** the times a step names ("for 10 minutes", "2 to 3 minutes", "1 ½ hours"), as countdowns: [{ label, seconds }], the lower end of a range,
 *  each once, at most 4. Pure. */
export function timersIn(step) {
  const out = [], seen = new Set();
  for (const m of String(step || '').matchAll(TIME)) {
    const lo = numOf(m[1]); if (!Number.isFinite(lo) || lo <= 0) continue;
    const per = /^h/i.test(m[3]) ? 3600 : /^s/i.test(m[3]) ? 1 : 60, secs = Math.round(lo * per); if (secs < 5 || secs > 24 * 3600 || seen.has(secs)) continue;
    seen.add(secs); out.push({ label: m[0].trim().replace(/\s+/g, ' '), seconds: secs }); if (out.length === 4) break;
  }
  return out;
}
/** seconds as a clock: 90 → 1:30, 3600 → 1:00:00. Pure. */
export const clock = (s) => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60; return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(x).padStart(2, '0'); };

/** a dozen classics with their quantities, so the page answers at once and offline; US measures with the metric weight in brackets where it
 *  matters (swapUnits uses it); every step that waits names its time (timersIn offers it). Servings as each is usually made. */
export const BUILT_IN = Object.freeze([
  { id: 'pancakes', name: 'Pancakes', aliases: ['pancake', 'hotcakes', 'flapjacks'], servings: 4, time: 20, tags: ['breakfast'],
    ingredients: ['1 ½ cups all-purpose flour (190 g)', '3 ½ teaspoons baking powder', '1 tablespoon sugar', '¼ teaspoon salt', '1 ¼ cups milk (300 ml)', '1 egg', '3 tablespoons butter, melted'],
    steps: ['Whisk the flour, baking powder, sugar and salt together in a large bowl.', 'Whisk the milk, egg and melted butter in a second bowl, pour it into the flour and stir until just combined; a few lumps are fine. Let the batter rest for 5 minutes.', 'Heat a lightly oiled pan over medium heat. Pour ¼ cup of batter for each pancake.', 'Cook for 2 minutes, until bubbles form on top and the edges look dry, then flip and cook for 1 to 2 minutes more, until golden.', 'Serve warm with butter and syrup.'] },
  { id: 'omelette', name: 'Omelette', aliases: ['omelet', 'cheese omelette', 'egg omelette'], servings: 1, time: 10, tags: ['breakfast', 'eggs'],
    ingredients: ['3 eggs', '2 tablespoons milk', '1 tablespoon butter', '¼ cup grated cheese (30 g)', 'a handful of chopped herbs or spinach (optional)', 'salt and pepper'],
    steps: ['Whisk the eggs with the milk, a pinch of salt and some pepper until no streaks remain.', 'Melt the butter in a nonstick pan over medium heat until it foams.', 'Pour in the eggs. After 30 seconds, push the set edges toward the middle and tilt the pan so the raw egg runs under; cook for 2 minutes, until nearly set.', 'Scatter the cheese and the herbs or spinach over one half, fold the other half over and cook for 30 seconds more.', 'Slide onto a plate and eat at once.'] },
  { id: 'tomato-pasta', name: 'Tomato pasta', aliases: ['spaghetti with tomato sauce', 'pasta with tomato sauce', 'spaghetti', 'pasta', 'marinara'], servings: 4, time: 25, tags: ['dinner', 'vegetarian'],
    ingredients: ['14 oz spaghetti (400 g)', '2 tablespoons olive oil', '3 cloves garlic, thinly sliced', '1 can crushed tomatoes (400 g)', '½ teaspoon salt', '¼ teaspoon chili flakes (optional)', 'a handful of basil leaves', 'grated parmesan, to serve'],
    steps: ['Bring a large pot of salted water to the boil and cook the spaghetti for 9 to 11 minutes, until just tender.', 'Meanwhile warm the olive oil in a wide pan over medium heat and cook the garlic for 1 minute, until fragrant but not brown.', 'Add the tomatoes, salt and chili flakes and simmer for 10 minutes, until slightly thickened.', 'Drain the pasta, keeping ½ cup of the cooking water. Toss the pasta with the sauce, loosening it with a splash of the water.', 'Tear the basil over the top and serve with parmesan.'] },
  { id: 'chicken-soup', name: 'Chicken noodle soup', aliases: ['chicken soup', 'chicken noodle', 'soup'], servings: 6, time: 60, tags: ['dinner', 'soup'],
    ingredients: ['1 tablespoon olive oil', '1 onion, diced', '2 carrots, diced', '2 celery stalks, diced', '2 cloves garlic, minced', '8 cups chicken stock (2 l)', '2 chicken breasts (about 1 lb, 450 g)', '1 bay leaf', '1 cup egg noodles (100 g)', '1 teaspoon salt', '½ teaspoon black pepper', '2 tablespoons chopped parsley'],
    steps: ['Warm the oil in a large pot over medium heat and cook the onion, carrots and celery for 5 minutes, until soft.', 'Add the garlic and cook for 1 minute.', 'Pour in the stock, add the chicken and bay leaf, bring to a simmer and cook for 20 minutes, until the chicken is cooked through.', 'Lift out the chicken, shred it with two forks and return it to the pot.', 'Add the noodles and simmer for 8 minutes, until tender.', 'Season with the salt and pepper, discard the bay leaf and stir in the parsley.'] },
  { id: 'guacamole', name: 'Guacamole', aliases: ['avocado dip', 'guac'], servings: 4, time: 10, tags: ['snack', 'vegan'],
    ingredients: ['3 ripe avocados', '1 lime, juiced', '½ small red onion, finely diced', '1 small tomato, diced', '1 jalapeño, minced (optional)', '2 tablespoons chopped coriander (cilantro)', '½ teaspoon salt'],
    steps: ['Halve the avocados, scoop the flesh into a bowl and mash it roughly with the lime juice.', 'Fold in the onion, tomato, jalapeño and coriander.', 'Season with the salt, taste, and add more lime or salt as you like.', 'Serve within 30 minutes, before it browns; a layer of lime juice on top keeps it green a little longer.'] },
  { id: 'rice', name: 'Steamed rice', aliases: ['rice', 'white rice', 'how to cook rice', 'boiled rice'], servings: 4, time: 30, tags: ['side', 'vegan'],
    ingredients: ['1 ½ cups long-grain white rice (300 g)', '2 ¼ cups water (540 ml)', '½ teaspoon salt', '1 teaspoon butter (optional)'],
    steps: ['Rinse the rice in a sieve under cold water until the water runs clear.', 'Bring the water and salt to the boil in a pot with a tight lid.', 'Add the rice, stir once, cover and turn the heat to its lowest. Cook for 15 minutes without lifting the lid.', 'Take the pot off the heat and let it stand, still covered, for 10 minutes.', 'Fluff with a fork, stirring in the butter if you like.'] },
  { id: 'oatmeal', name: 'Oatmeal', aliases: ['porridge', 'oats', 'rolled oats'], servings: 2, time: 10, tags: ['breakfast'],
    ingredients: ['1 cup rolled oats (90 g)', '2 cups milk or water (480 ml)', 'a pinch of salt', '1 tablespoon honey or maple syrup', '½ teaspoon cinnamon', '1 banana, sliced (optional)'],
    steps: ['Bring the milk and salt to a gentle simmer in a small pot.', 'Stir in the oats and cook for 5 minutes, stirring now and then, until thick and creamy.', 'Take it off the heat and let it stand for 1 minute.', 'Spoon into bowls and top with the honey, cinnamon and banana.'] },
  { id: 'grilled-cheese', name: 'Grilled cheese', aliases: ['grilled cheese sandwich', 'cheese toastie', 'toastie'], servings: 1, time: 10, tags: ['lunch', 'vegetarian'],
    ingredients: ['2 slices bread', '2 slices cheddar (2 oz, 60 g)', '1 tablespoon butter, softened'],
    steps: ['Butter one side of each slice of bread.', 'Put the cheese between the unbuttered sides.', 'Cook in a pan over medium-low heat for 3 minutes, until the underside is golden.', 'Flip and cook for 2 to 3 minutes more, until the cheese has melted.', 'Rest for 1 minute, then cut in half.'] },
  { id: 'vinaigrette', name: 'Salad dressing (vinaigrette)', aliases: ['salad dressing', 'vinaigrette', 'dressing', 'french dressing'], servings: 4, time: 5, tags: ['side', 'vegan'],
    ingredients: ['3 tablespoons olive oil', '1 tablespoon vinegar (red wine or balsamic)', '1 teaspoon Dijon mustard', '½ teaspoon honey or maple syrup', '¼ teaspoon salt', 'a pinch of black pepper'],
    steps: ['Whisk the vinegar, mustard, honey, salt and pepper in a small bowl.', 'Whisk in the oil a little at a time until the dressing is smooth and slightly creamy.', 'Taste on a leaf and adjust the salt or vinegar.', 'Keeps for 1 week in a jar in the fridge; shake before using.'] },
  { id: 'chocolate-chip-cookies', name: 'Chocolate chip cookies', aliases: ['cookies', 'choc chip cookies', 'chocolate cookies'], servings: 24, yield: 'cookies', time: 30, tags: ['baking', 'dessert'],
    ingredients: ['1 cup butter, softened (225 g)', '¾ cup sugar (150 g)', '¾ cup brown sugar (165 g)', '2 eggs', '1 teaspoon vanilla extract', '2 ¼ cups all-purpose flour (280 g)', '1 teaspoon baking soda', '½ teaspoon salt', '2 cups chocolate chips (340 g)'],
    steps: ['Heat the oven to 375°F and line two baking sheets with parchment.', 'Beat the butter with both sugars for 2 minutes, until pale and fluffy.', 'Beat in the eggs one at a time, then the vanilla.', 'Mix the flour, baking soda and salt and stir them in until no dry flour remains, then stir in the chocolate chips.', 'Drop tablespoon-sized balls of dough 2 inches apart on the sheets.', 'Bake for 9 to 11 minutes, until the edges are golden and the middles still look soft.', 'Cool on the sheet for 5 minutes before moving to a rack.'] },
  { id: 'lemonade', name: 'Lemonade', aliases: ['fresh lemonade', 'homemade lemonade'], servings: 6, time: 10, tags: ['drink', 'vegan'],
    ingredients: ['1 cup sugar (200 g)', '1 cup water, for the syrup (240 ml)', '1 cup fresh lemon juice (240 ml, 5 to 6 lemons)', '4 cups cold water (1 l)', 'ice', 'lemon slices, to serve'],
    steps: ['Heat the sugar with 1 cup of water in a small pot, stirring, for 3 minutes, until the sugar dissolves. Let the syrup cool.', 'Squeeze the lemons.', 'Stir the syrup, lemon juice and cold water together in a jug.', 'Chill for 30 minutes, then serve over ice with lemon slices.'] },
  { id: 'banana-bread', name: 'Banana bread', aliases: ['banana loaf', 'banana cake'], servings: 10, yield: 'slices', time: 70, tags: ['baking'],
    ingredients: ['3 ripe bananas, mashed', '⅓ cup butter, melted (75 g)', '¾ cup sugar (150 g)', '1 egg, beaten', '1 teaspoon vanilla extract', '1 teaspoon baking soda', 'a pinch of salt', '1 ½ cups all-purpose flour (190 g)'],
    steps: ['Heat the oven to 350°F and butter a 9x5-inch loaf pan.', 'Mix the mashed bananas with the melted butter in a large bowl.', 'Stir in the sugar, egg and vanilla.', 'Sprinkle over the baking soda and salt, then stir in the flour until just combined.', 'Pour into the pan and bake for 60 minutes, until a skewer pushed into the middle comes out clean.', 'Cool in the pan for 10 minutes, then turn out and slice.'] },
]);

const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
const STOP = /\b(?:recipe|recipes|for|a|an|the|how|to|make|do|i|cook|easy|simple|best|homemade|quick)\b/g;
/** the dish a search means: "recipe for pancakes", "how do I make pancakes", "easy pancake recipe" are all "pancake". Pure. */
export const dishOf = (q) => norm(q).replace(STOP, ' ').replace(/\s+/g, ' ').trim();
const single = (w) => (w.length > 4 && /ies$/.test(w) ? w.slice(0, -3) + 'y' : w.length > 4 && /(?:oes|ches|shes|sses)$/.test(w) ? w.slice(0, -2) : w.length > 3 && /s$/.test(w) && !/ss$/.test(w) ? w.slice(0, -1) : w);
/** the built-in recipes a name search means, best first; [] when none fits. Pure. */
export function find(q, list = BUILT_IN) {
  const d = dishOf(q); if (!d) return [];
  const words = d.split(' ').map(single), joined = words.join(' ');
  return list.map((r) => {
    const names = [r.name].concat(r.aliases || []).map((n) => norm(n).split(' ').map(single).join(' ')), id = r.id.replace(/-/g, ' ');
    let s = 0; if (names.includes(joined) || id === joined) s = 4; else if (names.some((n) => n.includes(joined) || joined.includes(n))) s = 2;
    else s = words.filter((w) => w.length > 2 && names.some((n) => n.split(' ').includes(w))).length ? 1 : 0;
    return [s, r];
  }).filter(([s]) => s > 0).sort((a, b) => b[0] - a[0]).map(([, r]) => r);
}
/** the ingredients a search names: "eggs, spinach and cheese" → ['eggs', 'spinach', 'cheese'], at most 5. Pure. */
export const ingredientsOf = (text) => String(text || '').split(/,|;|\band\b|\bwith\b|\+|&/i).map((s) => norm(s).replace(/\b(?:what|can|i|make|some|recipes?|using|only|have|got|from)\b/g, ' ').replace(/\s+/g, ' ').trim()).filter((s) => s.length > 1).slice(0, 5);
const hasWord = (line, w) => { const l = norm(line), v = [w, single(w), w + 's', w + 'es']; return v.some((x) => x.length > 2 && new RegExp('\\b' + x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b').test(l)); };
/** what can be made with what is in the fridge: [{ recipe, have, missing }] for every built-in recipe that uses at least one of the
 *  ingredients, the ones that use all of them first. Pure. */
export function byIngredients(text, list = BUILT_IN) {
  const want = ingredientsOf(text); if (!want.length) return [];
  return list.map((r) => { const have = want.filter((w) => r.ingredients.some((l) => hasWord(l, w))); return { recipe: r, have, missing: want.filter((w) => !have.includes(w)) }; })
    .filter((x) => x.have.length).sort((a, b) => b.have.length - a.have.length || a.recipe.ingredients.length - b.recipe.ingredients.length);
}

const clean = (s) => String(s || '').replace(/\s+/g, ' ').trim();
/** a TheMealDB record as the page's own recipe: its 20 measure+ingredient pairs as lines, its instructions as steps (numbered lines, or
 *  sentences when it is one paragraph), the photo, the source and video links; TheMealDB gives no servings, so 4 is assumed and said. Pure. */
export function fromMeal(m) {
  if (!m || !m.idMeal || !m.strMeal) return null;
  const ingredients = [];
  for (let i = 1; i <= 20; i++) { const n = clean(m['strIngredient' + i]), q = clean(m['strMeasure' + i]); if (n) ingredients.push((q && q !== '-' ? q + ' ' : '') + n); }
  let steps = String(m.strInstructions || '').replace(/\r/g, '').split(/\n+/).map((s) => s.replace(/^\s*(?:step\s*)?\d+\s*[.):-]?\s*/i, '').trim()).filter((s) => s.length > 2 && !/^step\s*\d+$/i.test(s));
  if (steps.length === 1 && steps[0].length > 220) steps = steps[0].split(/(?<=[.!?])\s+(?=[A-Z])/).reduce((acc, s) => { const last = acc[acc.length - 1]; if (last && (last + ' ' + s).length < 200) acc[acc.length - 1] = last + ' ' + s; else acc.push(s); return acc; }, []);
  return { id: 'mealdb-' + m.idMeal, name: clean(m.strMeal), servings: 4, servingsGuessed: true, time: 0, ingredients, steps, image: m.strMealThumb || '', source: /^https?:\/\//.test(m.strSource || '') ? m.strSource : '', video: /^https?:\/\//.test(m.strYoutube || '') ? m.strYoutube : '', area: clean(m.strArea), category: clean(m.strCategory), from: 'TheMealDB' };
}
// TheMealDB's own categories and cuisines (its list.php?c=list and ?a=list): browsing asks only for one of these, a closed list
export const CATEGORIES = Object.freeze(['Beef', 'Breakfast', 'Chicken', 'Dessert', 'Goat', 'Lamb', 'Miscellaneous', 'Pasta', 'Pork', 'Seafood', 'Side', 'Starter', 'Vegan', 'Vegetarian']);
export const AREAS = Object.freeze(['American', 'British', 'Canadian', 'Chinese', 'Croatian', 'Dutch', 'Egyptian', 'Filipino', 'French', 'Greek', 'Indian', 'Irish', 'Italian', 'Jamaican', 'Japanese', 'Kenyan', 'Malaysian', 'Mexican', 'Moroccan', 'Polish', 'Portuguese', 'Russian', 'Spanish', 'Thai', 'Tunisian', 'Turkish', 'Ukrainian', 'Vietnamese']);
/** the link that carries a recipe and its setting: ?q= or ?i= or ?id=, &servings= when changed, &units= when swapped. Pure. */
export function shareLink(origin, { q = '', i = '', id = '', servings = 0, base = 0, units = '' } = {}) {
  const p = new URLSearchParams();
  if (id) p.set('id', id); else if (i) p.set('i', i); else if (q) p.set('q', q);
  if (servings && servings !== base) p.set('servings', String(servings));
  if (units) p.set('units', units);
  const s = p.toString(); return String(origin || '') + '/recipes/' + (s ? '?' + s : '');
}
/** what the page says in the person's own language: English, or German for a German browser. Pure. */
export function wordsFor(lang) {
  const de = /^de\b/i.test(String(lang || ''));
  return de ? {
    title: 'Rezepte', sub: 'Nach Name oder nach Zutat suchen; die Mengen für jede Portionszahl umgerechnet, Schritt für Schritt kochen, Timer antippen, Cups in ml. Ein Dutzend Klassiker auch offline.',
    placeholder: 'Ein Gericht, oder Zutaten mit Komma', search: 'Suchen', byName: 'Nach Name', byIngredient: 'Nach Zutat', servings: 'Portionen', ingredients: 'Zutaten', steps: 'Zubereitung', step: 'Schritt', of: 'von',
    stepMode: 'Schritt-Modus', prev: 'Zurück', next: 'Weiter', done: 'Fertig', close: 'Schließen', copyList: 'Liste kopieren', copied: 'Kopiert', share: 'Link teilen', shared: 'Link kopiert', print: 'Drucken',
    metric: 'Metrisch', us: 'US', timer: 'Timer', start: 'Timer starten', stop: 'Timer stoppen', timeUp: 'Zeit ist um', minutes: 'Minuten', ready: 'Fertig in', builtIn: 'Eingebaut, auch offline', more: 'Mehr Rezepte',
    history: 'Verlauf', histEmpty: 'Die letzten 20 geöffneten Rezepte bleiben hier, auf diesem Gerät, und öffnen offline.', none: 'Kein Rezept dazu gefunden. Ein anderes Wort probieren, oder nach Zutat suchen.',
    offline: 'Offline: die eingebauten Rezepte und der Verlauf', have: 'passt zu', missing: 'fehlt', guessed: 'angenommen', source: 'Quelle', video: 'Video', wake: 'Der Bildschirm bleibt an, solange du kochst', shopping: 'Abhaken, was du schon hast; „Liste kopieren" nimmt den Rest.',
  } : {
    title: 'Recipes', sub: 'Search by name or by ingredient; every quantity scaled to your servings, one step at a time while you cook, timers to tap, cups to ml. A dozen classics work offline.',
    placeholder: 'A dish, or ingredients with commas', search: 'Search', byName: 'By name', byIngredient: 'By ingredient', servings: 'Servings', ingredients: 'Ingredients', steps: 'Steps', step: 'Step', of: 'of',
    stepMode: 'Step mode', prev: 'Previous', next: 'Next', done: 'Done', close: 'Close', copyList: 'Copy list', copied: 'Copied', share: 'Share link', shared: 'Link copied', print: 'Print',
    metric: 'Metric', us: 'US', timer: 'Timer', start: 'Start timer', stop: 'Stop timer', timeUp: 'Time is up', minutes: 'minutes', ready: 'Ready in', builtIn: 'Built in, works offline', more: 'More recipes',
    history: 'History', histEmpty: 'The last 20 recipes you opened stay here, on this device, and open offline.', none: 'No recipe found for that. Try another word, or search by ingredient.',
    offline: 'Offline: the built-in recipes and your history', have: 'uses', missing: 'missing', guessed: 'assumed', source: 'Source', video: 'Video', wake: 'The screen stays on while you cook', shopping: 'Tick what you already have; Copy list takes the rest.',
  };
}
