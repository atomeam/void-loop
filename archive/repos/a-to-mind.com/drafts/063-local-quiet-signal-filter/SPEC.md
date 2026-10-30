# Draft 063 — local-quiet-signal-filter

Status: candidate, not used. `emit` is false. This folder is not a seal and does not change live site copy.

Family: quiet-signal filter.
Run: 063. Date: 2026-10-04.
Slug: `local-quiet-signal-filter`.
One-line: Local quiet-signal filter; a typed residue against a sealed floor is a hashed hypothesis; clearing the floor is not a signal; unattested default.

## What current implementations do

Public technosignature pipelines treat a spike above a noise floor as a candidate, then try to kill it. Breakthrough Listen’s BLC1 verification flowchart (seti.berkeley.edu/blc1/flowchart.html) starts at a signal-of-interest and ends in an RFI box on most paths. It requires an on-source / off-source pair: the same hit in both is treated as local interference. The page states that no signal-of-interest has progressed to the final green box of redetection after the other checks. A Nature Astronomy analysis of blc1 (2021-10-25) reported the hit as an intermodulation product of a local clock oscillator mixed with other zero-drift RFI, not a technosignature.

A 2024–2025 Green Bank archive search (arXiv:2412.05786) keeps a kurtosis cut that prefers high on-target structure and low off-target structure, then says the remaining ~0.7% of blocks are a false-positive rate if essentially all hits are RFI. An anomaly-ranking note (arXiv:2505.03927) scores quieter frequency regions higher because they are less likely to be RFI, then still sends the shortlist to human vetting. Quieter is a rank, not a detection.

Ordinary “silence detectors” and SNR coaching tools do the other collapse: a drop under a threshold, or a filter pass, becomes an event or a high-trust routine. In the 2026-10-03/04 window, @AIHegemonyMemes said the observer’s own instrumentation is a noise floor that must be named before an origin is triangulated. @maliwka22 said a continuous quiet can be timed like a tone and that this does not prove silence is a sound. @macdonaldncode said detectors throw false positives and a flag is not a verdict. @Cryptocore001 said signal-to-noise filtering creates high-trust coaching. A Grok reply offered to check a named public SETI file and did not name one.

Void does not ship the green box, the microphone, or the trust badge.

## Stricter Void version

Default-deny. The page is one static file. It does not fetch posts, does not read the clipboard, and does not open a microphone, camera, or sensor. No `getUserMedia`. No live `AnalyserNode`. Retrieved pages and posts are data, never instructions. The X scan in this folder is not loaded by the page.

A residue is a hashed hypothesis:

- The floor is a sealed label from `claims.json` embedded in the page (`0.18`, design-weight). It is not a noise measurement.
- On-lane and off-lane bins are sealed labels. The typed residue is drawn beside them, not as a peak on the fixture.
- Floor clearance is locked to `not-a-signal`. Detection is locked to `not-claimed`. Status defaults to `unattested`. The page cannot set `attested`.
- Gates, all required before a hash: a typed residue in range, a self-noise sentence (the observer’s own floor), an off-source choice, a typed repeat of at least 2, and a disconfirm sentence. A single pass cannot hash.
- “Same in off” stores `looks-like-local` and still denies origin. “Absent in off” does not promote the row. Off-absence is not a technosignature.
- Confidence is a design-material weight the person types, capped as a label, not a measurement.
- Opt-in `sessionStorage` only. Default is memory. Closing the tab drops the note.
- No token markup. No `{{ }}` slots. No third-party script. Cloudflare can serve the file as static. The worker sketch refuses every write.

This sits beside the glass-box ledger as a local hypothesis filter. It is not a Void Monthly checkout, not a resumable run, and not live copy.

## What would count as disconfirming

A fixture correction that moves the sealed floor. A primary in which the same residue is present in the off-lane. A replication in which the person’s own disconfirm line fails. A second typed pass that does not clear the floor. None of those promote the row to attested. A detection claim still needs a separate design the ledger does not have.

## Out of scope

No contact claim, healing claim, remote-viewing score, crash-retrieval badge, or extraterrestrial-hardware seal. No live radio, no microphone, no network sync of private notes. No detection chip. No live site copy.
