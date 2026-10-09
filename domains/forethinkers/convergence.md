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
    claim: Five materials, about three hours, one post-step to magnetize, 318 um at 41.6 Hz. Hard-magnet pellet is nylon-12 / Sr-ferrite (69 vol%), magnetized at 1.5 T. A printed motor exists. It does not show a figure joint moving.
  - id: magnetize-outside-printer
    kind: shared-part
    status: established
    part: post-print impulse magnetization of bonded hard magnets
    title: "3D printed bonded magnets from rare-earth micropowder alloys"
    url: https://doi.org/10.1088/2058-8585/aded1f
    date: 2025-07-18
    tracks: [printing-working-machines]
    claim: Hard-magnetic polymer prints are saturated on a separate impulse magnetizer (about 3 to 7 T for bonded Neo), not inside the MIT extrusion platform. Soft-magnetic cores need no magnetize step. MIT News 2026-02-18 states magnetization is the post-print step and in-print magnetization is the next research goal.
  - id: figure-scale-benchtop-magnetize
    kind: shared-part
    status: established
    part: figure-scale peak field and benchtop fixture for printed hard magnets
    title: "Pulse Magnetizer (PM)"
    url: https://mag-instruments.com/products/pulse-magnetizer/
    date: 2026-10-03
    tracks: [printing-working-machines]
    claim: "MIT Sr-ferrite hard magnets need 1.5 T (paper DOI 10.1080/17452759.2026.2613185). Bonded Neo needs 3-4 T throughout (Magnequench guide). Mag-Instruments benchtop PM reaches 4 T at dia 1.25 cm sample OD and 2.9 T at dia 2.5 cm, so figure-scale (~1 cm) magnetize is a benchtop job for MIT feedstock and for Neo at tight coil OD."
  - id: multimaterial-export-3mf
    kind: shared-part
    status: established
    part: multi-material slicer export format
    title: "ISO/IEC 25422:2025 — 3D Manufacturing Format (3MF) specification suite"
    url: https://www.iso.org/standard/90283.html
    date: 2025-06-06
    tracks: [printing-working-machines, void-stage]
    claim: "Export-to-print emits 3MF (ISO/IEC 25422:2025) with Core basematerials naming the five MIT material classes plus display colors. Extruder mapping is slicer-vendor metadata, not Core. STL cannot carry multi-material in one file. Prusa prefers 3MF over AMF (KB accessed 2026-10-03)."
  - id: senolytics-mash-dq
    kind: shared-part
    status: established
    part: intermittent senolytic D+Q fibrosis improvement in fibrotic MASH
    title: "Senolytics dasatinib and quercetin in metabolic dysfunction-associated steatohepatitis: a proof-of-principle randomized, controlled trial"
    url: https://www.nature.com/articles/s42255-026-01643-4
    date: 2026-10-01
    tracks: [life-extension]
    claim: "Phase-2 RCT (n=31): intermittent dasatinib+quercetin achieved ≥1-stage fibrosis improvement without MASH worsening in 47% vs 7% placebo (P=0.02); MASH resolution 53% vs 7%. snRNA-seq showed lower senescence and fibrosis signatures. Hypothesis-generating (small n). Nature Metabolism 1 Oct 2026; NCT05506488."
  - id: senolytic-burden-selects-responders
    kind: shared-part
    status: established
    part: senescent-cell burden (T-cell p16 variant 5 or plasma SASP) picks who responds to D+Q
    title: "Effects of intermittent senolytic therapy on bone metabolism in postmenopausal women: a phase 2 randomized controlled trial"
    url: https://doi.org/10.1038/s41591-024-03096-2
    date: 2024-07-02
    tracks: [life-extension]
    claim: "Overall primary endpoint missed (CTx P=0.611, n=60); highest p16 tertile responded (P1NP +34%, CTx -11%, radius BMD +2.7%, exploratory). Aging Cell 2025 (doi 10.1111/acel.14489): p16 variant 5 predicts response best; plasma SASP panel is a substitute. Registry check 2026-10-07 (ClinicalTrials.gov API v2, CORS open): no follow-on senolytic MASH trial registered; three prospective GLP-1 DNAm-age trials (NCT07220473, NCT07707778, NCT07293325) read out 2027."
  - id: florida-keys-reef-accretion
    kind: shared-part
    status: established
    part: A. cervicornis outplanting raises offshore reef-accretion potential
    title: "Coral restoration can drive rapid increases in reef-accretion potential"
    url: https://doi.org/10.1038/s41598-025-04818-3
    date: 2025-08-04
    tracks: [planet-restoration]
    claim: "Lower Florida Keys paired surveys: restored offshore A. cervicornis areas reach +2.80 mm y⁻¹ reef-accretion potential vs −0.84 mm y⁻¹ non-restored within 2–6 years; >16× gross carbonate production; ≈5% cover gain. Inshore massive restoration: no measurable accretion effect. 2023 bleach near-complete A. cervicornis mortality vs 59% massive survival. Open USGS CC0 data DOI 10.5066/P13HMEON."
  - id: florida-acropora-functional-extinction
    kind: shared-part
    status: established
    part: 2023 heatwave killed nearly all Florida Keys Acropora, so restoration success now hinges on heat tolerance
    title: "Heat-driven functional extinction of Caribbean Acropora corals from Florida's Coral Reef"
    url: https://doi.org/10.1126/science.adx7825
    date: 2025-10-23
    tracks: [planet-restoration]
    claim: "Science 390:361 (Manzello et al.): SST at or above 31 C for 40.7 days on average; 97.8-100% of A. palmata and A. cervicornis dead in the Keys and Dry Tortugas by March 2024 (52,356 colonies), 37.9% offshore southeast Florida. Gene banks prevented extirpation (Conserv Biol doi 10.1111/cobi.70168). Durusdinium elkhorn +1.9 C ED50 (Coral Reefs doi 10.1007/s00338-025-02652-7). First permitted cross-border outplant (Florida x Honduras) July 2025; Dry Tortugas side-by-side trial April 2026."
  - id: offline-character-mind-module
    kind: shared-part
    status: established
    part: offline voice mind module (wake word, ASR, small LLM, TTS) at toy size and power
    title: "Module LLM (Axera AX630C)"
    url: https://docs.m5stack.com/en/module/Module-LLM
    date: 2026-10-07
    tracks: [living-figures]
    claim: "54 x 54 x 13 mm, 17.1 g, 0.5 W idle / 1.5 W full load, wake word + ASR + Qwen2.5-0.5B + TTS with no cloud; 359.8 ms first token and 10.32 tokens/s (M5Stack model page, accessed 2026-10-07). Answers toy problem 1 at the part level. Too large for a 38 mm body, so the mind lives in the figure's home base; that layout is the next bench test."
  - id: slicer-slot-3mf-layout
    kind: shared-part
    status: established
    part: 3MF layout that opens as five named material slots in a consumer slicer
    title: "OrcaSlicer v2.4.2 3MF importer (src/libslic3r/Format/bbs_3mf.cpp)"
    url: https://github.com/OrcaSlicer/OrcaSlicer/blob/v2.4.2/src/libslic3r/Format/bbs_3mf.cpp
    date: 2026-07-07
    tracks: [printing-working-machines, void-stage]
    claim: "Box slot test 2026-10-07 (lib3mf 2.5.0 strict read, OrcaSlicer 2.4.2 CLI --export-3mf): five build items, each object with its own one-color m:colorgroup, keep five names on extruders 1-5. Core basematerials alone, one shared colorgroup, or one components assembly all land on extruder 1. PrusaSlicer 2.9.6 (2026-06-25) reads extruders only from Metadata/Slic3r_PE_model.config. Bambu Studio master (2026-09-22) also maps pid/pindex pairs."
  - id: printed-motor-waves-arm
    kind: shared-part
    status: established
    part: 3D-printed electric motor (every element but the permanent magnets) driving a waving arm and a multi-legged walking robot
    title: "Fully 3D-Printed Wave-Wound Electromagnetic Motors"
    url: https://doi.org/10.1002/admt.70994
    date: 2026-04-20
    tracks: [printing-working-machines, living-figures]
    claim: "Schwalbe, Mettes, Francke, Allen, Mazumdar (Georgia Tech), Advanced Materials Technologies e70994, 20 Apr 2026, CC BY 4.0 (abstract via Crossref, read 2026-10-07). Printed stator, housing, bearings and sensing circuit (silver nanoparticle ink, thermally conductive insulating polymer, surface-mount parts); bought magnets. Axial flux motor 7.62 N mm/A peak torque constant, 28.2% peak efficiency, about 5x the torque and 3.7x the efficiency of prior printed motors. Demos: fan, water pump, paddle-wheel boat, multi-legged walking robot, waving arm. Earlier steps from the same lab: single-print coil actuator plus compliant-joint gripper, 46 mN over 4 mm at 6.3 W, 4.2 W continuous at 140 C (Mettes et al., IEEE/ASME AIM 2023, doi 10.1109/AIM46323.2023.10196155). Fluidic path: UC San Diego one-print TPU six-legged walker on an air supply (Zhai et al., Adv Intell Syst, 26 Jan 2025, doi 10.1002/aisy.202400876)."
  - id: printed-actuator-moves-figure-joint
    kind: shared-part
    status: hypothesis
    part: printed actuator in a figure joint at toy size and toy-safe heat
    tracks: [printing-working-machines, living-figures]
    claim: "A printed motor now moves a robot arm (see printed-motor-waves-arm), so the open part is the figure: a printed motor small enough for a 38 mm to 120 mm body, run from a toy battery, with outer surfaces kept within ASTM F963 section 4.4 thermal limits. Printed coils run hot (140 C at 4.2 W in the AIM 2023 coil), so the motor needs low duty cycle or a printed thermal path to the base. Derived torque need for a Motelet arm wave is small (see living-figures track)."
  - id: export-to-print
    kind: void-stage
    status: hypothesis
    part: export a print file from a summoned figure
    tracks: [void-stage]
    claim: Format is 3MF; the five-slot layout is tested (see slicer-slot-3mf-layout). print-file.js on main already packs valid single-part 3MF. Moves from blocked to hypothesis; becomes established once the per-part export ships and a slice test shows five tool changes. Magnetize handoff cites 1.5 T (MIT Sr-ferrite) or 3-4 T (bonded Neo) and a dia 1.25 cm benchtop coil path.
  - id: stage-figure
    kind: void-stage
    status: hypothesis
    part: little 3D figure inhabiting the current Void
    tracks: [living-figures, void-stage]
    claim: Search pops a small 3D version that uses what is already on stage and leaves when thrown off with the mouse. Motelet does this on main (void-live-deploy/skills/figure.js, 2026-10-07); stays hypothesis here until a dated public page describes it.
