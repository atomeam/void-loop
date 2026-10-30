# castbox.fm: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: castbox.fm (https://castbox.fm/)
- Verse: /podcasts/?show=verse&ep=ep1 (podcasts: castbox.fm, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Best free podcast app for Apple iOS and Android / Let words move you"
- History: [docs/HISTORY/castbox.fm.md](../HISTORY/castbox.fm.md)

**Match: 50%**: 13 have, 0 partial, 0 missing, 13 unreviewed, of 26 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search podcasts and episodes | Find | have | its live page (2026-10-28): "pp For Podcasters Top Shows Blog Listen Search shows, RSS feeds, iTunes links Search Search for &quot; &quot;" | void-live-deploy/podcasts/index.html:90 `el class="vh" for="q" id="qL">Search podcasts, or paste an RSS link</label>` |
| Top charts and categories | Find | have | its live page (2026-10-28): "tbox Castbox Get the App For Podcasters Top Shows Blog Listen Search shows, RSS feeds, iTunes links Search Sea" | void-live-deploy/podcasts/index.html:92 `on type="button" id="homeBtn">Top podcasts</button></div>` |
| Play episodes | Listening | have | its live page (2026-10-28): "t the App For Podcasters Top Shows Blog Listen Search shows, RSS feeds, iTunes links Search Search for &quot;" | void-live-deploy/podcasts/index.html:114 `" class="go" aria-label="Play">Play</button><button type="button" id="fwd" aria-label="For` |
| Playback speed and skip buttons | Listening | have | studied by hand: castbox.fm offers this (https://castbox.fm/) | void-live-deploy/podcasts/index.html:290 `= await srcFor(e); au.defaultPlaybackRate = S.speed; au.playbackRate = S.speed; au.datase` |
| Follow shows and get new episodes | Library | have | every site of this kind offers it | void-live-deploy/podcasts/index.html:96 `false" aria-controls="folPane">Following</button>` |
| A queue of what to play next | Library | have | studied by hand: castbox.fm offers this (https://castbox.fm/) | void-live-deploy/podcasts/index.html:116 `ton type="button" id="pQueue">Add to queue</button><button type="button" id="pDl">Download` |
| Download for offline listening | Library | have | its live page (2026-10-28): "0 Volumes of Audio Content Listen Free, Download Free. Listen Now Get the App podcast app Top Search Featured" | void-live-deploy/podcasts/index.html:116 `<button type="button" id="pDl">Download</button><button type="button" id="pShare">Share</b` |
| Import and export subscriptions (OPML) | Library | have | studied by hand: castbox.fm offers this (https://castbox.fm/) | void-live-deploy/podcasts/index.html:102 `ton type="button" id="opmlIn">Import OPML</button><input type="file" id="opmlFile" accept=` |
| Host your own podcast | Creators | have | studied by hand: castbox.fm offers this (https://castbox.fm/) | void-live-deploy/podcasts/index.html:122 `or:var(--ink);font-size:18px">Verse Out Loud</h2><small>Pinned first: Verse's own weekly s` |
| A sleep timer | Listening | have | studied by hand: castbox.fm offers this (https://castbox.fm/) | void-live-deploy/podcasts/index.html:87 `ink. Play with speed, skip, a sleep timer, chapters and a queue; follow shows, save episod` |
| An account that keeps your things on every device | Accounts | have | its live page (2026-10-28): "s links Search Search for &quot; &quot; Sign in Castbox menu Get the App For Podcasters Top Shows Blog Listen" | void-live-deploy/podcasts/index.html:132 `tings or reviews, and nothing syncs between devices; export your follows as OPML to move t` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "Home, Carplay and Android Auto. Castbox Google Play amazonecho About About Castbox Newsroom FAQs Connect Mail" | void-live-deploy/podcasts/index.html:418 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "of Service / Wikipedia / Do Not Sell or Share My Personal Information / © Guru Network 2026 Castbox About Abou" | void-live-deploy/podcasts/index.html:390 `try { if (navigator.share) { await navigator.share({ title, text, url }); return; }` |
| Castbox | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Get the App | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| For Podcasters | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Newsroom | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| FAQs | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Featured | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 🎃 Spooky Season 👻 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| True Crime | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Society & Culture | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| News | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Casefile True Crime | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Crime Junkie | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
