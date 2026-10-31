# podchaser.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: podchaser.com (https://www.podchaser.com/)
- Verse: /podcasts/?show=verse&ep=ep1 (podcasts: podchaser.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Podchaser: The #1 Podcast Database &amp; API"
- History: [docs/HISTORY/podchaser.com.md](../HISTORY/podchaser.com.md)

**Match: 46%**: 12 have, 0 partial, 1 missing, 13 unreviewed, of 26 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search podcasts and episodes | Find | have | its live page (2026-10-28): "asts Charts Charts open menu Monitoring Search podcasts, credits, & more... Search podcasts, credits, & more.." | void-live-deploy/podcasts/index.html:90 `el class="vh" for="q" id="qL">Search podcasts, or paste an RSS link</label>` |
| Top charts and categories | Find | have | its live page (2026-10-28): "casts Podchaser Logo open menu Podcasts Charts Charts open menu Monitoring Search podcasts, credits, & more..." | void-live-deploy/podcasts/index.html:92 `on type="button" id="homeBtn">Top podcasts</button></div>` |
| Play episodes | Listening | have | its live page (2026-10-28): "search engine – powering discovery for listeners, creators, brands, and agencies. Search and browse over 6 mi" | void-live-deploy/podcasts/index.html:114 `" class="go" aria-label="Play">Play</button><button type="button" id="fwd" aria-label="For` |
| Follow shows and get new episodes | Library | have | its live page (2026-10-28): "e & API Podchaser Open menu Podchaser - Follow, Share and Rate Podcasts Podchaser Logo Podchaser - Follow, Sha" | void-live-deploy/podcasts/index.html:96 `false" aria-controls="folPane">Following</button>` |
| Download for offline listening | Library | have | its live page (2026-10-28): "or podcast data, search, and discovery. Download the App Upgrade to Pro X/Twitter Facebook Linkedin Instagram" | void-live-deploy/podcasts/index.html:116 `<button type="button" id="pDl">Download</button><button type="button" id="pShare">Share</b` |
| Transcripts | Listening | have | its live page (2026-10-28): "each Power Score™ Contacts Brand Safety Transcripts Sponsor History Host & Guest Credits Chart Rankings and mo" | void-live-deploy/podcasts/index.html:118 `w"><label class="vh" for="tq">Search the transcript</label><input type="search" id="tq" cl` |
| Ratings and reviews | Community | have | its live page (2026-10-28): "f podcasts by categories, demographics, ratings, reviews, host and guest credits, and more. Discover episodes" | void-live-deploy/podcasts/index.html:132 `re are no paid subscriptions, ratings or reviews, and nothing syncs between devices; expor` |
| Hosts, guests and credits | Data | missing | its live page (2026-10-28): "s open menu Monitoring Search podcasts, credits, & more... Search podcasts, credits, & more... Ctrl K Open adv" | no sign of it in the source of /podcasts/ |
| Host your own podcast | Creators | have | its live page (2026-10-28): "ine – powering discovery for listeners, creators, brands, and agencies. Search and browse over 6 million podca" | void-live-deploy/podcasts/index.html:122 `or:var(--ink);font-size:18px">Verse Out Loud</h2><small>Pinned first: Verse's own weekly s` |
| A podcast API | Developers | have | its live page (2026-10-28): "Podchaser: The #1 Podcast Database & API Podchaser Open menu Podchaser - Follow, Share and Rate Podcasts Podc" | void-live-deploy/podcasts/index.html:162 `try { const r = await fetch('/api/podcasts?' + qs); const j = await r.json().catch(() =>` |
| An account that keeps your things on every device | Accounts | have | its live page (2026-10-28): "d open menu For Business open menu More Log In Contact Sales Contact Sales open menu Podcasts Charts Charts op" | void-live-deploy/podcasts/index.html:132 `tings or reviews, and nothing syncs between devices; export your follows as OPML to move t` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "or podcast data, search, and discovery. Download the App Upgrade to Pro X/Twitter Facebook Linkedin Instagram" | void-live-deploy/podcasts/index.html:418 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "Podchaser Open menu Podchaser - Follow, Share and Rate Podcasts Podchaser Logo Podchaser - Follow, Share and R" | void-live-deploy/podcasts/index.html:390 `try { if (navigator.share) { await navigator.share({ title, text, url }); return; }` |
| Podchaser Logo | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Contact Sales | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| All | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Podcasts | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Episodes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Lists | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Brands | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| podcast database | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Best Podcasts | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| New Podcasts | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Best Episodes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Add a Podcast | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
