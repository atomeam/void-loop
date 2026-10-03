# Printing working machines

## Progress ledger

- 2026-10-03 04:04 ET — Answered: the magnetize post-step is independent of the MIT printer. Bonded NdFeB prints are saturated on a separate impulse magnetizer (about 3–7 T). Soft-magnetic cores need no magnetize step. Next: name the peak field and fixture size for a figure-scale hard-magnet volume.
- 2026-10-03 seed — Established MIT fully 3D-printed linear motor (five materials, one magnetize post-step).

## Open questions, ranked

1. What peak field and fixture geometry saturate the MIT hard-magnetic pellet composite at figure scale (about 1 cm magnet volume), and does a benchtop impulse unit reach it?
2. What print file format does export-to-print have to emit for a multi-material motor body a slicer can take?
3. Can a printed motor body and its magnetize step be described so Void hands a visitor an original-named part page with downloadable geometry?

## What is now known

- Fully 3D-printed electric linear motor exists. Cañada, Bigelow, Velásquez-García. Virtual and Physical Prototyping, DOI [10.1080/17452759.2026.2613185](https://doi.org/10.1080/17452759.2026.2613185). MIT News [18 Feb 2026](https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218). Five materials (dielectric, conductive, soft magnetic, hard magnetic, flexible), about three hours, material cost about 50 cents, 318 µm stroke at 41.6 Hz. The only post-print step is magnetizing the hard-magnetic regions.
- That magnetize step is not part of the extrusion platform. MIT News states the team magnetizes hard magnetic materials after printing, and the next research goal is to integrate magnetization into the print so true one-shot fabrication becomes possible ([MIT News, 2026-02-18](https://news.mit.edu/2026/3d-printing-platform-rapidly-produces-complex-electric-machines-0218)). The paper notes that post-print magnetization requires the finished part to fit between magnetizing poles, and that adjacent printed magnets cannot be given opposing polarity with precision after the fact ([Taylor & Francis full text](https://www.tandfonline.com/doi/full/10.1080/17452759.2026.2613185)).
- Soft-magnetic printed cores (nylon-12 / FeSiAl pellets in the same MIT line of work) reach relative permeability above 30 with no heat post-processing and no magnetize step, so they stay compatible with polymer multi-material builds ([Cañada, Kim, Velásquez-García, Virtual and Physical Prototyping 2024, DOI 10.1080/17452759.2024.2310046](https://doi.org/10.1080/17452759.2024.2310046)).
- Independent labs already saturate FDM bonded NdFeB after print on commercial impulse magnetizers: Słoma et al. magnetized ABS/NdFeB cylinders on a Laboratorio Elettrofisico Compact 10K6/30 at 7 T in a 40 mm coil and reached Br about 0.39 T and (BH)max about 25 kJ/m³ at 57.5 vol.% spherical Magnequench powder ([Flexible and Printed Electronics, 18 Jul 2025, DOI 10.1088/2058-8585/aded1f](https://doi.org/10.1088/2058-8585/aded1f)). Słoma’s pipeline used 7 T to saturation; industrial NdFeB impulse practice commonly targets several tesla. The exact peak field for the MIT hard-magnetic pellet feedstock at figure scale remains the next measurement.
- So the open question “can the MIT motor’s one post-step be done outside that lab printer?” has a clear yes: magnetization is a standard impulse-magnetizer operation available in magnet shops and university labs, and it is already used on consumer-printer bonded NdFeB parts. The MIT printer prints the hard-magnetic composite; a separate fixture and pulse finish the polarity.

## What changed this cycle

Earlier notes treated the magnetize step as tied to the MIT platform. Primary sources show it is a separate, portable step. The remaining gate for one-shot printing is bringing that pulse into the print head (MIT’s stated next goal), or documenting a visitor-safe handoff that names an original part, an STL, and a magnetize instruction that a shop can run.

## Next open question

What peak field and fixture opening saturate a hard-magnet volume the size of a miniature figure joint actuator (about 1 cm), using the same class of polymer-bonded NdFeB feedstock the MIT motor uses, and can that be done on a benchtop impulse unit a small team can buy or borrow?

## Concrete experiment

Print or buy a hard-magnetic composite coupon about 10 mm across and 5 mm tall (same scale Słoma used). Pulse at 3 T and at 7 T in a coil that fits the coupon. Measure remanence before and after with a gaussmeter. Repeat with a soft-magnetic FeSiAl nylon coupon to confirm it stays unmagnetized. Record fixture inner diameter and pulse energy so a Linemote-scale page can cite a real shop path.

## Who is closest

- MIT Microsystems Technology Laboratories (Cañada, Bigelow, Velásquez-García) for multi-material extrusion that already prints the motor body and for integrating magnetization into the print.
- Laboratorio Elettrofisico and MAGNET-PHYSIK for commercial impulse magnetizers already used on FDM bonded NdFeB.
- Warsaw University of Technology (Słoma et al., 2025) for an end-to-end consumer-FDM plus 7 T magnetize pipeline with measured Br and energy product.
