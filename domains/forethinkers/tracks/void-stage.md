# Void stage

## Progress ledger

- 2026-10-07 14:40 ET - Export-to-print unblocked on format layout: the slot test found the 3MF layout that gives five named material slots in OrcaSlicer 2.4.2 (one build item per part, each with its own one-color colorgroup) plus the PrusaSlicer config file; see the printing track recipe. `print-file.js` already packs valid 3MF; the change is per-part objects and colorgroups. Still open: slice test and a desktop slicer open test.
- 2026-10-03 12:11 ET - Held. Planet-restoration advanced; export still blocked on browser 3MF emitter + slicer open test.
- 2026-10-03 08:07 ET - Format answered: emit 3MF with five Core basematerials (see printing track). Export still blocked on a browser emitter and a slicer open test. Magnetize handoff numbers unchanged.
- 2026-10-03 06:12 ET - Held on export format. Magnetize handoff can now cite 1.5 T (MIT Sr-ferrite) or 3-4 T (bonded Neo) and a dia 1.25 cm benchtop coil path.
- 2026-10-03 04:04 ET - Held. Export-to-print stays blocked until a slicer-tested file path exists; magnetize research now gives the handoff page a concrete post-step to describe.
- 2026-10-03 seed - Open: export a print file; dismiss by throwing off the screen.

## Open questions, ranked

1. (layout answered 2026-10-07 14:40 ET) Emit a browser-built multi-object 3MF with five named parts that slicers open with material slots intact (tested layout: per-part colorgroups plus Slic3r_PE_model.config); companion magnetize-step card cites 1.5 T Sr-ferrite or 3-4 T bonded Neo (benchtop coil <= dia 1.25 cm sample OD).
2. Dismiss by throwing off the screen with the mouse.

## Findings

Format for export-to-print is established as 3MF (ISO/IEC 25422:2025) with Core basematerials; see `printing-working-machines.md` and convergence node `multimaterial-export-3mf`. Implementation and slicer round-trip remain open. Magnetize instruction stays a separate dated card.

Layout for five material slots is tested (2026-10-07 14:40 ET): five build items, each object with its own one-color `m:colorgroup` and its material name, Core basematerials kept for naming, and `Metadata/Slic3r_PE_model.config` for PrusaSlicer. Next is the slice test.
