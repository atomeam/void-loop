# Verse's electric guitar: where the sound comes from

Every file here is a recording of a real electric guitar, played clean. Verse plays them as the guitar and lead of its band songs (lib/rap-strings.js, lib/arrange.js). The amp is not a recording: lib/arrange.js drives the clean guitar into its own waveshaper and cabinet filter. tools/instruments.py rebuilds the files from the originals: mono, 24 kHz, 16-bit, the pluck moved to the first sample, every take of a note at one level.

- From "Black And Green Guitars" by Karoryfer Lecolds, https://github.com/sfzinstruments/karoryfer.black-and-green-guitars, released under CC0 1.0 (public domain dedication). The readme says: "Royalty-free for all commercial and non-commercial use. Copyright 2022 Karoryfer Lecolds."
- Instrument: the green guitar, a Gretsch Anniversary, recorded by Brian Wood.
- Files: {note}-held.wav for the MIDI notes 40 to 73 every 3 semitones, from Samples/green/ord (twang, layer f, round robin 1), cut at 2.5 seconds with a 0.4 second fade; {note}-mute1.wav and {note}-mute2.wav for the MIDI notes 40 to 64 every 3 semitones, from Samples/green/stac (staccato, round robins 1 and 2), cut at 0.5 seconds with a 0.15 second fade. Karoryfer names its notes one octave up from the usual names, so its e3 is MIDI 40 here.
