# virtualpiano.net: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: virtualpiano.net (https://virtualpiano.net/)
- Verse: /piano/ (music: virtualpiano.net, tower gate 16 of 18)
- Live scan: 2026-10-28, HTTP 403, page title "Just a moment..."
- History: [docs/HISTORY/virtualpiano.net.md](../HISTORY/virtualpiano.net.md)

**Match: 50%**: 4 have, 0 partial, 3 missing, 1 unreviewed, of 8 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Play with the computer keyboard | Play | have | every site of this kind offers it | void-live-deploy/piano/index.html:106 `"kb" role="group" aria-label="Piano keyboard, press a key"><div class="kbi" id="kbi"></div` |
| Song sheets to play along | Songs | have | every site of this kind offers it | void-live-deploy/piano/index.html:102 `ruments, sustain, key labels, sheets in plain letters, recording and reverb. Nothing is lo` |
| Record and play back | Play | have | studied by hand: virtualpiano.net offers this (https://virtualpiano.net/) | void-live-deploy/piano/index.html:110 `tion class="pane" aria-label="Record and replay">` |
| Other instruments | Play | have | studied by hand: virtualpiano.net offers this (https://virtualpiano.net/) | void-live-deploy/piano/index.html:105 `arimba</option><option value="harpsichord">Harpsichord</option><option value="musicbox">Mu` |
| Lessons and a guided mode | Songs | missing | studied by hand: virtualpiano.net offers this (https://virtualpiano.net/) | no sign of it in the source of /piano/ |
| Play from a MIDI keyboard | Play | missing | studied by hand: virtualpiano.net offers this (https://virtualpiano.net/) | no sign of it in the source of /piano/ |
| Sheets added by players | Songs | missing | studied by hand: virtualpiano.net offers this (https://virtualpiano.net/) | no sign of it in the source of /piano/ |
| Its live pages could not be read (HTTP 403), so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://virtualpiano.net/ | not compared yet |
