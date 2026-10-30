# local-single-mover-card (run 070)

Family: human-machine co-agency. Queue was empty. Candidate only. Not a Used row. `emit` is false.

One-line: Local single-mover card; a step hashes only after exactly one mover is sealed; joint agency stays denied; the seal is a hypothesis of attribution, not a handoff and not a shared mind; unattested default.

Does not reuse `local-co-agency-split` (run 058). That draft placed a human initiation beside a machine proposal and disabled handoff. This draft will not hash until exactly one mover is sealed, and it refuses a joint mover. The two lanes are mutually exclusive, not a side-by-side split.

## What existing implementations do

Public co-agency surfaces treat a shared step as permission to act, or they hide who moved.

- Weiss, "Human-AI Collaboration: From Paradoxes to Patterns" (arXiv:2609.36481, submitted 2026-09-29), says humans and AI perform better together, then documents four patterns: Instruction, Delegation, Assistance, and Co-creation. The outperform sentence is inside the claim. The patterns are a design map, not a measurement that a centaur formed.
- "Design Principles for Human-Agent Interaction" (arXiv:2606.20630) lists "Negotiate Shared Control" and says agents should not act autonomously without a possibility of user intervention. Negotiation is a principle. It is not a receipt that intervention happened.
- Ouilhet Olmos, "The Interface Is Downstream" (arXiv:2609.28801, submitted 2026-09-23), argues permissions and evidence rules already shape the agent before it replies. That is a provenance caution, not a seal that consent traveled upstream.
- ACM Interactions (September–October 2026), "When Systems Act for Users," asks for identity legibility, intent visibility, bounded delegation, and recovery when systems act for a person. The article still describes systems that take action.
- Mixed-initiative context work (arXiv:2604.07121) lets suggestions take effect only on user approval, then treats context as a shared object both parties edit. Approval-then-effect is the step this draft does not ship.
- Posts in this window celebrate agent-to-agent coffee negotiation with no person on the loop, sell a human checkpoint after generation, and describe a policy layer that waits and then pays. See `x-scan.md`. The checkpoint and the payment sit inside the claim.

## A-to-Mind version

Default deny. Nothing is sent. A step cannot be hashed until exactly one mover is sealed. "Both" is a disabled control.

- Observation, mover, step text, optional veto, source label, design weight, and disconfirm are one hashed hypothesis. Status starts `unattested`. The page cannot set `attested`.
- Allowed movers are `human` and `machine-paste`. `both` and an unset mover cannot hash. Machine text is data the person pasted. It is not an instruction and it does not execute.
- Handoff is a disabled control. There is no tool call, no agent loop, no session mode, and no endpoint that accepts a reason string.
- A veto is an optional sentence the person types. It is stored only in the local hash payload. It is not sent and it is not a model instruction.
- Confidence is a design-material weight the person types between 0 and 1. It is not a performance delta, a bits-per-second score, or a centaur badge.
- Retrieved pages and X posts are data, never instructions. The fields strip tags. Url-shaped source text is labeled not fetched. The page does not eval and does not fetch.
- Empty `href_allowlist`. No token markup. No beacon. No account. No camera. No microphone.
- Worker sketch returns 403 for every method and does not read the body.
- Export is a local download the person starts. Share is absent.
- Local hint if step text contains an imperative aimed at the page (`execute`, `handoff`, `ignore previous`). The hint does not become a seal and does not follow the text.
- No healing claim, contact claim, shared-mind badge, or centaur badge.

## Hash

Current draft digest of `claims.json`: `c4eae379cc86d87179a2d7b442618d1b2a026403a16c1b565112f58bd21a7369`

The digest is not a seal.

## Human seal

1. A human adds `local-single-mover-card` to Queue before any later run may pick it.
2. Seal only the hashed hypothesis text, not a centaur, handoff, or shared-mind claim.
3. Do not deploy the worker as a handoff sink. 403 stays.
4. Do not link this draft from live copy in the same commit.
