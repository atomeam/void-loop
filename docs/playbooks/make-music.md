# Make music: an original piece, composed from the ask, synthesised in the browser

**Starts when:** someone asks Verse to make a song, beat, lullaby, tune or "music for <a mood>" (owner, 2026-10-17: "void should also learn how to make music"). Not when they ask it to play a recording or find lyrics.

1. **Choose the mood from the words.** `moodOf(ask)` in `void-live-deploy/lib/compose.js` matches mood words (lullaby, rain, dark, epic, happy, beat ...) to a tempo range, scales, a drum style and a lead sound. No mood word: the seed picks one and the card says so.
2. **Seed from the ask's own words** (`hashOf` of the words with filler removed), so the same ask gives the same piece. Never `Math.random()` in the composition; a test compares two runs.
3. **Compose with the music's own rules, not a model:** a key (12 tonics), a scale (major, minor, dorian, phrygian, the two pentatonics), a four-chord progression built on the seven-note parent scale, a bass on the chord roots, a two-bar melodic motif that walks by steps on the scale, repeated, varied once, and ending on the tonic, and a drum pattern per style. Every melody note is checked to be in its scale.
4. **Synthesise with Web Audio only** (`schedule(ctx, piece, t0)`): oscillators (sine, triangle, square, sawtooth) with an envelope, seeded noise through filters for snare and hat, a swept sine for the kick. No sample, no file, no model call, no paid service. `schedule` takes any context, so the same code plays live and renders offline.
5. **Say only what was made:** `describe(piece)` builds its sentence from the composed values (key, scale, bpm, bars, chords). A new skill is rated experiment; the card says so.
6. **Card:** a piano roll in inline SVG (melody, bass, three drum rows), Play/Stop (one `AudioContext`, closed on stop), Save as WAV (`renderWav`: `OfflineAudioContext`, 22.05 kHz mono, `wavBytes`), Copy the notes (`notesText`).
7. **Tests:** `node --test tools/compose.test.mjs` (same ask same piece, mood sets tempo, notes in scale, ends at home, WAV header, schedule on a fake context, match/near-miss), then `node tools/test_void.mjs --only "Verse music"` (card, Play/Stop, copy, a real download that starts with RIFF/WAVE, "play some music" not taken).
8. **Ship:** `node tools/new-skill.mjs` for a new skill file, add it to a family in `tools/families.mjs`, regenerate `tools/deps.mjs` and the book, a line in `docs/MAP.md`, `tools/finish.mjs`.

**Mistakes already made:** a near-miss "make a list of songs" matched the make-a-song pattern (guard on list, lyrics, playlist); playing a recording and composing one are different asks; the card's own sentence must come from the piece, not a template that could name a key it did not use; a headless browser cannot judge how it sounds, so the test checks the audio graph runs, the WAV is real and the notes are in the scale, and a person has to listen.

**Next, when asked:** a second instrument layer and a call and answer between two melodies; swing; a longer form (verse and chorus); letting the person say "slower", "in a minor key", "add drums" and re-compose with the same seed plus that change.
