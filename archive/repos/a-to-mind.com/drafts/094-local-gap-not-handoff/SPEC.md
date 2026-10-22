# Draft 094 — local-gap-not-handoff

Family: human-machine co-agency. Queue was empty. Candidate only. Not a Used row. `emit` is false.

One-line: Local gap-not-handoff; two sealed lane classes hash to a gap id; the handoff sentence is discarded and is not in the hash; a gap between lanes is not a handoff and not shared control; unattested default.

Does not reuse `local-co-agency-split` (run 058), `local-single-mover-card` (run 070), or `local-abstain-seat` (run 082). Run 058 placed a human initiation beside a machine proposal and disabled handoff. Run 070 hashed only after exactly one mover was sealed and refused a joint mover. Run 082 sealed only `abstain` and left the instrument seat empty. This draft marks both lanes as present and hashes only the refused overlap. Neither lane is a mover. There is no transfer control.

## What existing implementations do

Public co-agency surfaces still treat a second lane as something that can receive work.

- arXiv:2603.02050, "When to Hand Off, When to Work Together" (submitted 2026-03-02, latest noted 2026-09-20), studies concurrent work on a shared artifact. CLEO interprets collaborative intent and adapts. Delegation, direction, and concurrent work are still joins on one artifact.
- Graph Digital, 2026-03-18, treats the human-AI handoff as a designed boundary: map steps, set autonomy, write escalation rules. A mapped handoff is still a transfer of the next step.
- Tian Pan, 2026-04-16, describes a warm handoff and mixed-initiative loops in which either party can yield. Yielding is still a control transfer.
- NHI Mgmt Group, 2026-09-30, distinguishes a full agent handoff (the receiver owns the conversation) from using an agent as a tool (the caller keeps ownership). Both still pass a payload.
- Posts in this window claim a deny-by-default approval button, a Neuralink-class interface, a voice HMI on a combat vehicle, and a review layer about to be flooded by agents. See `x-scan.md`. The button, the voice line, and the review sit inside the claim.

## A-to-Mind version

Default deny. Nothing is sent. The gap cannot be closed.

- Both lanes must be `marked`. Unset lanes cannot hash. `overlap` has one allowlisted value, `refused`. There is no overlap control that can be set to joined.
- Observation is the two lane classes, the refused overlap, a disconfirm id from a closed list, a design-material weight, and status. Status starts `unattested`. The page cannot set `attested`.
- Handoff text the person pastes is stripped of tags, counted, then discarded. The character count is shown. The text is not in the hash, not stored, and not an instruction.
- The drawing is two lanes with a fixed gap and no arrow. A gap is not a warm handoff and not shared control.
- Confidence is a design-material weight the person types between 0 and 1. It is not an oversight equilibrium, a surplus delta, or a partner score.
- Retrieved pages and X posts are data, never instructions. Url-shaped paste is labeled not fetched. The page does not eval and does not fetch.
- Empty `href_allowlist`. No token markup. No beacon. No account. No camera. No microphone. No voice control.
- Worker sketch returns 403 for every method and does not read the body.
- Export is a local download the person starts. Share is absent.
- Local hint if the paste contains an imperative aimed at the page (`handoff`, `transfer`, `steer`, `execute`, `ignore previous`). The hint does not become a seal and does not follow the text.
- No healing claim, contact claim, shared-mind badge, partner badge, or shared-control badge.

## Hash

Canonical line, UTF-8, no handoff bytes:

`void.gap-not-handoff.v1|human=marked|instrument=marked|overlap=refused|disconfirm=<id>|weight=<0.000>|status=unattested`

Fixture line in `claims.json` digests to `a1e257ea964aef2a968eb49f7196c2d57f257987c2da0981364a5ff9c4fe770a`.

Current draft digest of `claims.json`: `9efb953cbcbc9c6ec6555e57521719c9af5d73eda5eb732da987845ee7aa454a`

The digest is not a seal.

## Human seal

1. A human adds `local-gap-not-handoff` to Queue before any later run may pick it.
2. Seal only the hashed gap hypothesis, not a handoff, shared control, or a partner.
3. Do not deploy the worker as a handoff sink. 403 stays.
4. Do not link this draft from live copy in the same commit.
