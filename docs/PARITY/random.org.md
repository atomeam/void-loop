# random.org: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: random.org (https://www.random.org/)
- Verse: /random/?min=1&max=100 (random number, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "RANDOM.ORG - True Random Number Service"
- History: [docs/HISTORY/random.org.md](../HISTORY/random.org.md)

**Match: 40%**: 8 have, 1 partial, 0 missing, 12 unreviewed, of 21 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| A random number in a range | Numbers | have | its live page (2026-10-28): "on Generator makes numbers in the [0,1] range with configurable decimal places Raw Random Bytes are useful for" | void-live-deploy/random/index.html:70 `<label>To <input id="max" type="number" inputmode="decimal" step="any" value="100"></l` |
| True randomness from a physical source | Numbers | have | its live page (2026-10-28): "RANDOM.ORG - True Random Number Service Home Games Lottery Quick Pick Keno Quick Pick Coin Flipper Dice Rolle" | void-live-deploy/random/index.html:105 `secure random numbers (<code>crypto.getRandomValues</code>), each value equally likely: n` |
| Shuffle a list, pick from a list | Tools | have | its live page (2026-10-28): "k Coin Flipper Dice Roller Playing Card Shuffler Birdie Fund Generator Numbers Integers Sequences Integer Sets" | void-live-deploy/random/index.html:64 `a coin, draw raffle winners, shuffle cards or pick any number, fair and on this device.</` |
| Dice, coins and cards | Tools | have | its live page (2026-10-28): "ames Lottery Quick Pick Keno Quick Pick Coin Flipper Dice Roller Playing Card Shuffler Birdie Fund Generator N" | void-live-deploy/random/index.html:64 `n:center;margin:0 0 8px">Roll dice, flip a coin, draw raffle winners, shuffle cards or pic` |
| Sequences without repeats | Numbers | have | its live page (2026-10-28): "Birdie Fund Generator Numbers Integers Sequences Integer Sets Gaussian Numbers Decimal Fractions Raw Bytes Li" | void-live-deploy/random/index.html:74 `ut id="uniq" type="checkbox"> no repeats</label>` |
| Random strings and passwords | Tools | have | its live page (2026-10-28): "Raw Bytes Lists & More List Randomizer Strings Passwords Clock Times Calendar Dates Geographic Coordinates Bi" | void-live-deploy/random/index.html:125 `, w = Math.floor(m / sc), f = String(m - w * sc).padStart(d, '0'); return (neg ? '-' : '')` |
| Verified prize draws with a record | Tools | have | its live page (2026-10-28): "- True Random Number Service Home Games Lottery Quick Pick Keno Quick Pick Coin Flipper Dice Roller Playing Ca" | void-live-deploy/random/index.html:64 `8px">Roll dice, flip a coin, draw raffle winners, shuffle cards or pick any number, fair` |
| An API | Developers | have | its live page (2026-10-28): "ng FAQ Web Tools Widgets for Your Pages API for Automated Clients Old API for Automated Clients Old Guidelines" | void-live-deploy/visit.js:9 `navigator.sendBeacon('/api/visit', JSON.stringify({ p: location.pathname, r: r, w: n` |
| An account that keeps your things on every device | Accounts | partial | its live page (2026-10-28): "Quotations about Randomness What's New! Login Search RANDOM.ORG True Random Number Service Warning: Your brows" | void-live-deploy/lib/handoff.js:33 `nction get(store = globalThis.localStorage) {` |
| Games | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Keno Quick Pick | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Birdie Fund Generator | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Numbers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Integers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Integer Sets | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Gaussian Numbers | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Decimal Fractions | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Raw Bytes | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Clock Times | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Calendar Dates | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Geographic Coordinates | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
