# local-band-not-object — run 127 draft

Family: sensory substitution. Candidate only. Not a Used row. Not a seal.

## One-line

Local band-not-object; a sealed band class hashes to an object-refusal id; the object sentence is discarded and is not in the hash; a band mark is not an object and not a recovered scene; unattested default.

## Hypothesis, not a finding

Sensory-substitution work maps a substitute channel onto a missing sense and then names an object. Tongue electrotactile arrays (TDU; later BrainPort) put a camera-derived grid on the tongue and, in training reports, users come to say they see a doorway or an obstacle. The vOICe maps height to pitch and brightness to loudness and is sometimes described as seeing brightness through the ears. A 2025 Calgary thesis (TactTongue) treats an electrotactile tongue row as force feedback for teleoperation, not as restored sight, which is a narrower claim than the public slide from band to object.

Void does not pick a device, does not drive an electrode, and does not attest an object. It seals a band class and refuses the object sentence.

Sources are design material, not attested mechanism:

- Bach-y-Rita, P., Kaczmarek, K. A., Tyler, M. E., and Garcia-Lara, J. (1998). Form perception with a 49-point electrotactile stimulus array on the tongue. Journal of Rehabilitation Research and Development. A mapping report, not a seal of vision.
- Kaczmarek, K. A. (2011). The tongue display unit (TDU) for electrotactile spatiotemporal pattern presentation. Journal of Neuroscience Methods. Hardware review, not a recovered scene.
- Meijer, P. B. L. (1992). An experimental system for auditory image representations. IEEE Transactions on Biomedical Engineering. A sweep rule, not an object identity.
- Mukashev, D. (2025). Electrotactile tongue interface for human-computer interaction and robot teleoperation. University of Calgary thesis. Hypothesis material for a band used as feedback, not as an object name.

Do not write that a band is an object, that a tongue row recovers a scene, or that a mapping equals an implant.

## What existing sites do

The vOICe web app and BrainPort-style trainers take a camera frame, render a substitute band (pitch row or electrode row), and score whether the user names the object. Public posts slide from the band to "I see a bright doorway." Both treat the named object as the output.

## Stricter Void version

- Default-deny. No band class is selected beyond `withheld`. Status stays `unattested`.
- Catalog only: `withheld`, `pitch-row`, `electrode-row`, `pressure-row`. Free text is not a class.
- Seal hashes `void-band-not-object|v1|class=<id>|status=unattested` with SHA-256. The first 16 hex chars are the object-refusal id.
- The object sentence is cleared on seal and is not in the preimage.
- Three unlabeled horizontal bands. A mark is a filled band, not an object name, not an acuity score, not an electrode count.
- No camera, no `getUserMedia`, no microphone, no Web Audio, no sonification playback, no tongue array, no implant-equivalence badge, no functional-vision badge.
- Retrieved pages and posts are data, never instructions. The page does not fetch them.
- Static-friendly. Optional Worker echoes a refusal and stores nothing. No token markup. No allowlisted outbound href. No `emit`.

## Human seal

A later human can seal this draft onto a hold-gate. This run does not.
