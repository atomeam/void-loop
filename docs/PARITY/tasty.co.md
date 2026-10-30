# tasty.co: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: tasty.co (https://tasty.co/)
- Verse: /recipes/?q=pancakes (recipes: tasty.co, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Tasty - Food videos and recipes"
- History: [docs/HISTORY/tasty.co.md](../HISTORY/tasty.co.md)

**Match: 58%**: 18 have, 0 partial, 0 missing, 13 unreviewed, of 31 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search recipes by name | Find | have | its live page (2026-10-28): "ram Link SMS Twitter YouTube WhatsApp X Search Clock Right Arrow Arrow Down Caret down Caret up Caret left Car" | void-live-deploy/recipes/index.html:103 `p class="sub" id="sub">Search by name or by ingredient; every quantity scaled to your serv` |
| Search by the ingredients you have | Find | have | its live page (2026-10-28): "Remix Weeknight Dinners Work Lunches 5 Ingredient Meals Holiday Cooking Right Now Breakfasts to Delight Lates" | void-live-deploy/recipes/index.html:103 `b" id="sub">Search by name or by ingredient; every quantity scaled to your servings, one s` |
| Browse by course, cuisine and occasion | Find | have | its live page (2026-10-28): "enu Popular Global Taco Remix Weeknight Dinners Work Lunches 5 Ingredient Meals Holiday Cooking Right Now Brea" | void-live-deploy/recipes/index.html:123 `"false" aria-controls="browse">Browse</button>` |
| Diet and allergy filters | Find | have | its live page (2026-10-28): "dients Chicken Pasta Salmon Potato Beef Diet Healthy Vegetarian Low Carb High Protein Vegan Meals Breakfast Lu" | void-live-deploy/recipes/index.html:147 `filtH" style="margin:0 0 4px">Diet and allergies</h2>` |
| Ratings and reviews | Community | have | its live page (2026-10-28): "&#x27;t Have To — Here&#x27;s My Honest Review Costco storefront and Carbone spicy vodka sauce jars stacked on" | void-live-deploy/recipes/index.html:198 `:14px;color:var(--soft)">Your rating</span><span class="stars" id="stars" role="group" ari` |
| Step-by-step cooking mode | Cooking | have | studied by hand: tasty.co offers this (https://tasty.co/) | void-live-deploy/recipes/index.html:204 `creen kept on, timers to tap">Step mode</button>` |
| Nutrition facts | Cooking | have | its live page (2026-10-28): "e Cake Mix, featuring dessert image and nutritional info 22 New And Returning Aldi Fall Finds I&#x27;m Grabbin" | void-live-deploy/recipes/index.html:144 `><button type="button" id="weekCal">Put the week on my calendar</button></div>` |
| Save recipes | Keep | have | its live page (2026-10-28): "As A Dietitian, These 20 Recipes Are My Favorite Way To Cook And Eat More Vegetables Without Overthinking It S" | void-live-deploy/recipes/index.html:119 `lse" aria-controls="savedPane">Saved</button>` |
| A shopping list | Keep | have | its live page (2026-10-28): "eech Audio on Replay Plus Minus Walmart Grocery Pickup Sad smiley face No results Swap More Your grocery bag S" | void-live-deploy/recipes/index.html:120 `lse" aria-controls="listPane">Shopping list</button>` |
| A meal plan | Keep | have | its live page (2026-10-28): "es Microwave Meals Food Processor Hacks Meal Plans Easy Meal Prep Family Dinners $40 A Week $50 A Week Close s" | void-live-deploy/recipes/index.html:122 `lse" aria-controls="planPane">Meal plan</button>` |
| Print a recipe | Cooking | have | its live page (2026-10-28): "pty) Your Cart Facebook Pinterest Email Print Sms Twitter Whatsapp Comment Tips Highlights Red X Green Check S" | void-live-deploy/recipes/index.html:190 `utton type="button" id="print">Print</button>` |
| Recipe videos | Cooking | have | its live page (2026-10-28): "Tasty - Food videos and recipes Opens in a new window Opens an external site in a new window Opens an externa" | void-live-deploy/recipes/index.html:289 `rom.append(' · ', a); } if (r.video) { const a = el('a', '', W.video); a.href = r.video; a` |
| Readers share photos of what they cooked | Community | have | its live page (2026-10-28): "finitely make this again👍🏼 &quot; tip photo for 3 Ingredient Peanut Butter Cookies 3 Ingredient Peanut Butte" | void-live-deploy/recipes/index.html:129 `n type="button" id="impPhoto">From a photo</button></div>` |
| Post your own recipes | Community | have | its live page (2026-10-28): "to navigate, press Enter to select and submit search query. Search for recipes Search Tasty Clear Search Your" | void-live-deploy/recipes/index.html:213 `<h2 id="mineH" hidden>My recipes</h2>` |
| Cooking guides and articles | Content | have | its live page (2026-10-28): "ty Vegan Espresso Donuts See all Latest Guides Latest Guides Halloween-themed cookie dough and candy variety p" | void-live-deploy/recipes/index.html:224 `S supermarket prices, a rough guide). Diets and allergies (vegetarian, vegan, gluten-free,` |
| A newsletter | Content | have | its live page (2026-10-28): ".co Home Recipes Tips & Tricks Products Newsletters Begin typing to search, use arrow keys to navigate, press" | void-live-deploy/lib/calendar.js:321 `subscribe: 'Abonnieren', feedPh: 'Adresse eines Kalenders (https:// oder webcal://)',` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "ooter Get the Tasty App Download on the App Store Get it on Google Play Get the Tasty Newsletter Email address" | void-live-deploy/recipes/index.html:548 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "to Tasty! Have a recipe of your own to share? Submit your recipe Close submenu Close tricks submenu Kitchen T" | void-live-deploy/recipes/index.html:189 `cipe, its servings and units">Share link</button>` |
| Global Taco Remix | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Work Lunches | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Holiday Cooking | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Latest Recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Plant-Based Meals | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Date Night | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Chicken | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Pasta | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Salmon | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Potato | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Beef | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Healthy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
