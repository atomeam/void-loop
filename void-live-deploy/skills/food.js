/**
 * food skill - what's in a common food: "calories in a banana", "how much protein in an egg", "sugar in a can of coke",
 * "carbs in rice", "nutrition facts for oatmeal", "calories in half an avocado", "protein in 2 eggs".
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * A built-in table of USDA FoodData Central (SR Legacy) values for one usual serving, so the answer is instant and sourced.
 * A food not in the table ("calories in a big mac") is left to the answer and article skills; daily needs ("how many
 * calories should i eat") are nutrition's; burns, BMI and "calories in a pound of fat" are calc's.
 */
const SRC = '<a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener">USDA FoodData Central</a> (SR Legacy)';
// one usual serving: grams, kcal, then grams of protein, carbs (sugar and fiber are part of the carbs), fat; each: it is
// counted one by one ("2 eggs"), so a number in the ask multiplies it
export const FOODS = [
  { name: 'banana', re: 'bananas?', serving: '1 medium', g: 118, kcal: 105, protein: 1.3, carbs: 27, sugar: 14.4, fat: 0.4, fiber: 3.1, each: true },
  { name: 'apple', re: 'apples?', serving: '1 medium', g: 182, kcal: 95, protein: 0.5, carbs: 25, sugar: 19, fat: 0.3, fiber: 4.4, each: true },
  { name: 'orange', re: 'oranges?', serving: '1 medium', g: 131, kcal: 62, protein: 1.2, carbs: 15.4, sugar: 12.2, fat: 0.2, fiber: 3.1, each: true },
  { name: 'avocado', re: 'avocados?', serving: '1 whole', g: 201, kcal: 322, protein: 4, carbs: 17.1, sugar: 1.3, fat: 29.5, fiber: 13.5, each: true },
  { name: 'egg', re: '(?:large\\s+|hard[- ]boiled\\s+|boiled\\s+)?eggs?', serving: '1 large', g: 50, kcal: 72, protein: 6.3, carbs: 0.4, sugar: 0.2, fat: 4.8, fiber: 0, each: true },
  { name: 'carrot', re: 'carrots?', serving: '1 medium', g: 61, kcal: 25, protein: 0.6, carbs: 5.8, sugar: 2.9, fat: 0.1, fiber: 1.7, each: true },
  { name: 'potato', re: '(?:baked\\s+)?potato(?:es)?', serving: '1 medium, baked with skin', g: 173, kcal: 161, protein: 4.3, carbs: 36.6, sugar: 2, fat: 0.2, fiber: 3.8, each: true },
  { name: 'sweet potato', re: '(?:baked\\s+)?sweet\\s+potato(?:es)?', serving: '1 medium, baked', g: 114, kcal: 103, protein: 2.3, carbs: 23.6, sugar: 7.4, fat: 0.2, fiber: 3.8, each: true },
  { name: 'white rice', re: '(?:white\\s+|cooked\\s+)?rice', serving: '1 cup, cooked', g: 158, kcal: 205, protein: 4.3, carbs: 44.5, sugar: 0.1, fat: 0.4, fiber: 0.6 },
  { name: 'brown rice', re: 'brown\\s+rice', serving: '1 cup, cooked', g: 195, kcal: 218, protein: 4.5, carbs: 45.8, sugar: 0.7, fat: 1.6, fiber: 3.5 },
  { name: 'pasta', re: '(?:cooked\\s+)?(?:pasta|spaghetti|noodles)', serving: '1 cup, cooked', g: 140, kcal: 221, protein: 8.1, carbs: 43.2, sugar: 0.8, fat: 1.3, fiber: 2.5 },
  { name: 'oatmeal', re: '(?:oatmeal|oats|porridge)', serving: '1 cup, cooked with water', g: 234, kcal: 166, protein: 5.9, carbs: 28.1, sugar: 0.6, fat: 3.6, fiber: 4 },
  { name: 'white bread', re: '(?:white\\s+)?bread', serving: '1 slice', g: 25, kcal: 67, protein: 1.9, carbs: 12.7, sugar: 1.4, fat: 0.8, fiber: 0.6, each: true },
  { name: 'whole wheat bread', re: '(?:whole\\s+wheat|wholemeal|whole\\s+grain|brown)\\s+bread', serving: '1 slice', g: 32, kcal: 81, protein: 4, carbs: 13.8, sugar: 1.4, fat: 1.1, fiber: 1.9, each: true },
  { name: 'chicken breast', re: '(?:grilled\\s+|cooked\\s+)?chicken(?:\\s+breasts?)?', serving: '3 oz, cooked, no skin', g: 85, kcal: 140, protein: 26.4, carbs: 0, sugar: 0, fat: 3, fiber: 0 },
  { name: 'salmon', re: '(?:cooked\\s+)?salmon', serving: '3 oz, cooked (farmed Atlantic)', g: 85, kcal: 175, protein: 18.8, carbs: 0, sugar: 0, fat: 10.5, fiber: 0 },
  { name: 'ground beef', re: '(?:ground|minced)\\s+beef|(?:beef\\s+)?mince|hamburger\\s+patty|beef\\s+patty', serving: '3 oz, cooked (85% lean)', g: 85, kcal: 213, protein: 21.6, carbs: 0, sugar: 0, fat: 13.2, fiber: 0 },
  { name: 'tuna', re: '(?:canned\\s+)?tuna', serving: '1 can, light in water, drained', g: 165, kcal: 191, protein: 42.1, carbs: 0, sugar: 0, fat: 1.3, fiber: 0, each: true },
  { name: 'bacon', re: 'bacon(?:\\s+strips?)?', serving: '1 slice, cooked', g: 8, kcal: 43, protein: 3, carbs: 0.1, sugar: 0, fat: 3.3, fiber: 0, each: true },
  { name: 'whole milk', re: '(?:whole\\s+)?milk', serving: '1 cup', g: 244, kcal: 149, protein: 7.7, carbs: 12, sugar: 12, fat: 7.9, fiber: 0, each: true },
  { name: 'skim milk', re: '(?:skim(?:med)?|non-?fat|fat-?free)\\s+milk', serving: '1 cup', g: 245, kcal: 83, protein: 8.3, carbs: 12, sugar: 12, fat: 0.2, fiber: 0, each: true },
  { name: 'cheddar', re: '(?:cheddar(?:\\s+cheese)?|cheese)', serving: '1 oz', g: 28, kcal: 113, protein: 7, carbs: 0.4, sugar: 0.1, fat: 9.3, fiber: 0 },
  { name: 'greek yogurt', re: '(?:plain\\s+)?greek\\s+yog(?:h)?urt', serving: '1 container (170 g), plain nonfat', g: 170, kcal: 100, protein: 17.3, carbs: 6.1, sugar: 5.5, fat: 0.7, fiber: 0, each: true },
  { name: 'butter', re: 'butter', serving: '1 tbsp', g: 14, kcal: 102, protein: 0.1, carbs: 0, sugar: 0, fat: 11.5, fiber: 0 },
  { name: 'olive oil', re: 'olive\\s+oil', serving: '1 tbsp', g: 13.5, kcal: 119, protein: 0, carbs: 0, sugar: 0, fat: 13.5, fiber: 0 },
  { name: 'peanut butter', re: 'peanut\\s+butter', serving: '2 tbsp', g: 32, kcal: 191, protein: 7.1, carbs: 7.1, sugar: 3.4, fat: 16.4, fiber: 1.6 },
  { name: 'almonds', re: 'almonds?', serving: '1 oz (about 23 almonds)', g: 28, kcal: 164, protein: 6, carbs: 6.1, sugar: 1.2, fat: 14.2, fiber: 3.5 },
  { name: 'honey', re: 'honey', serving: '1 tbsp', g: 21, kcal: 64, protein: 0.1, carbs: 17.3, sugar: 17.2, fat: 0, fiber: 0 },
  { name: 'sugar', re: '(?:white\\s+|table\\s+)?sugar', serving: '1 tsp', g: 4.2, kcal: 16, protein: 0, carbs: 4.2, sugar: 4.2, fat: 0, fiber: 0 },
  { name: 'broccoli', re: 'broccoli', serving: '1 cup, chopped, raw', g: 91, kcal: 31, protein: 2.6, carbs: 6, sugar: 1.5, fat: 0.3, fiber: 2.4 },
  { name: 'cucumber', re: 'cucumbers?', serving: '1 cup, sliced', g: 104, kcal: 16, protein: 0.7, carbs: 3.8, sugar: 1.7, fat: 0.1, fiber: 0.5 },
  { name: 'strawberries', re: 'strawberr(?:y|ies)', serving: '1 cup, halves', g: 152, kcal: 49, protein: 1, carbs: 11.7, sugar: 7.4, fat: 0.5, fiber: 3 },
  { name: 'blueberries', re: 'blueberr(?:y|ies)', serving: '1 cup', g: 148, kcal: 84, protein: 1.1, carbs: 21.4, sugar: 14.7, fat: 0.5, fiber: 3.6 },
  { name: 'grapes', re: 'grapes?', serving: '1 cup', g: 151, kcal: 104, protein: 1.1, carbs: 27.3, sugar: 23.4, fat: 0.2, fiber: 1.4 },
  { name: 'watermelon', re: 'watermelon', serving: '1 cup, diced', g: 152, kcal: 46, protein: 0.9, carbs: 11.5, sugar: 9.4, fat: 0.2, fiber: 0.6 },
  { name: 'black beans', re: 'black\\s+beans', serving: '1 cup, cooked', g: 172, kcal: 227, protein: 15.2, carbs: 40.8, sugar: 0.6, fat: 0.9, fiber: 15 },
  { name: 'lentils', re: 'lentils?', serving: '1 cup, cooked', g: 198, kcal: 230, protein: 17.9, carbs: 39.9, sugar: 3.6, fat: 0.8, fiber: 15.6 },
  { name: 'cheese pizza', re: '(?:cheese\\s+)?pizza', serving: '1 slice (1/8 of a 14" pizza)', g: 107, kcal: 285, protein: 12.2, carbs: 35.7, sugar: 3.8, fat: 10.4, fiber: 2.5, each: true },
  { name: 'dark chocolate', re: 'dark\\s+chocolate', serving: '1 oz (70–85% cacao)', g: 28, kcal: 170, protein: 2.2, carbs: 13, sugar: 6.8, fat: 12.1, fiber: 3.1 },
  { name: 'popcorn', re: '(?:air[- ]popped\\s+)?popcorn', serving: '1 cup, air-popped', g: 8, kcal: 31, protein: 1, carbs: 6.2, sugar: 0.1, fat: 0.4, fiber: 1.2 },
  { name: 'orange juice', re: '(?:orange\\s+juice|oj)', serving: '1 cup', g: 248, kcal: 112, protein: 1.7, carbs: 25.8, sugar: 20.8, fat: 0.5, fiber: 0.5, each: true },
  { name: 'black coffee', re: '(?:black\\s+)?coffee', serving: '1 cup, brewed', g: 237, kcal: 2, protein: 0.3, carbs: 0, sugar: 0, fat: 0, fiber: 0, each: true },
  { name: 'cola', re: '(?:coke|coca[- ]?cola|cola|pepsi|soda|pop)', serving: '1 can (12 fl oz)', g: 368, kcal: 140, protein: 0, carbs: 39, sugar: 39, fat: 0, fiber: 0, each: true, src: 'a typical 12 fl oz cola can label and ' },
  { name: 'beer', re: '(?:regular\\s+)?beer', serving: '1 can or bottle (12 fl oz)', g: 356, kcal: 153, protein: 1.6, carbs: 12.6, sugar: 0, fat: 0, fiber: 0, alcohol: 13.9, each: true },
  { name: 'red wine', re: 'red\\s+wine|wine', serving: '1 glass (5 fl oz)', g: 147, kcal: 125, protein: 0.1, carbs: 3.8, sugar: 0.9, fat: 0, fiber: 0, alcohol: 15.6, each: true }
];
const WANT = { calories: 'kcal', calorie: 'kcal', kcal: 'kcal', protein: 'protein', carbs: 'carbs', carb: 'carbs', carbohydrates: 'carbs', sugar: 'sugar', sugars: 'sugar', fat: 'fat', fiber: 'fiber', fibre: 'fiber' };
const LABEL = { kcal: 'calories', protein: 'protein', carbs: 'carbs', sugar: 'sugar', fat: 'fat', fiber: 'fiber' };
const NUM = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
const CONTAINER = /^(?:can|glass|bottle|slice|piece|cup|bowl|serving|portion|tablespoon|tbsp|teaspoon|tsp|scoop|spoonful|strip)s?\s+of\s+/;

