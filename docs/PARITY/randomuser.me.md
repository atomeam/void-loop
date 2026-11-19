# randomuser.me: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: randomuser.me (https://randomuser.me/)
- Verse: /random/?mode=people (random user, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Random User Generator / Home"
- History: [docs/HISTORY/randomuser.me.md](../HISTORY/randomuser.me.md)

**Match: 17%**: 2 have, 1 partial, 0 missing, 12 unreviewed, of 15 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| A random number in a range | Numbers | have | every site of this kind offers it | void-live-deploy/random/index.html:68 `nt:center;margin:8px auto 4px;max-width:720px;font:600 13px/1 system-ui,sans-serif">` |
| An API | Developers | have | its live page (2026-10-28): "ndom User Generator A free, open-source API for generating random user data. Like Lorem Ipsum, but for people." | void-live-deploy/visit.js:17 `navigator.sendBeacon('/api/visit', JSON.stringify({ p: location.pathname, r: r, w: nav` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "" } }, "email": " [email protected] ", "login": { "uuid": " 7a0eed16-9430-4d68-901f-c0d4c1c3bf00 ", "username"" | void-live-deploy/lib/handoff.js:33 `nction get(store = globalThis.localStorage) {` |
| User Photos | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Documentation | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Change Log | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Stats & Graphs | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Donate | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Photoshop Extension | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Sketch Extension | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| open-source | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| New | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| format | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| [email protected] | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Github Repo | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
