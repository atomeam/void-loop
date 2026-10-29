# player.fm: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: player.fm (https://player.fm/)
- Verse: /podcasts/?show=verse&ep=ep1 (podcasts: player.fm, tower gate 1 of 15)
- Live scan: 2026-10-28, HTTP 403, page title "Just a moment..."
- History: [docs/HISTORY/player.fm.md](../HISTORY/player.fm.md)

**Match: 82%**: 9 have, 0 partial, 0 missing, 2 unreviewed, of 11 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search podcasts and episodes | Find | have | every site of this kind offers it | void-live-deploy/podcasts/index.html:90 `el class="vh" for="q" id="qL">Search podcasts, or paste an RSS link</label>` |
| Top charts and categories | Find | have | every site of this kind offers it | void-live-deploy/podcasts/index.html:92 `on type="button" id="homeBtn">Top podcasts</button></div>` |
| Play episodes | Listening | have | every site of this kind offers it | void-live-deploy/podcasts/index.html:114 `" class="go" aria-label="Play">Play</button><button type="button" id="fwd" aria-label="For` |
| Playback speed and skip buttons | Listening | have | studied by hand: player.fm offers this (https://player.fm/) | void-live-deploy/podcasts/index.html:290 `= await srcFor(e); au.defaultPlaybackRate = S.speed; au.playbackRate = S.speed; au.datase` |
| Follow shows and get new episodes | Library | have | every site of this kind offers it | void-live-deploy/podcasts/index.html:96 `false" aria-controls="folPane">Following</button>` |
| A queue of what to play next | Library | have | studied by hand: player.fm offers this (https://player.fm/) | void-live-deploy/podcasts/index.html:116 `ton type="button" id="pQueue">Add to queue</button><button type="button" id="pDl">Download` |
| Download for offline listening | Library | have | studied by hand: player.fm offers this (https://player.fm/) | void-live-deploy/podcasts/index.html:116 `<button type="button" id="pDl">Download</button><button type="button" id="pShare">Share</b` |
| Import and export subscriptions (OPML) | Library | have | studied by hand: player.fm offers this (https://player.fm/) | void-live-deploy/podcasts/index.html:102 `ton type="button" id="opmlIn">Import OPML</button><input type="file" id="opmlFile" accept=` |
| A sleep timer | Listening | have | studied by hand: player.fm offers this (https://player.fm/) | void-live-deploy/podcasts/index.html:87 `ink. Play with speed, skip, a sleep timer, chapters and a queue; follow shows, save episod` |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://player.fm/ | not compared yet |
