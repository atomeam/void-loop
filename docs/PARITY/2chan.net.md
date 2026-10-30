# 2chan.net: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: 2chan.net (https://www.2chan.net/)
- Verse: /boards/ (image boards: 2chan.net, tower gate 12 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "�o�t������"
- History: [docs/HISTORY/2chan.net.md](../HISTORY/2chan.net.md)

**Match: 88%**: 7 have, 0 partial, 0 missing, 1 unreviewed, of 8 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Many boards on different topics | Boards | have | every site of this kind offers it | void-live-deploy/boards/index.html:125 `el class="vh" for="sort">Sort the boards</label>` |
| Start a thread with an image | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:129 `/boards/?all=1">Every board's new threads</a></p>` |
| Reply, quoting other posts | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:222 `ton" class="go" id="replyOpen">Reply</button></div>` |
| Post without an account | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:209 `<p>Posts are anonymous. Verse keeps a keyed hash of your connection for limits and ban` |
| Images on posts | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:154 `e="radio" name="nMode" value="images" checked> Pictures and text (a thread starts with a p` |
| Reports and moderators | Safety | have | every site of this kind offers it | void-live-deploy/boards/index.html:201 `ection id="review" hidden><h2>Reported and hidden posts (the owner)</h2><div id="revList">` |
| A name or tripcode | Posting | have | studied by hand: 2chan.net offers this (https://www.2chan.net/) | void-live-deploy/boards/index.html:116 `chive of old threads, search, tripcodes, sage and spoilers, and a thread watcher kept on y` |
