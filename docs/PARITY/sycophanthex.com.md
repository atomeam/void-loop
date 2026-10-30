# sycophanthex.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: sycophanthex.com (https://sycophanthex.com/)
- Verse: /fanfic/ (sycophanthex.com, tower gate 1 of 12)
- Live scan: not scanned yet
- History: [docs/HISTORY/sycophanthex.com.md](../HISTORY/sycophanthex.com.md)

**Match: 93%**: 25 have, 0 partial, 1 missing, 1 unreviewed, of 27 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| A story catalog, one row per story with its rating, chapters, words and status | Catalog | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/app.js:238 `show('index', 'Archive Descriptions & Stories');` |
| Browse the stories of one category | Browse | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/app.js:348 `: /.test(b.about) ? b.about : 'Stories in ' + b.title + '.';` |
| Browse by character | Browse | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:336 `rs</span><input type="search" id="fChars" maxlength="120" placeholder="Names, split by com` |
| Browse by genre | Browse | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:338 `ary><span>Genres:</span><span id="fGenresSay">any</span></summary><p class="quiet">A story` |
| Browse by rating, with a ratings guide | Browse | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:334 `id="fRated"><option value="">Any rating</option></select></label>` |
| Content warnings on every story, and a way to leave out stories with warnings | Browse | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:339 `type="checkbox" id="fNoWarn"> Hide stories with warnings</label>` |
| An author list and a page for each author | Browse | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:399 `class="grow" id="authorListH">Authors A to Z</h2><span class="quiet" id="authorsSay"></spa` |
| A title index from A to Z, with Other for titles that start with a number or a sign | Browse | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/app.js:301 `b.setAttribute('aria-label', 'Titles that start with a number or a sign'); az.append(b); }` |
| Sort the list alphabetically or by most recent | Browse | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/lib/fanfic.js:517 `t', newest: 'Newest stories', title: 'Title, A to Z', replies: 'Most replies' });` |
| Show completed stories only, or stories in progress only | Browse | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:335 `id="fStatus"><option value="">Complete or in progress</option><option value="Complete">Com` |
| Long lists in pages | Browse | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/lib/fanfic.js:71 `export const PER_PAGE = 20;` |
| Stories in a series | Stories | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:411 `class="grow" id="seriesListH">Series A to Z</h2><span class="quiet" id="seriesSay"></span>` |
| Chapters, word count and hits for each story | Stories | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/app.js:131 `const HITS = '/api/fanfic-hits';` |
| Reviews and a star rating for each story | Stories | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:674 `<h2 class="h1">Reviews and stars: how they work</h2>` |
| Report a story | Stories | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:470 `allengeReport" href="/boards/">Report this</a></div></section>` |
| Keyword search | Find | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:600 `<label class="vh" for="sq">Search the archive</label>` |
| The most recent stories, with an RSS feed | Find | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:383 `fandom. <a href="/fanfic/rss">Follow the newest stories by feed (RSS)</a></p>` |
| A random story and a featured story on the archive home | Find | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:307 `"><h2 class="grow" id="featH">Featured story</h2></div>` |
| Register and log in | Accounts | missing | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | no sign of it in the source of /fanfic/ |
| Rules, help, a ratings guide and an uploading guide | Help | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:740 `<h2 class="h1">Writing rules &amp; guidelines</h2>` |
| Site news with comments, and a news archive | Community | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:693 `class="h1">Site news and the news archive</h2>` |
| Lists of recommended stories | Community | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:425 `h2 class="grow" id="recsListH">My rec list</h2><span class="quiet" id="recsSay"></span></d` |
| Writing contests with winners | Community | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:488 `utton class="go" type="submit">Name the winner</button></div>` |
| Several archives by subject under one site | Community | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:312 `="/fanfic/?new=fandom" data-go>Start a fandom</a></div>` |
| Forums and a help desk | Community | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:682 `<h2 class="h1">Help desk: questions and answers</h2>` |
| Terms, disclaimer, credits and contact pages | About | have | studied by hand: sycophanthex.com offers this (https://sycophanthex.com/) | void-live-deploy/fanfic/index.html:699 `<dt>Terms, disclaimer and credits</dt><dd>The footer links the terms of use, a d` |
| Its live pages could not be read, so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://sycophanthex.com/ | not compared yet |
