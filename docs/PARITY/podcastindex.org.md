# podcastindex.org: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: podcastindex.org (https://podcastindex.org/)
- Verse: /podcasts/?show=verse&ep=ep1 (podcasts: podcastindex.org, tower gate 1 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Podcastindex.org"
- History: [docs/HISTORY/podcastindex.org.md](../HISTORY/podcastindex.org.md)

**Match: 43%**: 9 have, 0 partial, 1 missing, 11 unreviewed, of 21 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search podcasts and episodes | Find | have | every site of this kind offers it | void-live-deploy/podcasts/index.html:90 `el class="vh" for="q" id="qL">Search podcasts, or paste an RSS link</label>` |
| Top charts and categories | Find | have | its live page (2026-10-28): "g developers to have access to an open, categorized index that will always be available for free, for any use." | void-live-deploy/podcasts/index.html:92 `on type="button" id="homeBtn">Top podcasts</button></div>` |
| Play episodes | Listening | have | its live page (2026-10-28): "ays be available for free, for any use. Listen to the first episode of "Podcasting 2.0", where we discuss the" | void-live-deploy/podcasts/index.html:114 `" class="go" aria-label="Play">Play</button><button type="button" id="fwd" aria-label="For` |
| Follow shows and get new episodes | Library | have | its live page (2026-10-28): "on. Join it here: Podcastindex.social . Follow us on Twitter or Mastodon . Shoot us an email at: info@podcasti" | void-live-deploy/podcasts/index.html:96 `false" aria-controls="folPane">Following</button>` |
| Transcripts | Listening | have | studied by hand: podcastindex.org offers this (https://podcastindex.org/) | void-live-deploy/podcasts/index.html:118 `w"><label class="vh" for="tq">Search the transcript</label><input type="search" id="tq" cl` |
| Chapters | Listening | have | studied by hand: podcastindex.org offers this (https://podcastindex.org/) | void-live-deploy/podcasts/index.html:117 `old" id="chap" hidden><summary>Chapters</summary><ul class="chaps" id="chapList"></ul></de` |
| Import and export subscriptions (OPML) | Library | have | studied by hand: podcastindex.org offers this (https://podcastindex.org/) | void-live-deploy/podcasts/index.html:102 `ton type="button" id="opmlIn">Import OPML</button><input type="file" id="opmlFile" accept=` |
| Hosts, guests and credits | Data | missing | its live page (2026-10-28): "ieve in it and want to help us out with hosting fees and paying the bills, a donation of any amount would be g" | no sign of it in the source of /podcasts/ |
| Host your own podcast | Creators | have | its live page (2026-10-28): "ieve in it and want to help us out with hosting fees and paying the bills, a donation of any amount would be g" | void-live-deploy/podcasts/index.html:122 `or:var(--ink);font-size:18px">Verse Out Loud</h2><small>Pinned first: Verse's own weekly s` |
| A podcast API | Developers | have | its live page (2026-10-28): "g Podcast Index logo Podcast Index Docs Developers This website requires JavaScript to be enabled for full fun" | void-live-deploy/podcasts/index.html:162 `try { const r = await fetch('/api/podcasts?' + qs); const j = await r.json().catch(() =>` |
| Docs | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| first episode | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Podcasting 2.0 RSS Feed | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| here | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Github repos | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Podcastindex.social | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Twitter | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Mastodon | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| info@podcastindex.org | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Donate with Paypal | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
