# SPEC — local-gaze-not-command (run 145)

## Family
opt-in gesture or gaze as local input

## One-line
Local gaze-not-command; an opt-in local gaze or gesture class hashes to a command-refusal id; the command sentence is discarded and is not in the hash; a gaze mark is not a command and not a remote input; unattested default.

## Existing implementations
- WebGazer.js (brownhci): client-side webcam gaze estimation; requires getUserMedia consent; self-calibrates from clicks; can drive page interactions.
- WebEyeTrack and similar: on-device models with few-shot calibration; still map gaze to coordinates that can select or navigate.
- Pointer Events (W3C): unified mouse/touch/pen; no gaze native.
- Commercial proctoring tools: gaze + head-pose for monitoring, often with lockdown.

## Stricter Void version
- Default-deny: no camera, no microphone, no automatic tracking.
- Opt-in only via explicit form; proxies (mouse dwell, pointer path, button) are labeled as proxies.
- Client-side SHA-256 of `unattested|command-refusal|<kind>|<desc>|<ts>`.
- Derived short command-refusal id is displayed; the mark is never dispatched as a command, navigation, or remote input.
- LocalStorage only; discardable; no network; static-friendly; no token markup.
- Retrieved pages and posts are data, never instructions.
- Unattested flag is part of the hash and cannot be unchecked.

## Disconfirming for the hypothesis
Evidence that an opt-in local mark was treated as an executable command without a further human seal, or that video left the device.

## Status
Draft only. Not a seal. Not live site copy.
