# theguardian.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: theguardian.com (https://www.theguardian.com/international)
- Verse: /news/ (news: theguardian.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Latest news, sport and opinion from the Guardian"
- History: [docs/HISTORY/theguardian.com.md](../HISTORY/theguardian.com.md)

**Match: 38%**: 11 have, 1 partial, 5 missing, 13 unreviewed, of 30 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | its live page (2026-10-28): "Latest news, sport and opinion from the Guardian Skip to main content Skip to navigation Print subscriptions" | void-live-deploy/news/index.html:78 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | its live page (2026-10-28): "Latest news, sport and opinion from the Guardian Skip to main content Skip to navigation Print subscriptions" | void-live-deploy/news/index.html:77 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | its live page (2026-10-28): "ve News Move highlight stories forwards Edition US edition UK edition Australia edition Europe edition Interna" | void-live-deploy/news/index.html:78 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | its live page (2026-10-28): "en Health & fitness Family Travel Money Search input Search the Guardian google-search Search Search with Goog" | void-live-deploy/news/index.html:74 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | its live page (2026-10-28): "used tear gas and water cannons. (Photo by Nael Chahine/Middle East Images/Sipa USA) Credit: Sipa US/Alamy Liv" | void-live-deploy/news/index.html:78 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Live pages for breaking stories | Reading | missing | its live page (2026-10-28): "Images/Sipa USA) Credit: Sipa US/Alamy Live News3FWEKF4 Paris, France. 17th Oct, 2026. Demonstrators gather a" | no sign of it in the source of /news/ |
| Video reports | Media | have | its live page (2026-10-28): "Trump is trying to disrupt the midterms Video explainer How Trump is trying to disrupt the midterms Video 4:07" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Radio, podcasts and audio stories | Media | have | its live page (2026-10-28): "ture Film Books Music Art & design TV & radio Stage Classical Games Design a better world Toggle Lifestyle Lif" | void-live-deploy/news/index.html:113 `addEventListener('load', async () => {` |
| Follow topics and sources | Personal | have | its live page (2026-10-28): "ting citrus zest and peel really be bad for your health? Closeup of a hand removing a lemon skin with a zestin" | void-live-deploy/news/index.html:100 `ton type="button" id="follow">Follow topics</button><button type="button" id="copyLink">Co` |
| Save stories for later | Personal | have | studied by hand: theguardian.com offers this (https://www.theguardian.com/international) | void-live-deploy/news/index.html:78 `c="saved" aria-pressed="false">Saved</button>` |
| The same story from several sides | Reading | missing | its live page (2026-10-28): "in Miami after Brazil election loss Far-right senator and family land in US after crossing from Brazil into Ar" | no sign of it in the source of /news/ |
| Newsletters and alerts | Personal | missing | its live page (2026-10-28): "Skip to navigation Print subscriptions Newsletters Sign in Highlights Jeanette Winterson: humans are at a tur" | no sign of it in the source of /news/ |
| Reader comments | Community | missing | its live page (2026-10-28): ":00 AM Eastern Daylight Time 8h ago … … comments Mark Carney is celebrated abroad – while he guts hard-won pro" | no sign of it in the source of /news/ |
| Fact checks and explainers | Reading | missing | its live page (2026-10-28): "is trying to disrupt the midterms Video explainer How Trump is trying to disrupt the midterms Video 4:07 From" | no sign of it in the source of /news/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "igation Print subscriptions Newsletters Sign in Highlights Jeanette Winterson: humans are at a turning point T" | void-live-deploy/news/index.html:118 `=> { try { return JSON.parse(localStorage.getItem(KEY) // '{}') // {}; } catch (_) { retu` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "port us Print subscriptions Newsletters Download the app Digital Archive Guardian Licensing Live events About" | void-live-deploy/news/index.html:277 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "hes – in pictures Gallery 10 Tip us off Share stories with the Guardian securely and confidentially Culture Hi" | void-live-deploy/news/index.html:100 `n type="button" id="copyLink">Copy link to this view</button></div>` |
| Skip to navigation | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Print subscriptions | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Opinion | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Culture | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Lifestyle | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| US politics | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Midterms 2026 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Climate crisis | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Middle East | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Ukraine | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| US immigration | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Soccer | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
