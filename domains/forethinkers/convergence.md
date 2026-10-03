# convergence — the shared-parts map

The unit of a Forethinkers cycle is one row here: a part, or a Void stage that is blocked. `tools/forethinkers.py`
reads and rewrites the two tables below; keep their columns as they are.

- tracks: printing, figures, longevity, restoration
- part status: established (dated source + named part) | hypothesis (the map says so, nobody has checked; no source)
- stage status: live | blocked
- `checked` is the last day a cycle took this row as its unit

## Nodes

| id | kind | name | tracks | stages | status | source | dated | checked |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| summon | stage | Summon: ask Void and a 3D thing appears | figures |  | live |  |  |  |
| spin | stage | Spin: drag to turn what was summoned | figures |  | live |  |  |  |
| export | stage | Export: a summoned thing leaves Void as a mesh file (STL / 3MF / glTF) | printing, figures |  | blocked |  |  |  |
| print | stage | Print: the exported file prints, and a body with parts moves | printing, figures, longevity, restoration |  | blocked |  |  |  |
| own | stage | Own: what was printed is bound to the person, with rights and safe-use limits | figures, longevity, restoration |  | blocked |  |  |  |
| printed-linear-motor | part | Printed electric linear motor (MIT multi-material platform, about 3 hours, about $0.50 of material) | printing | print | established | https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218 | 2026-02-18 |  |
| printed-actuator-joint | part | Printed actuator used as a figure joint | printing, figures | export, print | hypothesis |  |  |  |
| soft-actuator | part | Soft actuator (motion that is safe next to people) | printing, figures, longevity, restoration | print | hypothesis |  |  |  |
| printed-joint-sensor | part | Printed joint sensor (position, speed, direction) | printing, figures, longevity | print | hypothesis |  |  |  |
| original-figure | part | Original character figure, our own IP (a toy that comes alive) | figures | summon, spin, export | hypothesis |  |  |  |
| assistive-joint | part | Assistive or prosthetic joint built from the same actuator | longevity | print | hypothesis |  |  |  |
| field-robot-limb | part | Restoration field-robot limb built from the same actuator | restoration | print | hypothesis |  |  |  |

## Edges

| from | to | via | status | source | dated |
| --- | --- | --- | --- | --- | --- |
| printed-linear-motor | printed-actuator-joint | figures | hypothesis |  |  |
| printed-actuator-joint | assistive-joint | longevity | hypothesis |  |  |
| printed-actuator-joint | field-robot-limb | restoration | hypothesis |  |  |
| soft-actuator | original-figure | figures | hypothesis |  |  |
| soft-actuator | assistive-joint | longevity | hypothesis |  |  |
| soft-actuator | field-robot-limb | restoration | hypothesis |  |  |
| printed-joint-sensor | printed-actuator-joint | figures | hypothesis |  |  |
| original-figure | export | figures | hypothesis |  |  |
| export | print | printing | hypothesis |  |  |
| print | own | figures | hypothesis |  |  |
