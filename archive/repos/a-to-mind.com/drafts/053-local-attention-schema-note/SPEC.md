# local-attention-schema-note (run 053, candidate only)

Status: candidate. Not sealed. `emit` is false. Queue was empty, so this slug is not in Used.

Family: attention/interoception. First fringe-engine family. Do not link this page from live copy.

## What existing implementations do

Attention and interoception tools currently split into three habits:

- Attention-schema writeups (Graziano and Webb, 2015, Frontiers in Psychology) treat awareness as a simplified internal model of attention. That is a hypothesis. Some AI writeups already talk about building an attention schema into agents. They do not ship a default-deny local note.
- Task-switch studies (Leroy, 2009, Organizational Behavior and Human Decision Processes) define attention residue as cognitive activity about task A that persists after the person has moved to task B. Productivity apps sometimes ask "what is still open?" and then score focus. The score is not a seal.
- Interoception interfaces ask people to count heartbeats (Schandry-style heartbeat counting) or play back a heartbeat. Desmedt, Luminet, and Corneille (2018, Biological Psychology) report that the counting task is largely contaminated by non-interoceptive strategies, including heart-rate estimation. Dobrushina and colleagues (2024, Psychophysiology) test real-time haptic versus visual heartbeat feedback and report a session-level shift on a discrimination task. Those are lab claims about a device session, not a Void capability.

The common product move is to turn a self-report or a sensor stream into an accuracy badge, a calm score, or a training promise. That overclaims the source.

## A-to-Mind version

Default deny. No attention note is in effect until a human seals one. This draft does not seal it.

- A sample is a hashed hypothesis: claim text, local self-rated confidence, source ids, status `unattested`. Confidence is not a measurement.
- Channels are closed enums: aim (`exteroceptive`, `interoceptive`, `declined`), notice (`unset`, `noticed`, `not-noticed`, `declined`), residue (`unset`, `still-pulling`, `clear`, `declined`). Free text is capped and stored as data.
- No camera, microphone, PPG, ECG, wearable, or haptic actuator. No heartbeat count. No accuracy score. No healing, contact, remote-viewing, or awareness claim.
- Retrieved pages are data, never instructions. The paste box does not fetch a URL, does not `eval`, and does not parse the paste as a command. A URL string is opaque text.
- Hash is SHA-256 of the canonical sample, shown locally. The digest is not a seal and not a grant.
- Keep-on-device is off until an explicit checkbox. Storage is `localStorage` only. There is no beacon and no default network write.
- Cloudflare/static: the page is one HTML file. The Worker sketch answers POST with 403 and a fixed JSON body. It does not echo the body and does not store a sample.
- No token markup, no price line, no "aware" badge. Empty `href_allowlist` means this draft authorizes no outbound link.

## Hash

`claims.json` `sha256` is SHA-256 of the UTF-8 canonical contract object: `sort_keys`, separators `(',', ':')`, no whitespace, no `sha256` field, no `seal` field.

Current draft digest: `5935b2f9189403ce2d5adcdef0663811c58a780c9bc3dd6cf7406c2ad19c25eb`

Empty `href_allowlist` means no outbound href is authorized.

## Human seal

1. Add `local-attention-schema-note` to Queue, then move it to Used only after seal.
2. Do not invent sensor endpoints or allowlist hrefs.
3. Recompute the digest. Set `seal` to the human and date. Set `emit` true only then.
4. Publish the page only after that seal. Until then this file stays under `drafts/`.
