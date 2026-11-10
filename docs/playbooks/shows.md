# Shows

Both shows use `void-live-deploy/lib/show-pipe.js` and `tools/show-pipe.mjs`.

1. A plain feat from the growth ledger. No codes, prices, paths, or reflection asks.
2. A free model writes it. Workers AI when credentials are present, otherwise `/api/answer`.
3. Hard checks, then a second free model scores clarity, originality, entertainment, and impressive. Under 6, or an average under 7, is rewritten once. A second miss is not published.
4. Kokoro (Apache-2.0, the `af_sky` voice file for Verse and the `bm_george` voice file for Critic). Verse is a little higher, with a light chorus and a short room. Critic is lower and drier (`VOICE_AF`). Those are voice files, not names. The speaker is Critic. Piper's lessac and ryan voice files are not used.
5. The next line starts when the previous file ends. One caption. The gate rejects overlapping boxes, overlapping speech, a mid-word wrap, and the jargon list.
6. Scores go to `void-live-deploy/studio/scores.json`. The next writer reads the notes and whether the marks rose.

A listener can follow it without knowing what a commit is. It does not read the git log, fill a mad-lib, or use the media-player exam as a score.

Open on a question. One true feat. Critic is a pompous fool who is wrong, then loses. Funny, never aimed at a real person. Whole sentences. Close by inviting people to ask Verse for anything at a-to-mind.com. A Short is under twenty seconds. A daily episode stays short until a judge says it is thin.

Pipelines studied, nothing copied. [MoneyPrinterTurbo](https://github.com/harry0703/MoneyPrinterTurbo) (MIT): script, voice, captions, picture, mix, and do not publish a failed take. [podcastfy](https://github.com/souzatharsis/podcastfy) (Apache-2.0): two hosts, one voice each. NotebookLM's public shape: cold open, disagreement, payoff. [WhisperX](https://github.com/m-bain/whisperX) and [subcap](https://github.com/bighippoman/subcap): captions follow the spoken words. Verse times the file it just spoke, so each caption is that line. ffmpeg sidechain ducking keeps the voice near -14 LUFS.

`/studio/` is the first visitor stage: an animated short, one caption, two browser voices. Next: a timing bench, a music mixer, a thumbnail maker, then the full editor.

## Held against human shows

The automated pipelines above are the floor. A Verse show is also scored against human work, on craft, not on fame or budget. The mark is 0 to 10. Under 6 means clearly worse, and the show is not published. Episode 8, the thirty-four second run of lines that do not follow, scores 3 or under on every podcast reference.

**Reply All, Yes Yes No** (Alex Goldman and PJ Vogt). The cold open is the confusing thing itself. One host is the listener, lost on purpose. The other has the explanation. Jokes come from that specific confusion, not from insulting a person. A concrete object sits in the middle. They do not talk over each other. Verse keeps the lost-host shape and the rule that a joke has to be about the fact just said.

**Hard Fork** (Kevin Roose and Casey Newton). The subject is in the first sentence. Disagreement is the engine. A real name and a real number show up before anyone sums it up. Ums are cut. The laugh stays. A short sting separates segments. Verse keeps the number and the disagreement. Verse does not copy their segments.

**No Such Thing As A Fish** (Dan Schreiber and the QI elves). A fact is the first sentence. The other host finds the absurd consequence immediately, then a second fact tops it. The jokes are about the fact. A running bit returns. The ending reuses a word from the opening. Verse keeps the running bit ("I have a note.") and the callback.

**Veritasium** shorts, including the shape of "2, 4, 8". A question or a demonstration is already happening in the first seconds. No channel introduction. The caption is the words being said. The payoff answers the question that opened it. Verse keeps the question-first opening.

**Mark Rober**. The result is already on screen in the first two seconds. The viewer is told what the payoff will be. The picture changes every few seconds. Verse keeps a moving picture from the first frame and a promise in the first line. Verse does not stage a stunt.

**Tom Scott**. One premise sentence, one concrete thing, and a callback at the end. Cuts land on the clause, not in the middle of a word. Verse keeps the callback and the clause-sized captions.

**Half as Interesting** (Sam Denby). A real constraint is framed so the odd detail is the joke. On-screen text is the noun, not a paraphrase. Information is dense. Verse keeps the specific number on screen and the joke that uses that number.

**Vox** explainers. A number or a map is in the first second. One claim, then why. Verse keeps one number and one claim per Short.

The side-by-side judge (`againstReferences` in `void-live-deploy/lib/show-pipe.js`) gives each of these a craft score from the same checks: hook, a number, lines that follow, turns that alternate, a callback, and a joke on the fact. The show's published human mark is the lowest of those scores and of the model's own comparison. Below 6, it does not go out.