// "a can of coke" -> { food: cola, n: 1 }; "2 eggs" -> n 2; "half an avocado" -> n 0.5; unknown foods -> null
function foodOf(raw) {
  let s = raw.trim().replace(/^the\s+/, ''), n = 1, counted = false, m;
  if ((m = s.match(/^half\s+(?:of\s+)?(?:an?\s+)?/))) { n = 0.5; counted = true; s = s.slice(m[0].length); }
  else if ((m = s.match(/^(\d{1,2}|a|an|one|two|three|four|five|six)\s+/))) { n = NUM[m[1]] || +m[1]; counted = n !== 1; s = s.slice(m[0].length); }
  s = s.replace(CONTAINER, '').replace(/^(?:medium|large|small|whole|raw|fresh|plain)\s+/, '');
  if (!s || n <= 0 || n > 12) return null;
  const f = FOODS.find((x) => new RegExp('^(?:' + x.re + ')$').test(s));
  if (!f || (counted && !f.each)) return null; // "3 strawberries" against a cup-sized row would be wrong
  return { food: f, n };
}

export function foodAsk(text) {
  const t = String(text || '').toLowerCase().trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  if (!t || t.length > 90) return null;
  let m = t.match(/^(?:(?:how\s+many|how\s+much|what(?:'s|\s+is|\s+are)\s+(?:the\s+)?)\s*)?(?:grams?\s+of\s+|g\s+of\s+|amount\s+of\s+)?(calories|calorie|kcal|protein|carbs|carb|carbohydrates|sugars?|fat|fiber|fibre)\s+(?:are\s+|is\s+|does\s+)?(?:there\s+)?in\s+(.+)$/);
  if (m) { const f = foodOf(m[2]); return f ? { ...f, want: WANT[m[1]] } : null; }
  m = t.match(/^(?:nutrition(?:al)?\s+(?:facts|info(?:rmation)?|value)|macros)\s+(?:for|of|in)\s+(.+)$/);
  if (m) { const f = foodOf(m[1]); return f ? { ...f, want: '' } : null; }
  m = t.match(/^(.+?)\s+(calories|protein|carbs|nutrition(?:\s+facts)?|macros)$/);
  if (m) { const f = foodOf(m[1]); return f ? { ...f, want: WANT[m[2]] || '' } : null; }
  return null;
}

const amt = (x) => (Math.round(x * 10) / 10).toLocaleString('en-US');

function run(text, api) {
  const { showPage, esc } = api, a = foodAsk(text);
  if (!a) return 'none';
  const f = a.food, n = a.n, what = (n === 1 ? '' : n === 0.5 ? 'half of ' : n + ' × ') + f.serving + ' (' + amt(f.g * n) + ' g)';
  const rows = ['kcal', 'protein', 'carbs', 'sugar', 'fat', 'fiber'].map((k) => '<tr><td style="padding-right:24px">' + LABEL[k][0].toUpperCase() + LABEL[k].slice(1)
    + '</td><td style="text-align:right">' + amt(f[k] * n) + (k === 'kcal' ? '' : ' g') + '</td></tr>').join('');
  const big = a.want ? amt(f[a.want] * n) + (a.want === 'kcal' ? ' calories' : ' g ' + LABEL[a.want]) : amt(f.kcal * n) + ' calories';
  showPage((el) => {
    el.innerHTML = '<h2>' + esc(f.name[0].toUpperCase() + f.name.slice(1)) + '</h2><div class="sub">' + esc(what) + '</div>'
      + '<div style="font-size:44px;font-weight:300;line-height:1.15;margin:6px 0 8px">' + esc(big) + '</div>'
      + '<table style="border-collapse:collapse">' + rows + '</table>'
      + (f.alcohol ? '<p style="color:#8a8a8a">Most of its calories come from the alcohol (' + amt(f.alcohol * n) + ' g).</p>' : '')
      + '<p class="nu-next"><a href="#" data-ask="plan my meals">plan my meals</a> <span style="color:#8a8a8a">(the day\'s calories split into meals, on the stage)</span> \u00b7 <a href="#" data-ask="how many calories should i eat a day">how many calories a day</a></p>' // asked by Verse: food facts lead to a plan
      + '<div class="src">Typical values from ' + (f.src || '') + SRC + '; sizes and brands vary, so a label wins.</div>';
  });
  return 'food';
}

export default {
  name: 'food',
  examples: ['calories in a banana', 'how much protein in an egg', 'sugar in a can of coke', 'carbs in rice', 'nutrition facts for oatmeal', 'avocado calories', 'protein in 2 eggs'],
  nearMisses: ['how many calories should i eat a day', 'how much protein do i need', 'calories burned running', 'how many calories in a pound of fat', 'banana bread recipe', 'egg timer'],
  match(lower, text) { return !!foodAsk(text || lower); },
  run
};
