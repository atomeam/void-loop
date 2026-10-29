# textboard.org: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: textboard.org (https://textboard.org/)
- Verse: /boards/ (image boards: textboard.org, tower gate 1 of 16)
- Live scan: 2026-10-28, HTTP no answer
- History: [docs/HISTORY/textboard.org.md](../HISTORY/textboard.org.md)

**Match: 78%**: 7 have, 0 partial, 0 missing, 2 unreviewed, of 9 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Many boards on different topics | Boards | have | every site of this kind offers it | void-live-deploy/boards/index.html:125 `el class="vh" for="sort">Sort the boards</label>` |
| Start a thread with an image | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:129 `/boards/?all=1">Every board's new threads</a></p>` |
| Reply, quoting other posts | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:222 `ton" class="go" id="replyOpen">Reply</button></div>` |
| Post without an account | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:209 `<p>Posts are anonymous. Verse keeps a keyed hash of your connection for limits and ban` |
| Images on posts | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:154 `e="radio" name="nMode" value="images" checked> Pictures and text (a thread starts with a p` |
| Archived threads | Reading | have | studied by hand: textboard.org offers this (https://textboard.org/) | void-live-deploy/boards/index.html:116 `;&gt;quotes and greentext, an archive of old threads, search, tripcodes, sage and spoilers` |
| Reports and moderators | Safety | have | every site of this kind offers it | void-live-deploy/boards/index.html:201 `ection id="review" hidden><h2>Reported and hidden posts (the owner)</h2><div id="revList">` |
| Its live pages could not be read (HTTP no answer), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://textboard.org/ | not compared yet |
