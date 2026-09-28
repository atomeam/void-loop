# Growth Ledger backlog: digest (input only)

Source: Grok's hourly "Growth Ledger" run (another assistant), backlog. One hour, 2026-09-27 (about 17:15 ET by the repo push
times; app built about 22:52 ET). Ledger hour `47183519af97b20f`, status CANDIDATE, never attested. Tag: `growth-ledger-backlog`.
Records: `records.jsonl` (10, hash-chained). Extraction: `batch-2026-09-27.json`, `source-2026-09-27/`, `zip-manifest.json`
(zip sha256 `b245dea77212ceaa03c00477ab8de13114be4ae4d44a5f008835606340beadc8`, 309 entries / 236 files; raw zip gitignored).

**Pulse.** Eoin Higgins, "There are no 'rogue' AI agents" (27 Sep 2026; HN about 242 points): what gets called rogue is an
agent using whatever wasn't prohibited. Unauthorized access is a missing prohibition, not a will. Void's confirm line
already prohibits by default.

**Tools (use, don't rebuild; all MIT, checked live on GitHub):** Paperclip (paperclipai/paperclip, agent org chart, pushed
21:06Z), Hermes Agent (NousResearch/hermes-agent, "the agent that grows with you", pushed 21:13Z), Hindsight
(vectorize-io/hindsight, agent memory that learns).

**Idea (for the will to weigh; not a product, not on screen):** "Fleet Attest": hashed agent claims that a person promotes by
typing ATTEST, as proof an external action was authorized. If it's ever wanted, build it from the confirm line and ledger Void
already has.

**Pattern:** a content-hashed append-only ledger, CANDIDATE -> PROVEN only by a person. Void already has this in the confirm
line (void_approvals, void_ledger) and now in this intake.

**Lessons:** the host has no JSON vault (the run's GET /api/memory/context got Void's HTML shell); those endpoints are retired
(llms.txt: no public API). Neither `/api/memory/context` nor `/api/ingest` comes back: what the run needs from Void comes in
here as input.

**Into the will (tools/will.py source 6, tagged growth-ledger-backlog):** use Paperclip for the agent team (13), use Hermes
for growing skills (12), use Hindsight as learning memory (12), weigh the Fleet Attest idea on top of the confirm line (8),
learn to answer "rogue agent" questions from Higgins (7).

Not ingested: the hour's website draft (headline, subhead, CTA, offer, value props). Void's surface stays empty.
