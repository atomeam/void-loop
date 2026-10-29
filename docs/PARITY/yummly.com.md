# yummly.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: yummly.com (https://www.yummly.com/)
- Verse: /recipes/?q=pancakes (recipes: yummly.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "All recipes / KitchenAid US"
- History: [docs/HISTORY/yummly.com.md](../HISTORY/yummly.com.md)

**Match: 53%**: 15 have, 1 partial, 0 missing, 13 unreviewed, of 29 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search recipes by name | Find | have | its live page (2026-10-28): "Accessibility menu Enable Accessibility search Kitchenaid logo with Trademark MAJOR APPLIANCES arrow COUNTERTO" | void-live-deploy/recipes/index.html:103 `p class="sub" id="sub">Search by name or by ingredient; every quantity scaled to your serv` |
| Search by the ingredients you have | Find | have | studied by hand: yummly.com offers this (https://www.yummly.com/) | void-live-deploy/recipes/index.html:103 `b" id="sub">Search by name or by ingredient; every quantity scaled to your servings, one s` |
| Browse by course, cuisine and occasion | Find | have | its live page (2026-10-28): "Fish Pasta Vegetarian Street Food Sides Desserts Breakfast / Brunch Drinks Difficulty Easy Intermediate Diffic" | void-live-deploy/recipes/index.html:123 `"false" aria-controls="browse">Browse</button>` |
| Diet and allergy filters | Find | have | its live page (2026-10-28): "Hot Maincourse Meat Poultry Fish Pasta Vegetarian Street Food Sides Desserts Breakfast / Brunch Drinks Diffic" | void-live-deploy/recipes/index.html:147 `filtH" style="margin:0 0 4px">Diet and allergies</h2>` |
| Ratings and reviews | Community | have | studied by hand: yummly.com offers this (https://www.yummly.com/) | void-live-deploy/recipes/index.html:198 `:14px;color:var(--soft)">Your rating</span><span class="stars" id="stars" role="group" ari` |
| Change the servings | Cooking | have | studied by hand: yummly.com offers this (https://www.yummly.com/) | void-live-deploy/recipes/index.html:173 `button" id="more" aria-label="One serving more">+</button><span id="yield"></span></span>` |
| Step-by-step cooking mode | Cooking | have | studied by hand: yummly.com offers this (https://www.yummly.com/) | void-live-deploy/recipes/index.html:204 `creen kept on, timers to tap">Step mode</button>` |
| Nutrition facts | Cooking | have | studied by hand: yummly.com offers this (https://www.yummly.com/) | void-live-deploy/recipes/index.html:144 `><button type="button" id="weekCal">Put the week on my calendar</button></div>` |
| Save recipes | Keep | have | its live page (2026-10-28): "g-icon Free shipping on orders $49.99+¹ Save icon Save icon Sign in and save more² kad-affirm-icon kad-affirm-" | void-live-deploy/recipes/index.html:119 `lse" aria-controls="savedPane">Saved</button>` |
| A shopping list | Keep | have | studied by hand: yummly.com offers this (https://www.yummly.com/) | void-live-deploy/recipes/index.html:120 `lse" aria-controls="listPane">Shopping list</button>` |
| A meal plan | Keep | have | studied by hand: yummly.com offers this (https://www.yummly.com/) | void-live-deploy/recipes/index.html:122 `lse" aria-controls="planPane">Meal plan</button>` |
| Keep a recipe from another site | Keep | have | studied by hand: yummly.com offers this (https://www.yummly.com/) | void-live-deploy/recipes/index.html:127 `"impH" style="margin:0 0 4px">Import a recipe</h2>` |
| Print a recipe | Cooking | have | every site of this kind offers it | void-live-deploy/recipes/index.html:190 `utton type="button" id="print">Print</button>` |
| Cooking guides and articles | Content | have | its live page (2026-10-28): "tachments Shop Now Explore Holiday Gift Guide Coffee & Espresso All Coffee Machines Fully Automatic Espresso M" | void-live-deploy/recipes/index.html:224 `S supermarket prices, a rough guide). Diets and allergies (vegetarian, vegan, gluten-free,` |
| A newsletter | Content | have | its live page (2026-10-28): "next purchase Enter your email address Subscribe now For more information about our privacy practices and a l" | void-live-deploy/lib/calendar.js:321 `subscribe: 'Abonnieren', feedPh: 'Adresse eines Kalenders (https:// oder webcal://)',` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "tart to make Product tips Recipe ideas Blog Inspiration Homemade French Onion Lasagna Class Explore the Kitche" | void-live-deploy/recipes/index.html:257 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; } catch (_) {}` |
| Enable Accessibility | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| COUNTERTOP APPLIANCES | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Your location: Not Determined | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Customer care | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Shop All Stand Mixers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Tilt Head | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Bowl-Lift | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Commercial | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| All accessories | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Attachments | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Bowls | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Parts | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
