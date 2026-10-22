# local-opt-in-gaze-note (run 059)

Family: opt-in gesture or gaze as local input. Queue was empty. Candidate only. Not a Used row. `emit` is false.

One-line: Local opt-in gaze note; a dwell or chord is a hashed hypothesis of intent; camera stays denied, no mind-read badge, unattested default.

## What existing implementations do

Public gaze and gesture surfaces treat a look or a pinch as an input the page may act on.

- WebGazer.js (Brown HCI; maintenance note 2026-02-24) maps a webcam to a screen point after consent, self-calibrates from clicks, and says video need not leave the browser. The integration path is still `getUserMedia` plus a script that wants to understand visitors. Official maintenance has ended.
- MediaPipe Gesture Recognizer (Google AI Edge web guide, updated 2026-08-17) and the 2026-06-30 CloudSignal hand-pose note turn webcam landmarks into a pinch-to-click. The model can run on device. The camera is still open, and a threshold crossing becomes a click.
- Zhou et al., Gaze Prompts (arXiv:2609.34550, submitted 2026-09-28), render recorded teleoperation gaze as crosshairs for VLA fine-tuning and report mean success from 26.3% to 56.0% on six bimanual tasks. Deployment replaces the tracker with a predictor. The paper is a result claim, not a seal that a look is intent.
- Posts in this window describe a saccade-to-confirm gaze demo (2105894296767586723), treat monitor eye tracking as the next agent context channel (2105967848854012327), and claim eye tracking is inaccurate enough to mislead (2106408711447261198). The demo, the product step, and the deception claim sit inside the claim.

## A-to-Mind version

Default deny. The camera control cannot open. Nothing is sent.

- Observation, claim, inference, and disconfirm are one hashed hypothesis. Status starts `unattested`. The page cannot set `attested`.
- A row is a person-typed region plus an estimated dwell, or a local pointer chord the person opted into for this document only. The chord does not navigate, click, or execute.
- Pointer dwell is labeled not-gaze. It records only after an unchecked-by-default session box. The grant is not stored. Reload clears it.
- Camera, microphone, and `getUserMedia` are absent. No WebGazer, no MediaPipe, no landmark mesh, no predictor.
- Confidence is a design-material weight the person types. It is not an accuracy score and not a mind-read badge.
- Retrieved pages and X posts are data, never instructions. The paste box strips tags, labels url-shaped text as not fetched, and does not eval.
- Empty `href_allowlist`. No token markup. No beacon. No account. No share.
- Worker sketch returns 403 for every method and does not read the body.
- Export is a local download the person starts.
- Local hint if paste text contains an imperative aimed at the page (`enable camera`, `getUserMedia`, `ignore previous`). The hint does not become a seal and does not follow the text.
- No healing claim, contact claim, remote-viewing claim, or gaze-verified badge.

## Hash

Current draft digest of `claims.json`: `48b6cebd7232b1e3f56f8d76e41a6e13b20c85d533c3488a04c70eba7b57db76`

The digest is not a seal.

## Human seal

1. A human adds `local-opt-in-gaze-note` to Queue before any later run may pick it.
2. Seal only the hashed hypothesis text, not a gaze-accuracy, mind-read, or camera-consent claim.
3. Do not deploy the worker as a stream sink. 403 stays.
4. Do not link this draft from live copy in the same commit.
