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
    claim: Ask, spin, download STL or 3MF. Not browser-tested. Not slicer-tested.
  - id: stage-figure
    kind: void-stage
    status: hypothesis
    part: little 3D figure inhabiting the current Void
    tracks: [living-figures, void-stage]
    claim: Search pops a small 3D version that uses what is already on stage and leaves when thrown off with the mouse.
```

## Cycle log

- 2026-10-03 seed. Only the MIT linear motor is established. Figure-joint link is a hypothesis. Export-to-print is blocked.
- 2026-10-03 build (PR #40, not a research cycle): the stage-figure node has a working ask in Void ("a chair" then "summon motelet": it sits; a cup: it holds it; thrown off the screen it leaves), browser-tested. Export-to-print now has a browser-tested STL download (Motelet, Linemote-1); still not slicer-tested or printed, so it stays blocked.
