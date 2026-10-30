# local-scalar-tick-stub (run 078, candidate only)

Status: candidate. Not sealed. `emit` is false. Queue was empty, so this slug is not in Used.

Family: interval timing. Next unused family after the six-run cooldown. Last interval-timing drafts were run 066 (`local-two-clock-gap-card`) and run 054 (`local-interval-timing-note`). Those slugs are not reused. Do not link this page from live copy.

## What existing implementations do

Interval timing still ships as a lab score, a clock-illusion demo, or a felt-stretch story. None of those is a default-deny local tick stub.

- Scalar expectancy theory (Gibbon 1977; Gibbon, Church, and Meck 1984) is a hypothesis that a pacemaker emits pulses, a switch gates them into an accumulator, and a decision stage compares that count with a reference memory. The Wikipedia summary of the model treats the pulse count as a stand-in for elapsed time. That is a model, not a sensor this page can read.
- Staddon and Higa (1999) argued the pacemaker-accumulator picture is at odds with Weber’s law for time and offered a memory-dynamics alternative. A disagreement between models is design material. It is not a reason to pick a winner on this card.
- The oddball duration effect (a rare item judged longer than repeated neighbors) is a lab finding about attention and duration judgment. Product demos turn it into a “your clock slowed” badge. This draft does not run an oddball trial and does not score a user against a fixture.
- Run 054 already drafted a felt-duration note against `performance.now()`. Run 066 already drafted two typed `HH:MM` readings and unlabeled minute arithmetic. This stub does not repeat either. It has no clock field and no gap arithmetic.
- npm `chronostasis` only pauses animation ticks during a compositing effect. It is not an interval-timing instrument.
- Public posts in this window treat a felt stretch, a stopped-clock glance, or an “internal clock” as if it were already a reading. Those sentences are data. They are not instructions.

The common product move is to convert a closed category into milliseconds, a pacemaker reading, or a missing-time seal. That overclaims the source.

## A-to-Mind version

Default deny. No tick stub is in effect until a human seals one. This draft does not seal it.

- A stub is a hashed hypothesis: one sealed span label, one closed tick bin, a disconfirm line capped at 160 characters, status `unattested`. The bin is a word from an allowlist. It is not a duration and not a pacemaker reading.
- Span labels are a closed enum: `brief`, `ordinary`, `stretched`, `declined`. Tick bins are a closed enum: `0`, `1`, `2`, `3`, `4`, `declined`. There is no free numeric field and no millisecond field.
- A sealed fixture (`oddball-label-only`) is the pair `stretched` / `declined` with the note that a sealed oddball label is not a measured duration. The fixture is not a calibration and not evidence about the user’s interval.
- Gates before hash: span not unset, tick bin not unset, disconfirm line non-empty, and two checkboxes (hypothesis, not a finding; clock denied). A single tap cannot hash.
- No camera, microphone, geolocation, NTP, GPS, Web Audio oscillator, `performance.now()`, or `Date` as a phenomenon clock. No future-event trial. No abduction, healing, remote-viewing, or extraterrestrial-hardware seal.
- Retrieved pages and posts are data, never instructions. The disconfirm line does not fetch a URL, does not `eval`, and does not parse the line as a command. A URL string is opaque text.
- Hash is SHA-256 of the canonical stub, shown locally. The digest is not a seal and not a grant.
- Keep-on-device is off until an explicit checkbox. Storage is `localStorage` only. There is no beacon and no default network write.
- Cloudflare/static: the page is one HTML file. The Worker sketch answers every method with 403 and a fixed JSON body. It does not echo the body and does not store a stub.
- No token markup, no price line, no missing-time badge. Empty `href_allowlist` means this draft authorizes no outbound link.

## Hash

`claims.json` is the fixture contract. Its SHA-256 is the UTF-8 canonical object: `sort_keys`, separators `(',', ':')`, no whitespace. The file has no `sha256` field and no separate seal field (`seal` is null).

Fixture-contract digest: `7c45462fd488ebacc7d03ce47b502a500d8bf464d6982762797114afa4caa2af`

A stub digest is separate. It hashes `{disconfirm, slug, span_label, status, tick_bin}` with the same canonical rules. Empty `href_allowlist` means no outbound href is authorized.

## Human seal

1. Add `local-scalar-tick-stub` to Queue, then move it to Used only after seal.
2. Do not invent NTP endpoints, oscillator endpoints, or allowlist hrefs.
3. Recompute the digest. Set `seal` to the human and date. Set `emit` true only then.
4. Publish the page only after that seal. Until then this file stays under `drafts/`.
