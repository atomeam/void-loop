# food52.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: food52.com (https://food52.com/)
- Verse: /recipes/?q=pancakes (recipes: food52.com, tower gate 1 of 15)
- Live scan: 2026-10-28, HTTP 429, page title "Vercel Security Checkpoint"
- History: [docs/HISTORY/food52.com.md](../HISTORY/food52.com.md)

**Match: 82%**: 9 have, 0 partial, 0 missing, 2 unreviewed, of 11 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search recipes by name | Find | have | every site of this kind offers it | void-live-deploy/recipes/index.html:103 `p class="sub" id="sub">Search by name or by ingredient; every quantity scaled to your serv` |
| Browse by course, cuisine and occasion | Find | have | every site of this kind offers it | void-live-deploy/recipes/index.html:123 `"false" aria-controls="browse">Browse</button>` |
| Diet and allergy filters | Find | have | every site of this kind offers it | void-live-deploy/recipes/index.html:147 `filtH" style="margin:0 0 4px">Diet and allergies</h2>` |
| Ratings and reviews | Community | have | studied by hand: food52.com offers this (https://food52.com/) | void-live-deploy/recipes/index.html:198 `:14px;color:var(--soft)">Your rating</span><span class="stars" id="stars" role="group" ari` |
| Save recipes | Keep | have | every site of this kind offers it | void-live-deploy/recipes/index.html:119 `lse" aria-controls="savedPane">Saved</button>` |
| Print a recipe | Cooking | have | every site of this kind offers it | void-live-deploy/recipes/index.html:190 `utton type="button" id="print">Print</button>` |
| Recipe videos | Cooking | have | studied by hand: food52.com offers this (https://food52.com/) | void-live-deploy/recipes/index.html:289 `rom.append(' · ', a); } if (r.video) { const a = el('a', '', W.video); a.href = r.video; a` |
| Post your own recipes | Community | have | studied by hand: food52.com offers this (https://food52.com/) | void-live-deploy/recipes/index.html:213 `<h2 id="mineH" hidden>My recipes</h2>` |
| Cooking guides and articles | Content | have | studied by hand: food52.com offers this (https://food52.com/) | void-live-deploy/recipes/index.html:224 `S supermarket prices, a rough guide). Diets and allergies (vegetarian, vegan, gluten-free,` |
| Its live pages could not be read (HTTP 429), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://food52.com/ | not compared yet |
