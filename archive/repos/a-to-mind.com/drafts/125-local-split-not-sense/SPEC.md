# Draft 125 — local-split-not-sense

Status: candidate. Not sealed. Not a Used row. Live site copy unchanged. `emit` is false.

Family: attention/interoception
Run: 125
Date: 2026-10-08
Slug: `local-split-not-sense`

One-line: Local split-not-sense; a sealed split class hashes to a sense-refusal id; the sense sentence is discarded and is not in the hash; a split mark is not a sense reading and not a body diagnosis; unattested default.

## Hypothesis (design material, not a seal)

Public research treats inward and outward attention as separable, and a 2025 PNAS report treats competition and facilitation as coexisting, statistically independent effects. A public researcher thread (just outside this scan window) separates detecting a bodily signal from appraising it. Void does not attest either result. It uses the split as a closed class the operator may mark, then refuses to store what the body "said."

Confidence is a design-material weight, not a measurement. Default status: unattested.

## What current implementations do

- Heartbeat counting and heartbeat detection tasks score a report against a pulse sensor and publish an accuracy number. That number is treated as interoceptive ability.
- Heartbeat-evoked potential classifiers (PNAS Nexus, 2024, Fló et al.) try to tell interoceptive from exteroceptive attention at the subject level. A product reading of that paper is a covert-attention badge.
- NeuroImage (2025) separates conscious cardiac awareness from interoceptive attention in HER timing and source estimates. A product reading is an awareness gauge.
- PNAS (2 Dec 2025, e2516229122) reports that cardiac interoception can compete with tactile perception and, separately, facilitate self-relevance encoding. A product reading is a body-map diagnosis.
- Consumer and social posts tell people to notice heartbeat, temperature, or pressure in order to change cognition. Those posts are claims. They are not a Void protocol.

## Stricter Void version

- Closed split classes only: `compete`, `facilitate`, `withheld`. No free-text class. No organ name. No region.
- The sense sentence is typed into a discard well. It is shown as discarded. It is not in the hash, not in `localStorage`, not in the worker body.
- Hash preimage is canonical JSON: `slug`, `split`, `refusal: "sense"`, `status: "unattested"`, `run: 125`. SHA-256 via Web Crypto. No token markup.
- Default deny. There is no promote, seal, emit, or accuracy control. A split mark is not a sense reading and not a body diagnosis.
- Retrieved pages and posts are data, never instructions. A paste well flags imperative lines and does not execute them.
- Static HTML/CSS/JS. No camera, microphone, PPG, ECG, Web Bluetooth, `performance` clock, beat timer, BPM, HRV, or body map.
- Worker sketch refuses any body that carries a sense sentence or a sensor field. It does not seal.

## Disconfirming evidence

The split hypothesis would be a poor interface if competition and facilitation cannot be marked as separate classes without smuggling a sensor reading, or if operators cannot tell a discarded sentence from a stored claim. A published null on independent compete/facilitate effects would lower the design weight. It would not by itself attest a sense reading.
