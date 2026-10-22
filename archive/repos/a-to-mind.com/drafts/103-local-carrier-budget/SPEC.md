# Draft 103 — local-carrier-budget

Status: candidate draft. Not a Used row. Not a seal. Live site copy is unchanged.

- Date: 2026-10-07
- Run: 103
- Family: sensory substitution
- Slug: `local-carrier-budget`
- Queue: empty. This slug was not queued. It is not promoted.
- One-line: Local carrier budget; a sealed carrier class hashes to a sight-refusal id; no image, sonification, or restored-sense field exists on the page; a carrier token is a budget line, not sight and not a scene recovered through sound or touch; unattested default.

Earlier sensory-substitution slugs are not reused: `local-proxy-channel-card`, `local-encoding-not-scene`, `local-pair-not-language`. Last family use was run 091. Last six runs were correlation-not-causation sync view (097), anomalous-event timeline (098), quiet-signal filter (099), non-lexical intent capture (100), attention/interoception (101), and interval timing (102).

## What existing implementations do

Published sensory-substitution systems treat a mapping as if it already were a sense.

- The vOICe (seeingwithsound.com, including a browser web app) scans an image column by column and maps vertical position to pitch and horizontal position to time. The project describes this as vision for the blind through sound-guided mental imagery, and in this window compared a blind user of that mapping with a Cortigent Orion I implant recipient.
- EyeMusic (Amedi group) uses a related image-to-sound mapping and encodes color as musical-instrument timbre.
- BrainPort is an electrotactile tongue array (Bach-y-Rita lineage). A 2026 usability comparison with Colorophone is public; one author disclosed developing the Colorophone device under test. Dutch posts in this window that say "Brainport" refer to the Eindhoven region, not the tongue display. Those are name collisions and are not design material.
- A 2025 EPJ ST review groups visual-to-auditory sonification into column-by-column, whole-image, and depth-as-input classes, and notes sensory-cognitive overload. A 2025 npj Science of Learning paper reports that a reversed vOICe-style map was learnable by sighted adults in a short lab task. That is a learning result about a mapping, not a restored-sight result.
- Implant marketing quoted on X in this window (Paradromics page language: send visual information to restore sight and possibly add thermal perception) is a claim about a different device class. It is not evidence that a carrier token is sight.

These are hypotheses and design material. This draft does not attest restored vision, acquired synesthesia, implant equivalence, contact, healing, remote viewing, or extraterrestrial hardware.

## Stricter Void version

Default-deny. The page offers five sealed carrier classes and nothing else.

| carrier class | what the literature names | what this page allows |
|---|---|---|
| pitch-bin | vertical position as pitch | the class name only |
| time-column | horizontal scan as time | the class name only |
| instrument-timbre | color as instrument | the class name only |
| electrode-locus | tongue or skin locus | the class name only |
| depth-band | depth as an input axis | the class name only |

Denied on the page, always empty: restored-sight, object-label, distance-meters, threat, implant-equivalence, scene. No `<img>`, no canvas, no Web Audio, no `getUserMedia`, no vibration, no oscillator, no sonification, no camera permission, no free-text field.

Canonical hypothesis string, hashed in-page with SHA-256:

`carrier-budget|v1|<class>|sense-refusal`

Example: `pitch-bin` → `9ca8eb5e6e93564149de8e8344bd76cf36dabebd7817c94cb0a2361469f79394`.

The hash is a hypothesis id, not a measurement and not a seal. Confidence is a design-material weight: low that a carrier is sight; medium that a named budget line should stay separate from a restored-sense sentence. Default status: unattested.

Retrieved pages and posts stay in a data bin. They are not instructions. They are not concatenated into the hash. The worker sketch refuses any body that contains image, audio, camera, free text, or a class outside the allowlist.

Cloudflare/static-friendly: one HTML file, no build, no token markup, no third-party script. The worker is a sketch for a later human seal, not a deployed route.

## Disconfirming evidence

A disconfirm line may be chosen from a closed list. It is stored beside the hash, not inside it. What would count against the design hypothesis: a sealed methods note in which the named carrier class was not the mapping used; the same source treating that class as two different senses without a new hash; a user study whose reported recognition does not survive when the carrier axis is removed. This draft does not run that study.

## Files

- `proposed-carrier-budget.html` — static interface
- `carrier-worker.js` — default-deny sketch
- `claims.json` — hashed hypotheses, unattested
- `x-scan.md` — scan, not a seal
