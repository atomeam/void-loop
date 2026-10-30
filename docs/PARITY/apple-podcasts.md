# Apple Podcasts: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: Apple Podcasts (https://podcasts.apple.com/)
- Verse: /podcasts/?show=verse&ep=ep1 (podcasts, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Apple Podcasts - Web Player"
- History: [docs/HISTORY/apple-podcasts.md](../HISTORY/apple-podcasts.md)

**Match: 55%**: 17 have, 0 partial, 1 missing, 13 unreviewed, of 31 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search podcasts and episodes | Find | have | its live page (2026-10-28): "le Podcasts - Web Player Apple Podcasts Search Home New Top Charts Sign In Media Controls New Featured Previou" | void-live-deploy/podcasts/index.html:90 `el class="vh" for="q" id="qL">Search podcasts, or paste an RSS link</label>` |
| Top charts and categories | Find | have | its live page (2026-10-28): "b Player Apple Podcasts Search Home New Top Charts Sign In Media Controls New Featured Previous Page NEW SEASO" | void-live-deploy/podcasts/index.html:92 `on type="button" id="homeBtn">Top podcasts</button></div>` |
| Play episodes | Listening | have | its live page (2026-10-28): "Apple Podcasts - Web Player Apple Podcasts Search Home New Top Charts Sign In Media Controls New Featured Pre" | void-live-deploy/podcasts/index.html:114 `" class="go" aria-label="Play">Play</button><button type="button" id="fwd" aria-label="For` |
| Playback speed and skip buttons | Listening | have | its live page (2026-10-28): "page","destination":{"storefront":"us","skipCache":false,"adamId":"1000797374953","showAdamId":"1423306695","h" | void-live-deploy/podcasts/index.html:290 `= await srcFor(e); au.defaultPlaybackRate = S.speed; au.playbackRate = S.speed; au.datase` |
| Follow shows and get new episodes | Library | have | its live page (2026-10-28): "s Opinion Shows is Annie-Rose Strasser. Subscribe today at nytimes.com/podcasts or on Apple Podcasts, Spotify" | void-live-deploy/podcasts/index.html:96 `false" aria-controls="folPane">Following</button>` |
| A queue of what to play next | Library | have | studied by hand: Apple Podcasts offers this (https://podcasts.apple.com/) | void-live-deploy/podcasts/index.html:116 `ton type="button" id="pQueue">Add to queue</button><button type="button" id="pDl">Download` |
| Download for offline listening | Library | have | its live page (2026-10-28): "ducers: Chia Hao Tat and Eduardo Ocampo Download Uber Eats and order now. http://ubereats.com The Ringer is co" | void-live-deploy/podcasts/index.html:116 `<button type="button" id="pDl">Download</button><button type="button" id="pShare">Share</b` |
| Transcripts | Listening | have | its live page (2026-10-28): "ezrakleinshow@nytimes.com. You can find transcripts (posted midday) and more episodes of “The Ezra Klein Show”" | void-live-deploy/podcasts/index.html:118 `w"><label class="vh" for="tq">Search the transcript</label><input type="search" id="tq" cl` |
| Chapters | Listening | have | its live page (2026-10-28): "/www.drkerryburnight.com/#joyspan + + + Chapters Chapters 00:00:00 Dedicating Your Life to Helping Others Age" | void-live-deploy/podcasts/index.html:117 `old" id="chap" hidden><summary>Chapters</summary><ul class="chaps" id="chapList"></ul></de` |
| Import and export subscriptions (OPML) | Library | have | its live page (2026-10-28): "rnalist Kyle Buchanan talks to the most important people in Hollywood to give you an insider perspective like" | void-live-deploy/podcasts/index.html:102 `ton type="button" id="opmlIn">Import OPML</button><input type="file" id="opmlFile" accept=` |
| Ratings and reviews | Community | have | its live page (2026-10-28): "The Good, The True, and The Cinema Film Reviews MORE Film Reviews Updated Oct 21 Bananas History Bananas Histo" | void-live-deploy/podcasts/index.html:132 `re are no paid subscriptions, ratings or reviews, and nothing syncs between devices; expor` |
| Hosts, guests and credits | Data | missing | its live page (2026-10-28): "RE History Updated Weekly The Guild of Ghostly Grounds The Guild of Ghostly Grounds The Guild of Ghostly Groun" | no sign of it in the source of /podcasts/ |
| Host your own podcast | Creators | have | its live page (2026-10-28): "RE History Updated Weekly The Guild of Ghostly Grounds The Guild of Ghostly Grounds The Guild of Ghostly Groun" | void-live-deploy/podcasts/index.html:122 `or:var(--ink);font-size:18px">Verse Out Loud</h2><small>Pinned first: Verse's own weekly s` |
| A sleep timer | Listening | have | its live page (2026-10-28): "edRect"},"titleAccessibilityLabel":"The Sleepy Bookshelf: Just Jane","title":"Fiction","releaseFrequency":"Upd" | void-live-deploy/podcasts/index.html:87 `ink. Play with speed, skip, a sleep timer, chapters and a queue; follow shows, save episod` |
| A podcast API | Developers | have | its live page (2026-10-28): "g","pageId":"33","pageUrl":"https://amp-api.podcasts.apple.com/v1/editorial/us/groupings?platform=web&extend%5" | void-live-deploy/podcasts/index.html:162 `try { const r = await fetch('/api/podcasts?' + qs); const j = await r.json().catch(() =>` |
| An account that keeps your things on every device | Accounts | have | its live page (2026-10-28): "ple Podcasts Search Home New Top Charts Sign In Media Controls New Featured Previous Page NEW SEASON • Why did" | void-live-deploy/podcasts/index.html:132 `tings or reviews, and nothing syncs between devices; export your follows as OPML to move t` |
| Works offline | Apps | have | its live page (2026-10-28): "d, Lovett or Leave It, Runaway Country, Offline with Jon Favreau, and more—plus exclusive content, including b" | void-live-deploy/podcasts/index.html:87 `llow shows, save episodes for offline. Kept on your device, no account.</p>` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "e’s achieved. In our conversation, Jake shares: Why he struggles to enjoy his own successHis thoughts on the V" | void-live-deploy/podcasts/index.html:390 `try { if (navigator.share) { await navigator.share({ title, text, url }); return; }` |
| The Daily | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Crime Junkie | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Dateline NBC | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Good Hang with Amy Poehler | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Up First from NPR | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| The Builders | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| REAL AF with Andy Frisella | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| History | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Leisure | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Comedy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Documentary | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| True Crime | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
