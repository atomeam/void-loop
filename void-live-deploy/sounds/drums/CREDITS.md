# Verse's drum kits: where each sound comes from

Every file here is a recording of a real instrument. Verse plays them in its beats (lib/rap-kit.js). tools/drum-kits.py rebuilds them from the originals: mono, 48 kHz, 16-bit, the hit moved to the first sample, the tail cut and faded.

## 808/ (a real Roland TR-808)

- Recorded by Michael Fischer (Technopolis), "Roland TR-808 Rhythm Composer Sound Sample Set 1.0.0" (1994), sampled directly from the individual outputs of TR-808 serial 103852. The author released the set as free ("these samples are ABSOLUTELY FREE!") with no restrictions on use.
- Taken from the npm package @fluid-music/tr-808 (Fluid Music, ISC license), which redistributes the set and adds the bass drum tuned to G1 (BDTuned) that Verse plays as its 808 bass.
- Files: kick-1, kick-2 (BD1025, BD2525), bass-1, bass-2 (BDTuned BD2510-g1, BD0010-g1), snare-1, snare-2 (SD2525, SD5050), clap-1 (CP), hat-1 (CH), ohat-1, ohat-2 (OH25, OH75), crash-1 (CY5050), rim-1 (RS), cowbell-1 (CB).

## kit/ (an acoustic drum kit and hand percussion)

- From the Versilian Community Sample Library (VCSL) by Versilian Studios, https://github.com/sgossner/VCSL, released under CC0 1.0 (public domain dedication).
- Files: kick (Bass Drum 1, two dynamics, two takes each), snare (Snare Drum Modern 1, three dynamics, two takes each), rim (stick), hat (Hi-Hat closed, three dynamics), ohat (Hi-Hat open), pedal (Hi-Hat pedal), crash and ride (Suspended Cymbal 1), clap (four takes), tomhi and tomlo (Tom 1 and Tom 2), tamb (Tambourine 1), shaker (Shaker Small).

## Left out on purpose

Sample sets whose terms forbid commercial use or changes to the samples (some free TR-909 sets say "not for profit" and "do not change samples") are not used.
