# Allrecipes: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: Allrecipes (https://www.allrecipes.com/)
- Verse: /recipes/?q=pancakes (recipes, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 402
- History: [docs/HISTORY/allrecipes.md](../HISTORY/allrecipes.md)

**Match: 88%**: 14 have, 0 partial, 0 missing, 2 unreviewed, of 16 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search recipes by name | Find | have | every site of this kind offers it | void-live-deploy/recipes/index.html:103 `p class="sub" id="sub">Search by name or by ingredient; every quantity scaled to your serv` |
| Search by the ingredients you have | Find | have | studied by hand: Allrecipes offers this (https://www.allrecipes.com/) | void-live-deploy/recipes/index.html:103 `b" id="sub">Search by name or by ingredient; every quantity scaled to your servings, one s` |
| Browse by course, cuisine and occasion | Find | have | every site of this kind offers it | void-live-deploy/recipes/index.html:123 `"false" aria-controls="browse">Browse</button>` |
| Diet and allergy filters | Find | have | every site of this kind offers it | void-live-deploy/recipes/index.html:147 `filtH" style="margin:0 0 4px">Diet and allergies</h2>` |
| Ratings and reviews | Community | have | studied by hand: Allrecipes offers this (https://www.allrecipes.com/) | void-live-deploy/recipes/index.html:198 `:14px;color:var(--soft)">Your rating</span><span class="stars" id="stars" role="group" ari` |
| Change the servings | Cooking | have | studied by hand: Allrecipes offers this (https://www.allrecipes.com/) | void-live-deploy/recipes/index.html:173 `button" id="more" aria-label="One serving more">+</button><span id="yield"></span></span>` |
| Metric and US units | Cooking | have | studied by hand: Allrecipes offers this (https://www.allrecipes.com/) | void-live-deploy/recipes/index.html:186 `"uMetric" aria-pressed="false">Metric</button>` |
| Nutrition facts | Cooking | have | studied by hand: Allrecipes offers this (https://www.allrecipes.com/) | void-live-deploy/recipes/index.html:144 `><button type="button" id="weekCal">Put the week on my calendar</button></div>` |
| Save recipes | Keep | have | every site of this kind offers it | void-live-deploy/recipes/index.html:119 `lse" aria-controls="savedPane">Saved</button>` |
| A shopping list | Keep | have | studied by hand: Allrecipes offers this (https://www.allrecipes.com/) | void-live-deploy/recipes/index.html:120 `lse" aria-controls="listPane">Shopping list</button>` |
| Print a recipe | Cooking | have | every site of this kind offers it | void-live-deploy/recipes/index.html:190 `utton type="button" id="print">Print</button>` |
| Recipe videos | Cooking | have | studied by hand: Allrecipes offers this (https://www.allrecipes.com/) | void-live-deploy/recipes/index.html:289 `rom.append(' · ', a); } if (r.video) { const a = el('a', '', W.video); a.href = r.video; a` |
| Readers share photos of what they cooked | Community | have | studied by hand: Allrecipes offers this (https://www.allrecipes.com/) | void-live-deploy/recipes/index.html:129 `n type="button" id="impPhoto">From a photo</button></div>` |
| Post your own recipes | Community | have | studied by hand: Allrecipes offers this (https://www.allrecipes.com/) | void-live-deploy/recipes/index.html:213 `<h2 id="mineH" hidden>My recipes</h2>` |
| Its live pages could not be read (HTTP 402), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://www.allrecipes.com/ | not compared yet |
