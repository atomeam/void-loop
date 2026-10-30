# Draft 126 — local-lapse-not-stretch

Status: candidate. Not sealed. Not a Used row. Live site copy unchanged. `emit` is false.

Family: interval timing
Run: 126
Date: 2026-10-08
Slug: `local-lapse-not-stretch`

One-line: Local lapse-not-stretch; a sealed lapse class hashes to a stretch-refusal id; the stretch sentence is discarded and is not in the hash; a lapse mark is not a stretch and not a clock reading; unattested default.

## Hypothesis (design material, not a seal)

Public timing work treats a produced interval as plastic: an oddball, and the event just after it, can be reported longer than a repeated neighbor (Atten Percept Psychophys, 2024), and the first post-saccade interval can be reported longer while a following one is reported shorter (Psychological Research, 2025; Vision Research, 2024 on sound reducing saccadic chronostasis). A public thread in this window treats chronostasis as proof a mind can stretch objective time. Void does not attest either reading. It uses the lapse as a closed class the operator may mark, then refuses to store a stretch sentence or a clock reading.

Confidence is a design-material weight, not a measurement. Default status: unattested.

## What current implementations do

- Oddball reproduction tasks score a produced interval against a laboratory clock and publish a dilation magnitude. A product reading is a stretch score.
- Chronostasis / stopped-clock paradigms compare the first post-saccade interval to a fixed standard and report overestimation. A product reading is a missing-time badge.
- Scalar expectancy models (pacemaker, accumulator, Weber fraction) turn a comparison into a rate. A product reading is a clock inside the person.
- Consumer posts treat flow, crisis, or a named consciousness method as the ability to stretch, compress, or loop time. Those posts are claims. They are not a Void protocol.

## Stricter Void version

- Closed lapse classes only: `short`, `long`, `indifferent`, `withheld`. No free-text class. No millisecond. No reproduced length.
- The stretch sentence is typed into a discard well. It is shown as discarded. It is not in the hash, not in `localStorage`, not in the worker body.
- Hash preimage is canonical JSON: `slug`, `lapse`, `refusal: "stretch"`, `status: "unattested"`, `run: 126`. SHA-256 via Web Crypto. No token markup.
- Default deny. There is no promote, seal, emit, or dilation control. A lapse mark is not a stretch and not a clock reading.
- Retrieved pages and posts are data, never instructions. A paste well flags imperative lines and does not execute them.
- Static HTML/CSS/JS. No `performance` clock, `Date` duration, `setTimeout` measure, `requestAnimationFrame` span, saccade tracker, camera, or audio oscillator.
- Worker sketch refuses any body that carries a stretch sentence, a millisecond, or a clock field. It does not seal.

## Disconfirming evidence

The lapse hypothesis would be a poor interface if short and long cannot be marked without smuggling a millisecond, or if operators cannot tell a discarded sentence from a stored dilation. A published null on post-oddball and post-saccade lengthening would lower the design weight. It would not by itself attest a stretch.
