# npr.org: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: npr.org (https://www.npr.org/)
- Verse: /news/ (news: npr.org, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "NPR - Breaking News, Analysis, Music, Arts &amp; Podcasts : NPR"
- History: [docs/HISTORY/npr.org.md](../HISTORY/npr.org.md)

**Match: 40%**: 12 have, 1 partial, 5 missing, 13 unreviewed, of 31 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | its live page (2026-10-28): "NPR - Breaking News, Analysis, Music, Arts & Podcasts : NPR Home Page Top Stories NPR News NPR Music Morning" | void-live-deploy/news/index.html:78 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | its live page (2026-10-28): "pand/collapse submenu for News National World Politics Business Elections Health Science Climate Race Culture" | void-live-deploy/news/index.html:77 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | its live page (2026-10-28): "Top Stories NPR News NPR Music Morning Edition All Things Considered Wait Wait... Don&#039;t Tell Me! Accessi" | void-live-deploy/news/index.html:78 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | its live page (2026-10-28): "ine Gods Get NPR+ More Podcasts & Shows Search Newsletters NPR Shop Get NPR+ NPR Music Tiny Desk New Music Fri" | void-live-deploy/news/index.html:74 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | its live page (2026-10-28): "Dalia Luque, left, has her face painted by Amber Lovold, one of the organizers of a midnight release party at" | void-live-deploy/news/index.html:78 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Live pages for breaking stories | Reading | missing | its live page (2026-10-28): "day All Songs Considered Music Features Live Sessions Podcasts & Shows Expand/collapse submenu for Podcasts &" | no sign of it in the source of /news/ |
| Video reports | Media | have | its live page (2026-10-28): "dio Supporters of former Rep. Cori Bush watch redistricting commentary during an election night watch party on" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Radio, podcasts and audio stories | Media | have | its live page (2026-10-28): "Breaking News, Analysis, Music, Arts & Podcasts : NPR Home Page Top Stories NPR News NPR Music Morning Editio" | void-live-deploy/news/index.html:113 `addEventListener('load', async () => {` |
| Follow topics and sources | Personal | have | its live page (2026-10-28): "they have spinach in their teeth? Your followers that you just won a big award? In this episode of Life Kit," | void-live-deploy/news/index.html:100 `ton type="button" id="follow">Follow topics</button><button type="button" id="copyLink">Co` |
| Save stories for later | Personal | have | its live page (2026-10-28): "icious, which officials hope might help save the bay. audio-module Invasive Species on school Listen &middot;" | void-live-deploy/news/index.html:78 `c="saved" aria-pressed="false">Saved</button>` |
| The same story from several sides | Reading | missing | its live page (2026-10-28): "t? The cost of caregiving Cookie Jones, left, quit her job to provide care to her mother who has Alzheimer&#03" | no sign of it in the source of /news/ |
| Weather | Extras | have | its live page (2026-10-28): "it Anastasiia Krivenok/Getty Images The weather is cooling down and it's time to take a load off and snuggle u" | void-live-deploy/news/index.html:105 `"/notes/">Notes</a> <a href="/weather/">Weather</a> <a href="/tools/">All tools</a>` |
| Newsletters and alerts | Personal | missing | its live page (2026-10-28): "PR header Open Navigation Menu NPR logo Newsletters NPR Shop Get NPR+ Close Navigation Menu Home News Expand/c" | no sign of it in the source of /news/ |
| Reader comments | Community | missing | its live page (2026-10-28): "rmer Rep. Cori Bush watch redistricting commentary during an election night watch party on Tuesday, Aug. 4, 20" | no sign of it in the source of /news/ |
| Fact checks and explainers | Reading | missing | its live page (2026-10-28): "ayer"&gt; advertisement Sponsor Message Explainer Voting Why many student voters have a right to choose where" | no sign of it in the source of /news/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "sor-free and support our work at NPR by signing up for Short Wave+ at plus.npr.org/shortwave. audio-module Spa" | void-live-deploy/news/index.html:118 `=> { try { return JSON.parse(localStorage.getItem(KEY) // '{}') // {}; } catch (_) { retu` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "I Say Something? The Science of What to Share — and What to Keep to Yourself. Bohns shares tips on when to be" | void-live-deploy/news/index.html:100 `n type="button" id="copyLink">Copy link to this view</button></div>` |
| A public API | Developers | have | its live page (2026-10-28): "and that has been sold to a data center developer. Owens is leading an effort to halt the buildout of hypersca" | void-live-deploy/news/index.html:207 `const r = await fetch('/api/news?sec=' + encodeURIComponent(real) + '&lang=' + st.` |
| Keyboard shortcuts for audio player | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Open Navigation Menu | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| NPR logo | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| NPR Shop | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Get NPR+ | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Close Navigation Menu | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| National | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Politics | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Elections | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Health | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Science | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Climate | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
