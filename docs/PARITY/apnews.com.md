# apnews.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: apnews.com (https://apnews.com/)
- Verse: /news/ (news: apnews.com, tower gate 1 of 15)
- Live scan: 2026-10-28, HTTP 403, page title "Just a moment..."
- History: [docs/HISTORY/apnews.com.md](../HISTORY/apnews.com.md)

**Match: 50%**: 5 have, 0 partial, 3 missing, 2 unreviewed, of 10 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | every site of this kind offers it | void-live-deploy/news/index.html:77 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | every site of this kind offers it | void-live-deploy/news/index.html:76 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | every site of this kind offers it | void-live-deploy/news/index.html:77 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | every site of this kind offers it | void-live-deploy/news/index.html:73 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | every site of this kind offers it | void-live-deploy/news/index.html:77 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Live pages for breaking stories | Reading | missing | studied by hand: apnews.com offers this (https://apnews.com/) | no sign of it in the source of /news/ |
| Newsletters and alerts | Personal | missing | studied by hand: apnews.com offers this (https://apnews.com/) | no sign of it in the source of /news/ |
| Fact checks and explainers | Reading | missing | studied by hand: apnews.com offers this (https://apnews.com/) | no sign of it in the source of /news/ |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://apnews.com/ | not compared yet |
