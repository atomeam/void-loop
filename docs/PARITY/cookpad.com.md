# cookpad.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: cookpad.com (https://cookpad.com/)
- Verse: /recipes/?q=pancakes (recipes: cookpad.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Save, Publish &amp; Share Recipes with Home Cooks Worldwide - Cookpad"
- History: [docs/HISTORY/cookpad.com.md](../HISTORY/cookpad.com.md)

**Match: 50%**: 13 have, 1 partial, 0 missing, 13 unreviewed, of 27 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search recipes by name | Find | have | its live page (2026-10-28): "create recipes, send cooksnaps and more Search Search Premium Top Cooksnapped Recipes Top Cooksnapped Recipes" | void-live-deploy/recipes/index.html:103 `p class="sub" id="sub">Search by name or by ingredient; every quantity scaled to your serv` |
| Search by the ingredients you have | Find | have | its live page (2026-10-28): "kpad Cookpad Search Search by recipe or ingredients Get the App Halloween Halloween Search by recipe or ingred" | void-live-deploy/recipes/index.html:103 `b" id="sub">Search by name or by ingredient; every quantity scaled to your servings, one s` |
| Browse by course, cuisine and occasion | Find | have | its live page (2026-10-28): "okpad Apron 2026 Challenge Quick & Easy DINNERS Stew Slow Cooker Main Dishes Popular Ingredients Updated Febru" | void-live-deploy/recipes/index.html:123 `"false" aria-controls="browse">Browse</button>` |
| Diet and allergy filters | Find | have | its live page (2026-10-28): "s rajma banana bread eggplant mushrooms gluten-free chocolate chip cookies no nuts breakfast gluten-free choco" | void-live-deploy/recipes/index.html:147 `filtH" style="margin:0 0 4px">Diet and allergies</h2>` |
| Save recipes | Keep | have | its live page (2026-10-28): "Save, Publish & Share Recipes with Home Cooks Worldwide - Cookpad Cookpad Cookpad Guest Register or Log In Sa" | void-live-deploy/recipes/index.html:119 `lse" aria-controls="savedPane">Saved</button>` |
| Print a recipe | Cooking | have | every site of this kind offers it | void-live-deploy/recipes/index.html:190 `utton type="button" id="print">Print</button>` |
| Recipe videos | Cooking | have | its live page (2026-10-28): "-event-logger#log:once" data-visibility-watch-intersection-threshold-value="0.5" data-dom-event-logger-url-val" | void-live-deploy/recipes/index.html:289 `rom.append(' · ', a); } if (r.video) { const a = el('a', '', W.video); a.href = r.video; a` |
| Readers share photos of what they cooked | Community | have | studied by hand: cookpad.com offers this (https://cookpad.com/) | void-live-deploy/recipes/index.html:129 `n type="button" id="impPhoto">From a photo</button></div>` |
| Post your own recipes | Community | have | studied by hand: cookpad.com offers this (https://cookpad.com/) | void-live-deploy/recipes/index.html:213 `<h2 id="mineH" hidden>My recipes</h2>` |
| Cooking guides and articles | Content | have | its live page (2026-10-28): "eedback Blog Terms of Service Community Guidelines Privacy Policy Frequently Asked Questions facebook instagra" | void-live-deploy/recipes/index.html:224 `S supermarket prices, a rough guide). Diets and allergies (vegetarian, vegan, gluten-free,` |
| A newsletter | Content | have | its live page (2026-10-28): "their recipes and cooking experiences. Subscribe to Premium for exclusive features & benefits! Cookpad Commun" | void-live-deploy/lib/calendar.js:321 `subscribe: 'Abonnieren', feedPh: 'Adresse eines Kalenders (https:// oder webcal://)',` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "okpad Cookpad Cookpad Guest Register or Log In Save and create recipes, send cooksnaps and more Search Search" | void-live-deploy/recipes/index.html:257 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; } catch (_) {}` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "tagram_post pinterest youtube flipboard Download our app Open Cookpad App on Google Play Open Cookpad App on A" | void-live-deploy/recipes/index.html:548 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "Save, Publish & Share Recipes with Home Cooks Worldwide - Cookpad Cookpad Cookpad Guest Register or Log In Sa" | void-live-deploy/recipes/index.html:189 `cipe, its servings and units">Share link</button>` |
| Top Cooksnapped Recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Top Viewed Recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Cookpad | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Halloween | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇺🇸 United States | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇬🇧 United Kingdom | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇪🇸 España | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇦🇷 Argentina | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇺🇾 Uruguay | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇲🇽 México | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇨🇱 Chile | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🇻🇳 Việt Nam | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
