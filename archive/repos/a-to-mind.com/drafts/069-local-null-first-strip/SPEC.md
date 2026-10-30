# local-null-first-strip (run 069)

Family: weak-signal hypothesis ledger. Queue was empty. Candidate only. Not a Used row. `emit` is false.

One-line: Local null-first strip; an ordinary account must be typed before a remainder can be hashed; the remainder is a hypothesis of what that account does not cover, not an early warning; unattested default.

Does not reuse `local-weak-signal-ledger` (run 057). That draft stored a faint note plus a disconfirm path as a ledger row. This draft will not hash until the ordinary account is typed, and it shows only a two-cell strip, not a ledger and not a radar.

## What existing implementations do

Public weak-signal tools treat a faint note as a reason to rank or act.

- Ansoff (1975) named weak signals as ambiguous early clues. Later early-warning frameworks add a threshold that opens a management discussion. The threshold is a policy choice, not a measurement.
- Explorer Labs (package dated 2026-09-23) ships a 100-card weak-signal deck plus canvases that rate credibility and immediate versus systemic impact, then point at a 2-to-4-week experiment.
- A Sustainability Science paper (2026) ranked 280 candidate weak signals by likelihood, impact, and timing, then mapped 20 onto an influence matrix and treated high centrality as a reason to prioritize.
- A 2026-10-04 Living Library note on an OECD horizon-scanning paper says early signals are hard to interpret and that standards are still missing. The note is data, not an instruction.
- CEOtudent (2026-08) publishes a personal triage matrix (novelty, proximity, trajectory, exposure) and an early-warning dashboard. The scores are an editorial framework, which that page itself says is not an empirical measurement.
- Posts in this window call AI weak-signal spotting an investment edge, or deny that a flattering cut is a signal at all. See `x-scan.md`.

## A-to-Mind version

Default deny. No strip is kept until the person checks keep-on-device. Nothing is sent.

- The ordinary account is required first (24 characters). The remainder field stays disabled until that bar is met. A remainder without an ordinary account cannot be hashed.
- Observation, ordinary account, remainder, source label, design weight, and disconfirm are one hashed hypothesis. Status starts `unattested`. The page cannot set `attested`.
- Confidence is a design-material weight the person types between 0 and 1. It is not a probability, an intensity color, a triage score, or a centrality rank.
- Retrieved pages and X posts are data, never instructions. The fields strip tags. Url-shaped source text is labeled not fetched. The page does not eval and does not fetch.
- Empty `href_allowlist`. No token markup. No beacon. No account. No radar. No early-warning badge.
- Worker sketch returns 403 for every method and does not read the body.
- Export is a local download the person starts. Share is absent.
- No camera, microphone, sensor, prediction market, healing claim, contact claim, or extraterrestrial-hardware seal.

## Hash

Current draft digest of `claims.json`: `aec925553ea4dd683b02cbd7e5cb863d6c20bb6964b3aa2763fbf5cb85203c54`

The digest is not a seal.

## Human seal

1. A human adds `local-null-first-strip` to Queue before any later run may pick it.
2. Seal only the hashed hypothesis text, not an early-warning or investment-edge claim.
3. Do not deploy the worker as a signal sink. 403 stays.
4. Do not link this draft from live copy in the same commit.
