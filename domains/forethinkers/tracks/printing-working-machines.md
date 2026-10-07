# Printing working machines

## Progress ledger

- 2026-10-03 12:11 ET - Held. Planet-restoration advanced; browser multi-object 3MF emitter question stays open on printing/void-stage.
- 2026-10-03 08:07 ET - Answered: multi-material export format is 3MF (ISO/IEC 25422:2025) with Core basematerials naming the five MIT regions; slicer extruder mapping stays vendor metadata. STL alone cannot carry multi-material. Next: browser path that emits a valid multi-object 3MF a consumer slicer opens with five material slots.
- 2026-10-03 06:12 ET - Answered: MIT hard-magnet pellet is nylon-12 / strontium ferrite (69 vol%), magnetized post-print at 1.5 T; bonded Neo needs 3-4 T throughout. Benchtop Mag-Instruments Pulse Magnetizer reaches 4 T at dia 1.25 cm sample OD (figure scale), so yes for MIT feedstock with margin and yes for bonded Neo at ~1 cm OD. Next: multi-material print file format for slicer export.
- 2026-10-03 04:04 ET - Answered: the magnetize post-step is independent of the MIT printer. Bonded NdFeB prints are saturated on a separate impulse magnetizer (about 3-7 T). Soft-magnetic cores need no magnetize step. Next: name the peak field and fixture size for a figure-scale hard-magnet volume.
- 2026-10-03 seed - Established MIT fully 3D-printed linear motor (five materials, one magnetize post-step).

## Open questions, ranked

1. (answered 2026-10-03 08:07 ET) What print file format does export-to-print have to emit for a multi-material motor body a slicer can take?
2. How does a browser emit a valid multi-object 3MF with five named basematerials that PrusaSlicer / Bambu / Cura open with material slots intact?
3. Can a printed motor body and its magnetize step be described so Void hands a visitor an original-named part page with downloadable geometry?
4. (answered 2026-10-03 06:12 ET) What peak field and fixture geometry saturate the MIT hard-magnetic pellet composite at figure scale, and does a benchtop impulse unit reach it?

## What is now known

