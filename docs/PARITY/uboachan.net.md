# uboachan.net: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: uboachan.net (https://uboachan.net/)
- Verse: /boards/ (image boards: uboachan.net, tower gate 12 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Uboachan"
- History: [docs/HISTORY/uboachan.net.md](../HISTORY/uboachan.net.md)

**Match: 88%**: 7 have, 0 partial, 0 missing, 1 unreviewed, of 8 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Many boards on different topics | Boards | have | every site of this kind offers it | void-live-deploy/boards/index.html:125 `el class="vh" for="sort">Sort the boards</label>` |
| Start a thread with an image | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:129 `/boards/?all=1">Every board's new threads</a></p>` |
| Reply, quoting other posts | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:222 `ton" class="go" id="replyOpen">Reply</button></div>` |
| Post without an account | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:209 `<p>Posts are anonymous. Verse keeps a keyed hash of your connection for limits and ban` |
| Images on posts | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:154 `e="radio" name="nMode" value="images" checked> Pictures and text (a thread starts with a p` |
| A catalogue view of threads | Reading | have | studied by hand: uboachan.net offers this (https://uboachan.net/) | void-live-deploy/boards/index.html:116 `o makes it. Every board has a catalog of its threads, index pages in bump order, threads t` |
| Reports and moderators | Safety | have | every site of this kind offers it | void-live-deploy/boards/index.html:201 `ection id="review" hidden><h2>Reported and hidden posts (the owner)</h2><div id="revList">` |
