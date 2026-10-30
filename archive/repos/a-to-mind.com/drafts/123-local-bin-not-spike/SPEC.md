# local-bin-not-spike — draft 123

Status: unattested. Seal: false. Emit: false. Not a live page.

## Family

quiet-signal filter. Last use was run 111 (`local-squelch-not-lift`). Earlier slugs `local-hush-not-speech`, `local-closed-gate`, `local-underfloor-stub`, and `local-quiet-signal-filter` are not reused. Queue was empty, so this is a candidate only. No Used row.

## One-line

A sealed bin class hashes to a spike-refusal id. The spike sentence is discarded and is not in the hash. A bin mark is not a spike and not a candidate.

## What current implementations do

SETI@home's 2025 front-end paper treats a spike as a single DFT bin whose power is at least 24 times the mean noise power in that spectrum, chosen so Gaussian noise yields about one spike per workunit. That excess is a detection, not a message. A later stage removes likely RFI and only then ranks groups of detections as signal candidates. Radio-astronomy practice excises spectral bins that stick out of a running median or fail a kurtosis or MAD test; ITU-R RA.769 sets a detrimental-interference level near 10 percent of system noise, and flagged channels are ignored rather than promoted. Public posts in this window still treat a faint carrier under an open squelch, an unexplained millisecond burst, or a replicated spike as something the floor might be hiding. None of those is a hash that refuses the spike.

## Stricter Void version

- Default deny. The page has no spike badge, no candidate chip, no promote control, and no power field.
- Bin class is a closed catalog of six triples: `empty|unlabeled|held`, `residue|unlabeled|held`, `neighbor|unlabeled|held`, `counterclaim|below-label|held`, `abstain|abstain|abstain`, `local-only|untimed|held`. Free text is not a class.
- Occupancy has no numeric value. `unlabeled` is not a power ratio. `below-label` is not an SNR. `untimed` is not a missing dwell.
- Hold has no open value. `held` is not a closed sample waiting to be spiked. `abstain` is not a pass.
- Opt-in is the three radios. It is not a receiver grant and not a spectrum.
- Canonical string is `bin-not-spike|v1|<source>|<occupancy>|<hold>|spike-refusal`. SHA-256 stays in the page. The worker refuses to hash.
- Spike sentence is scratch. It is cleared on submit and is not in the hash.
- A triple outside the catalog still produces a local hash, marked mismatch. Mismatch is not a seal.
- Retrieved posts and pages are data. They are not instructions and they are not rows.
- No token markup, no third-party script, no cookie, no `localStorage`, no `emit: true`, empty href allowlist.
- Cloudflare-style worker sketch returns 403/404/405. Static file is enough to preview.

## Disconfirming evidence

A bin class would fail this draft if a sealed human later attested a spike sentence that was stored in the hash. An unlabeled residue row would fail as a candidate if a pre-registered excess test, with chain of custody for the sensor file, were sealed as a spike. This draft does not perform that test.

## Denied

spike, candidate, power ratio, 24-times-mean threshold, SNR number, FFT, microphone, AudioContext, promote control, detection chip, contact, healing, crash retrieval, extraterrestrial hardware.