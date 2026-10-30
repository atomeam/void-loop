# skinnytaste.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: skinnytaste.com (https://www.skinnytaste.com/)
- Verse: /recipes/?q=pancakes (recipes: skinnytaste.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Healthy Recipes Made with Real Food / Skinnytaste"
- History: [docs/HISTORY/skinnytaste.com.md](../HISTORY/skinnytaste.com.md)

**Match: 46%**: 11 have, 1 partial, 0 missing, 13 unreviewed, of 25 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search recipes by name | Find | have | its live page (2026-10-28): "; Stories Feed JSON RSD Skip to content Search... Search... Subscribe and get the latest recipes! Menu 3 Site" | void-live-deploy/recipes/index.html:103 `p class="sub" id="sub">Search by name or by ingredient; every quantity scaled to your serv` |
| Search by the ingredients you have | Find | have | its live page (2026-10-28): "gan Recipes Vegetarian Whole 30 By Main Ingredient Toggle By Main Ingredient submenu Toggle By Main Ingredient" | void-live-deploy/recipes/index.html:103 `b" id="sub">Search by name or by ingredient; every quantity scaled to your servings, one s` |
| Browse by course, cuisine and occasion | Find | have | its live page (2026-10-28): "le Course submenu Toggle Course submenu Breakfast Lunch Appetizers Dinner Salad Side Dishes Soup Dessert Drink" | void-live-deploy/recipes/index.html:123 `"false" aria-controls="browse">Browse</button>` |
| Diet and allergy filters | Find | have | its live page (2026-10-28): "es submenu Recipe Finder Category Index Diet Toggle Diet submenu Toggle Diet submenu High Fiber High Protein A" | void-live-deploy/recipes/index.html:147 `filtH" style="margin:0 0 4px">Diet and allergies</h2>` |
| Change the servings | Cooking | have | studied by hand: skinnytaste.com offers this (https://www.skinnytaste.com/) | void-live-deploy/recipes/index.html:173 `button" id="more" aria-label="One serving more">+</button><span id="yield"></span></span>` |
| Nutrition facts | Cooking | have | studied by hand: skinnytaste.com offers this (https://www.skinnytaste.com/) | void-live-deploy/recipes/index.html:144 `><button type="button" id="weekCal">Put the week on my calendar</button></div>` |
| Save recipes | Keep | have | its live page (2026-10-28): "arch Search Recipe Index Cookbook Index Saved Recipes Search... Search... Subscribe and get the latest recipes" | void-live-deploy/recipes/index.html:119 `lse" aria-controls="savedPane">Saved</button>` |
| A meal plan | Keep | have | its live page (2026-10-28): "oks submenu My Cookbooks Cookbook Index Meal Plans Header Widget 2 Sitewide Search input Search Search Recipe" | void-live-deploy/recipes/index.html:122 `lse" aria-controls="planPane">Meal plan</button>` |
| Print a recipe | Cooking | have | every site of this kind offers it | void-live-deploy/recipes/index.html:190 `utton type="button" id="print">Print</button>` |
| Recipe videos | Cooking | have | its live page (2026-10-28): "r High Protein Anti Inflammatory Weight Watchers Dairy Free Recipes Gluten Free Low Carb Low Sodium Vegan Reci" | void-live-deploy/recipes/index.html:289 `rom.append(' · ', a); } if (r.video) { const a = el('a', '', W.video); a.href = r.video; a` |
| A newsletter | Content | have | its live page (2026-10-28): "RSD Skip to content Search... Search... Subscribe and get the latest recipes! Menu 3 Site Navigation About Gin" | void-live-deploy/lib/calendar.js:321 `subscribe: 'Abonnieren', feedPh: 'Adresse eines Kalenders (https:// oder webcal://)',` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "nu Toggle Skinnytaste Community submenu Login About Contact Book Tour My Shop Header Widget 1 Twitter Facebook" | void-live-deploy/recipes/index.html:257 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; } catch (_) {}` |
| Book Tour | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| My Shop | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Recipe Index | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Cookbook Index | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Recipe Finder | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Category Index | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Skinnytaste Community | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| My Cookbooks | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Maple Dijon Sheet Pan Chicken | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Crockpot Turkey Chili (Kid-Friendly!) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Southwest Stuffed Sweet Potatoes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Turkey Burgers with Apples and Gruyère | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
