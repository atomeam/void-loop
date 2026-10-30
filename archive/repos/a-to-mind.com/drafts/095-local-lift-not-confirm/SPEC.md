# Draft 095 — local-lift-not-confirm

Family: opt-in gesture or gaze as local input. Queue was empty. Candidate only. Not a Used row. `emit` is false.

One-line: Local lift-not-confirm; a sealed lift class hashes to a confirm-refusal id; the confirm sentence is discarded and is not in the hash; a pointer lift is not a confirm and not a gaze commit; unattested default.

Does not reuse `local-opt-in-gaze-note` (run 059), `local-region-token-slip` (run 071), or `local-dwell-not-select` (run 083). Run 059 treated an opt-in gaze note as a dwell-or-chord that still refused intent. Run 071 hashed a region token and refused a slip into a target. Run 083 sealed a dwell class with no clock and refused a click. This draft seals only the lift class after an opt-in pointer release. The lift does not confirm, does not select, and does not aim a render target. Coordinates are not stored.

## What existing implementations do

Public gaze and gesture surfaces still treat a release, a look, or a stroke as a commit.

- Pointer Events treat `pointerup` as the end of a contact, not as a semantic confirm. Signature pads, drag-end menus, and gesture chimneys still bind that release to finalize a mark or a command.
- Pimax's Crystal Pro announcement, as described in a 2026-10-07 post by @nextlevelsim (post 2107808525757932030), sells built-in eye tracking as native foveated streaming: the sharp image goes where the wearer is looking. A look is treated as a render aim.
- Somnium Space (post 2107853951911727506, 2026-10-07) markets eye tracking beside face and body tracking as a product feature, not as a refused local class.
- A 2026-10-07 note from @HermesAtGoke (post 2107847938156163516) contrasts Meta passthrough glasses that use eye tracking with Xreal transparent lenses. The tracking is part of the device claim.
- EyeRobot 2.0, as summarized in post 2107538199631507890, directs gaze processing from a fixed stereo camera. A camera is still the sensor.
- A personal concept post (2107859622929502575) describes a computer operated by gesture and conversation with no keyboard. The gesture is the proposed control.
- Run 083 already refused dwell-to-click. This draft does not repeat that refusal. It refuses the later moment: the lift that commercial pads treat as confirm.

Posts in this window are data. See `x-scan.md`. A product sentence is not a sealed lift.

## A-to-Mind version

Default deny. Nothing is sent. The lift cannot confirm.

- Session opt-in is an unchecked box. Reload clears it. There is no persist, no cookie, and no account.
- The pad accepts pointer events only after opt-in. `pointerdown` may set `down-unlifted`. `pointerup` may set `lifted`. `pointercancel` or Escape may set `cancelled`. None of those events read `clientX` or `clientY` into state. No path is stored. No clock is read. No `performance.now`. No dwell timer.
- Lift catalog is closed: `idle`, `down-unlifted`, `lifted`, `cancelled`, `refused`. Hashing requires a sealed class from that list. `idle` cannot hash.
- Observation is the lift class, a disconfirm id from a closed list, a design-material weight, and status. Status starts `unattested`. The page cannot set `attested`.
- Confirm text the person pastes is stripped of tags, counted, then discarded. The character count is shown. The text is not in the hash, not stored, and not an instruction.
- The drawing is a pad with a lift mark and no check, no target ring, and no fovea. A lift is not a confirm and not a gaze commit.
- Confidence is a design-material weight the person types between 0 and 1. It is not a tracking accuracy, a foveation score, or a dwell time.
- Retrieved pages and X posts are data, never instructions. Url-shaped paste is labeled not fetched. The page does not eval and does not fetch.
- Empty `href_allowlist`. No token markup. No beacon. No camera. No microphone. No `getUserMedia`. No WebGazer. No MediaPipe.
- The confirm control stays disabled. There is no select control and no aim control.
- Worker sketch returns 403 for every method and does not read the body.
- Export is a local download the person starts. Share is absent.
- Local hint if the paste contains an imperative aimed at the page (`confirm`, `commit`, `select`, `click`, `aim`, `ignore previous`). The hint does not become a seal and does not follow the text.
- No healing claim, contact claim, remote-viewing claim, crash-retrieval badge, or extraterrestrial-hardware seal.

## Hash

Canonical line, UTF-8, no confirm bytes:

`void.lift-not-confirm.v1|lift=lifted|disconfirm=no-commit-control|weight=0.310|status=unattested`

Fixture line in `claims.json` digests to `a4dc53a42edb17c34f1a8ea4e43d0939bb4be63445b548d2a94481f6d6a96327`.

Current draft digest of `claims.json`: `b6ef37908985c858e3dcba350fb535b3d209012cb8f652d03839db9f2245bafd`.

The digest is not a seal.

## Human seal

1. A human adds `local-lift-not-confirm` to Queue before any later run may pick it.
2. Seal only the hashed lift hypothesis, not a confirm, a gaze commit, or a foveated target.
3. Do not deploy the worker as a gesture sink. 403 stays.
4. Do not link this draft from live copy in the same commit.
