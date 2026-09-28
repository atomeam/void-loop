<!-- a2m-rank -->
**Board rank:** RESEARCH  
**Board index:** `A2M.ops.md`  
**Title:** Embodied error & folk-skill data
**Board rank + soft tag:** RESEARCH · data/traces

**Shared parts:** see `A2M.ops.md#shared-parts` — uses: Gatekeeper packet (dataset license pack), consent record, AI extraction (tagger after local scrub), back office, aging-owner research. Does **not** use the cloud intake (local drop folder + scrubber first; schema ideas only).

---
# Domain: Embodied error & folk-skill data (private)

**Status:** RESEARCH — not a cash lane. No phone-call energy. No PRIMARY steal from Handoff / AfterOwner ingest; research appends only.  
**Public face:** blank forever. No a-to-mind.com copy, scoreboard, Pages deploy, or homepage marketing.

---

## One-liner

Harvest labeled failure/correction traces and folk-skill (tacit trade know-how) from vanishing and high-stakes crafts — then license those datasets commercially to robotics / embodied-AI labs, with a prestige archive lane for museums.

## Product layers

| Layer | Buyer | What ships |
| --- | --- | --- |
| **(A) Labeled failure / correction traces** | Robotics / embodied-AI labs | Pre-failure sensor spike → correction trajectory → force profile of the save (+ verbal mutter). Recovery data under commercial license. |
| **(B) Folk-skill / tacit know-how datasets** | Same labs | Structured tacit trade know-how — data, not footage, not marketing copy. |
| **(C) Museum / archive prestige licensing** | Museums & archives | How it actually felt when it almost failed — prestige + long-tail licensing. |

Product is **not** pretty video. Product is **labeled traces** packaged as closed-loop stimulus→response (trigger maps to corrective command), not raw CSV/audio folders — labs pay for deployable reflexes.

## Why this is not already a side hustle

Most craft content is a success demo: polished steps, clean outcomes, and a before/after clip. Buyers who train or simulate embodied systems need the missing half — the failure, the recovery, and the felt cue that tells a person when to correct. The gap is not more pretty footage; it is labeled failure/recovery/feel data with enough context to connect a deviation to a save. That is why this remains a data-product research lane rather than an ordinary creator side hustle.

### Buyer map (research only)

- **Robotics foundation-model (FM) companies:** failure clusters, corrective trajectories, and folk-skill packs for embodied learning and evaluation.
- **Insurers / slip-and-fall teams:** consented, anonymized near-miss and recovery patterns for risk, claims, and prevention research.
- **Game and animation studios:** believable weight shifts, hesitation, slips, saves, and tacit craft motion for simulation and performance reference.
- **Cultural archives:** provenance-rich records of vanishing trades and the lived feel of almost-failure, with prestige and long-tail licensing.

No buyer outreach is implied. Rank stays **RESEARCH**; this does not promote the Domain or steal PRIMARY capacity from Handoff / AfterOwner ingest.

## Smallest viable start

Start with **20–40 clips**, not an instrumented-week production. Film a narrow failure cluster or one folk-skill pack using self/co-op participants, explicit consent, and anonymization before tagging. A pack should be coherent enough to test whether buyers value a repeated correction pattern, not a random gallery of craft footage.

- One narrow trade, motion family, or near-miss pattern per pilot.
- Consent covers capture, anonymized processing, commercial research licensing, revocation handling, and archive/game/robotics use as applicable.
- Keep a consent record and provenance manifest beside every clip; remove or mask faces, identifying marks, voices, and incidental background details where required.
- Ship a **failure-cluster pack** or **folk-skill pack**: labeled MP4s plus machine-readable metadata, not a raw dump.

The moat is **authenticity plus consent documents**: real practitioners, real corrections, traceable provenance, and permission that survives handoff to a buyer. Scarcity without rights is not a product; rights without authentic recovery traces are generic footage.

## Hard-constraint fit

This lane can be tested without a phone, cold calls, or bothering people. The first capture path is self-film or co-op film with willing participants and written consent; all buyer discovery can wait. No phone-call energy, stranger-interruption energy, or public-facing marketing is required.
## Target trades (scarcity moat)

Trades with almost no successors and ~10–15 years of living practitioners left:

- Cooperage, slate roofing, analog film timing, linotype, traditional bookbinding, timber-frame joinery, organ-pipe voicing, mechanical-watch adjusting.

High-stakes crossover later: legacy industrial maintenance (aerospace welding, deep-sea pipe fitting) where one failed save costs millions.

Inventory is finite and cannot be farmed — scarcity is the moat; once the last practitioners retire, the data cannot be synthesized cheaply.

