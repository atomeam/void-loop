# aljazeera.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: aljazeera.com (https://www.aljazeera.com/)
- Verse: /news/ (news: aljazeera.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Breaking News, World News and Video from Al Jazeera"
- History: [docs/HISTORY/aljazeera.com.md](../HISTORY/aljazeera.com.md)

**Match: 32%**: 8 have, 0 partial, 4 missing, 13 unreviewed, of 25 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | its live page (2026-10-28): "Breaking News, World News and Video from Al Jazeera Skip links Skip to Featured Content Skip to Content Feed" | void-live-deploy/news/index.html:78 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | its live page (2026-10-28): "Breaking News, World News and Video from Al Jazeera Skip links Skip to Featured Content Skip to Content Feed" | void-live-deploy/news/index.html:77 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | its live page (2026-10-28): "ews Show more news sections Middle East Africa Asia US & Canada Latin America Europe Asia Pacific Explained Sp" | void-live-deploy/news/index.html:78 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | its live page (2026-10-28): "am video player play Live Click here to search search Sign up Secondary navigation menu Navigation menu caret-" | void-live-deploy/news/index.html:74 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | its live page (2026-10-28): "rned a temporary ban on Arab candidates by the Central Elections Committee. Israel is holding legislative elec" | void-live-deploy/news/index.html:78 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Live pages for breaking stories | Reading | missing | its live page (2026-10-28): "Al Jazeera , link to home page link to live stream video player play Live Sign up Show navigation menu Show n" | no sign of it in the source of /news/ |
| Video reports | Media | have | its live page (2026-10-28): "Breaking News, World News and Video from Al Jazeera Skip links Skip to Featured Content Skip to Content Feed" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Radio, podcasts and audio stories | Media | have | its live page (2026-10-28): "ations In Pictures Science & Technology Podcasts Travel Sponsored Content link to live stream video player pla" | void-live-deploy/news/index.html:113 `addEventListener('load', async () => {` |
| Follow topics and sources | Personal | have | its live page (2026-10-28): ";) party, waves an Israeli flag onstage following the release of the first exit poll results in Israel&#x27;s" | void-live-deploy/news/index.html:100 `ton type="button" id="follow">Follow topics</button><button type="button" id="copyLink">Co` |
| The same story from several sides | Reading | missing | its live page (2026-10-28): "ctions Originals Features Economy Human Rights Climate Crisis Investigations In Pictures Science & Technology" | no sign of it in the source of /news/ |
| Newsletters and alerts | Personal | missing | its live page (2026-10-28): "s Help Advertise with us Stay Connected Newsletters Channel Finder TV Schedule Podcasts Submit a Tip Paid Part" | no sign of it in the source of /news/ |
| Fact checks and explainers | Reading | missing | its live page (2026-10-28): "Oct. 28, 2026. (AP Photo/Ariel Schalit) EXPLAINER Why Arab parties may not be the ‘kingmakers’ in this Israeli" | no sign of it in the source of /news/ |
| Skip to Featured Content | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Skip to Content Feed | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Skip to Most Read | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Middle East | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| US & Canada | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Latin America | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Explained | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Opinion | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Interactives | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Originals | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Features | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Economy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
