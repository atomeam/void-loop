# Shows

Both shows use `void-live-deploy/lib/show-pipe.js` and `tools/show-pipe.mjs`.

1. A plain feat from the growth ledger. No codes, prices, paths, or reflection asks.
2. A free model writes it. Workers AI when credentials are present, otherwise `/api/answer`.
3. Hard checks, then a second free model scores clarity, originality, entertainment, and impressive. Under 6, or an average under 7, is rewritten once. A second miss is not published.
4. Kokoro (Apache-2.0, the `af_sky` voice file for Verse and the `bm_george` voice file for Critic). Both sit in the same room: the same gentle EQ and compressor, and only a light pitch difference (`VOICE_AF`). Each spoken line is loudness-matched, and so is the mix. Those are voice files, not names. The speaker is Critic. Piper's lessac and ryan voice files are not used.
5. The next line starts when the previous file ends. One caption. The gate rejects overlapping boxes, overlapping speech, a mid-word wrap, and the jargon list.
6. Scores go to `void-live-deploy/studio/scores.json`. The next writer reads the notes and whether the marks rose.

A listener can follow it without knowing what a commit is. It does not read the git log, fill a mad-lib, or use the media-player exam as a score.

Open on a question. One true feat. Critic is a pompous fool who is wrong, then loses. Funny, never aimed at a real person. Whole sentences. Close by inviting people to ask Verse for anything at a-to-mind.com. A Short is under twenty seconds. A daily episode stays short until a judge says it is thin.

Pipelines studied, nothing copied. [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) (MIT): script, voice, captions, picture, mix, and do not publish a failed take. [podcastfy](https://github.com/souzatharsis/podcastfy) (Apache-2.0): two hosts, one voice each. NotebookLM's public shape: cold open, disagreement, payoff. [WhisperX](https://github.com/m-bain/whisperX) and [subcap](https://github.com/bighippoman/subcap): captions follow the spoken words. Verse times the file it just spoke, so each caption is that line. ffmpeg sidechain ducking keeps the voice near -14 LUFS.

`/studio/` is the first visitor stage: an animated short, one caption, two browser voices. Next: a timing bench, a music mixer, a thumbnail maker, then the full editor.

## Held against human shows

The automated pipelines above are the floor. A Verse show is also measured against human work, on craft only: would a stranger stay, is there a joke with a payoff, does one real event carry a number. The mark is 0 to 10. Under 6 is not published. The named shows are a ruler. They are not a format, a catchphrase, or a bit to reuse. Critic's bit, the shape of the episode, and the jokes are invented for Verse.

The listener is a free model, asked several ways, and the mark is the lowest answer. A calibration run scores three bad scripts (the journal-rules episode, the thirty-four second talking book, and a page reading) and one hand-written good script. If that run cannot put the bad ones under 6 and the good one at 6 or more, the judge cannot separate them, and nothing is published.

**Reply All, Yes Yes No** (Alex Goldman and PJ Vogt). What to measure: a concrete thing is in the open, one person is lost, the joke is about that thing, and they do not talk at the same time. Not a shape to reuse.

**Hard Fork** (Kevin Roose and Casey Newton). What to measure: a subject and a number arrive immediately, and the two hosts disagree. Not a shape to reuse.

**No Such Thing As A Fish** (Dan Schreiber and the QI elves). What to measure: a fact, then a consequence that is actually funny, and an ending that remembers the opening. Not a shape to reuse. "I have a note" is not Verse's bit.

**Veritasium**. What to measure: the question or the demonstration is already happening, and the caption is the spoken words.

**Mark Rober**. What to measure: the result is already on screen, and the picture changes.

**Tom Scott**. What to measure: one concrete thing, and the ending remembers the opening. Cuts land on a clause.

**Half as Interesting** (Sam Denby). What to measure: the joke is a specific detail of a real constraint, and the on-screen text is that detail.

**Vox**. What to measure: one number, one claim.

None of these is a format, a catchphrase, or a bit. Critic's bit on this show is his own: he tries to sign a card the visitor has already closed. The episode is that card, the signature, and the clock. `tools/show-judge.mjs` asks a free model three ways and keeps the lowest mark. `separates` in `void-live-deploy/lib/show-pipe.js` is the calibration. If it is false, nothing is published.
