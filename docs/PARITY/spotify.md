# Spotify: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: Spotify (https://open.spotify.com/)
- Verse: /music/ (music, tower gate 12 of 15)
- Live scan: 2026-10-28, HTTP 200, page title "Spotify – Web Player"
- History: [docs/HISTORY/spotify.md](../HISTORY/spotify.md)

**Match: 36%**: 4 have, 0 partial, 6 missing, 1 unreviewed, of 11 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| As much content as the original (the counts are not compared yet) | Content | unreviewed | every site of this kind offers it | not studied yet |
| Stream millions of songs | Listening | have | studied by hand: Spotify offers this (https://open.spotify.com/) | void-live-deploy/music/index.html:103 `tion class="pane" aria-label="Playlists">` |
| Playlists | Library | have | studied by hand: Spotify offers this (https://open.spotify.com/) | void-live-deploy/music/index.html:103 `tion class="pane" aria-label="Playlists">` |
| Recommendations | Find | have | studied by hand: Spotify offers this (https://open.spotify.com/) | void-live-deploy/music/index.html:101 `rds and tunings, and practice recommendations. No account.</p>` |
| Search artists, songs and albums | Find | missing | studied by hand: Spotify offers this (https://open.spotify.com/) | no sign of it in the source of /music/ |
| Podcasts and audiobooks | Listening | missing | studied by hand: Spotify offers this (https://open.spotify.com/) | no sign of it in the source of /music/ |
| Lyrics | Listening | missing | studied by hand: Spotify offers this (https://open.spotify.com/) | no sign of it in the source of /music/ |
| Play on other devices | Devices | have | studied by hand: Spotify offers this (https://open.spotify.com/) | void-live-deploy/music/index.html:101 `music tools that run on your device: a metronome, a piano, a tuner, a BPM counter and a c` |
| Follow friends and share | Sharing | missing | studied by hand: Spotify offers this (https://open.spotify.com/) | no sign of it in the source of /music/ |
| A yearly listening summary | Find | missing | studied by hand: Spotify offers this (https://open.spotify.com/) | no sign of it in the source of /music/ |
| Download for offline | Listening | missing | studied by hand: Spotify offers this (https://open.spotify.com/) | no sign of it in the source of /music/ |
