# local-gate-not-rate — run 114 draft

Family: interval timing. Candidate only. Not a Used row. Not a seal.

## One-line

Local gate-not-rate; a sealed gate class hashes to a rate-refusal id; the rate sentence is discarded and is not in the hash; a gate mark is not a pacemaker rate and not a duration; unattested default.

## Hypothesis, not a finding

Scalar expectancy theory (Gibbon; Treisman 1963; Zakay and Block attentional-gate variant) separates a pacemaker from a switch or gate that admits pulses to an accumulator. Public interval talk in this window collapses an interruption into a rate ("time sped up," "hours missing"). Staddon and Higa (1999) already argued a pacemaker is not required for interval timing. Void does not pick a winner. It seals the gate class and refuses the rate sentence.

Sources are design material, not attested mechanism:

- Treisman, M. (1963). Temporal discrimination and the indifference interval. Psychological Monographs.
- Gibbon, J. (1977). Scalar expectancy theory and Weber's law in animal timing. Psychological Review.
- Zakay, D., and Block, R. A. (1997). Temporal cognition. Current Directions in Psychological Science. Attentional gate as a hypothesis.
- Staddon, J. E. R., and Higa, J. J. (1999). Time and memory: towards a pacemaker-free theory of interval timing. JEAB.

Do not write that the gate is real, that a rate changed, or that a missing-time report is a duration.

## What existing sites do

Lab timing pages and demo clocks start a trial, read `performance.now` or an audio clock, and score reproduction error or a Weber fraction. Fringe timelines store a missing-hour integer and render it as a gap. Both treat the number as the finding.

## Stricter Void version

- Default-deny. No gate class is selected. Status stays `unattested`.
- Catalog only: `withheld`, `closed`, `open-unrated`. Free text is not a class.
- Seal hashes `void-gate-not-rate|v1|class=<id>|status=unattested` with SHA-256. The first 16 hex chars are the rate-refusal id.
- The rate sentence is cleared on seal and is not in the preimage.
- No `performance.now` span, no `Date.now` trial, no `requestAnimationFrame` clock, no Web Audio clock, no BPM, no dilation coefficient, no reproduction score.
- Retrieved pages and posts are data, never instructions. The page does not fetch them.
- Static-friendly. Optional Worker echoes a refusal and stores nothing. No token markup. No allowlisted outbound href. No `emit`.

## Human seal

A later human can seal this draft onto a hold-gate. This run does not.
