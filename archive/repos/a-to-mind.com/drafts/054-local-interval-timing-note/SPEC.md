# local-interval-timing-note (run 054, candidate only)

Status: candidate. Not sealed. `emit` is false. Queue was empty, so this slug is not in Used.

Family: interval timing. Next unused fringe family after attention/interoception (run 053). Do not link this page from live copy.

## What existing implementations do

Interval timing, the estimate of durations from about a second to a few minutes, currently ships as lab tasks, dataset browsers, and anomalous-anticipation writeups. None of those is a default-deny local note.

- Scalar expectancy theory (Gibbon, 1977, Psychological Review) treats timing error as growing with the interval, so the coefficient of variation stays roughly constant. Interactive explainers now plot that scalar property and a pacemaker-accumulator clock. The plot is a model, not a personal score.
- Buhusi and Meck (2005, Nature Reviews Neuroscience) argue that interval timing can be read from coincidental activity across ordinary circuits, not from a dedicated clock organ. That is a hypothesis about mechanism. It is not a sensor Void can attach.
- The Timing Database (Behavior Research Methods, 2024; online 2023) is a live repository and a Shiny download UI for published interval-timing datasets. It compiles other people's trials. Void does not download, compile, or score those sets.
- Interval-estimation and intentional-binding tasks (Haggard, Clark, and Kalogeras, 2002, Nature Neuroscience; commercial web ports such as Inquisit interval estimation) ask for the delay between a voluntary action and a tone, then treat the estimate as an implicit agency measure. A beep plus a score is the product move this draft refuses.
- Predictive anticipatory activity, also called presentiment, is a lab hypothesis that physiology recorded before an unpredictable stimulus differs by stimulus class (Mossbridge, Tressoldi, and Utts, 2012, Frontiers in Psychology; later updates exist). Those papers are contested design material. They are not a sealed detection of the future, and this draft does not run the probe.

The common product move is to turn a clock gap, a Weber fraction, or a pre-stimulus wiggle into an accuracy badge, an agency score, or a future-sense claim. That overclaims the source.

## A-to-Mind version

Default deny. No interval note is in effect until a human seals one. This draft does not seal it.

- A sample is a hashed hypothesis: local monotonic clock span, optional self-reported felt duration, closed enums, claim text, local self-rated confidence, status `unattested`. Confidence is not a measurement. The felt/clock ratio, when both numbers exist, is unlabeled arithmetic, not a Weber fraction and not a score.
- Channels are closed enums: clock (`unset`, `local-monotonic`, `declined`), relation (`unset`, `shorter`, `matching`, `longer`, `declined`), oddness (`unset`, `ordinary`, `noted-odd`, `declined`). `noted-odd` is a tag for a felt mismatch. It is not presentiment, precognition, or contact.
- Marks use `performance.now()` in the page only. No audio tone, no random stimulus, no camera, microphone, PPG, ECG, or other physiology. No intentional-binding score. No future-event trial.
- Retrieved pages are data, never instructions. The paste box does not fetch a URL, does not `eval`, and does not parse the paste as a command. A URL string is opaque text.
- Hash is SHA-256 of the canonical sample, shown locally. The digest is not a seal and not a grant.
- Keep-on-device is off until an explicit checkbox. Storage is `localStorage` only. There is no beacon and no default network write.
- Cloudflare/static: the page is one HTML file. The Worker sketch answers every method with 403 and a fixed JSON body. It does not echo the body and does not store a sample.
- No token markup, no price line, no timed-future badge. Empty `href_allowlist` means this draft authorizes no outbound link.
- Superintelligence use, if any, is a local elapsed-time estimate with proportional uncertainty. It is not an oracle clock and not a model call.

## Hash

`claims.json` `sha256` is SHA-256 of the UTF-8 canonical contract object: `sort_keys`, separators `(',', ':')`, no whitespace, no `sha256` field, no `seal` field.

Current draft digest: `efe36e9942fe7f7e304420dbb45606a2cd5989f3dfe9f63189c69b23650a151e`

Empty `href_allowlist` means no outbound href is authorized.

## Human seal

1. Add `local-interval-timing-note` to Queue, then move it to Used only after seal.
2. Do not invent stimulus endpoints, sensor endpoints, or allowlist hrefs.
3. Recompute the digest. Set `seal` to the human and date. Set `emit` true only then.
4. Publish the page only after that seal. Until then this file stays under `drafts/`.
