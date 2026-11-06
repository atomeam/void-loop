# suncommunitynews.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: suncommunitynews.com (https://suncommunitynews.com/)
- Verse: /news/global-headlines/?sec=world (news: suncommunitynews.com, tower gate 13 of 15)
- Live scan: not scanned yet
- History: [docs/HISTORY/suncommunitynews.com.md](../HISTORY/suncommunitynews.com.md)

**Match: 71%**: 5 have, 0 partial, 0 missing, 2 unreviewed, of 7 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | every site of this kind offers it | void-live-deploy/news/global-headlines/index.html:91 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | every site of this kind offers it | void-live-deploy/news/global-headlines/index.html:90 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | every site of this kind offers it | void-live-deploy/news/global-headlines/index.html:91 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | every site of this kind offers it | void-live-deploy/news/global-headlines/index.html:87 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | every site of this kind offers it | void-live-deploy/news/global-headlines/index.html:91 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Its live pages could not be read, so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://suncommunitynews.com/ | not compared yet |
