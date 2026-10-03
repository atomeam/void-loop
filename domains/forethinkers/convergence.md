# Convergence map

Each node is one claim. A cycle picks one node and fans only into `tracks`. Status `established` needs title, url, date, and part. The runner rejects anything else.

```yaml
nodes:
  - id: mit-printed-linear-motor
    kind: shared-part
    status: established
    part: fully 3D-printed electric linear motor
    title: "Fully 3D-Printed electric motor manufactured via multi-modal, multi-material extrusion"
    url: https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218
    date: 2026-02-18
    tracks: [printing-working-machines]
    claim: Five materials, about three hours, one post-step to magnetize, 318 um at 41.6 Hz. A printed motor exists. It does not show a figure joint moving.
  - id: magnetize-outside-printer
    kind: shared-part
    status: established
    part: post-print impulse magnetization of bonded hard magnets
    title: "3D printed bonded magnets from rare-earth micropowder alloys"
    url: https://doi.org/10.1088/2058-8585/aded1f
    date: 2025-07-18
    tracks: [printing-working-machines]
    claim: Hard-magnetic polymer prints are saturated on a separate impulse magnetizer (about 3 to 7 T), not inside the MIT extrusion platform. Soft-magnetic cores need no magnetize step. MIT News 2026-02-18 states magnetization is the post-print step and in-print magnetization is the next research goal.
  - id: printed-actuator-moves-figure-joint
    kind: shared-part
    status: hypothesis
    part: printed actuator in a figure joint
    tracks: [printing-working-machines, living-figures]
    claim: A printed actuator could move a miniature figure joint. The linear motor alone does not show this.
  - id: export-to-print
    kind: void-stage
    status: blocked
    part: export a print file from a summoned figure
    tracks: [void-stage]
    claim: Ask, spin, download STL or 3MF. Not browser-tested on main. Not slicer-tested. Magnetize handoff text can now cite dated impulse practice.
  - id: stage-figure
    kind: void-stage
    status: hypothesis
    part: little 3D figure inhabiting the current Void
    tracks: [living-figures, void-stage]
    claim: Search pops a small 3D version that uses what is already on stage and leaves when thrown off with the mouse.
```

## Cycle log

- 2026-10-03 04:04 ET. Magnetize-outside-printer established from Słoma et al. 2025 (7 T impulse on FDM NdFeB) plus MIT News 2026-02-18 (magnetize is post-print; in-print is next). Figure-joint link stays hypothesis. Export-to-print stays blocked on main.
- 2026-10-03 seed. Only the MIT linear motor is established. Figure-joint link is a hypothesis. Export-to-print is blocked.
