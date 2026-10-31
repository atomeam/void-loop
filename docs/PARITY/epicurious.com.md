# epicurious.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: epicurious.com (https://www.epicurious.com/)
- Verse: /recipes/?q=pancakes (recipes: epicurious.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Epicurious – Recipes, Menu Ideas, Videos &amp; Cooking Tips / Epicurious"
- History: [docs/HISTORY/epicurious.com.md](../HISTORY/epicurious.com.md)

**Match: 61%**: 21 have, 1 partial, 0 missing, 13 unreviewed, of 35 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search recipes by name | Find | have | its live page (2026-10-28): "Chevron Kitchen Gear Chevron Techniques Search for &quot;pasta&quot; Search Open Navigation Menu Menu Epicurio" | void-live-deploy/recipes/index.html:103 `p class="sub" id="sub">Search by name or by ingredient; every quantity scaled to your serv` |
| Search by the ingredients you have | Find | have | its live page (2026-10-28): "lity Newsletter Primary Recipes Chevron Ingredients Chevron Occasions Chevron Kitchen Gear Chevron Techniques" | void-live-deploy/recipes/index.html:103 `b" id="sub">Search by name or by ingredient; every quantity scaled to your servings, one s` |
| Browse by course, cuisine and occasion | Find | have | its live page (2026-10-28): "":"tags\u002Fsimple-cooking"},{"label":"Breakfast","value":"breakfast","hierarchy":"tags\u002Fmeal"},{"label":" | void-live-deploy/recipes/index.html:123 `"false" aria-controls="browse">Browse</button>` |
| Diet and allergy filters | Find | have | its live page (2026-10-28): "Recipes to Bake Tonight 103 of Our Best Vegan Recipes icon Gallery 103 of Our Best Vegan Recipes Latest Recipe" | void-live-deploy/recipes/index.html:147 `filtH" style="margin:0 0 4px">Diet and allergies</h2>` |
| Ratings and reviews | Community | have | its live page (2026-10-28): "it. You will not be disappointed.” 5.0 Rating 0 Rating 1 Rating 2 Rating 3 Rating 4 Rating 5 Rating ( 4.86 )" | void-live-deploy/recipes/index.html:198 `:14px;color:var(--soft)">Your rating</span><span class="stars" id="stars" role="group" ari` |
| Change the servings | Cooking | have | its live page (2026-10-28): "Text":[{"type":0,"value":"Nutrition Per Serving"}],"InstagramEmbed.ConsentBannerHeader":[{"type":0,"value":"In" | void-live-deploy/recipes/index.html:173 `button" id="more" aria-label="One serving more">+</button><span id="yield"></span></span>` |
| Step-by-step cooking mode | Cooking | have | its live page (2026-10-28): "editors' comments and recommended next steps."}],"BusinessApplication.NeedInputsBannerDek":[{"type":0,"value"" | void-live-deploy/recipes/index.html:204 `creen kept on, timers to tap">Step mode</button>` |
| Nutrition facts | Cooking | have | its live page (2026-10-28): ""value":"Ingredients"}],"IngredientList.nutritionHedText":[{"type":0,"value":"Nutrition Per Serving"}],"Instag" | void-live-deploy/recipes/index.html:144 `><button type="button" id="weekCal">Put the week on my calendar</button></div>` |
| Save recipes | Keep | have | its live page (2026-10-28): "ing 3 Rating 4 Rating 5 Rating ( 4.86 ) Save Story save recipe 58 Pie Recipes to Bake Tonight icon Gallery 58" | void-live-deploy/recipes/index.html:119 `lse" aria-controls="savedPane">Saved</button>` |
| A shopping list | Keep | have | its live page (2026-10-28): "5 Rating ( 4.8 ) Save Story save recipe Shopping The Best New Cookbooks of Winter 2026 The Best New Cookbooks" | void-live-deploy/recipes/index.html:120 `lse" aria-controls="listPane">Shopping list</button>` |
| A meal plan | Keep | have | its live page (2026-10-28): "pe":0,"value":"Want to turn this into a meal plan?"}],"AIChatBotTicker.hed4":[{"type":0,"value":"Need to adjus" | void-live-deploy/recipes/index.html:122 `lse" aria-controls="planPane">Meal plan</button>` |
| Keep a recipe from another site | Keep | have | its live page (2026-10-28): "\u003E \u003Cpath fill-rule=\"evenodd\" clip-rule=\"evenodd\" d=\"M11.5557 24.256C11.5557 23.7823 11.9424 23.3" | void-live-deploy/recipes/index.html:127 `"impH" style="margin:0 0 4px">Import a recipe</h2>` |
| Print a recipe | Cooking | have | its live page (2026-10-28): "{"desktop":["jumpToSection","bookmark","print"],"mobile":["jumpToSection","bookmark"]},"actionBarTwoButtons":{" | void-live-deploy/recipes/index.html:190 `utton type="button" id="print">Print</button>` |
| Recipe videos | Cooking | have | its live page (2026-10-28): "Epicurious – Recipes, Menu Ideas, Videos & Cooking Tips / Epicurious Google Tag Manager Skip to main content" | void-live-deploy/recipes/index.html:289 `rom.append(' · ', a); } if (r.video) { const a = el('a', '', W.video); a.href = r.video; a` |
| Readers share photos of what they cooked | Community | have | its live page (2026-10-28): ":true}}},"GalleryPage":{"settings":{"hasPhotoBookmark":false}},"SeriesPagination":{"settings":{"prefixDivider"" | void-live-deploy/recipes/index.html:129 `n type="button" id="impPhoto">From a photo</button></div>` |
| Post your own recipes | Community | have | its live page (2026-10-28): "2F\u003E \u003C\u002Fsvg\u003E","commentSubmittedIcon":"\u003Csvg width=\"64\" height=\"64\" viewBox=\"0 0 64" | void-live-deploy/recipes/index.html:213 `<h2 id="mineH" hidden>My recipes</h2>` |
| Cooking guides and articles | Content | have | its live page (2026-10-28): "Occasions Chevron Kitchen Gear Chevron Techniques Search for &quot;pasta&quot; Search Open Navigation Menu Me" | void-live-deploy/recipes/index.html:224 `S supermarket prices, a rough guide). Diets and allergies (vegetarian, vegan, gluten-free,` |
| A newsletter | Content | have | its live page (2026-10-28): "Skip to main content Epicurious Utility Newsletter Primary Recipes Chevron Ingredients Chevron Occasions Chevr" | void-live-deploy/lib/calendar.js:321 `subscribe: 'Abonnieren', feedPh: 'Adresse eines Kalenders (https:// oder webcal://)',` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "ERNAME"}}},"BookmarkIcon":{"settings":{"signInHed":"Sign in to save","signInHedSpanTag":" ","signInMessage":"R" | void-live-deploy/recipes/index.html:257 `e = { ...store, ...JSON.parse(localStorage.getItem(KEY) // '{}') }; } catch (_) {}` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "icurious App","url":" https:\u002F\u002Fapps.apple.com\u002Fus\u002Fapp\u002Fepicurious\u002Fid312101965"},{"i" | void-live-deploy/recipes/index.html:548 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "ed3d4295e4a0\u002Fmaster\u002Fpass\u002FShare_Newsletters.jpg"},"subscribe":{"dangerousDisclaimer":"\u003Cp\u0" | void-live-deploy/recipes/index.html:189 `cipe, its servings and units">Share link</button>` |
| A public API | Developers | have | its live page (2026-10-28): "":0,"value":"Cover Shoot by"}],"Bylines.DeveloperPreamble":[{"type":0,"value":"Development by"}],"Bylines.Dire" | void-live-deploy/recipes/index.html:328 `try { const r = await fetch('/api/recipes?' + params); if (r.ok) { const j = await r` |
| Recipes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Occasions | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Kitchen Gear | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Kale and Brussels Sprouts Salad | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 58 Pie Recipes to Bake Tonight | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Soothing Rice Porridge | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Chili Crisp Yogurt Chicken | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Broiled Salmon Teriyaki | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Cider-Braised Sausage and Lentils | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| This Cookout Menu Dials Up the Classics | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Creamy Miso Mushroom Pasta | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Butternut Pasta With Sausage and Dates | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
