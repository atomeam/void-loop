# 4chan: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: 4chan (https://www.4chan.org/)
- Verse: /boards/ (image boards, tower gate 1 of 16)
- Live scan: 2026-10-28, HTTP 403, page title "Verification Required"
- History: [docs/HISTORY/4chan.md](../HISTORY/4chan.md)

**Match: 88%**: 14 have, 0 partial, 0 missing, 2 unreviewed, of 16 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Many boards on different topics | Boards | have | every site of this kind offers it | void-live-deploy/boards/index.html:125 `el class="vh" for="sort">Sort the boards</label>` |
| Start a thread with an image | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:129 `/boards/?all=1">Every board's new threads</a></p>` |
| Reply, quoting other posts | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:222 `ton" class="go" id="replyOpen">Reply</button></div>` |
| Post without an account | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:209 `<p>Posts are anonymous. Verse keeps a keyed hash of your connection for limits and ban` |
| Images on posts | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:154 `e="radio" name="nMode" value="images" checked> Pictures and text (a thread starts with a p` |
| A catalogue view of threads | Reading | have | studied by hand: 4chan offers this (https://www.4chan.org/) | void-live-deploy/boards/index.html:116 `o makes it. Every board has a catalog of its threads, index pages in bump order, threads t` |
| Archived threads | Reading | have | studied by hand: 4chan offers this (https://www.4chan.org/) | void-live-deploy/boards/index.html:116 `;&gt;quotes and greentext, an archive of old threads, search, tripcodes, sage and spoilers` |
| Search | Reading | have | studied by hand: 4chan offers this (https://www.4chan.org/) | void-live-deploy/boards/index.html:119 `<label class="vh" for="sq">Search every board</label>` |
| Watch threads for new replies | Reading | have | studied by hand: 4chan offers this (https://www.4chan.org/) | void-live-deploy/boards/index.html:196 `on type="button" id="watchBtn">Watch</button><a class="btn" id="toTop" href="#top">Top</a>` |
| Threads update by themselves | Reading | have | studied by hand: 4chan offers this (https://www.4chan.org/) | void-live-deploy/boards/index.html:196 `ton type="button" id="updNow">Update now</button><button type="button" id="watchBtn">Watch` |
| Hide posts by words | Reading | have | studied by hand: 4chan offers this (https://www.4chan.org/) | void-live-deploy/boards/index.html:130 `"panel" id="filterP"><summary>Hide posts with these words</summary>` |
| Reports and moderators | Safety | have | every site of this kind offers it | void-live-deploy/boards/index.html:201 `ection id="review" hidden><h2>Reported and hidden posts (the owner)</h2><div id="revList">` |
| A name or tripcode | Posting | have | studied by hand: 4chan offers this (https://www.4chan.org/) | void-live-deploy/boards/index.html:116 `chive of old threads, search, tripcodes, sage and spoilers, and a thread watcher kept on y` |
| Text formatting (quotes, spoilers) | Posting | have | studied by hand: 4chan offers this (https://www.4chan.org/) | void-live-deploy/boards/index.html:164 `<summary>Try the formatting</summary>` |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://www.4chan.org/ | not compared yet |
