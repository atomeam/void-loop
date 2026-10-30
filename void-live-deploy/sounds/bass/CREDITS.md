# Verse's bass guitar: where the sound comes from

Every file here is a recording of a real bass guitar. Verse plays them as the bass of its band songs (lib/rap-strings.js, lib/arrange.js). tools/instruments.py rebuilds them from the originals: mono, 24 kHz, 16-bit, the pluck moved to the first sample, cut at 2.5 seconds with a 0.4 second fade, every take of a note at one level.

- From "Swagbass" by Karoryfer Lecolds, https://github.com/sfzinstruments/karoryfer.swagbass, released under CC0 1.0 (public domain dedication). The readme says: "Royalty-free for all commercial and non-commercial use. Copyright 2014 Karoryfer Lecolds."
- Instrument: a bass guitar (an Ibanez BTB-400QM, refinished) on flatwound strings, played and mapped by D. Smolken, recorded direct from the neck pickup with no effects and the onboard EQ flat.
- Files: {note}-soft.wav and {note}-hard.wav for the MIDI notes 24 to 45 every 3 semitones (C1, D#1, F#1, A1, C2, D#2, F#2, A2), from the velocity layers p (soft) and f (hard), round robin 1. Karoryfer names its notes one octave up from the usual names, so its c2 is MIDI 24 here.
