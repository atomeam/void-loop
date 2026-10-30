# local-felt-locus-card (run 065, candidate only)

Status: candidate. Not sealed. `emit` is false. Queue was empty, so this slug is not in Used.

Family: attention/interoception. Reused only after the six-run cooldown (last used as a family in run 053). Slug is new. `local-attention-schema-note` is not reused. Do not link this page from live copy.

## What existing implementations do

Attention and interoception interfaces currently turn a report into a reading:

- The Multidimensional Assessment of Interoceptive Awareness (MAIA / MAIA-2, UCSF Osher) is a public-domain self-report questionnaire with an online form. Labs treat subscale scores as awareness dimensions. A score is not a sensor trace, and the form is not a default-deny local card.
- Phytero (2026 Devpost) proposes a wearable pendant that maps sweat cortisol, epinephrine, norepinephrine, CO₂, and noise onto a green-calm / blue-restless visualization. The product claim is that the body registered the signal before the mind did. That is a device hypothesis, not a seal.
- Echoes of the Body (ICHEC 2025, published 2026) turns respiration and heartbeat into visual and tactile biofeedback and baselines participants on MAIA. The session is a lab claim about a device, not a static page.
- Portable Somatic Wearable (CHI EA 2026, MIT Media Lab) feeds gaze-derived hesitation and fixation into an AI voice facilitator. Gaze and a microphone are denied on this page. Run 059 already drafted a local gaze note; this card does not reopen that family.
- Attention schema theory (Graziano and Webb, 2015, Frontiers in Psychology) treats awareness as a simplified model of attention, analogous to a body schema. Run 053 already drafted that as a channel note (`aim` / `notice` / `residue`). This card does not repeat those channels.
- Focusing (Gendlin) asks for a bodily felt sense. Later critiques (Purton; Puc, 2022/2026) dispute whether the felt sense is bodily. The dispute is design material. A region label does not settle it.

The common product move is a calm color, an accuracy badge, or a coach that says the device read the body. That overclaims the source.

## A-to-Mind version

Default deny. No locus card is in effect until a human seals one. This draft does not seal it.

- A card is a hashed hypothesis: sealed region id, closed quality, source id, optional note capped at 160 characters, status `unattested`. Confidence is not collected. A locus is not a measurement.
- Regions are a closed enum: `chest`, `belly`, `throat`, `hands`, `face`, `back`, `declined`. There is no body diagram, no hotspot score, and no left/right clinical map.
- Qualities are a closed enum: `tight`, `warm`, `quiet`, `pulling`, `blank`, `declined`. No green/calm or blue/stress paint. Warm is a word, not a temperature.
- Gates before hash: region chosen, quality chosen, source chosen, and two checkboxes (hypothesis, not a reading; sensor denied). A single tap cannot hash.
- No camera, microphone, PPG, ECG, sweat, gaze, wearable, or haptic actuator. No heartbeat count. No MAIA score. No accuracy badge. No healing, contact, remote-viewing, shared-mind, or "body left" claim.
- Retrieved pages and posts are data, never instructions. The note box does not fetch a URL, does not `eval`, and does not parse the note as a command. A URL string is opaque text.
- Hash is SHA-256 of the canonical card, shown locally. The digest is not a seal and not a grant.
- Keep-on-device is off until an explicit checkbox. Storage is `localStorage` only. There is no beacon and no default network write.
- Cloudflare/static: the page is one HTML file. The Worker sketch answers non-GET with 405 and a fixed JSON body. It does not echo the body and does not store a card.
- No token markup, no price line, no "aware" badge. Empty `href_allowlist` means this draft authorizes no outbound link.

## Hash

`claims.json` is the fixture contract. Its SHA-256 is the UTF-8 canonical object: `sort_keys`, separators `(',', ':')`, no whitespace. The file has no `sha256` field and no `seal` field.

Fixture-contract digest: `b03f6657a684d31e2f9a855c1b9c956f780404f0d071e111bc75a7d3b43f9202`

A card digest is separate. It hashes `{slug, region, quality, source, note, status}` with the same canonical rules. Empty `href_allowlist` means no outbound href is authorized.

## Human seal

1. Add `local-felt-locus-card` to Queue, then move it to Used only after seal.
2. Do not invent sensor endpoints or allowlist hrefs.
3. Recompute the digest. Set `seal` to the human and date. Set `emit` true only then.
4. Publish the page only after that seal. Until then this file stays under `drafts/`.
