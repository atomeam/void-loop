// Recipe respect (owner, 2026-11-19: every recipe is very sensitive and respectful toward every animal and every vegetable; plants are met with
// care and gratitude). Verse's own words about food stay gentle, and a recipe that comes from somewhere else (TheMealDB, an import, one a visitor wrote)
// reads gently on Verse too. This is the shared part every recipe card and page reads: the same guide is a line of the charter (lib/charter.js), so
// Verse's own prompts follow it, and the quality guard judges tone (tools/recipe-tone.mjs). Nothing here changes what a step asks you to do: the
// quantities, times, temperatures and order are untouched, only the verb that sounds harsh becomes a gentle one that means the same thing in a kitchen.
// It never claims plants feel pain (they have no nerves or brain); it thanks them instead. Pure. Tests: tools/recipe-respect.test.mjs.

/** the guide in one plain paragraph: what a recipe written or shown by Verse does. The charter line and the tone judge both use it. */
export const GUIDE = 'Verse writes every recipe with care for the animals and the plants in it: gentle, accurate words for each step, a thank-you to the ingredients, nothing preachy, and no false science (plants get gratitude, never a claim that they feel pain).';

const cap = (from, to) => (/^[A-Z]/.test(from) ? to.charAt(0).toUpperCase() + to.slice(1) : to);
// [pattern, gentle words]: each pair says the same thing in a kitchen, so the step still reads right
const SOFTEN = [
  [/\bkill the (heat|flame|flames|fire|burner|stove|gas)\b/gi, (m, x) => cap(m, 'turn off the ' + x)],
  [/\b(?:chop|cut|twist|pull|snap) off (the|their|its|each|all the) (heads?)\b/gi, (m, x, h) => cap(m, 'take off ' + x + ' ' + h)],
  [/\b(?:chop|cut|twist|pull|snap) (the|their|its|each|all the) (heads?) off\b/gi, (m, x, h) => cap(m, 'take ' + x + ' ' + h + ' off')],
  [/\b(?:behead|decapitate)\b/gi, (m) => cap(m, 'take the head off')],
  [/\bbutcher(?:ing|ed)? (the|a|an|your|each|some|these|those) /gi, (m, x) => cap(m, 'cut up ' + x + ' ')],
  [/\bslaughter(?:ed)?\b/gi, (m) => cap(m, 'prepared')],
  [/\bstab (the|each|all the|a|your) /gi, (m, x) => cap(m, 'pierce ' + x + ' ')],
  [/\bpunch down\b/gi, (m) => cap(m, 'press down')],
  [/\bgut (the|each|all the|a|your) (fish|trout|mackerel|sardines?|herring|bass|sea bass|bream|fishes)\b/gi, (m, x, y) => cap(m, 'clean ' + x + ' ' + y)],
];
/** a step with its harsh verbs turned into gentle ones that mean the same in a kitchen. Same quantities, times and order. Pure; running it twice changes nothing more. */
export function gentler(step) {
  let t = String(step == null ? '' : step);
  for (const [re, to] of SOFTEN) t = t.replace(re, to);
  return t;
}

const ANIMAL = /\b(chicken|beef|pork|lamb|mutton|goat|turkey|duck|veal|venison|ham|bacon|sausages?|chorizo|pancetta|mince|steak|ribs?|brisket|fish|salmon|tuna|cod|haddock|trout|mackerel|sardines?|anchov(?:y|ies)|prawns?|shrimps?|crab|lobster|mussels?|clams?|oysters?|squid|octopus|scallops?|gelatine|lard|suet)\b/i;
const DAIRYEGG = /\b(eggs?|milk|butter|cream|cheese|yogh?urt|ghee|honey)\b/i;
/** what the recipe leans on: 'animal' (meat or fish), 'gentle-animal' (eggs, milk, honey), or 'plant'. Pure. */
export function kindOf(recipe) {
  const t = [recipe && recipe.name].concat((recipe && recipe.ingredients) || []).join(' ');
  return ANIMAL.test(t) ? 'animal' : DAIRYEGG.test(t) ? 'gentle-animal' : 'plant';
}
/** one short, warm line to end a recipe: thanks to what is in it, plain, not a sermon. The same recipe always gets the same line. Pure. */
export function thanksLine(recipe) {
  const k = kindOf(recipe), n = String((recipe && recipe.name) || '').length % 2;
  if (k === 'animal') return n ? 'Thank you to the animal, the plants and the people behind this meal. Use every part you can.' : 'A thank-you to the animal, the plants and the farmers behind this dish. Waste none of it.';
  if (k === 'gentle-animal') return n ? 'Thank you to the animals, the plants and the people who made this possible.' : 'A thank-you to the hens, cows, bees and growers behind these ingredients.';
  return n ? 'Thank you to the vegetables, herbs and growers in this dish. Use every bit, stems and peels in the stock pot.' : 'A thank-you to every vegetable and herb in this dish, and to the hands that grew them. Keep the scraps for stock.';
}
/** the recipe with its steps made gentle and its thank-you line added; the rest (name, quantities, times, order, step count) is untouched. Pure. */
export function gentleRecipe(recipe) {
  if (!recipe || typeof recipe !== 'object') return recipe;
  return { ...recipe, steps: (recipe.steps || []).map(gentler), thanks: recipe.thanks || thanksLine(recipe) };
}
