# simplyrecipes.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: simplyrecipes.com (https://www.simplyrecipes.com/)
- Verse: /recipes/?q=pancakes (recipes: simplyrecipes.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 402
- History: [docs/HISTORY/simplyrecipes.com.md](../HISTORY/simplyrecipes.com.md)

**Match: 78%**: 7 have, 0 partial, 0 missing, 2 unreviewed, of 9 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search recipes by name | Find | have | every site of this kind offers it | void-live-deploy/recipes/index.html:103 `p class="sub" id="sub">Search by name or by ingredient; every quantity scaled to your serv` |
| Browse by course, cuisine and occasion | Find | have | every site of this kind offers it | void-live-deploy/recipes/index.html:123 `"false" aria-controls="browse">Browse</button>` |
| Diet and allergy filters | Find | have | every site of this kind offers it | void-live-deploy/recipes/index.html:147 `filtH" style="margin:0 0 4px">Diet and allergies</h2>` |
| Ratings and reviews | Community | have | studied by hand: simplyrecipes.com offers this (https://www.simplyrecipes.com/) | void-live-deploy/recipes/index.html:198 `:14px;color:var(--soft)">Your rating</span><span class="stars" id="stars" role="group" ari` |
| Save recipes | Keep | have | every site of this kind offers it | void-live-deploy/recipes/index.html:119 `lse" aria-controls="savedPane">Saved</button>` |
| Print a recipe | Cooking | have | every site of this kind offers it | void-live-deploy/recipes/index.html:190 `utton type="button" id="print">Print</button>` |
| Cooking guides and articles | Content | have | studied by hand: simplyrecipes.com offers this (https://www.simplyrecipes.com/) | void-live-deploy/recipes/index.html:224 `S supermarket prices, a rough guide). Diets and allergies (vegetarian, vegan, gluten-free,` |
| Its live pages could not be read (HTTP 402), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://www.simplyrecipes.com/ | not compared yet |
