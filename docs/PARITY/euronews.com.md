# euronews.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: euronews.com (https://www.euronews.com/)
- Verse: /news/ (news: euronews.com, tower gate 13 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Latest breaking news available as free video on demand / Euronews"
- History: [docs/HISTORY/euronews.com.md](../HISTORY/euronews.com.md)

**Match: 40%**: 12 have, 1 partial, 5 missing, 13 unreviewed, of 31 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | its live page (2026-10-28): "Latest breaking news available as free video on demand / Euronews homepage Accessibility shortcuts Go to navi" | void-live-deploy/news/index.html:77 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | its live page (2026-10-28): "athinaikos on Thursday 9 November 2023. Sport UEFA reschedules Europa League match amid planned French general" | void-live-deploy/news/index.html:76 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | its live page (2026-10-28): "were being disrupted by a cyberattack. Europe News Belgium&#039;s finance and tax agency hit by cyberattack B" | void-live-deploy/news/index.html:77 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | its live page (2026-10-28): "to navigation Go to main content Go to search Go to footer Go to navigation Go to the Homepage Euronews logo" | void-live-deploy/news/index.html:73 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | its live page (2026-10-28): "s digital services were being disrupted by a cyberattack. Europe News Belgium&#039;s finance and tax agency hi" | void-live-deploy/news/index.html:77 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Live pages for breaking stories | Reading | missing | its live page (2026-10-28): "he news and insights that drive Europe, live from Brussels every morning at 08.00. Also available as a newslet" | no sign of it in the source of /news/ |
| Video reports | Media | have | its live page (2026-10-28): "Latest breaking news available as free video on demand / Euronews homepage Accessibility shortcuts Go to navi" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Radio, podcasts and audio stories | Media | have | its live page (2026-10-28): ".00. Also available as a newsletter and podcast. Europe Today Euronews&#039; flagship morning TV show with the" | void-live-deploy/news/index.html:111 `addEventListener('load', async () => {` |
| Follow topics and sources | Personal | have | its live page (2026-10-28): "ces to crack down on fraud. Euronews is following them in this special series: The Food Detectives The Food De" | void-live-deploy/news/index.html:98 `ton type="button" id="follow">Follow topics</button><button type="button" id="copyLink">Co` |
| Save stories for later | Personal | have | its live page (2026-10-28): "lack Friday is coming up, and you could save some serious cash on your next holiday Travel News Black Friday o" | void-live-deploy/news/index.html:77 `c="saved" aria-pressed="false">Saved</button>` |
| The same story from several sides | Reading | missing | its live page (2026-10-28): "No Comment: No agenda, no argument, no bias, No Comment. Get the story without commentary. No Comment No agen" | no sign of it in the source of /news/ |
| Weather | Extras | have | its live page (2026-10-28): "Kansai, Japan Services Read more about Weather Weather Read more about Bulletin Bulletin Read more about Mess" | void-live-deploy/news/index.html:103 `"/notes/">Notes</a> <a href="/weather/">Weather</a> <a href="/tools/">All tools</a>` |
| Newsletters and alerts | Personal | missing | its live page (2026-10-28): "y morning at 08.00. Also available as a newsletter and podcast. Europe Today Euronews&#039; flagship morning T" | no sign of it in the source of /news/ |
| Reader comments | Community | missing | its live page (2026-10-28): "more about USA USA Featured Program No Comment: No agenda, no argument, no bias, No Comment. Get the story wi" | no sign of it in the source of /news/ |
| Fact checks and explainers | Reading | missing | its live page (2026-10-28): "policies and decisions through videos, explainers, polls, and a chatbot answering your questions anytime and" | no sign of it in the source of /news/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "ture Earth Health Euroviews Videos More Log In My Account Live Close menu sidebar Close alert Euronews logo Ad" | void-live-deploy/news/index.html:116 `=> { try { return JSON.parse(localStorage.getItem(KEY) // '{}') // {}; } catch (_) { retu` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "in Visit our Apple store page Visit our Google Play store page Newsletter Newsletters Events Events Podcasts V" | void-live-deploy/news/index.html:262 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| A public API | Developers | have | its live page (2026-10-28): "rea fines Google, Apple for pushing app developers onto their payment systems South Korea fines Google and App" | void-live-deploy/news/index.html:192 `const r = await fetch('/api/news?sec=' + encodeURIComponent(real) + '&lang=' + st.` |
| Go to navigation | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Go to main content | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Go to footer | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Français | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Deutsch | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Italiano | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Español | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Português | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Polski | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Pусский | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Türkçe | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Magyar | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
