# convergence — the shared-parts map

Every cycle works every row here: each part, and each Void stage that is blocked, through every track it touches. `tools/forethinkers.py`
reads and rewrites the two tables below; keep their columns as they are.

- tracks: every track in the repo (`python tools/forethinkers.py tracks`): the Forethinkers track files, every venture
  domain file, every assimilate row. Open misses are tracks too; they are placed, not written into rows.
- a domain's "Shared parts: ... uses:" line is a declared link; `python tools/forethinkers.py sync` puts it here
- part status: established (dated source + named part) | hypothesis (the map says so, nobody has checked; no source)
- stage status: live | blocked
- `checked` is the last day a cycle took this row as its unit

## Nodes

| id | kind | name | tracks | stages | status | source | dated | checked |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| summon | stage | Summon: ask Void and a 3D thing appears | living-figures |  | live |  |  |  |
| spin | stage | Spin: drag to turn what was summoned | living-figures |  | live |  |  |  |
| export | stage | Export: a summoned thing leaves Void as a mesh file (STL / 3MF / glTF) | printed-machines, living-figures |  | blocked |  |  |  |
| print | stage | Print: the exported file prints, and a body with parts moves | printed-machines, living-figures, life-extension, restoring-planet |  | blocked |  |  |  |
| own | stage | Own: what was printed is bound to the person, with rights and safe-use limits | living-figures, life-extension, restoring-planet |  | blocked |  |  |  |
| printed-linear-motor | part | Printed electric linear motor (MIT multi-material platform, about 3 hours, about $0.50 of material) | printed-machines | print | established | https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218 | 2026-02-18 |  |
| printed-actuator-joint | part | Printed actuator used as a figure joint | printed-machines, living-figures | export, print | hypothesis |  |  |  |
| soft-actuator | part | Soft actuator (motion that is safe next to people) | printed-machines, living-figures, life-extension, restoring-planet | print | hypothesis |  |  |  |
| printed-joint-sensor | part | Printed joint sensor (position, speed, direction) | printed-machines, living-figures, life-extension | print | hypothesis |  |  |  |
| original-figure | part | Original character figure, our own IP (a toy that comes alive); a 3D miniature in Void first, the safe ones later sold printed | living-figures, model-fight-league | summon, spin, export | hypothesis |  |  |  |
| assistive-joint | part | Assistive or prosthetic joint built from the same actuator | life-extension | print | hypothesis |  |  |  |
| field-robot-limb | part | Restoration field-robot limb built from the same actuator | restoring-planet | print | hypothesis |  |  |  |
| holodeck | part | Holodeck: a summoned world the miniatures live and play in (simulation only) | living-figures | summon, spin | hypothesis |  |  |  |
| replicator | part | Replicator: the summon-to-print path for safe 3D items, so a miniature or item in Void can be bought as a physical print | printed-machines, living-figures | summon, export, print, own | hypothesis |  |  |  |
| persuadetron | part | Persuadetron-style gadget the miniatures carry in Void games (acts on simulated figures only; the Syndicate Wars name and look are not ours, so an original name and design before any physical sale) | living-figures, model-fight-league, influence-science | summon, spin | hypothesis |  |  |  |
| persuasion-defence | part | Persuasion defence: detecting and blunting real manipulation (dark patterns, AI-driven persuasion) for the person at the screen; built only where the science shows the effect is real (see domains/void.defences.md) | influence-science | own | hypothesis |  |  |  |
| shared-intake | part | Shared intake (shared part, A2M.ops.md) | abandoned-project-ghost-finishing, aquifer-yield, capacity-marketplace, conforming-amendment-sprint, context-residue-handover, control-ledger, cutover-file, group-letter-proof, handoff-studio, leftover-footprint, make-it-insurable, neighborhood-street-days, relic-weaver, taxpoint-file, worksite-split |  | hypothesis |  |  |  |
| ai-extraction | part | Ai extraction (shared part, A2M.ops.md) | abandoned-project-ghost-finishing, embodied-error-data, handoff-studio, make-it-insurable, relic-weaver |  | hypothesis |  |  |  |
| back-office | part | Back office (shared part, A2M.ops.md) | abandoned-project-ghost-finishing, aquifer-yield, capacity-marketplace, context-residue-handover, embodied-error-data, grid-salvage, handoff-studio, make-it-insurable, neighborhood-street-days, relic-weaver |  | hypothesis |  |  |  |
| gatekeeper-packet | part | Gatekeeper packet (shared part, A2M.ops.md) | aquifer-yield, capacity-marketplace, conforming-amendment-sprint, control-ledger, cutover-file, embodied-error-data, grid-salvage, group-letter-proof, handoff-studio, leftover-footprint, make-it-insurable, taxpoint-file, worksite-split |  | hypothesis |  |  |  |
| evidence-rule | part | Evidence rule (shared part, A2M.ops.md) | aquifer-yield, grid-salvage, handoff-studio, make-it-insurable |  | hypothesis |  |  |  |
| partner-bench | part | Partner bench (shared part, A2M.ops.md) | aquifer-yield, capacity-marketplace, conforming-amendment-sprint, control-ledger, cutover-file, grid-salvage, group-letter-proof, handoff-studio, leftover-footprint, make-it-insurable, neighborhood-street-days, taxpoint-file, worksite-split |  | hypothesis |  |  |  |
| deadline-calendar | part | Deadline calendar (shared part, A2M.ops.md) | aquifer-yield, capacity-marketplace, conforming-amendment-sprint, control-ledger, cutover-file, grid-salvage, group-letter-proof, handoff-studio, leftover-footprint, make-it-insurable, taxpoint-file, worksite-split |  | hypothesis |  |  |  |
| data-center-demand-watch | part | Data center demand watch (shared part, A2M.ops.md) | aquifer-yield, capacity-marketplace, grid-salvage, handoff-studio |  | hypothesis |  |  |  |
| consent-record | part | Consent record (shared part, A2M.ops.md) | capacity-marketplace, conforming-amendment-sprint, context-residue-handover, control-ledger, cutover-file, embodied-error-data, group-letter-proof, handoff-studio, leftover-footprint, make-it-insurable, neighborhood-street-days, relic-weaver, taxpoint-file, worksite-split |  | hypothesis |  |  |  |
| readiness-sprint | part | Readiness sprint (shared part, A2M.ops.md) | conforming-amendment-sprint, control-ledger, cutover-file, group-letter-proof, leftover-footprint, taxpoint-file, worksite-split |  | hypothesis |  |  |  |
| jurisdiction-rule-set | part | Jurisdiction rule set (shared part, A2M.ops.md) | conforming-amendment-sprint, control-ledger, cutover-file, group-letter-proof, leftover-footprint, taxpoint-file, worksite-split |  | hypothesis |  |  |  |
| drift-check | part | Drift check (shared part, A2M.ops.md) | conforming-amendment-sprint, leftover-footprint |  | hypothesis |  |  |  |
| scope-exemption-worksheet | part | Scope exemption worksheet (shared part, A2M.ops.md) | control-ledger, taxpoint-file |  | hypothesis |  |  |  |
| aging-owner-research | part | Aging owner research (shared part, A2M.ops.md) | embodied-error-data, handoff-studio, neighborhood-street-days |  | hypothesis |  |  |  |
| n8n | part | N8n (shared part, A2M.ops.md) | handoff-studio |  | hypothesis |  |  |  |
| lakeland-polk | part | Lakeland polk (shared part, A2M.ops.md) | handoff-studio, make-it-insurable, neighborhood-street-days |  | hypothesis |  |  |  |
| leftover-ledger | part | Leftover ledger (shared part, A2M.ops.md) | leftover-footprint |  | hypothesis |  |  |  |
| cross-jurisdiction-crosswalk | part | Cross jurisdiction crosswalk (shared part, A2M.ops.md) | worksite-split |  | hypothesis |  |  |  |

## Edges

| from | to | via | status | source | dated |
| --- | --- | --- | --- | --- | --- |
| printed-linear-motor | printed-actuator-joint | living-figures | hypothesis |  |  |
| printed-actuator-joint | assistive-joint | life-extension | hypothesis |  |  |
| printed-actuator-joint | field-robot-limb | restoring-planet | hypothesis |  |  |
| soft-actuator | original-figure | living-figures | hypothesis |  |  |
| soft-actuator | assistive-joint | life-extension | hypothesis |  |  |
| soft-actuator | field-robot-limb | restoring-planet | hypothesis |  |  |
| printed-joint-sensor | printed-actuator-joint | living-figures | hypothesis |  |  |
| original-figure | export | living-figures | hypothesis |  |  |
| export | print | printed-machines | hypothesis |  |  |
| print | own | living-figures | hypothesis |  |  |
| replicator | print | living-figures | hypothesis |  |  |
| holodeck | original-figure | living-figures | hypothesis |  |  |
| persuadetron | original-figure | model-fight-league | hypothesis |  |  |
| persuadetron | persuasion-defence | influence-science | hypothesis |  |  |
