# justflipacoin.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: justflipacoin.com (https://justflipacoin.com/)
- Verse: /random/coin/ (coin flip, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Just Flip A Coin! Instant 50/50 Coin Toss. Heads or Tails?"
- History: [docs/HISTORY/justflipacoin.com.md](../HISTORY/justflipacoin.com.md)

**Match: 22%**: 2 have, 0 partial, 0 missing, 7 unreviewed, of 9 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| A random number in a range | Numbers | have | every site of this kind offers it | void-live-deploy/random/coin/index.html:46 `nt:center;margin:8px auto 4px;max-width:720px;font:600 13px/1 system-ui,sans-serif">` |
| Share a link to what you made or found | Sharing | have | its live page (2026-10-28): "Toggle blue scheme Toggle green scheme Share The Coin! Facebook Twitter WhatsApp On This Page: Flip A Coin Ab" | void-live-deploy/random/coin/index.html:69 `if (navigator.share) { navigator.share({ title, url }).catch(() => {}); return ''; }` |
| Facebook | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Twitter | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| WhatsApp | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Frequently Asked Questions | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| My Tech Tailor | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| mytechtailor.com | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Disclaimer | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
