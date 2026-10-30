# channelnewsasia.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: channelnewsasia.com (https://www.channelnewsasia.com/)
- Verse: /news/ (news: channelnewsasia.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Breaking News and Analysis on Asia and the World / Real-Time Coverage out of Asia and Singapore - CNA"
- History: [docs/HISTORY/channelnewsasia.com.md](../HISTORY/channelnewsasia.com.md)

**Match: 42%**: 12 have, 1 partial, 4 missing, 13 unreviewed, of 30 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | its live page (2026-10-28): "Breaking News and Analysis on Asia and the World / Real-Time Coverage out of Asia and Singapore - CNA Skip to" | void-live-deploy/news/index.html:78 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | its live page (2026-10-28): "aking News and Analysis on Asia and the World / Real-Time Coverage out of Asia and Singapore - CNA Skip to mai" | void-live-deploy/news/index.html:77 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | its live page (2026-10-28): "Breaking News and Analysis on Asia and the World / Real-Time Coverage out of Asia and Singapore - CNA Skip to" | void-live-deploy/news/index.html:78 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | its live page (2026-10-28): "on: Singapore Indonesia Asia World CNAR Search menu CNAR Search menu Search Edition: Singapore Indonesia Asia" | void-live-deploy/news/index.html:74 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | its live page (2026-10-28): "haze probes In a rare meeting attended by Deputy Prime Minister Gan Kim Yong, Senior Minister K Shanmugam and" | void-live-deploy/news/index.html:78 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Live pages for breaking stories | Reading | missing | its live page (2026-10-28): "page Watch Id 1431321 Type landing_page Live TV Id 1431321 Type landing_page News Reports Documentaries & Show" | no sign of it in the source of /news/ |
| Video reports | Media | have | its live page (2026-10-28): "teractives Id 1331736 Type landing_page Watch Id 1431321 Type landing_page Live TV Id 1431321 Type landing_pag" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| Radio, podcasts and audio stories | Media | have | its live page (2026-10-28): "V Schedule Id 1822266 Type landing_page Listen Id 5197731 Type landing_page CNA938 Live Id 5197731 Type landin" | void-live-deploy/news/index.html:113 `addEventListener('load', async () => {` |
| Follow topics and sources | Personal | have | its live page (2026-10-28): "laysia podcasts Wellness Thailand Japan Follow CNA Follow our news Follow our news Follow our news Facebook X" | void-live-deploy/news/index.html:100 `ton type="button" id="follow">Follow topics</button><button type="button" id="copyLink">Co` |
| Save stories for later | Personal | have | its live page (2026-10-28): "ng their nationality without knowing it Bookmark Bookmark Share How South Korean children are losing their nat" | void-live-deploy/news/index.html:78 `c="saved" aria-pressed="false">Saved</button>` |
| The same story from several sides | Reading | missing | its live page (2026-10-28): "awei App Gallery Huawei App Gallery Copyright block Copyright© Mediacorp 2026. Mediacorp Pte Ltd. All rights r" | no sign of it in the source of /news/ |
| Weather | Extras | have | its live page (2026-10-28): "a Releases Id 5302186 Type landing_page Weather Type external [Plaster/CNAB-10397] Invalid state and Login SSO" | void-live-deploy/news/index.html:105 `"/notes/">Notes</a> <a href="/weather/">Weather</a> <a href="/local/">Local TV and radio</` |
| Newsletters and alerts | Personal | missing | its live page (2026-10-28): "_page More Id 5193846 Type landing_page Newsletters Id 4398926 Type landing_page CNA Eyewitness Id 1924581 Typ" | no sign of it in the source of /news/ |
| Reader comments | Community | missing | its live page (2026-10-28): "page World Id 1821886 Type landing_page Commentary Id 1821896 Type landing_page CNA Explains Id 3384986 Type l" | no sign of it in the source of /news/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "ster] Schema mark-up Profile menu block Sign In Sign In Account My Feed Edition Menu Edition Menu Edition: Sin" | void-live-deploy/news/index.html:118 `=> { try { return JSON.parse(localStorage.getItem(KEY) // '{}') // {}; } catch (_) { retu` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "ur news Facebook X Youtube LinkedIn RSS Google Play Google Play App Store App Store Huawei App Gallery Huawei" | void-live-deploy/news/index.html:277 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "ty without knowing it Bookmark Bookmark Share How South Korean children are losing their nationality without k" | void-live-deploy/news/index.html:100 `n type="button" id="copyLink">Copy link to this view</button></div>` |
| Logo | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Singapore | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Indonesia | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| CNA | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Insider | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Lifestyle | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Luxury | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Top Stories | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| CNA Explains | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sustainability | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Singapore Parliament | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Interactives | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
