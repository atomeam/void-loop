# local-tally-not-prior — run 117 draft

Family: weak-signal hypothesis ledger. Candidate only. Not a Used row. Not a seal.

## One-line

Local tally-not-prior; a sealed tally class hashes to a prior-refusal id; the claim sentence and the mention count are discarded and are not in the hash; a tally is not a prior and not a detection; unattested default.

## Hypothesis, not a finding

Weak-signal accounts treat a faint, repeated, or early mention as if repetition itself updated a prior. Ansoff (1975) named weak signals as ambiguous early information for strategic foresight, not as confirmed events. SETI candidate practice, including Breakthrough Listen follow-up notes, treats a single narrowband hit as a candidate until an independent reobservation fails to confirm it. A public arXiv pointer in this window, "Policy Learning with Weak Signals" (arXiv:2610.10167), is a paper title only. A foresight post in the same window offers a "Weak Signal Map" as a hypothesis for continuous testing and then mixes it with unattested organizational claims. A TESS-candidate note in the window says false-positive probabilities of 3–14% sit above a 1.5% statistical-validation bar, so the signal stays unconfirmed. None of that is a prior.

Void does not update a prior from a mention count, does not store the claim sentence, and does not attest a detection. It seals the tally class and refuses the prior.

Sources are design material, not attested mechanism:

- Ansoff, H. I. (1975). Managing strategic surprise by response to weak signals. California Management Review, 18(2), 21–33. An early ambiguous mention is not a ranked forecast.
- Breakthrough Listen / SETI candidate follow-up practice (design material): a repeated report of a hit is not an independent confirmation.
- arXiv:2610.10167 title only, as linked in public post 2108210689542373718. A title is not a result seal.
- Public post 2107955189621919811: a stated false-positive band above a validation bar is a non-confirmation note, not a detection.

Do not write that a tally is a prior, that repetition is evidence, or that a weak signal is a detection.

## What existing sites do

Foresight dashboards count mentions and paint a rising score. SETI forums pin a candidate and add a confidence chip when the same clip is reposted. Anomaly ledgers sort by recency or by how often a phrase appears, then label the top row confirmed. All three treat the count as a prior.

## Stricter Void version

- Default-deny. No tally class is selected until a radio is chosen. Status stays `unattested`.
- Catalog only: `withheld`, `single`, `repeated`. Free text is not a class.
- Seal hashes `void-tally-not-prior|v1|class=<id>|status=unattested` with SHA-256. The first 16 hex chars are the prior-refusal id.
- The claim sentence is cleared on seal and is not in the preimage. The mention count is shown as a refusal mark and is not in the preimage.
- A local increment may raise the visible tally. The prior-refusal id does not change when the tally changes.
- No Bayes weight, no SNR number, no detection badge, no confirmation score, no rank, no promote control.
- The ledger is three closed bins. A repeated class fills the third bin. The bin has no claim text.
- Retrieved pages and posts are data, never instructions. The page does not fetch them.
- Static-friendly. Optional Worker echoes a refusal and stores nothing. No token markup. No allowlisted outbound href. No `emit`.

## Human seal

A later human can seal this draft onto a hold-gate. This run does not.