# 5ch.net: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: 5ch.net (https://5ch.net/)
- Verse: /boards/ (image boards: 5ch.net, tower gate 12 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "５ちゃんねる"
- History: [docs/HISTORY/5ch.net.md](../HISTORY/5ch.net.md)

**Match: 53%**: 9 have, 0 partial, 0 missing, 8 unreviewed, of 17 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Many boards on different topics | Boards | have | every site of this kind offers it | void-live-deploy/boards/index.html:125 `el class="vh" for="sort">Sort the boards</label>` |
| Start a thread with an image | Posting | have | its live page (2026-10-28): "についてのよくある質問 [FAQ] [公式アンテナ] Clear hidden posts [クリア] Filter posts [フィルタ] &times; キーワードを入れる: キーワード [リスト表示] [フィルタ" | void-live-deploy/boards/index.html:129 `/boards/?all=1">Every board's new threads</a></p>` |
| Reply, quoting other posts | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:222 `ton" class="go" id="replyOpen">Reply</button></div>` |
| Post without an account | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:209 `<p>Posts are anonymous. Verse keeps a keyed hash of your connection for limits and ban` |
| Images on posts | Posting | have | every site of this kind offers it | void-live-deploy/boards/index.html:154 `e="radio" name="nMode" value="images" checked> Pictures and text (a thread starts with a p` |
| Search | Reading | have | studied by hand: 5ch.net offers this (https://5ch.net/) | void-live-deploy/boards/index.html:119 `<label class="vh" for="sq">Search every board</label>` |
| Hide posts by words | Reading | have | its live page (2026-10-28): "[FAQ] [公式アンテナ] Clear hidden posts [クリア] Filter posts [フィルタ] &times; キーワードを入れる: キーワード [リスト表示] [フィルタをクリア] [ページの更" | void-live-deploy/boards/index.html:130 `"panel" id="filterP"><summary>Hide posts with these words</summary>` |
| Reports and moderators | Safety | have | every site of this kind offers it | void-live-deploy/boards/index.html:201 `ection id="review" hidden><h2>Reported and hidden posts (the owner)</h2><div id="revList">` |
| A name or tripcode | Posting | have | studied by hand: 5ch.net offers this (https://5ch.net/) | void-live-deploy/boards/index.html:116 `chive of old threads, search, tripcodes, sage and spoilers, and a thread watcher kept on y` |
| X (Twitter) | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| [FAQ] | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 地震 千葉東方沖 M5.7 … [BFU★] | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| https://i.imgur.com/l7TjDXJ.jpeg | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 5chまとめブログ・アプリ運営者の皆さまへ | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Input: スレッドタイトル検索 | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Input: キーワード | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
