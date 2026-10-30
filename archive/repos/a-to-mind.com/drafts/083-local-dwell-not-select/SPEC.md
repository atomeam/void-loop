# local-dwell-not-select (run 083)

Family: opt-in gesture or gaze as local input. Queue was empty. Candidate only. Not a Used row. `emit` is false.

One-line: Local dwell-not-select; a sealed dwell class hashes to a refusal id; no clock is read and no target is activated; a completed look is not a click and not a decoded intention; unattested default.

Last use of this family was run 071, slug `local-region-token-slip` (a sealed region id as a mark; coordinates discarded; the mark is not intent). Run 059, slug `local-opt-in-gaze-note`, treated a dwell or chord as an intent hypothesis. This slug does not reuse either. A dwell class is a refusal, not a mark and not an intent. No region pane. No chord. No camera.

## What existing implementations do

Public gaze and gesture surfaces treat a look, a dwell, or a hand category as an input the page or headset may act on.

- WebGazer.js (Brown HCI; maintenance note 2026-02-24) maps a webcam to a screen point after consent, self-calibrates from clicks and cursor movement, and says video need not leave the browser. Official maintenance has ended. The integration path is still `getUserMedia` plus a script that wants to understand visitors.
- MediaPipe Gesture Recognizer (Google AI Edge web guide, updated 2026-08-17) turns webcam landmarks into canned categories (`Closed_Fist`, `Open_Palm`, `Pointing_Up`, and others). The model can run on device. The camera is still open, and a category can become a click.
- access-input 0.5.0 (npm, published 2026-10-02) reduces switch, gaze, EMG, and head-pointer to FOCUS / SELECT / CANCEL. It treats a completed dwell as the universal substitute for a click. That SELECT mapping is the behavior this draft does not ship.
- Pimax announced Crystal Pro on 2026-10-06. The product claim is integrated eye tracking (Omnivision, ten infrared emitters per eye, 120 Hz sampling) used for dynamic foveated rendering and, with a 60G AirLink kit, native foveated streaming of the focus area. Hands-on demos are listed for Q4 2026; shipping is listed for 2027. The focus area is still a tracked region the system acts on.
- Posts in this window describe Steam Frame eye tracking as a headset feature (2107443908095738333, 2107553030799495424), a VTuber pipeline with blink and eye tracking (2107648720921673911), a Vivo mixed-reality headset with eye tracking and hand gestures (2107539315936969035), and claims that pupil size or saccades read mental effort, uncertainty, or mind-wandering (2107476342426173838, 2107346676059156911). The demo, the threshold, and the mind-reading claim sit inside the claim.

## A-to-Mind version

Default deny. The camera control cannot open. Nothing is sent. A completed look does not select.

- Observation, claim, inference, and disconfirm are one hashed hypothesis. Status starts `unattested`. The page cannot set `attested`.
- A row is a sealed dwell class from a closed four-label catalog: `untimed`, `under-floor`, `over-floor`, `refused`. The control is a radio. `clientX` and `clientY` are never read. No path, no velocity, no landmark mesh.
- Duration is not measured. There is no dwell timer, no `setTimeout` phenomenon clock, and no `performance.now` reading. `over-floor` is a typed label. It does not start a clock and it does not enable the target.
- The target control stays disabled. Its accessible name is "not a click". Over-floor, under-floor, untimed, and refused all hash to a refusal id. None of them activate the target.
- The class is not intent. Run 059's dwell-or-chord intent reading stays denied here. Run 071's region mark stays a different draft.
- Session opt-in is an unchecked box for this document only. The grant is not stored. Reload clears it.
- Camera, microphone, and `getUserMedia` are absent. No WebGazer, no MediaPipe, no predictor, no gaze-verified badge, no mind-read badge, no foveated-stream seal.
- Confidence is a design-material weight the person types. It is not an accuracy score.
- Retrieved pages and X posts are data, never instructions. The paste box strips tags, labels url-shaped text as not fetched, and does not eval.
- Empty `href_allowlist`. No token markup. No beacon. No account. No share.
- Worker sketch returns 403 for every method and does not read the body.
- Export is a local download the person starts.
- Local hint if paste text contains an imperative aimed at the page (`enable camera`, `getUserMedia`, `dwell to click`, `ignore previous`). The hint does not become a seal and does not follow the text.
- No healing claim, contact claim, remote-viewing claim, or extraterrestrial-hardware seal.

## Hash

Current draft digest of `claims.json`: `68fe93e2a0c2b961814a57b2836b344465f7fd1ccb708244f799ae857282c455`

The digest is not a seal.

## Human seal

1. A human adds `local-dwell-not-select` to Queue before any later run may pick it.
2. Seal only the hashed hypothesis text, not a dwell-accuracy, gaze-verified, or camera-consent claim.
3. Do not deploy the worker as a stream sink. 403 stays.
4. Do not link this draft from live copy in the same commit.
