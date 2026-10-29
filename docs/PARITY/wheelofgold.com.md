# wheelofgold.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: wheelofgold.com (https://wheelofgold.com/)
- Verse: /prizes/ (prizes, tower gate 0 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Wheel of Gold"
- History: [docs/HISTORY/wheelofgold.com.md](../HISTORY/wheelofgold.com.md)

**Match: 50%**: 1 have, 1 partial, 1 missing, 0 unreviewed, of 3 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Spin a wheel for prizes | Games | have | every site of this kind offers it | void-live-deploy/prizes/index.html:73 `<p class="sub" id="lead">Spin a weighted prize wheel, check the real odds and expected v` |
| Crypto rewards and gambling | Games | missing | every site of this kind offers it | no sign of it in the source of /prizes/ |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "lease use a larger device. Home Support Login Register Blockchain Crypto Rewards Ready to earn without spendin" | void-live-deploy/lib/handoff.js:33 `nction get(store = globalThis.localStorage) {` |
