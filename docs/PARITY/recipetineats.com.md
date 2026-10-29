# recipetineats.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: recipetineats.com (https://www.recipetineats.com/)
- Verse: /recipes/?q=pancakes (recipes: recipetineats.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "RecipeTin Eats - A Food Blog Serving Up Quick &amp; Easy Dinner Recipes"
- History: [docs/HISTORY/recipetineats.com.md](../HISTORY/recipetineats.com.md)

**Match: 48%**: 12 have, 0 partial, 0 missing, 13 unreviewed, of 25 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search recipes by name | Find | have | its live page (2026-10-28): "st Prep, Big Flavours Main Menu Display Search Bar My RecipeTin Search Recipes... Search Recipes... Close × Ma" | void-live-deploy/recipes/index.html:103 `p class="sub" id="sub">Search by name or by ingredient; every quantity scaled to your serv` |
| Search by the ingredients you have | Find | have | its live page (2026-10-28): "nyone can make great food with everyday ingredients even if you&rsquo;re short on time and cost-conscious. Mor" | void-live-deploy/recipes/index.html:103 `b" id="sub">Search by name or by ingredient; every quantity scaled to your servings, one s` |
| Browse by course, cuisine and occasion | Find | have | its live page (2026-10-28): "s - A Food Blog Serving Up Quick & Easy Dinner Recipes RecipeTin Eats &raquo; Feed RecipeTin Eats &raquo; Comm" | void-live-deploy/recipes/index.html:123 `"false" aria-controls="browse">Browse</button>` |
| Diet and allergy filters | Find | have | its live page (2026-10-28): "n Mexican Middle Eastern South American Dietary Gluten Free Low Calorie Vegetarian Other Categories BBQ Breakf" | void-live-deploy/recipes/index.html:147 `filtH" style="margin:0 0 4px">Diet and allergies</h2>` |
| Ratings and reviews | Community | have | studied by hand: recipetineats.com offers this (https://www.recipetineats.com/) | void-live-deploy/recipes/index.html:198 `:14px;color:var(--soft)">Your rating</span><span class="stars" id="stars" role="group" ari` |
| Change the servings | Cooking | have | its live page (2026-10-28): "RecipeTin Eats - A Food Blog Serving Up Quick & Easy Dinner Recipes RecipeTin Eats &raquo; Feed RecipeTin Eat" | void-live-deploy/recipes/index.html:173 `button" id="more" aria-label="One serving more">+</button><span id="yield"></span></span>` |
| Metric and US units | Cooking | have | studied by hand: recipetineats.com offers this (https://www.recipetineats.com/) | void-live-deploy/recipes/index.html:186 `"uMetric" aria-pressed="false">Metric</button>` |
| Save recipes | Keep | have | its live page (2026-10-28): "Roasts Sandwiches &#038; Sliders Recipe collections Cookbook recipes My Food Bank About Me RecipeTin Meals My" | void-live-deploy/recipes/index.html:119 `lse" aria-controls="savedPane">Saved</button>` |
| Print a recipe | Cooking | have | every site of this kind offers it | void-live-deploy/recipes/index.html:190 `utton type="button" id="print">Print</button>` |
| Recipe videos | Cooking | have | its live page (2026-10-28): "out a bowl with wine or cocktails, and watch them disappear. Thanks for the recipe, Nigella! Get the Recipe C" | void-live-deploy/recipes/index.html:289 `rom.append(' · ', a); } if (r.video) { const a = el('a', '', W.video); a.href = r.video; a` |
| Readers share photos of what they cooked | Community | have | its live page (2026-10-28): "nner Puttanesca fish tray bake Close up photo of Hokkien noodles with chicken Quick Hokkien Noodles 5 minutes" | void-live-deploy/recipes/index.html:129 `n type="button" id="impPhoto">From a photo</button></div>` |
| A newsletter | Content | have | its live page (2026-10-28): "atest recipes (plus get 3 FREE eBooks)! Subscribe Easy dinner recipes Your weeknight dinner woes, solved! Quic" | void-live-deploy/lib/calendar.js:321 `subscribe: 'Abonnieren', feedPh: 'Adresse eines Kalenders (https:// oder webcal://)',` |
| Skip to primary navigation | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Skip to header navigation | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Skip to primary sidebar | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| RecipeTin Eats | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Main Menu | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| My RecipeTin | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| My cookbooks! | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Recipes By Category | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Iconic + cult classics | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Mains | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Chicken | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
