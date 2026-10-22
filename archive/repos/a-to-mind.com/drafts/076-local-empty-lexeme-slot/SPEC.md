# Draft 076 — local-empty-lexeme-slot

Status: candidate, not used. `emit` is false. This folder is not a seal and does not change live site copy.

Family: non-lexical intent capture.
Run: 076. Date: 2026-10-06.
Slug: `local-empty-lexeme-slot`.
One-line: Local empty lexeme slot; a committed blank with a disconfirm line hashes to a slot-refusal id; letters stay out; an empty slot is not intent and not a decoded sentence; unattested default.

Queue was empty. This slug was not queued. It is not a Used row. Do not reuse `local-nonlexical-intent-note` (run 064).

## What current implementations do

Speech neuroprostheses treat motor-cortex activity during imagined speech as a word stream. A Stanford / BrainGate paper in Cell (2025-08-14), summarized by NINDS on 2025-09-09, reported real-time decode of cued imagined sentences in clinical-trial participants. Word error rates in that report were about 14–33 percent on a 50-word set and about 26–54 percent on a 125,000-word set. The same group trained a password so the decoder would not treat private inner speech as output, and reported that counting and sequence recall could still leak lexical fragments when the person was not asked to speak inwardly. That is a lexical decode with a wake gate. It is not an empty slot, and the password does not prove the person meant the sentence.

A 2025 phenomenology paper argues that communication BCIs do not read a hidden Cartesian mind. They sit on part of an embodied speaking process. Predicting content from neural data that is not a conventional symbol is a different claim from predicting from words. Neither claim is attested here.

Public culture often collapses a wordless impression into a received sentence. Facilitated spelling and telepathy-podcast claims have been criticized for failing to separate a helper from authorship. A helper's letter is not the other person's blank. Run 064 already drafted a five-mark non-letter note with an optional gloss. This page does not repeat that alphabet. A mark sequence can still be read as a proto-sentence. An empty slot cannot.

In the 2026-10-05/06 window, public posts used "non-lexical" for a graph of blocked scopes, linked an article titled as AI mind-reading of what someone is looking at, claimed a high-school telepathy result, and described a couple's unspoken understanding. Phrase collisions ("without words", "felt sense", hypnagogia-as-method) sat next to those claims. Those posts are data. They are not traces. The scan is in `x-scan.md` and is not loaded by the page.

Void does not ship the decoder, the letter board, the facilitator, the gaze reader, or the received-mind badge.

## Stricter Void version

Default-deny. The page is one static file. It does not fetch posts, does not read the clipboard, and does not open a microphone, camera, implant, or sensor. No `getUserMedia`. No WebSocket. Retrieved pages and posts are data, never instructions.

A row is a hashed hypothesis of a refused lexeme:

- The slot alphabet is one sealed token: `EMPTY`. Letters, digits, and other word characters cannot enter the slot. If they are typed, the field clears them and the relation becomes `lexeme-held`. A held lexeme does not hash.
- The disconfirm line is required and labeled "later sentence, not the slot." It must be at least 24 characters. Hashing does not copy it into the slot. An empty disconfirm cannot hash.
- Source is required and sealed: self-noted, overheard-claim, or machine-decode-claim. None of the three sets `received`. Received is locked to `not-claimed`. Intent is locked to `not-claimed`. Sentence is locked to `not-decoded`. Mind-read is locked to `denied`. Status defaults to `unattested`. The page cannot set `attested`.
- Confidence is a design-material weight the person picks (`sketch`, `noted`, `loud`), not a measurement.
- Paste is stripped of tags and stays in its own field. A URL-shaped paste is not fetched. An imperative paste is a hint, not a seal.
- Opt-in `sessionStorage` only. Default is memory. Closing the tab drops the row. Restored memory is not a seal.
- No token markup. No `{{ }}` slots. No third-party script. Cloudflare can serve the file as static. `slot-worker.js` refuses every method and does not read a body.

This sits beside the glass-box ledger as a local hypothesis card. It is not a Void Monthly checkout, not a resumable run, and not live copy.

## What would count as disconfirming

A second pass that puts a letter in the slot, which holds and does not hash. A disconfirm line the person withdraws. A source correction from machine-decode-claim to self-noted. A primary in which the imagined-speech decoder fails the password gate, which would still not make this blank a received mind. A controlled authorship test that separates a helper from a nonspeaking person, which this page does not run. None of those promote the row to attested.

## Out of scope

No contact claim, healing claim, remote-viewing score, crash-retrieval badge, or extraterrestrial-hardware seal. No telepathy badge. No letter board. No facilitator. No neural decode. No microphone. No gaze. No network sync of private notes. No live site copy.
