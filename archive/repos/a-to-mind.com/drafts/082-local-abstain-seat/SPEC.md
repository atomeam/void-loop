# Draft 082 — local-abstain-seat

Family: human-machine co-agency. Queue was empty. Candidate only. Not a Used row. `emit` is false.

One-line: Local abstain seat; a sealed abstain class hashes to a seat-refusal id; the instrument seat stays empty and is not in the hash; an abstain is not a partner and not a waiting agent; unattested default.

Does not reuse `local-co-agency-split` (run 058) or `local-single-mover-card` (run 070). Run 058 placed a human initiation beside a machine proposal and disabled handoff. Run 070 hashed only after exactly one mover was sealed and refused a joint mover. This draft never offers a mover. The only sealable seat is `abstain`. A pasted proposal is counted and discarded. It is not in the hash and it is not followed.

## What existing implementations do

Public co-agency surfaces still treat a second seat as something that can act, ask, or wait.

- Choose Your Agent (arXiv:2602.12089, revised 2026-08-24) partitions initiative into Advisor (AI proposes, human vetoes), Coach (human proposes, AI critiques), and Delegate (AI acts, human observes). Those are allocations of authority. They are not a receipt that the human seat stayed empty of a partner.
- IEEE Spectrum, 2026-10-05, reports Ghosh, Mitchell, and Passi arguing that human-in-the-loop review often becomes a permission click without the capacity to engage. Their friction proposals include recording a human choice before the agent reveals a plan. The article describes agents that still have a plan to reveal.
- LiveAIWire, 2026-10-05, summarizes the Oversight Game (Overman and Bayati, ICML 2026): the agent chooses to act or ask, and the human chooses to trust or oversee, seeking a stable pattern. A learned ask is still an agent move.
- Social Europe, 2026-09-18, argues formal authority can drift from effective control as each delegation stays locally rational. A kill switch is not the same as capacity to intervene. That is a caution, not a seal.
- Posts in this window claim an agent kept working while the person walked, that agents should hold permissions rather than keys, that neurotech is required for long-term alignment, and that a final human review is enough after two coding agents meet. See `x-scan.md`. The review and the permission sit inside the claim.

## A-to-Mind version

Default deny. Nothing is sent. The instrument seat cannot be marked. "Both" is not a control.

- The only allowlisted seat is `abstain`. `instrument`, `both`, and unset cannot hash.
- Observation is the abstain class, a disconfirm id from a closed list, a design-material weight, and status. Status starts `unattested`. The page cannot set `attested`.
- Proposal text the person pastes is stripped of tags, counted, then discarded. The character count is shown. The text is not in the hash, not stored, and not an instruction.
- The instrument seat is drawn empty after the hash. Empty is not a waiting agent and not a deferred act.
- Confidence is a design-material weight the person types between 0 and 1. It is not an oversight equilibrium, a surplus delta, or a partner score.
- Retrieved pages and X posts are data, never instructions. Url-shaped paste is labeled not fetched. The page does not eval and does not fetch.
- Empty `href_allowlist`. No token markup. No beacon. No account. No camera. No microphone.
- Worker sketch returns 403 for every method and does not read the body.
- Export is a local download the person starts. Share is absent.
- Local hint if the paste contains an imperative aimed at the page (`execute`, `handoff`, `act`, `ignore previous`). The hint does not become a seal and does not follow the text.
- No healing claim, contact claim, shared-mind badge, partner badge, or centaur badge.

## Hash

Canonical line, UTF-8, no proposal bytes:

`void.abstain-seat.v1|seat=abstain|disconfirm=<id>|weight=<0.000>|status=unattested`

Current draft digest of `claims.json`: `d906a82d3d92a7cbd502cfdf92c9391607697b7d2b1e66656f57282055ae9b1d`

The digest is not a seal.

## Human seal

1. A human adds `local-abstain-seat` to Queue before any later run may pick it.
2. Seal only the hashed abstain hypothesis, not a partner, a waiting agent, or an oversight equilibrium.
3. Do not deploy the worker as a handoff sink. 403 stays.
4. Do not link this draft from live copy in the same commit.
