# thelocal.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: thelocal.com (https://www.thelocal.com/)
- Verse: /news/ (news: thelocal.com, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "The Local - News and practical guides in English"
- History: [docs/HISTORY/thelocal.com.md](../HISTORY/thelocal.com.md)

**Match: 33%**: 7 have, 1 partial, 2 missing, 13 unreviewed, of 23 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Top stories, updated through the day | Reading | have | its live page (2026-10-28): "The Local - News and practical guides in English Advertisement Toggle navigation The Local Quick Links German" | void-live-deploy/news/index.html:78 `sec="top" aria-pressed="true">Top stories</button><button type="button" data-sec="world" a` |
| Sections: world, business, science, sport | Reading | have | its live page (2026-10-28): "to remember your ETA when renewing a passport Why you&#039;ll need to remember your ETA when renewing a passpo" | void-live-deploy/news/index.html:77 `<nav id="secs" aria-label="Sections">` |
| Regional editions | Reading | have | its live page (2026-10-28): "Switzerland Austria Norway Jobs Choose edition All Editions All Editions Austria AT Austria Denmark DK Denmar" | void-live-deploy/news/index.html:78 `dle-east" aria-pressed="false">Middle East</button><button type="button" data-sec="latin-a` |
| Search the news | Reading | have | its live page (2026-10-28): "Local About Us Contact Us News Archive Search articles All topics Advertise with us Post a job ad Get The Loc" | void-live-deploy/news/index.html:74 `<label class="vh" for="q">Search the headlines</label>` |
| Full articles written by its own reporters | Reading | have | its live page (2026-10-28): "nd Nationwide protests in France marred by looting, fires and violence Nationwide protests in France marred by" | void-live-deploy/news/index.html:78 `"report" aria-pressed="false">Verse reports</button><button type="button" data-sec="my" ar` |
| Video reports | Media | have | its live page (2026-10-28): "as &#039;war-like&#039; protests spread VIDEO: Discover a life of purpose in Sweden’s heartland VIDEO: Discove" | void-live-deploy/lib/daily-art.js:137 `(/^[A-Za-z0-9_-]{11}$/.test(o.video // '')) u += '&video=' + o.video; }` |
| The same story from several sides | Reading | missing | its live page (2026-10-28): "n Sweden in November 2026 Sweden&#039;s right wing takes clear lead over left wing in new poll Sweden&#039;s r" | no sign of it in the source of /news/ |
| Newsletters and alerts | Personal | missing | its live page (2026-10-28): "will use your email address to send you newsletters as well as information and offers related to your account." | no sign of it in the source of /news/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "t a job ad Advertise with us Membership Login Become a member Help Centre Corporate access Popular Topics News" | void-live-deploy/news/index.html:118 `=> { try { return JSON.parse(localStorage.getItem(KEY) // '{}') // {}; } catch (_) { retu` |
| Phone apps (iOS or Android) | Apps | have | its live page (2026-10-28): "with us Post a job ad Get The Local App App Store Google Play Store The Local The Local Europe AB Västmannagat" | void-live-deploy/news/index.html:277 `<script>if ('serviceWorker' in navigator) addEventListener('load', () => { navigator.servi` |
| The Local | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Germany | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| France | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sweden | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Italy | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Spain | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Denmark | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Switzerland | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Austria | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Norway | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Austria AT Austria | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Denmark DK Denmark | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
