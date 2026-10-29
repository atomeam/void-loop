# listennotes.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: listennotes.com (https://www.listennotes.com/)
- Verse: /podcasts/?show=verse&ep=ep1 (podcasts: listennotes.com, tower gate 1 of 15)
- Live scan: 2026-10-28, HTTP 403, page title "Are you a robot? 2a09:bac1:7681:1c50::3dc:44"
- History: [docs/HISTORY/listennotes.com.md](../HISTORY/listennotes.com.md)

**Match: 73%**: 8 have, 0 partial, 1 missing, 2 unreviewed, of 11 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search podcasts and episodes | Find | have | every site of this kind offers it | void-live-deploy/podcasts/index.html:90 `el class="vh" for="q" id="qL">Search podcasts, or paste an RSS link</label>` |
| Top charts and categories | Find | have | every site of this kind offers it | void-live-deploy/podcasts/index.html:92 `on type="button" id="homeBtn">Top podcasts</button></div>` |
| Play episodes | Listening | have | its live page (2026-10-28): "or none at all, when you log in to your Listen Notes account. Your IP address is 2a09:bac1:7681:1c50::3dc:44 ." | void-live-deploy/podcasts/index.html:114 `" class="go" aria-label="Play">Play</button><button type="button" id="fwd" aria-label="For` |
| Follow shows and get new episodes | Library | have | every site of this kind offers it | void-live-deploy/podcasts/index.html:96 `false" aria-controls="folPane">Following</button>` |
| Transcripts | Listening | have | studied by hand: listennotes.com offers this (https://www.listennotes.com/) | void-live-deploy/podcasts/index.html:118 `w"><label class="vh" for="tq">Search the transcript</label><input type="search" id="tq" cl` |
| Import and export subscriptions (OPML) | Library | have | studied by hand: listennotes.com offers this (https://www.listennotes.com/) | void-live-deploy/podcasts/index.html:102 `ton type="button" id="opmlIn">Import OPML</button><input type="file" id="opmlFile" accept=` |
| Hosts, guests and credits | Data | missing | studied by hand: listennotes.com offers this (https://www.listennotes.com/) | no sign of it in the source of /podcasts/ |
| A podcast API | Developers | have | studied by hand: listennotes.com offers this (https://www.listennotes.com/) | void-live-deploy/podcasts/index.html:162 `try { const r = await fetch('/api/podcasts?' + qs); const j = await r.json().catch(() =>` |
| An account that keeps your things on every device | Accounts | have | its live page (2026-10-28): "obot?" checks, or none at all, when you log in to your Listen Notes account. Your IP address is 2a09:bac1:7681" | void-live-deploy/podcasts/index.html:132 `tings or reviews, and nothing syncs between devices; export your follows as OPML to move t` |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://www.listennotes.com/ | not compared yet |
