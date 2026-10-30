# howsecureismypassword.net: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: howsecureismypassword.net (https://www.howsecureismypassword.net/)
- Verse: /password-strength/ (password strength, tower gate 15 of 15, gate passed)
- Live scan: 2026-10-28, HTTP 200, page title "How Secure Is My Password?"
- History: [docs/HISTORY/howsecureismypassword.net.md](../HISTORY/howsecureismypassword.net.md)

**Match: 75%**: 3 have, 0 partial, 0 missing, 1 unreviewed, of 4 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| How long a password would take to crack | Strength | have | every site of this kind offers it | void-live-deploy/password-strength/index.html:62 `ng, how long it would take to crack from a stolen list and at a login, why, the tips that` |
| Why it is weak and how to fix it | Strength | have | every site of this kind offers it | void-live-deploy/password-strength/index.html:62 `list and at a login, why, the tips that fix it, and whether it has leaked.</p>` |
| Nothing is sent anywhere | Privacy | have | every site of this kind offers it | void-live-deploy/password-strength/index.html:71 `this device; the password is never sent anywhere, stored, or put in the address. It is an` |
| Security.org | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
