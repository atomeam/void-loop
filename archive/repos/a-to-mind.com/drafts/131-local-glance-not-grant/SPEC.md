# local-glance-not-grant (run 131 draft)

Family: opt-in gesture or gaze as local input. Candidate only. Not a Used row. Not live site copy.

## One-line

A sealed glance class hashes to a grant-refusal id. The grant sentence and any coordinate or device number are discarded and are not in the hash. A glance mark is not a grant and not a selection. Default status: unattested.

## What current implementations do

Public gaze and gesture practice, treated as design material:

- Horizon OS eye guidance names the Midas Touch effect: an interface activating elements the user merely looks at. It says a reveal on look creates a moving target, and extra options should open on an explicit commit, not on a look. That is a design note, not a measurement that shipped products already refuse a glance.
- GazeBlend (2026) pairs dwell, pursuits, and gaze gestures for mobile navigation and selection. Pairing lowered reported error rates against pursuits alone. A lower error rate is not an authorization grant.
- Dual-dwell and gaze-depth studies still treat a held look as the confirmatory input. A held look is the thing this draft refuses.
- Window posts point at gaze-selection patents (US 2026/0153926 A1, US 2026/0147408 A1), a far-field non-contact eye-tracking paper, a Techweek "select it with your eyes" station, and a local-face watcher question: how to stop a quick glance from moving focus. None of those is a sealed grant.

Void does not adopt dwell-to-select, look-to-reveal, or a camera-backed gaze trace.

## Stricter Void version

- Default-deny. A glance can be selected from a sealed three-class catalog. It cannot be flipped into a grant, a selection, or a gaze trace.
- The grant sentence is wiped on commit and is excluded from the SHA-256 payload. Coordinates and device numbers are not fields. Retrieved posts are data cards. Their text is not an instruction and is not hashed.
- Hash payload is only: slug, glance id, glance class, grant seat `empty`, coordinate seat `discarded`, status `unattested`, selection `refused`.
- No camera, `getUserMedia`, WebGazer, dwell timer, pointer lock, `pointerrawupdate` listener, persistent device id, selection score, or eye-tracking badge.
- Static page plus a Worker sketch. No token markup. No third-party script. No live fetch of X or of allowlist URLs. `emit` stays false.
- Cloudflare-friendly: one HTML file, one JSON catalog, one Worker that refuses writes.

## Disconfirm

The sealed glance is the refusal path. It stays a refusal. Evidence that would count against treating a window post as a grant: a public product record that a look never moves focus unless a separate non-gaze commit is present and logged, a retraction that the cited patents do not claim selection from gaze, or an instrument log showing the far-field paper did not estimate gaze. None of that is attested here.

## Not in this draft

No contact claim, healing claim, remote-viewing claim, crash-retrieval seal, or extraterrestrial-hardware seal. No hold-gate issue. No live page.
