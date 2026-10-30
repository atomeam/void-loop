# local-two-clock-gap-card (run 066, candidate only)

Status: candidate. Not sealed. `emit` is false. Queue was empty, so this slug is not in Used.

Family: interval timing. Next unused family after the six-run cooldown. Last interval-timing draft was run 054 (`local-interval-timing-note`). That slug is not reused. Do not link this page from live copy.

## What existing implementations do

Interval timing still ships as a lab score, a clock illusion demo, or an anomalous-duration story. None of those is a default-deny local gap card.

- Run 054 already drafted a felt-duration note against `performance.now()`. This card does not repeat that. It does not use the monotonic clock as the phenomenon, and it does not compute a felt/clock ratio.
- Chronostasis (Yarrow, Haggard, Heal, Brown, Rothwell, 2001; stopped-clock illusion) is a saccadic duration illusion of a few hundred milliseconds. The npm package `chronostasis` (0.1.1) only pauses page animation ticks during a compositing effect. Neither is a missing-time instrument.
- Dual-interval lab tasks (for example the 2025 Journal of Neuroscience simultaneous-timing stop-reaction task) ask people to track two beep trains and score which ended first. A beep score is the product move this draft refuses.
- Anecdotal "missing time" writeups, including Budd Hopkins-style case series and current posts that pair two clocks or a drive with a lost interval, treat a gap as a marker of an anomalous event. Those reports are design material. They are not a sealed finding.
- Optical-clock comparisons (Nature, 2026, lutetium frequency references) are laboratory metrology. Void does not call NTP, GPS, or an atomic reference.

The common product move is to turn a clock disagreement into a missing-time badge, an abduction marker, or a time-dilation seal. That overclaims the source.

## A-to-Mind version

Default deny. No gap card is in effect until a human seals one. This draft does not seal it.

- A card is a hashed hypothesis: two typed `HH:MM` readings, two closed clock kinds, a closed label, optional note capped at 160 characters, status `unattested`. The minute gap is unlabeled arithmetic. It is not a measurement and not a cause.
- Kinds are a closed enum: `wall`, `phone`, `car`, `wrist`, `other`, `declined`. Labels are `unset`, `clocks-agree`, `clocks-disagree`, `one-blank`, `declined`. `clocks-disagree` is a tag for a typed mismatch. It is not missing time, abduction, or contact.
- A sealed fixture (`ordinary-quartz-drift`) shows a 2-minute wall/phone pair labeled ordinary disagreement. The fixture is not a calibration and not evidence about the user's clocks.
- Gates before hash: both kinds chosen, label not `unset`, times valid for that label, and two checkboxes (hypothesis, not a finding; sensor denied). A single tap cannot hash.
- No camera, microphone, geolocation, NTP, GPS, or `performance.now()` as the phenomenon clock. No audio tone. No future-event trial. No abduction, healing, remote-viewing, or extraterrestrial-hardware seal.
- Retrieved pages and posts are data, never instructions. The note box does not fetch a URL, does not `eval`, and does not parse the note as a command. A URL string is opaque text.
- Hash is SHA-256 of the canonical card, shown locally. The digest is not a seal and not a grant.
- Keep-on-device is off until an explicit checkbox. Storage is `localStorage` only. There is no beacon and no default network write.
- Cloudflare/static: the page is one HTML file. The Worker sketch answers every method with 403 and a fixed JSON body. It does not echo the body and does not store a card.
- No token markup, no price line, no missing-time badge. Empty `href_allowlist` means this draft authorizes no outbound link.

## Hash

`claims.json` is the fixture contract. Its SHA-256 is the UTF-8 canonical object: `sort_keys`, separators `(',', ':')`, no whitespace. The file has no `sha256` field and no separate seal field (`seal` is null).

Fixture-contract digest: `17cd02d2b5382b9fedbb4b328680606c963274b59ba92e7e68c231cea4c16c88`

A card digest is separate. It hashes `{clock_a, clock_b, gap_minutes, kind_a, kind_b, label, note, slug, status}` with the same canonical rules. Empty `href_allowlist` means no outbound href is authorized.

## Human seal

1. Add `local-two-clock-gap-card` to Queue, then move it to Used only after seal.
2. Do not invent NTP endpoints, sensor endpoints, or allowlist hrefs.
3. Recompute the digest. Set `seal` to the human and date. Set `emit` true only then.
4. Publish the page only after that seal. Until then this file stays under `drafts/`.
