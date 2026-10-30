# podbean.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: podbean.com (https://www.podbean.com/)
- Verse: /podcasts/?show=verse&ep=ep1 (podcasts: podbean.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Free Podcast hosting and Monetizing Platform / Podbean"
- History: [docs/HISTORY/podbean.com.md](../HISTORY/podbean.com.md)

**Match: 53%**: 16 have, 0 partial, 1 missing, 13 unreviewed, of 30 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Search podcasts and episodes | Find | have | its live page (2026-10-28): "Podbean Podbean Logo Toggle navigation Search Search Search Podcasting Podcast Features Podcast Hosting Start" | void-live-deploy/podcasts/index.html:90 `el class="vh" for="q" id="qL">Search podcasts, or paste an RSS link</label>` |
| Top charts and categories | Find | have | its live page (2026-10-28): "st practices, and helpful tips. Popular Topics How to Start a Podcast The step-by-step guide to start your own" | void-live-deploy/podcasts/index.html:92 `on type="button" id="homeBtn">Top podcasts</button></div>` |
| Play episodes | Listening | have | its live page (2026-10-28): "dcast. Video to Podcast Convert YouTube playlists to podcasts, videos to audios. AI Podbean AI AI-Enhanced Aud" | void-live-deploy/podcasts/index.html:114 `" class="go" aria-label="Play">Play</button><button type="button" id="fwd" aria-label="For` |
| Playback speed and skip buttons | Listening | have | studied by hand: podbean.com offers this (https://www.podbean.com/) | void-live-deploy/podcasts/index.html:290 `= await srcFor(e); au.defaultPlaybackRate = S.speed; au.playbackRate = S.speed; au.datase` |
| Follow shows and get new episodes | Library | have | its live page (2026-10-28): "e” section of your Podbean settings and follow the steps to “Connect to Spotify”. What statistics come with Po" | void-live-deploy/podcasts/index.html:96 `false" aria-controls="folPane">Following</button>` |
| Download for offline listening | Library | have | its live page (2026-10-28): "er demographics and engagement metrics. Download it now. Download Podbean app on App Store Download Podbean ap" | void-live-deploy/podcasts/index.html:116 `<button type="button" id="pDl">Download</button><button type="button" id="pShare">Share</b` |
| Transcripts | Listening | have | its live page (2026-10-28): "ctured chapter markers, and AI-enhanced transcripts that deliver accurate, engaging, and polished text for eve" | void-live-deploy/podcasts/index.html:118 `w"><label class="vh" for="tq">Search the transcript</label><input type="search" id="tq" cl` |
| Chapters | Listening | have | its live page (2026-10-28): "titles and show notes, well-structured chapter markers, and AI-enhanced transcripts that deliver accurate, en" | void-live-deploy/podcasts/index.html:117 `old" id="chap" hidden><summary>Chapters</summary><ul class="chaps" id="chapList"></ul></de` |
| Import and export subscriptions (OPML) | Library | have | its live page (2026-10-28): "ur podcast is easy and free. First, you import your current content using our free importing tool . Then, you" | void-live-deploy/podcasts/index.html:102 `ton type="button" id="opmlIn">Import OPML</button><input type="file" id="opmlFile" accept=` |
| Ratings and reviews | Community | have | its live page (2026-10-28): "king. Judy Rodman See over 3,000 5-star reviews from podcasters Featured Podcasts That Don‘t Sound Right That" | void-live-deploy/podcasts/index.html:132 `re are no paid subscriptions, ratings or reviews, and nothing syncs between devices; expor` |
| Hosts, guests and credits | Data | missing | its live page (2026-10-28): "Free Podcast hosting and Monetizing Platform / Podbean Podbean Logo Toggle navigation Search Search Search Po" | no sign of it in the source of /podcasts/ |
| Host your own podcast | Creators | have | its live page (2026-10-28): "Free Podcast hosting and Monetizing Platform / Podbean Podbean Logo Toggle navigation Search Search Search Po" | void-live-deploy/podcasts/index.html:122 `or:var(--ink);font-size:18px">Verse Out Loud</h2><small>Pinned first: Verse's own weekly s` |
| A sleep timer | Listening | have | its live page (2026-10-28): "unds Oasis / Relaxing Nature Sounds For Sleep, Meditation, Relaxation Or Focus / Sounds Of Nature / Sleep Soun" | void-live-deploy/podcasts/index.html:87 `ink. Play with speed, skip, a sleep timer, chapters and a queue; follow shows, save episod` |
| A podcast API | Developers | have | its live page (2026-10-28): "bean Amplified Podcast Badges Resources Developers Podbean Plugins --> Podbean About Us Podbean Blog Careers P" | void-live-deploy/podcasts/index.html:162 `try { const r = await fetch('/api/podcasts?' + qs); const j = await r.json().catch(() =>` |
| An account that keeps your things on every device | Accounts | have | its live page (2026-10-28): "u need. Blog to Podcast Repurpose your blog into an engaging podcast. Video to Podcast Convert YouTube playlis" | void-live-deploy/podcasts/index.html:132 `tings or reviews, and nothing syncs between devices; export your follows as OPML to move t` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "ownload it now. Download Podbean app on App Store Download Podbean app on Google Play Unleash your creativity" | void-live-deploy/podcasts/index.html:418 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "roadcast. Making it easier than ever to share your voice with the world. Record from Anywhere Effortlessly des" | void-live-deploy/podcasts/index.html:390 `try { if (navigator.share) { await navigator.share({ title, text, url }); return; }` |
| Podbean Logo | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Podcasting | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Advertisers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Enterprise | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Pricing | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Resources | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Discover | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| All | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Arts | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Business | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Comedy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Education | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