```

## Cycle log

- 2026-10-07 20:14 ET. Printed-motor-waves-arm established (Schwalbe et al., Advanced Materials Technologies, 20 Apr 2026, doi 10.1002/admt.70994): a motor printed in every element but its magnets drives a waving arm and a multi-legged walking robot, 7.62 N mm/A, 28.2% efficiency. The figure-joint node stays hypothesis with a narrower gap: toy size, toy battery, toy-safe surface heat. Logged the AIM 2023 single-print coil-plus-gripper and the UC San Diego one-print pneumatic walker as the two earlier routes. No earlier think-tank branches or PRs to fold.
- 2026-10-07 18:07 ET. Florida-acropora-functional-extinction established (Manzello et al. Science 23 Oct 2025): the 2023 heatwave killed 97.8-100% of Keys Acropora, answering planet-restoration question 3. Logged gene banks (Muller et al. Conserv Biol 2025), Durusdinium +1.9 C elkhorn (Coral Reefs 2025), the Baker et al. Science AGF forum, and the Flonduran field trials (Miami July 2025, Dry Tortugas April 2026). No earlier think-tank branches or PRs to fold.
- 2026-10-07 16:20 ET. Senolytic-burden-selects-responders established (Farr et al. Nat Med 2024; Aging Cell 2025 p16 variant 5). Live ClinicalTrials.gov pass: no senolytic MASH replication registered, NCT05506488 has no posted results, three prospective GLP-1 DNAm-age trials read out Apr-Dec 2027. Registry API is browser-readable, so a live trial-watch card is buildable. Stale 14:16 worktree removed (its PR #158 had merged).
- 2026-10-07 14:40 ET. Slicer-slot-3mf-layout established by a box slot test (seven variants, lib3mf strict + OrcaSlicer 2.4.2 CLI round-trip): one build item per part with its own one-color colorgroup gives five named parts on extruders 1-5; basematerials alone give one slot. PrusaSlicer 2.9.6 needs Slic3r_PE_model.config. Export-to-print unblocked to hypothesis. Corrected the 08:07 basematerials-only plan.
- 2026-10-07 12:17 ET. Offline-character-mind-module established (M5Stack Module LLM, AX630C: 54 mm, 17 g, 1.5 W, offline wake word + ASR + 0.5B LLM + TTS at 10.3 tokens/s). Living-figures hold lifted because Motelet is on main. Babaru (16 Apr 2026) and Waylo Offline logged as consumer on-device-mind toys. Folded unmerged 08:07, 10:08 and 12:11 cycles from 2026-10-03.
- 2026-10-03 12:11 ET. Florida-keys-reef-accretion established (Toth et al. Sci Rep DOI 10.1038/s41598-025-04818-3; −0.84 → +2.80 mm y⁻¹; USGS 10.5066/P13HMEON). GSOCS-LULCC and Australia SOC-M logged on planet-restoration track. Life-extension and 3MF work from prior cycles stay folded on this branch.
- 2026-10-03 10:08 ET. Senolytics-mash-dq established (Nature Metabolism 1 Oct 2026; D+Q 47% vs 7% fibrosis improvement). PEARL rapamycin safety (Aging 4 Apr 2025) and semaglutide epigenetic slowing (Nat Commun 19 May 2026) logged on life-extension track. Printing/void-stage 3MF work from 08:07 stays folded on this branch.
- 2026-10-03 08:07 ET. Multimaterial-export-3mf established (ISO/IEC 25422:2025; Core basematerials; Prusa prefers 3MF). Export-to-print stays blocked on browser emitter + slicer test. Figure-joint link stays hypothesis.
- 2026-10-03 06:12 ET. Figure-scale-benchtop-magnetize established. MIT hard magnet is Sr-ferrite at 1.5 T (Canada et al. VPP 2026); bonded Neo needs 3-4 T (Magnequench); Mag-Instruments PM reaches 4 T at dia 1.25 cm sample OD. Export-to-print stays blocked on format. Figure-joint link stays hypothesis.
- 2026-10-03 04:04 ET. Magnetize-outside-printer established from Sloma et al. 2025 (7 T impulse on FDM NdFeB) plus MIT News 2026-02-18 (magnetize is post-print; in-print is next). Figure-joint link stays hypothesis. Export-to-print stays blocked on main.
- 2026-10-03 seed. Only the MIT linear motor is established. Figure-joint link is a hypothesis. Export-to-print is blocked.
- 2026-10-03 build (PR #40, not a research cycle): the stage-figure node has a working ask in Void ("a chair" then "summon motelet": it sits; a cup: it holds it; thrown off the screen it leaves), browser-tested. Export-to-print now has a browser-tested STL download (Motelet, Linemote-1); still not slicer-tested or printed, so it stays blocked.
