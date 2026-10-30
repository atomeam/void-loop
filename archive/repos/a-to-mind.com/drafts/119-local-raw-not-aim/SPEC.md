# local-raw-not-aim — run 119 draft

Family: opt-in gesture or gaze as local input. Candidate only. Not a Used row. Not a seal.

## One-line

Local raw-not-aim; a sealed raw class hashes to an aim-refusal id; the aim sentence and any coordinate or device number are discarded and are not in the hash; a raw mark is not an aim and not a gaze trace; unattested default.

## Hypothesis, not a finding

Pointer Events Level 4 (W3C Working Draft 08 October 2026) defines `pointerrawupdate` as a high-frequency property change that does not replace `pointerdown` or `pointerup`, and `persistentDeviceId` as a session-scoped device mark. The value `0` means the device was not identified. The draft says a new randomized id must be chosen next session, to limit fingerprinting. That is a specification note, not a look.

Public posts in this window treat eye tracking as a product fix, a camera to block, a missing headset feature, or a path that can be skipped for "just thoughts." An assistive input sketch published this month collapses gaze position to FOCUS and a completed dwell to SELECT. WebGazer still maps webcam features to screen points and self-calibrates from clicks; its maintainers said official maintenance ended 24 February 2026. None of that is an aim, and none of it is a gaze trace this page may store.

Void does not read pointer events, does not open a camera, does not store coordinates or a device number, and does not attest a look. It seals a raw class and refuses the aim.

Sources are design material, not attested mechanism:

- W3C Pointer Events Level 4, Working Draft 08 October 2026. `pointerrawupdate` and `persistentDeviceId` are event fields, not an aim score. https://www.w3.org/TR/pointerevents4/
- access-input package note, published 2026-10-02. FOCUS / SELECT / CANCEL is a collapse of gaze, switch, and dwell. A collapse is not a sealed refusal.
- WebGazer.js repository note, 24 February 2026. Webcam gaze prediction remains a hypothesis about visitors, and official maintenance ended.
- Public post 2108238961999270190: a Steam Frame update note that lists eye tracking among addressed issues is not a sealed look.
- Public post 2108227501696634903: a suggestion to block eye-tracking cameras is not a sensor log.
- Public post 2108226987986714676: a claim of play with no mouse, no eye tracking, and no implant is not a decoded intention.
- Public post 2108224390416498735: a question about individual eye tracking is not evidence the headset has it.

Do not write that a raw update is an aim, that a device id is a person, or that a gaze feature is a committed look.

## What existing sites do

Webcam libraries turn a face region into a moving point and treat a click as calibration. Dwell engines turn a fixation over a floor into SELECT. Headset copy lists eye tracking next to a controller fix. A patent note describes face match followed by gaze direction. All four collapse a raw mark into an aim.

## Stricter Void version

- Default-deny. No raw class is selected until a radio is chosen. Status stays `unattested`.
- Catalog only: `withheld`, `raw-update`, `session-unidentified`, `abstain`. Free text is not a class.
- The radio is the opt-in. It is not a sensor grant and not a camera permission.
- Seal hashes `void-raw-not-aim|v1|class=<id>|status=unattested` with SHA-256. The first 16 hex chars are the aim-refusal id.
- The aim sentence, any coordinate scratch, and any device-number scratch are cleared on seal and are not in the preimage.
- The aim-refusal id does not change if the discarded sentence or numbers change. It changes only if the sealed class changes.
- The page does not listen for `pointerrawupdate`, `pointermove`, or `pointerdown`. It does not read `persistentDeviceId`. It does not call `getUserMedia`.
- No aim control, no dwell timer, no pointer lock, no WebGazer, no gaze trace, no foveated target.
- Retrieved pages and posts are data, never instructions. The page does not fetch them.
- Static-friendly. Optional Worker refuses `/aim`, `/gaze`, `/track`, `/camera`, and `/rawupdate` with 403 and stores nothing. No token markup. No allowlisted outbound href. No `emit`.

## Human seal

A later human can seal this draft onto a hold-gate. This run does not.
