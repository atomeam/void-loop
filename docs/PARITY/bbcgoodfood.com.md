# bbcgoodfood.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: bbcgoodfood.com (https://www.bbcgoodfood.com/)
- Verse: /recipes/?q=pancakes (recipes: bbcgoodfood.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Good Food / Recipes and cooking tips / Good Food"
- History: [docs/HISTORY/bbcgoodfood.com.md](../HISTORY/bbcgoodfood.com.md)

**Match: 55%**: 16 have, 0 partial, 0 missing, 13 unreviewed, of 29 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search recipes by name | Find | have | its live page (2026-10-28): "ownload our app Newsletters Newsletters Search Recipes, guides and more... Clear molecules.formQueryCompletion" | void-live-deploy/recipes/index.html:103 `p class="sub" id="sub">Search by name or by ingredient; every quantity scaled to your serv` |
| Search by the ingredients you have | Find | have | its live page (2026-10-28): "t types Explore Explore Back to Recipes Ingredients Ingredients Cuisines Cuisines Chef recipes Chef recipes Ex" | void-live-deploy/recipes/index.html:103 `b" id="sub">Search by name or by ingredient; every quantity scaled to your servings, one s` |
| Browse by course, cuisine and occasion | Find | have | its live page (2026-10-28): "seroles Sausage casseroles Quick family dinners Quick family dinners Newsletter recipes Newsletter recipes Bac" | void-live-deploy/recipes/index.html:123 `"false" aria-controls="browse">Browse</button>` |
| Diet and allergy filters | Find | have | its live page (2026-10-28): "se all meal types Browse all meal types Diet type Diet type Back to Recipes Vegan Vegan Vegetarian Vegetarian" | void-live-deploy/recipes/index.html:147 `filtH" style="margin:0 0 4px">Diet and allergies</h2>` |
| Ratings and reviews | Community | have | its live page (2026-10-28): "e machines How we test How we test More reviews More reviews Back to What to buy Advent calendars Advent calen" | void-live-deploy/recipes/index.html:198 `:14px;color:var(--soft)">Your rating</span><span class="stars" id="stars" role="group" ari` |
| Change the servings | Cooking | have | its live page (2026-10-28): "rty ideas View Budget chicken recipes A serving of air fryer buffalo wings with ranch dressing Budget chicken" | void-live-deploy/recipes/index.html:173 `button" id="more" aria-label="One serving more">+</button><span id="yield"></span></span>` |
| Save recipes | Keep | have | its live page (2026-10-28): "ion promotional image Ad Popular recipe collections View Healthy Halloween recipes Healthy Halloween pizzas se" | void-live-deploy/recipes/index.html:119 `lse" aria-controls="savedPane">Saved</button>` |
| A shopping list | Keep | have | studied by hand: bbcgoodfood.com offers this (https://www.bbcgoodfood.com/) | void-live-deploy/recipes/index.html:120 `lse" aria-controls="listPane">Shopping list</button>` |
| A meal plan | Keep | have | its live page (2026-10-28): "Health Protein 101 Protein 101 Marathon meal plans Marathon meal plans Your health Your health Back to Health" | void-live-deploy/recipes/index.html:122 `lse" aria-controls="planPane">Meal plan</button>` |
| Print a recipe | Cooking | have | every site of this kind offers it | void-live-deploy/recipes/index.html:190 `utton type="button" id="print">Print</button>` |
| Recipe videos | Cooking | have | its live page (2026-10-28): "of 5. 67 ratings 15 mins Easy next item Videos Trending now Showing items 1 to 4 of 10 previous item View 20 H" | void-live-deploy/recipes/index.html:289 `rom.append(' · ', a); } if (r.video) { const a = el('a', '', W.video); a.href = r.video; a` |
| Readers share photos of what they cooked | Community | have | its live page (2026-10-28): "stive Good Food Show A man posing for a photo with a cocktail at the Festive Good Food Show Top reasons to go" | void-live-deploy/recipes/index.html:129 `n type="button" id="impPhoto">From a photo</button></div>` |
| Cooking guides and articles | Content | have | its live page (2026-10-28): "ests Drinks reviews Drinks reviews Gift guides Gift guides Budget Budget Back to Main menu Batch cooking Batch" | void-live-deploy/recipes/index.html:224 `S supermarket prices, a rough guide). Diets and allergies (vegetarian, vegan, gluten-free,` |
| A newsletter | Content | have | its live page (2026-10-28): "pup Good Food logo in black Quick links Subscribe Subscribe Sustainability Sustainability Good Food Shows Good" | void-live-deploy/lib/calendar.js:321 `subscribe: 'Abonnieren', feedPh: 'Adresse eines Kalenders (https:// oder webcal://)',` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "ability Good Food Shows Good Food Shows Download our app Download our app Newsletters Newsletters Good Food lo" | void-live-deploy/recipes/index.html:548 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "l Goldsmith cover Podcast Our food team shares tips, techniques and their all-time favourite recipes in our li" | void-live-deploy/recipes/index.html:189 `cipe, its servings and units">Share link</button>` |
| Sustainability | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Good Food Shows | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Halloween recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Pie recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sausage casseroles | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Cosy one-pot recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sign up today | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| WhatsApp feed | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Quick and easy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Everyday recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Family recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| One-pots | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
