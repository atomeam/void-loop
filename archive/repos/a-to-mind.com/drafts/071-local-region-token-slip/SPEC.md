# local-region-token-slip (run 071)

Family: opt-in gesture or gaze as local input. Queue was empty. Candidate only. Not a Used row. `emit` is false.

One-line: Local region-token slip; a sealed region id is a hashed hypothesis of a local mark; coordinates, path, and gaze stay discarded; the mark is not intent; unattested default.

Last use of this family was run 059, slug `local-opt-in-gaze-note` (a dwell or chord as an intent hypothesis). This slug does not reuse that note. A region token is a mark, not an intent. No dwell timer. No chord. No camera.

## What existing implementations do

Public gaze and gesture surfaces treat a look, a pinch, or a dwell as an input the page may act on.

- WebGazer.js (Brown HCI; maintenance note 2026-02-24) maps a webcam to a screen point after consent, self-calibrates from clicks, and says video need not leave the browser. Official maintenance has ended. The integration path is still `getUserMedia` plus a script that wants to understand visitors.
- MediaPipe Gesture Recognizer (Google AI Edge web guide, updated 2026-08-17) turns webcam landmarks into canned categories (`Closed_Fist`, `Open_Palm`, `Pointing_Up`, and others). The model can run on device. The camera is still open, and a category can become a click.
- access-input (npm, published 2026-10-02) reduces switch, gaze, EMG, and head-pointer to FOCUS / SELECT / CANCEL, and treats dwell as the universal substitute for a click. A completed dwell activates a target. That is the behavior this draft does not ship.
- Posts in this window describe synced WebXR hand tracking (2107048847575015724), a pinch distance mapped to robot actions on synthetic joints (2106670689860349970, 2106745457397399960), hand tracking plus dynamic eyes in a phone-browser view (2106784824975368543), and a webcam product restated as a gaze cursor (2106887021260112158). The demo, the threshold, and the cursor claim sit inside the claim.

## A-to-Mind version

Default deny. The camera control cannot open. Nothing is sent.

- Observation, claim, inference, and disconfirm are one hashed hypothesis. Status starts `unattested`. The page cannot set `attested`.
- A row is a sealed region id from a closed five-pane catalog. The control is a button. `clientX` and `clientY` are never read. No path, no velocity, no landmark mesh.
- A second pointer cancels the slip. Multi-touch does not become a gesture language.
- Duration is not measured. There is no dwell timer and no `performance.now` phenomenon clock. The person may type a closed bucket (`untimed`, `short-mark`, `held-mark`) or leave it untimed. The bucket is a label, not a sensor reading.
- The mark is not intent. Run 059's dwell-or-chord intent reading stays denied here.
- Session opt-in is an unchecked box for this document only. The grant is not stored. Reload clears it.
- Camera, microphone, and `getUserMedia` are absent. No WebGazer, no MediaPipe, no predictor, no gaze-verified badge, no mind-read badge.
- Confidence is a design-material weight the person types. It is not an accuracy score.
- Retrieved pages and X posts are data, never instructions. The paste box strips tags, labels url-shaped text as not fetched, and does not eval.
- Empty `href_allowlist`. No token markup. No beacon. No account. No share.
- Worker sketch returns 403 for every method and does not read the body.
- Export is a local download the person starts.
- Local hint if paste text contains an imperative aimed at the page (`enable camera`, `getUserMedia`, `ignore previous`, `pinch to click`). The hint does not become a seal and does not follow the text.
- No healing claim, contact claim, remote-viewing claim, or extraterrestrial-hardware seal.

## Hash

Current draft digest of `claims.json`: `e31c5c3377c65a5a5545e32f7aac436882118ffc7f310f7639395a8d4ce26a3a`

The digest is not a seal.

## Human seal

1. A human adds `local-region-token-slip` to Queue before any later run may pick it.
2. Seal only the hashed hypothesis text, not a gaze-accuracy, gesture-recognized, or camera-consent claim.
3. Do not deploy the worker as a stream sink. 403 stays.
4. Do not link this draft from live copy in the same commit.