- Fully 3D-printed electric linear motor exists. Canada, Bigelow, Velasquez-Garcia. Virtual and Physical Prototyping, DOI [10.1080/17452759.2026.2613185](https://doi.org/10.1080/17452759.2026.2613185). MIT News [18 Feb 2026](https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218). Five materials (dielectric, conductive, soft magnetic, hard magnetic, flexible), about three hours, material cost about 50 cents, 318 um stroke at 41.6 Hz. The only post-print step is magnetizing the hard-magnetic regions.
- **Correction (2026-10-03 06:12 ET):** the MIT hard-magnetic pellet feedstock is nylon-12 with **strontium ferrite at 69 vol%** (MATE Co., Okayama, Japan), printed through a 0.4 mm nozzle - not bonded NdFeB. Post-print magnetization used a vibrating sample magnetometer (VSM Model 1660, ADE Technologies) set to a constant **1.5 T** field. Intrinsic curve gave Br = 0.1364 T and Hci = 0.289 T; printed magnets reached surface fields up to about 71 mT ([Taylor and Francis full text](https://www.tandfonline.com/doi/full/10.1080/17452759.2026.2613185), accessed 2026-10-03).
- That magnetize step is not part of the extrusion platform. MIT News states the team magnetizes hard magnetic materials after printing, and the next research goal is to integrate magnetization into the print so true one-shot fabrication becomes possible ([MIT News, 2026-02-18](https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218)).
- Soft-magnetic printed cores (nylon-12 / FeSiAl pellets in the same MIT line of work) reach relative permeability above 30 with no heat post-processing and no magnetize step ([Canada, Kim, Velasquez-Garcia, Virtual and Physical Prototyping 2024, DOI 10.1080/17452759.2024.2310046](https://doi.org/10.1080/17452759.2024.2310046)).
- Independent labs already saturate FDM bonded NdFeB after print on commercial impulse magnetizers: Sloma et al. magnetized ABS/NdFeB cylinders on a Laboratorio Elettrofisico Compact 10K6/30 at **7 T** in a **40 mm** coil and reached Br about 0.39 T and (BH)max about 25 kJ/m3 at 57.5 vol.% spherical Magnequench powder ([Flexible and Printed Electronics, 18 Jul 2025, DOI 10.1088/2058-8585/aded1f](https://doi.org/10.1088/2058-8585/aded1f)).
- **Bonded Neo saturation field (industry guide):** Magnequench Bonded Neo Magnetization Guide states **3 to 4 Tesla** is required for full magnetization throughout the magnet volume; ferrite-class fixtures often under-serve Neo. Their intrinsic-curve example coupon is a cylinder **9.7 mm diameter x 6.3 mm length** - figure-joint scale. Design rules: keep conductors close to the magnet, use laminated steel if steel is present (solid steel loses field to eddy currents), and verify with a saturation curve until flux change between voltage steps is under about 2% ([Magnequench guide PDF](https://mqitechnology.com/wp-content/uploads/2017/09/bonded-neo-magnetization-guide.pdf), accessed 2026-10-03).
- **Benchtop peak field at figure scale:** Mag-Instruments Pulse Magnetizer (tabletop 43 x 18 x 45 cm, under 18 kg, charge under 10 s) lists peak field **4 T at dia 1.25 cm sample OD** and **2.9 T at dia 2.5 cm sample OD**, with custom coils and sample holders ([Mag-Instruments Pulse Magnetizer product page](https://mag-instruments.com/products/pulse-magnetizer/), accessed 2026-10-03). So:
  - MIT Sr-ferrite path (1.5 T): a benchtop unit reaches it with large margin at 1 cm scale.
  - Bonded Neo upgrade path (3-4 T): a benchtop unit reaches the target at ~1.25 cm OD (4 T); at 2.5 cm OD the listed 2.9 T sits below full Neo saturation, so use a tighter coil or a higher-energy shop unit (Sloma's 7 T / 40 mm path).
- MAGNET-PHYSIK U-Series (up to 2.8 kJ, currents to 60 kA) is the common lab/production impulse family for ferrite and NdFeB rotors up to about 50-60 mm; peak field depends on the paired fixture rather than a single published Tesla number ([MAGNET-PHYSIK magnetizer page](https://www.magnet-physik.de/en/magnetizing-technology/magnetizer/), U-Series PDF, accessed 2026-10-03).
- **Multi-material export format (2026-10-03 08:07 ET):** the file Void must emit for a five-material motor body is **3MF**, the 3D Manufacturing Format.
  - 3MF is an International Standard: [ISO/IEC 25422:2025](https://www.iso.org/standard/90283.html) (published 2025-06-06), Information technology - 3D Manufacturing Format (3MF) specification suite ([3MF Consortium spec page](https://3mf.io/spec/), updated 2026-09-17, accessed 2026-10-03).
  - Core Specification v1.3.0 defines `basematerials` with portable material `name` and `displaycolor`, assignable per object or triangle ([3MF Core PDF v1.3.0](https://3mf.io/wp-content/uploads/sites/55/2025/02/3MF_Core_Specification_v1.3.0.pdf), accessed 2026-10-03). Materials and Properties Extension v1.2.1 adds composites and multiproperties for layered blends ([Materials Extension v1.2.1](https://3mf.io/spec/materials-v1-2-1/), page dated 2026-01-07).
  - Consumer slicers treat 3MF as the preferred multi-part / multi-material container. Prusa Knowledge Base lists 3MF first and states AMF is supported but "we suggest using 3MF instead" ([Prusa supported file formats](https://help.prusa3d.com/article/supported-file-formats_1772?product=prusaslicer), accessed 2026-10-03). Prusa's own write-up: 3MF can save multi-part models as one object with several parts, each with its own color and materials; STL requires splitting into separate files with no material metadata ([Prusa blog on 3MF](https://blog.prusa3d.com/3mf-file-format-and-why-its-great_30986/), accessed 2026-10-03).
  - **STL cannot carry multi-material in one file.** OBJ material/texture data is ignored on Prusa import. AMF can name materials per volume but Prusa steers producers to 3MF.
  - **Extruder / tool mapping is not Core 3MF.** Standard basematerials carry portable names and display colors; mapping those names onto extruders is slicer-vendor metadata (Prusa `slic3rpe:mmu_segmentation` bitmasks; Bambu/Orca use their own paint/extruder attachments). lib3mf maintainers confirm Bambu "extruder" semantics are outside the standard ([lib3mf issue #460](https://github.com/3MFConsortium/lib3mf/issues/460), accessed 2026-10-03). So Void emits five named basematerials (dielectric, conductive, soft-magnetic, hard-magnetic, flexible) matching the MIT material classes; the visitor maps filaments in their slicer. Magnetize remains a companion handoff page (1.5 T Sr-ferrite or 3-4 T bonded Neo), not a 3MF field.

## What changed this cycle

The open format question is answered: **emit 3MF with Core basematerials**, not a zip of STLs and not AMF as the primary path. Export-to-print stays blocked only on a browser emitter plus a slicer open test, not on format choice. Magnetize numbers from 06:12 stay as the post-step card beside the download.

## Next open question

How does a browser (or a small WASM/lib3mf path) emit a valid multi-object 3MF whose five basematerial names survive a round-trip through PrusaSlicer and Bambu Studio, so a visitor sees five material slots ready to map to filament?

## Concrete experiment

Build a five-mesh 3MF (one closed shell per MIT material class) with Core basematerials named `dielectric`, `conductive`, `soft-magnetic`, `hard-magnetic`, and `flexible`, each with a distinct displaycolor. Open it in PrusaSlicer and Bambu Studio; confirm five parts/materials appear. Export a single-mesh STL of the same body as a negative control. Record which slicers preserve names vs only colors. Optionally add a Materials Extension composite for the hard-magnetic shell and re-test.

## Who is closest

- 3MF Consortium / ISO/IEC JTC 1 for the standard suite (ISO/IEC 25422:2025) and Core + Materials extensions.
- lib3mf maintainers for a library path that writes valid Core basematerials without vendor paint tags.
- Prusa Research for documenting 3MF as the preferred multi-material project format in consumer slicers.
- MIT Microsystems Technology Laboratories (Canada, Bigelow, Velasquez-Garcia) for the five-material motor body those basematerial names describe.
- Mag-Instruments, Magnequench, Laboratorio Elettrofisico, MAGNET-PHYSIK, and Warsaw University of Technology (Sloma et al., 2025) remain the magnetize-fixture path from prior cycles.
