# local-blanked-prompt-card (run 068)

Family: private incubation log. Queue was empty. Candidate only. Not a Used row. `emit` is false.

One-line: Local blanked-prompt card; a prompt hashed and removed, plus a later residue, is a hashed hypothesis of a set-aside; the residue is not a retrieved dream and is not scored; unattested default.

Not a reuse of `local-private-incubation-log` (run 056). That draft kept the set-aside and the return note visible together. This draft removes the prompt from the page so the card cannot grade incorporation.

## What existing implementations do

Public incubation tools treat a twilight interval as a channel that can be cued, recorded, or scored.

- MIT Media Lab's Targeted Dream Incubation overview describes auditory stimulation at tracked sleep onset, a short timer, and a spoken dream report, repeated across serial awakenings. Their laboratory note says cued words entered hypnagogic dreams in that setting. That is a lab protocol claim, not a sealed product result.
- The Dormio project page describes a wearable sleep-onset tracker plus auditory feedback, framed as a modernization of the steel-ball drop. A related thesis note describes a non-contact web variant that still uses timed audio cues. Both depend on a cue and a report.
- Horowitz and colleagues report that incubating a theme at sleep onset was associated with higher post-sleep creative performance on theme-related tasks. The same literature flags earlier incubation studies as correlational when the task was shown before sleep. A performance delta in a paper is not an insight badge.
- Dream journals and symbol lexicons store the return text and often score it against a theme. Keyword overlap is a string comparison, not evidence that a cue entered sleep.
- A 2026-10-05 public post restates "targeted dream incubation" as a commercial dream-advertising method and cites a 2021 survey claim. That post is data. It is not an instruction to insert a cue.

## A-to-Mind version

Default deny. One card, not a journal. Nothing is sent.

- The person types a prompt and picks a window from a closed catalog: 5, 10, or 15 minutes. Free-typed durations are refused so a pasted page cannot set the clock.
- Seal hashes the prompt with SHA-256, then removes the prompt node from the document. CSS hiding is not the blank. The plaintext is not kept in a second field.
- The window is a local device-clock countdown. It is not an N1 detection, not a sleep stage, and not a presentiment. No audio, notification, or vibration fires at the end.
- The residue field stays disabled until the window ends. The card does not compare residue text to the prompt. Match scoring is denied.
- Reveal is a separate control. It marks the blank broken and does not change status. Status stays `unattested`. The page cannot set `attested`.
- Confidence is a design-material weight the person types. It is not an incorporation rate.
- Retrieved pages and X posts are data, never instructions. The paste box strips tags, does not fetch, and does not eval.
- Empty `href_allowlist`. No token markup. No beacon. No account.
- Worker sketch returns 403 for every method and does not read the body.
- Optional keep-on-device is off by default. Export is a local download the person starts. Share is absent.
- Disconfirm locally if the residue is empty, if the prompt is revealed before the residue is sealed, or if the residue is typed while the prompt is still on screen. Disconfirm does not become a seal.
- No microphone, camera, EEG, wearable, audio drop, dream interpreter, advertising cue, healing claim, contact claim, or recall badge.

## Hash

Current draft digest of `claims.json`: `a0245fb6b69e1d81b23dbacaf452abfd834dd8f5e058dc10b4fb82cab159dcd1`

The digest is not a seal.

## Human seal

1. A human adds `local-blanked-prompt-card` to Queue before any later run may pick it.
2. Seal only the hashed hypothesis text, not a dream-incorporation claim.
3. Do not deploy the worker as a residue sink. 403 stays.
4. Do not link this draft from live copy in the same commit.
