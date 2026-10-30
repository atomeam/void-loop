# chordchord.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: chordchord.com (https://chordchord.com/chord-finder)
- Verse: /chords/ (music: chordchord.com, tower gate 14 of 16)
- Live scan: 2026-10-28, HTTP 200, page title "Chord Finder: Discover and Play Chords on Piano &amp; Guitar"
- History: [docs/HISTORY/chordchord.com.md](../HISTORY/chordchord.com.md)

**Match: 31%**: 5 have, 0 partial, 2 missing, 9 unreviewed, of 16 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Chord progressions in a key | Writing | have | its live page (2026-10-28): "ongwriter looking for the perfect chord progression, use the Chord Finder to quickly test out different chord" | void-live-deploy/chords/index.html:145 `<h2>Progressions in this key</h2>` |
| Play the chords | Writing | have | its live page (2026-10-28): "Chord Finder: Discover and Play Chords on Piano & Guitar Chord Finder Discover piano and guitar chords instan" | void-live-deploy/chords/index.html:111 `button" id="cPlay" class="go">Play the chord</button><button type="button" id="cArp">Play` |
| Choose the key and the mode | Writing | have | its live page (2026-10-28): "er Chord Finder Note Finder Note Finder Scales : Scale Finder Scale Finder Piano Scales Piano Scales Guitar Sc" | void-live-deploy/chords/index.html:139 `<h2>Chords in this key</h2>` |
| Generate random progressions | Writing | missing | its live page (2026-10-28): "tar Scales Songwriting : Song Structure Generator Song Structure Generator Song Ideas Generator Song Ideas Gen" | no sign of it in the source of /chords/ |
| Export MIDI | Files | missing | studied by hand: chordchord.com offers this (https://chordchord.com/chord-finder) | no sign of it in the source of /chords/ |
| Build a whole song with parts | Writing | have | its live page (2026-10-28): "iano Scales Guitar Scales Guitar Scales Songwriting : Song Structure Generator Song Structure Generator Song I" | void-live-deploy/chords/index.html:104 `><a href="/?q=make%20me%20a%20song">Make me a song</a></nav>` |
| Guitar and piano diagrams | Writing | have | its live page (2026-10-28): "ord Finder: Discover and Play Chords on Piano & Guitar Chord Finder Discover piano and guitar chords instantly" | void-live-deploy/chords/index.html:113 `<h2>Guitar fingerings</h2>` |
| 1 . Free Chord Finder Tool | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 2 . How to Use the Chord Finder | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| 3 . Practical Examples | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| ChordChord.com | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Online Metronome | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Circle of Fifths | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Note Finder | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Drum Machine | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
| Printable Staff Paper | Unreviewed | unreviewed | a menu item, button or box on its live page (2026-10-28) | not compared yet |
