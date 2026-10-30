# dw.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: dw.com (https://www.dw.com/en/)
- Verse: /news/ (news: dw.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "News and current affairs from Germany and around the world"
- History: [docs/HISTORY/dw.com.md](../HISTORY/dw.com.md)

**Match: 34%**: 8 have, 1 partial, 3 missing, 13 unreviewed, of 25 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | its live page (2026-10-28): "News and current affairs from Germany and around the world You need to enable JavaScript to run this app. Ski" | void-live-deploy/news/index.html:78 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | its live page (2026-10-28): "ent affairs from Germany and around the world You need to enable JavaScript to run this app. Skip to content S" | void-live-deploy/news/index.html:77 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | its live page (2026-10-28): "ideos Latest audio Latest audio Regions Africa Asia Europe Latin America Middle East North America Germany Top" | void-live-deploy/news/index.html:78 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | its live page (2026-10-28): "livestream - channel DW English Live TV Search DW Advertisement Homepage Skip next section Top Story Top Story" | void-live-deploy/news/index.html:74 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | its live page (2026-10-28): "tion against an opposition alliance led by former military chief Gadi Eisenkot. Early Israeli election results" | void-live-deploy/news/index.html:78 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Live pages for breaking stories | Reading | missing | its live page (2026-10-28): "o to TV livestream - channel DW English Live TV Search DW Advertisement Homepage Skip next section Top Story T" | no sign of it in the source of /news/ |
| Video reports | Media | have | its live page (2026-10-28): "e for minds Open main navigation Latest videos Latest videos Latest audio Latest audio Regions Africa Asia Eur" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Radio, podcasts and audio stories | Media | have | its live page (2026-10-28): "ternal link — Inside Europe This weekly podcast is a deep dive into the twists and turns of European current a" | void-live-deploy/news/index.html:113 `addEventListener('load', async () => {` |
| Follow topics and sources | Personal | have | its live page (2026-10-28): "t it may take days for the final tally. Follow DW. Politics 10/28/2026 October 28, 2026 Skip next section A cl" | void-live-deploy/news/index.html:100 `ton type="button" id="follow">Follow topics</button><button type="button" id="copyLink">Co` |
| The same story from several sides | Reading | missing | its live page (2026-10-28): "ny Topics Climate Equality Health Human Rights Migration Technology Categories Business Science Environment Cu" | no sign of it in the source of /news/ |
| Newsletters and alerts | Personal | missing | its live page (2026-10-28): "mie DW Akademie Service External link — Newsletters Newsletters External link — Reception Reception External l" | no sign of it in the source of /news/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "ael change its Iran approach? A traffic sign in Israel with two arrows ahead of a screen showing the faces of" | void-live-deploy/news/index.html:118 `=> { try { return JSON.parse(localStorage.getItem(KEY) // '{}') // {}; } catch (_) { retu` |
| Latin America | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Middle East | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| North America | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Germany | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Climate | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Equality | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Health | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Migration | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Technology | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Science | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Environment | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Culture | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
