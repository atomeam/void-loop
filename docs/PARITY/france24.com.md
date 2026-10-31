# france24.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: france24.com (https://www.france24.com/en/)
- Verse: /news/ (news: france24.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "France 24 - International breaking news, top stories and headlines"
- History: [docs/HISTORY/france24.com.md](../HISTORY/france24.com.md)

**Match: 36%**: 10 have, 0 partial, 5 missing, 13 unreviewed, of 28 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | its live page (2026-10-28): "France 24 - International breaking news, top stories and headlines France 24 - International breaking news, t" | void-live-deploy/news/index.html:78 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | its live page (2026-10-28): "ce 24 on TV Headings Topics Environment Business / Tech Sport Culture The Bright Side Infographics Fight the F" | void-live-deploy/news/index.html:77 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | its live page (2026-10-28): "ers Sponsored contents By region France Africa Middle East Americas Europe Asia-Pacific Previous Next France A" | void-live-deploy/news/index.html:78 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | its live page (2026-10-28): "obot can reach a depth of 6,000 metres. Searching for radioactive waste in the depths of the Atlantic Searchin" | void-live-deploy/news/index.html:74 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | its live page (2026-10-28): "e Fake The Observers Sponsored contents By region France Africa Middle East Americas Europe Asia-Pacific Previ" | void-live-deploy/news/index.html:78 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Live pages for breaking stories | Reading | missing | its live page (2026-10-28): "ories and headlines Home Shows Newsfeed Live en Français English Español عربي Settings Sign up for newsletters" | no sign of it in the source of /news/ |
| Video reports | Media | have | its live page (2026-10-28): "cast Closed-captioned Newscast TV guide Watch France 24 on TV Headings Topics Environment Business / Tech Spor" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Radio, podcasts and audio stories | Media | have | its live page (2026-10-28): "a depth of 6,000 metres. Searching for radioactive waste in the depths of the Atlantic Searching for radioact" | void-live-deploy/news/index.html:113 `addEventListener('load', async () => {` |
| Follow topics and sources | Personal | have | its live page (2026-10-28): "was theft&#039;: Trials begin in Paris following October 17 violence On the ground France Includes a video 4" | void-live-deploy/news/index.html:100 `ton type="button" id="follow">Follow topics</button><button type="button" id="copyLink">Co` |
| Save stories for later | Personal | have | its live page (2026-10-28): "y at the Arab World Institute in Paris. Saved from destruction: Paris show offers glimpse of Gaza’s archaeolog" | void-live-deploy/news/index.html:78 `c="saved" aria-pressed="false">Saved</button>` |
| The same story from several sides | Reading | missing | its live page (2026-10-28): "ment Business / Tech Sport Culture The Bright Side Infographics Fight the Fake The Observers Sponsored content" | no sign of it in the source of /news/ |
| Newsletters and alerts | Personal | missing | its live page (2026-10-28): "glish Español عربي Settings Sign up for newsletters Manage subscription to notifications Manage my privacy set" | no sign of it in the source of /news/ |
| Reader comments | Community | missing | its live page (2026-10-28): "to China over Mbappé&#039;s Mao Zedong comments Asia / Pacific Bolsonaro fled Brazil after losing Sunday&#039" | no sign of it in the source of /news/ |
| Fact checks and explainers | Reading | missing | its live page (2026-10-28): "dance test France’s cultural exception? Explainer Economy Reading time 6 min Reading time Most read 1 Mbappé a" | no sign of it in the source of /news/ |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "erbian government Analysis Europe Photo shared on July 6, 2026, by Orit Strook, Israeli Minister of Settlement" | void-live-deploy/news/index.html:100 `n type="button" id="copyLink">Copy link to this view</button></div>` |
| Mideast conflict | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| French Presidential Elections 2027 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Midterms 2026 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| See all shows | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| TV guide | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Environment | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Culture | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Infographics | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Fight the Fake | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| The Observers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sponsored contents | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| France | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
