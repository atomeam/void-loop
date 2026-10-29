# delish.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: delish.com (https://www.delish.com/)
- Verse: /recipes/?q=pancakes (recipes: delish.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Recipes, Party Food, Cooking Guides, Dinner Ideas - Delish.com"
- History: [docs/HISTORY/delish.com.md](../HISTORY/delish.com.md)

**Match: 48%**: 12 have, 1 partial, 0 missing, 13 unreviewed, of 26 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search recipes by name | Find | have | its live page (2026-10-28): "Subscribe Subscribe Open Sidepanel Menu Search What are you hungry for? Search Delish Logo Sign in Sign in Sig" | void-live-deploy/recipes/index.html:103 `p class="sub" id="sub">Search by name or by ingredient; every quantity scaled to your serv` |
| Browse by course, cuisine and occasion | Find | have | its live page (2026-10-28): "Recipes, Party Food, Cooking Guides, Dinner Ideas - Delish.com Sidebar Menu Close Sidepanel Close bookmarks M" | void-live-deploy/recipes/index.html:123 `"false" aria-controls="browse">Browse</button>` |
| Diet and allergy filters | Find | have | every site of this kind offers it | void-live-deploy/recipes/index.html:147 `filtH" style="margin:0 0 4px">Diet and allergies</h2>` |
| Ratings and reviews | Community | have | its live page (2026-10-28): "ispute resolution procedures ) and have reviewed the Privacy Notice This site is protected by reCAPTCHA and th" | void-live-deploy/recipes/index.html:198 `:14px;color:var(--soft)">Your rating</span><span class="stars" id="stars" role="group" ari` |
| Step-by-step cooking mode | Cooking | have | its live page (2026-10-28): "oy two of our classic recipes—featuring step-by-step instructions and in-depth tips—every month for free. cres" | void-live-deploy/recipes/index.html:204 `creen kept on, timers to tap">Step mode</button>` |
| Nutrition facts | Cooking | have | studied by hand: delish.com offers this (https://www.delish.com/) | void-live-deploy/recipes/index.html:144 `><button type="button" id="weekCal">Put the week on my calendar</button></div>` |
| Save recipes | Keep | have | its live page (2026-10-28): "28, 2026 at 5:12 PM 3 hours ago 45 mins Save recipe Cheesy baked beans with marinara sauce and fresh basil in" | void-live-deploy/recipes/index.html:119 `lse" aria-controls="savedPane">Saved</button>` |
| A shopping list | Keep | have | its live page (2026-10-28): "go is seen on the outside of one of its grocery I Tried Aldi’s New Under-$10 Sparkling Wines plain and peppero" | void-live-deploy/recipes/index.html:120 `lse" aria-controls="listPane">Shopping list</button>` |
| Print a recipe | Cooking | have | every site of this kind offers it | void-live-deploy/recipes/index.html:190 `utton type="button" id="print">Print</button>` |
| Recipe videos | Cooking | have | its live page (2026-10-28): "n Tips & Tools Kitchen Tips & Tools All Videos About Us About Us Newsletter Follow Follow do-not-sell-link Opt" | void-live-deploy/recipes/index.html:289 `rom.append(' · ', a); } if (r.video) { const a = el('a', '', W.video); a.href = r.video; a` |
| Cooking guides and articles | Content | have | its live page (2026-10-28): "Recipes, Party Food, Cooking Guides, Dinner Ideas - Delish.com Sidebar Menu Close Sidepanel Close bookmarks M" | void-live-deploy/recipes/index.html:224 `S supermarket prices, a rough guide). Diets and allergies (vegetarian, vegan, gluten-free,` |
| A newsletter | Content | have | its live page (2026-10-28): "se Sidepanel Close bookmarks My Recipes Subscribe Membership Benefits Membership Benefits Recipes Meals Meals" | void-live-deploy/lib/calendar.js:321 `subscribe: 'Abonnieren', feedPh: 'Adresse eines Kalenders (https:// oder webcal://)',` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "ewsletter Newsletter Sign Up Newsletter Sign in Sign in Sign in Sign in Subscribe Subscribe Open Sidepanel Men" | void-live-deploy/recipes/index.html:257 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; } catch (_) {}` |
| My Recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Membership Benefits | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Meals | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Holidays | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Food Trends | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| News | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Kitchen Tips & Tools | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Follow | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| OPEN | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Halloween Recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Occasions | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
