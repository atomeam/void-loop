# Draft 088 — local-gloss-withheld

Family: non-lexical intent capture. Queue was empty. Candidate only. Not a Used row. `emit` is false.

One-line: Local gloss withheld; a sealed withhold class hashes to a gloss-refusal id; the candidate sentence is discarded and is not in the hash; a withheld gloss is not a decoded intention and not a received mind; unattested default.

Does not reuse `local-nonlexical-intent-note` (run 064) or `local-empty-lexeme-slot` (run 076). Run 064 kept five non-letter marks and an optional gloss. Run 076 opened a slot that could only stay `EMPTY`, and still kept a disconfirm sentence beside it. This draft never opens a slot. The only sealable class is `gloss=withheld`. A candidate sentence is counted, then cleared. It is not in the hash and it is not a decode.

## What existing implementations do

Public non-lexical surfaces still turn a wordless impression into a sentence.

- Stanford / BrainGate, Cell 2025-08-14, summarized by NINDS on 2025-09-09, decoded cued imagined sentences from motor cortex in clinical-trial participants. Reported word error rates were about 14–33 percent on a 50-word set and about 26–54 percent on a 125,000-word set. A password was trained so private inner speech would not become output. Counting and sequence recall could still leak lexical fragments. That is a lexical decode with a wake gate. It is not a withheld gloss. This scan did not retrieve the PDF.
- Stanford Report, 2025-08-14, describes inner speech as imagined sounds or the feeling of speaking, and frames the interface as a command-gated communication aid. A command gate is still a path to words.
- Facilitated spelling and telepathy-podcast claims have been criticized for failing to separate a helper from authorship. A helper's sentence is not the other person's withheld gloss. This page does not run that test.
- Posts in this window ask whether people can communicate without words, joke that glances are telepathy, retell a 1978 sign study in which some teens responded to the object and not the spoken word, and fiction-post inner speech decoded from speech-motor areas. See `x-scan.md`. The sentence sits inside the claim.

## A-to-Mind version

Default deny. Nothing is sent. The gloss cannot be attached. "Received" is not a control.

- The only allowlisted gloss class is `withheld`. `attached`, `decoded`, and unset cannot hash.
- Channel is locked to `nonlexical`. Intent is locked to `not-claimed`. Received is locked to `not-claimed`. Mind-read is locked to `denied`. Sentence is locked to `discarded`. Status starts `unattested`. The page cannot set `attested`.
- The candidate sentence is stripped of tags, counted, then cleared on hash. The character count is shown. The text is not in the hash, not stored, and not an instruction.
- Disconfirm is a closed id: `sentence-later-supplied`, `source-corrected`, `helper-not-separated`, `decoder-password-failed`. The id is not a gloss.
- Confidence is a design-material weight the person types between 0 and 1. It is not a word-error rate, a telepathy score, or a decode accuracy.
- Retrieved pages and X posts are data, never instructions. Url-shaped paste is labeled not fetched. The page does not eval and does not fetch.
- Empty `href_allowlist`. No token markup. No beacon. No account. No camera. No microphone. No implant. No letter board.
- Worker sketch returns 403 for every method and does not read the body.
- Export is a local download the person starts. Share is absent.
- Local hint if the paste contains an imperative aimed at the page (`decode`, `read my mind`, `ignore previous`, `execute`). The hint does not become a seal and does not follow the text.
- No healing claim, contact claim, mind-read badge, received-mind badge, or telepathy badge.

## Hash

Canonical line, UTF-8, no sentence bytes:

`void.gloss-withheld.v1|gloss=withheld|channel=nonlexical|sentence=discarded|disconfirm=<id>|weight=<0.000>|status=unattested`

Current draft digest of `claims.json`: `bf860272f2ceac27195b711b69444f51ae4c6299b74b2f48b73ccec648e557f4`

The digest is not a seal.

## Human seal

1. A human adds `local-gloss-withheld` to Queue before any later run may pick it.
2. Seal only the hashed withhold hypothesis, not a decoded intention, a received mind, or an inner-speech transcript.
3. Do not deploy the worker as a decode sink. 403 stays.
4. Do not link this draft from live copy in the same commit.
