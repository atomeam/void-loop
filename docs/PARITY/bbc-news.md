# BBC News: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: BBC News (https://www.bbc.com/news)
- Verse: /news/ (news, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "BBC News - Breaking news, video and the latest top stories from the U.S. and around the world"
- History: [docs/HISTORY/bbc-news.md](../HISTORY/bbc-news.md)

**Match: 38%**: 11 have, 0 partial, 5 missing, 13 unreviewed, of 29 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | its live page (2026-10-28): "BBC News - Breaking news, video and the latest top stories from the U.S. and around the world Skip to content" | void-live-deploy/news/index.html:78 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | its live page (2026-10-28): "op stories from the U.S. and around the world Skip to content Skip to content Open menu Watch Live British Bro" | void-live-deploy/news/index.html:77 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | its live page (2026-10-28): "Video Live Documentaries US & Canada UK Africa Asia Australia Europe Latin America Middle East In Pictures BBC" | void-live-deploy/news/index.html:78 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | its live page (2026-10-28): "Live News Live Sport Documentaries Site search Search news, topics and more Search Home News Sport Business Te" | void-live-deploy/news/index.html:74 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | its live page (2026-10-28): "minister says a system failure followed by &quot;inexplicable&quot; human error led to the collision south of" | void-live-deploy/news/index.html:78 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Live pages for breaking stories | Reading | missing | its live page (2026-10-28): "content Skip to content Open menu Watch Live British Broadcasting Corporation Home News Sport Business Technol" | no sign of it in the source of /news/ |
| Video reports | Media | have | its live page (2026-10-28): "BBC News - Breaking news, video and the latest top stories from the U.S. and around the world Skip to content" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Radio, podcasts and audio stories | Media | have | its live page (2026-10-28): "Sustainable Business Green Living Audio Podcast Categories Radio Audio FAQs Video Watch Documentaries BBC Maes" | void-live-deploy/news/index.html:113 `addEventListener('load', async () => {` |
| Follow topics and sources | Personal | have | its live page (2026-10-28): "ransport minister says a system failure followed by &quot;inexplicable&quot; human error led to the collision" | void-live-deploy/news/index.html:100 `ton type="button" id="follow">Follow topics</button><button type="button" id="copyLink">Co` |
| Save stories for later | Personal | have | studied by hand: BBC News offers this (https://www.bbc.com/news) | void-live-deploy/news/index.html:78 `c="saved" aria-pressed="false">Saved</button>` |
| The same story from several sides | Reading | missing | its live page (2026-10-28): "e Dolores Huerta slightly turned to her right with her hands in a prayer position and a large turquoise ring o" | no sign of it in the source of /news/ |
| Weather | Extras | have | its live page (2026-10-28): "el Earth Audio Video Live Documentaries Weather Newsletters Watch Live News News image unavailable Rescue pers" | void-live-deploy/news/index.html:105 `"/notes/">Notes</a> <a href="/weather/">Weather</a> <a href="/local/">Local TV and radio</` |
| Newsletters and alerts | Personal | missing | its live page (2026-10-28): "Audio Video Live Documentaries Weather Newsletters Watch Live News News image unavailable Rescue personnel wo" | no sign of it in the source of /news/ |
| Reader comments | Community | missing | its live page (2026-10-28): "plus Liverpool v Chelsea Listen to BBC commentaries and follow live text updates from the last 16 of the EFL" | no sign of it in the source of /news/ |
| Fact checks and explainers | Reading | missing | its live page (2026-10-28): "Middle East In Pictures BBC InDepth BBC Verify Home News US & Canada UK UK Politics England N. Ireland N. Irel" | no sign of it in the source of /news/ |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "t the BBC Privacy Policy Cookies Do not share or sell my info Accessibility Help Contact the BBC Advertise wit" | void-live-deploy/news/index.html:100 `n type="button" id="copyLink">Copy link to this view</button></div>` |
| Technology | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Health | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Culture | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Arts | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Travel | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Earth | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Audio | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Documentaries | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| US & Canada | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Australia | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Latin America | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Middle East | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
