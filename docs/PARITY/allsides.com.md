# allsides.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: allsides.com (https://www.allsides.com/)
- Verse: /news/ (news: allsides.com, tower gate 1 of 15)
- Live scan: 2026-10-28, HTTP 403, page title "Just a moment..."
- History: [docs/HISTORY/allsides.com.md](../HISTORY/allsides.com.md)

**Match: 67%**: 6 have, 0 partial, 1 missing, 2 unreviewed, of 9 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | every site of this kind offers it | void-live-deploy/news/index.html:78 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | every site of this kind offers it | void-live-deploy/news/index.html:77 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | every site of this kind offers it | void-live-deploy/news/index.html:78 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | every site of this kind offers it | void-live-deploy/news/index.html:74 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | every site of this kind offers it | void-live-deploy/news/index.html:78 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Follow topics and sources | Personal | have | studied by hand: allsides.com offers this (https://www.allsides.com/) | void-live-deploy/news/index.html:100 `ton type="button" id="follow">Follow topics</button><button type="button" id="copyLink">Co` |
| The same story from several sides | Reading | missing | studied by hand: allsides.com offers this (https://www.allsides.com/) | no sign of it in the source of /news/ |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://www.allsides.com/ | not compared yet |
