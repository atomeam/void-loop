/**
 * recipe skill — a recipe with ingredients and steps, from TheMealDB (no key)
 * Contract: { name, examples, nearMisses, match(lower, text), run(text, api) }
 * "recipe for pancakes", "pancake recipe", "recipes with chicken".
 */
import { bandMini } from '../lib/card-mini.js';
import { swapAsk } from './swaps.js'; // "how to make buttermilk" is a pantry swap, not a dish
// what "make" and "cook" take that is not food ("how do i make money", "what can i make with my time")
const NOT_FOOD = /\b(money|friends?|website|site|app|apps|game|games|video|account|living|difference|decisions?|choices?|sense|it|this|that|me|you|him|her|them|music|songs?|beats?|bots?|server|robot|mods?|slime|portal|potions?|paper|origami|time|love|plans?|lists?|calls?|payments?|changes?|progress|mistakes?|noise|space|room|tea\s+party|fire|soap|candles?)\b/i;
export function dishOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  let m = t.match(/^(?:(?:give|show|find)\s+me\s+)?(?:a\s+)?recipes?\s+(?:for|of)\s+(.{2,40})$/i) || t.match(/^(?:a\s+)?(.{2,40}?)\s+recipes?$/i);
  if (m) return { dish: m[1].replace(/^(?:a|an|some|the)\s+/i, '').trim(), by: 'name' };
  // "how do i make guacamole", "how to cook rice", "how to bake banana bread"; not money, friends, a website…
  m = t.match(/^(?:how\s+(?:do\s+(?:i|you)|to|can\s+i|should\s+i)|best\s+way\s+to)\s+(?:make|cook|bake|prepare)\s+(?:a\s+|an\s+|some\s+|the\s+)?([a-z][a-z' -]{1,30})$/i);
  if (m && !NOT_FOOD.test(m[1])) return { dish: m[1].trim(), by: 'name' };
  m = t.match(/^(?:recipes?|what\s+can\s+i\s+(?:make|cook))\s+with\s+(.{2,30})$/i);
  if (m && !NOT_FOOD.test(m[1])) return { dish: m[1].trim(), by: 'ingredient' };
  return null;
}
/** "chicken and rice", "eggs, cheese" -> the ingredients, at most 3 (TheMealDB filters by one at a time). Pure. */
export function ingredientsOf(dish) {
  return String(dish || '').split(/\s*(?:,|&|\+|\band\b|\bor\b)\s*/i).map((x) => x.replace(/^(?:some|a|an|the|leftover)\s+/i, '').trim()).filter(Boolean).slice(0, 3);
}
/** the meals that every list holds (by idMeal), in the first list's order. Pure. */
export function mealsInAll(lists) {
  if (!lists.length) return [];
  const rest = lists.slice(1).map((l) => new Set(l.map((m) => m.idMeal)));
  return lists[0].filter((m) => rest.every((ids) => ids.has(m.idMeal)));
}

async function run(text, api) {
  const { showPage, esc } = api;
  const q = dishOf(text);
  if (!q) return 'none';
  const el = showPage((p) => { p.innerHTML = '<h2>' + esc(q.dish) + '</h2><div class="sub">…</div>'; });
  const src = (id) => '<div class="src">Source: <a href="https://www.themealdb.com/meal/' + encodeURIComponent(id || '') + '" target="_blank" rel="noopener">TheMealDB</a></div>';
  try {
    const base = 'https://www.themealdb.com/api/json/v1/1/';
    const one = (s) => s.replace(/(ies)$/i, 'y').replace(/([^s])s$/i, '$1');
    let j, only = '';
    if (q.by === 'ingredient') {
      // "what can i make with chicken and rice": one list for each ingredient, then the meals in all of them (2026-10-30: the whole
      // phrase went to the filter as one ingredient, and it found none). When none has all, the list for the first one that has meals,
      // and the card says which ingredient it is.
      const parts = ingredientsOf(q.dish);
      const lists = await Promise.all(parts.map((p) => fetch(base + 'filter.php?i=' + encodeURIComponent(p.replace(/\s+/g, '_'))).then((r) => r.json()).then((x) => (x && x.meals) || [])));
      const all = mealsInAll(lists), first = lists.findIndex((l) => l.length);
      if (!all.length && parts.length > 1 && first >= 0) only = parts[first];
      j = { meals: all.length ? all : first >= 0 && only ? lists[first] : null };
    } else {
      j = await fetch(base + 'search.php?s=' + encodeURIComponent(q.dish)).then((r) => r.json());
      if ((!j || !j.meals) && one(q.dish) !== q.dish) j = await fetch(base + 'search.php?s=' + encodeURIComponent(one(q.dish))).then((r) => r.json());
    }
    if (!api._pageStill(el)) return 'recipe';
    const meals = (j && j.meals) || [];
    if (!meals.length) { el.innerHTML = '<h2>' + esc(q.dish) + '</h2><p>I don\'t have a recipe for “' + esc(q.dish) + '” yet. I\'ve noted it, so I can learn it.</p>'; return 'none'; }
    if (q.by === 'ingredient') {
      el.innerHTML = '<h2>With ' + esc(only || q.dish) + '</h2>' + (only ? '<div class="sub">No recipe here has all of ' + esc(q.dish) + '. These have ' + esc(only) + '.</div>' : '') + '<ul class="choices">' + meals.slice(0, 8).map((m) => '<li><a href="#" data-ask="' + esc('recipe for ' + m.strMeal) + '">' + esc(m.strMeal) + '</a></li>').join('') + '</ul>' + src('');
      return 'recipe';
    }
    const m = meals[0];
    const ing = []; for (let i = 1; i <= 20; i++) { const n = (m['strIngredient' + i] || '').trim(); if (n) ing.push(((m['strMeasure' + i] || '').trim() + ' ' + n).trim()); }
    const steps = String(m.strInstructions || '').split(/\r?\n+/).map((s) => s.replace(/^\s*(step\s*)?\d+[.):]?\s*/i, '').trim()).filter((s) => s.length > 3).slice(0, 12);
    el.innerHTML = '<h2>' + esc(m.strMeal) + '</h2><div class="sub">' + esc([m.strArea, m.strCategory].filter(Boolean).join(' · ')) + '</div>'
      + (m.strMealThumb ? '<img alt="" src="' + esc(m.strMealThumb) + '/preview">' : '')
      + '<div class="sub" style="margin-top:8px">Ingredients</div><ul>' + ing.map((x) => '<li>' + esc(x) + '</li>').join('') + '</ul>'
      + '<div class="sub">Steps</div><ol>' + steps.map((x) => '<li style="margin:3px 0">' + esc(x) + '</li>').join('') + '</ol>' + src(m.idMeal);
    bandMini(api, el, 'pot', { dish: m.strMeal, n: ing.length }, '3D pot on a cutting board with the recipe card for ' + m.strMeal); // owner, 2026-10-25: "3d figure if possible"
    return 'recipe';
  } catch (_) {
    if (!api._pageStill(el)) return 'none';
    el.innerHTML = '<h2>' + esc(q.dish) + '</h2><p>The recipe service didn\'t answer just now. Ask again in a moment.</p>';
    return 'none';
  }
}
export default {
  name: 'recipe',
  examples: ['recipe for pancakes', 'lasagna recipe', 'recipes with chicken', 'how do i make guacamole', 'best way to make pasta carbonara'],
  nearMisses: ['recipe for disaster meaning', 'what is a recipe', 'who invented pizza', 'how do i make money', 'how to make friends'],
  // a question about recipes ("what is a recipe") is not a request for one
  match(lower, text) { return !!dishOf(text) && !swapAsk(text) && !/\bdisaster\b|\bsuccess\b/i.test(text) && !/^(?:what(?!\s+can\s+i\s+(?:make|cook)\s+with\b)|who|why|when|where|is|are|define|meaning)\b/i.test(String(text).trim()); },
  run
};
