// /recipes/'s stage card: the recipe open on the page, as an ask the stage's recipe skill reads back (skills/recipe.js dishOf), with the
// servings and the units the page shows. A built-in recipe goes by its name ("recipe for pancakes, built in, 8 servings, metric"), a
// TheMealDB one by its id ("recipe for teriyaki chicken casserole, themealdb 52772, us units"), so the card shows the same recipe the
// page does, not another one of the same name. A recipe the visitor wrote or imported gives '', so its text stays on the device and the
// example ask stays; so does a page with no recipe open. Pure: tools/toolkit.test.mjs.
import { BUILT_IN } from './recipes.js';

export const MAX_SERVINGS = 200; // the page's own limit (recipes/index.html setServ)
const NAME = /^[A-Za-z0-9][A-Za-z0-9 '&()-]{0,78}$/; // what the skill reads back as a name: no comma, so the options after it stay apart

/** the stage ask for recipe r at servings and units ('metric' or anything else for US measures), or ''. Pure. */
export function cardAsk(r, servings, units) {
  if (!r || typeof r.id !== 'string' || typeof r.name !== 'string') return '';
  const n = Math.round(+servings), base = r.servings;
  const sv = Number.isFinite(n) && n >= 1 && n <= MAX_SERVINGS && n !== base ? ', ' + n + ' servings' : '';
  const u = units === 'metric' ? ', metric' : ', us units';
  const b = BUILT_IN.find((x) => x.id === r.id);
  if (b && b.name === r.name) return NAME.test(b.name) ? 'recipe for ' + b.name.toLowerCase() + ', built in' + sv + u : '';
  const m = /^mealdb-(\d{1,8})$/.exec(r.id), name = r.name.replace(/\s+/g, ' ').trim();
  if (m && r.from === 'TheMealDB' && NAME.test(name)) return 'recipe for ' + name.toLowerCase() + ', themealdb ' + m[1] + sv + u;
  return '';
}