## Capture posture

- **Passive off-body instrumentation:** tool-mounted contact mics, rigid overhead spatial tracking, force plate under workpiece — no gloves between master and tool.
- **Hardwired DAQ** with one hardware clock (no Bluetooth drift).
- **Direct feed** of what the artisan sees at loupe/microscope level (silent-cue problem).
- Day rate, not footage royalty; artisan owns likeness; A-to-Mind owns anonymized correction traces. One instrumented week with 2–3 specialists tests demand.

### Acoustic start (organ-pipe voicing)

Quiet room, 2 mics + camera, zero wearables — cleanest signatures, fastest label loop. Most acoustic-dependent trade (ear → tiny knife cut; contact mic on the tool is the whole trigger feed).

### Tactile start (cooperage / leather paring)

Tool accelerometer + overhead skeletal tracking + workpiece force plate. Signature is force-ramp spike → micro deviation → release. Resistance ramp first; audible creak ~100ms after correction already started.

### Avoid for v1

Watch-adjusting: acoustic trigger + loupe cue + micron correction hits intrusion, sync, and silent-cue problems simultaneously.

## Automation assembly line (docs-only lock)

Runtime flow:

`local drop folder ingest → scrubber (OpenCV + local blur/mask/strip audio) → OpenCode/Gemini tagger → MP4 + JSON pack`

The drop folder is the controlled intake boundary. The scrubber runs locally before any tagger sees the material: detect and blur/mask identifying regions, strip audio when voice or ambient identity is not part of the licensed signal, and retain a provenance record. The tagger can use OpenCode/Gemini against the scrubbed clip to propose labels; a human reviews consent, identity risk, and failure/recovery labels before a pack is licensed.

### Build order (locked)

1. **First node: JSON metadata schema for the pack/tagger.** This is the product contract, not code. It defines stable fields for `pack_id`, `clip_id`, source/provenance, trade or folk-skill, consent and permitted uses, anonymization actions, failure/trigger, correction/recovery, feel cues, reviewer status, and the shipped MP4/JSON paths. Schema versioning and a manifest make a pack auditable and re-tag-gable.
2. **Second node: Python auto-blur scrubber.** Implement only after the schema contract is accepted; its output must populate the contract's scrub, provenance, and review fields.

**No code is built in this task.** The schema is the first build artifact; the scrubber is second. The tagger and pack export follow those two gates.
## Packaging / commercial license notes

- Closed-loop stimulus→response packaging — not raw dump folders.
- Buyers under research only: robotics foundation-model companies, robotics / embodied-AI labs, insurers studying slip-and-fall, game/animation studios, and cultural archives. Commercial licensing remains gated by consent and pack quality; no outreach now.
- Prestige long-tail: museum/archive licensing of the “almost failed” feel.
- Private commercial lane only; nothing here ships public. Face remains blank.

## Overlap (single Domain now)

This file is the **one** Domain for embodied error + folk-skill material. Do **not** re-open or recreate:

- `folk-skill-failure-data.md`
- `vanishing-trades-error-signatures.md`

Capture posture, packaging, and sell-side notes all live here. Prefer append over new files.

## Absorbed-from

- `vanishing-trades-error-signatures.md`
- `folk-skill-failure-data.md`

## Attempts

| When | What | Score | Next |
| --- | --- | --- | --- |
| (prior) | Organ-pipe voicing mapped as most acoustic-dependent; cooperage / leather paring as most tactile-force | — | Capture posture frozen: off-body, hardwired DAQ, closed-loop packaging |
| (prior) | Folk-skill sell-side noted; capture already owned by vanishing-trades sibling | — | Merged into this Domain; no separate sell lane |
| (blank) | Further attempts logged here as they happen | _human_ | |
| 2026-09-23 | Adam paste folded: sell-side gap, buyer map, 20–40 clip pilot, consent/anonymization moat, and local assembly-line contract | RESEARCH | First node locked: JSON pack/tagger schema; second: Python scrubber; docs only, no outreach |

## Score

_blank — human fills after each session_

## Kill list / retain

**Retain**

- Day rate + anonymized traces ownership model.
- Acoustic (organ) and tactile (cooper) as first two capture lanes.
- Finite inventory / scarcity as moat.
- Private Domain rules: no public copy, no homepage, no scoreboard, no Pages deploy.

**Kill / never**

- Watch-adjusting for v1.
- Bridge / archive wipes; public Loop claims; homepage marketing; Gumroad deploys.
- hold/apps/void as a live lane for this material (not this Domain).
- Re-opening absorbed filenames as separate Domains.

## Public face

Blank forever.
