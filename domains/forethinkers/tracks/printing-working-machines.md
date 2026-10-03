# Printing working machines

## Progress ledger

- 2026-10-03 06:12 ET - Answered: MIT hard-magnet pellet is nylon-12 / strontium ferrite (69 vol%), magnetized post-print at 1.5 T; bonded Neo needs 3-4 T throughout. Benchtop Mag-Instruments Pulse Magnetizer reaches 4 T at dia 1.25 cm sample OD (figure scale), so yes for MIT feedstock with margin and yes for bonded Neo at ~1 cm OD. Next: multi-material print file format for slicer export.
- 2026-10-03 04:04 ET - Answered: the magnetize post-step is independent of the MIT printer. Bonded NdFeB prints are saturated on a separate impulse magnetizer (about 3-7 T). Soft-magnetic cores need no magnetize step. Next: name the peak field and fixture size for a figure-scale hard-magnet volume.
- 2026-10-03 seed - Established MIT fully 3D-printed linear motor (five materials, one magnetize post-step).

## Open questions, ranked

1. What print file format does export-to-print have to emit for a multi-material motor body a slicer can take?
2. Can a printed motor body and its magnetize step be described so Void hands a visitor an original-named part page with downloadable geometry?
3. (answered 2026-10-03 06:12 ET) What peak field and fixture geometry saturate the MIT hard-magnetic pellet composite at figure scale, and does a benchtop impulse unit reach it?

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

## What changed this cycle

Earlier notes treated the MIT hard-magnet pellet as the same class as polymer-bonded NdFeB. Primary sources show MIT used **strontium ferrite** magnetized at **1.5 T**. The figure-scale peak-field question now has named numbers: 1.5 T for the MIT feedstock, 3-4 T for a bonded-Neo upgrade, and a named benchtop unit that delivers 4 T inside a 1.25 cm sample OD. Fixture geometry for figure scale is a custom coil sized to the sample OD (Mag-Instruments ships holders; Magnequench designs keep conductors at the magnet surface).

## Next open question

What print file format does export-to-print have to emit so a multi-material motor body (dielectric + conductive + soft magnetic + hard magnetic + flexible) loads in a normal slicer, with a named magnetize post-step citing the peak-field numbers above?

## Concrete experiment

Print or buy a nylon-12 / Sr-ferrite coupon about 10 mm across and 5 mm tall. Pulse at 1.5 T and at 3 T in a coil with sample OD <= 1.25 cm (Mag-Instruments PM class or equivalent). Measure remanence before and after with a gaussmeter; confirm the 1.5 T step matches MIT's published Br band. Optionally repeat with a bonded-Neo coupon and step 3 T -> 4 T -> 7 T to map the Magnequench saturation curve at figure scale. Record fixture inner diameter and pulse energy for the handoff page.

## Who is closest

- MIT Microsystems Technology Laboratories (Canada, Bigelow, Velasquez-Garcia) for the multi-material motor body and for integrating magnetization into the print head (in-situ Sr-ferrite work already in the same group).
- Mag-Instruments (Munich) for a named benchtop impulse unit with published Tesla-at-sample-OD numbers at figure scale.
- Magnequench for bonded-Neo saturation field (3-4 T) and fixture design practice.
- Laboratorio Elettrofisico and MAGNET-PHYSIK for higher-energy impulse magnetizers already used on FDM bonded NdFeB (Sloma et al., 2025).
- Warsaw University of Technology (Sloma et al., 2025) for an end-to-end consumer-FDM plus 7 T magnetize pipeline with measured Br and energy product.
