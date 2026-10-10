# Third-party sources and their licenses

Data and methods Void uses that come from someone else, with the terms they come under. Add a row when a change brings
in a new source.

| Used in | Source | What we took | Terms |
|---|---|---|---|
| `void-live-deploy/lib/sky-math.js` | Jean Meeus, *Astronomical Algorithms*, 2nd ed. (Willmann-Bell, 1998), chapters 12, 13, 21, 22, 25, 47, 48 | The formulas (sidereal time, coordinate transforms, precession, obliquity, the sun, the moon's main periodic terms, the moon's phase), written as our own code; the book's worked examples are the fixed inputs and expected answers in `tools/sky-math.test.mjs` | Mathematical methods and published numeric results are facts, not copyrighted expression; no text or code is copied. The book is cited. |
| `void-live-deploy/lib/sky-math.js` | E. M. Standish, "Keplerian Elements for Approximate Positions of the Major Planets", JPL Solar System Dynamics (ssd.jpl.nasa.gov), table 1, 1800–2050 | The orbital elements and their rates for the planets and the Earth–Moon barycentre | A work of the US Government (NASA/JPL), public domain in the United States; credited as requested. |
| `void-live-deploy/lib/sky-math.js` | D. Hoffleit and W. H. Warren Jr., *The Bright Star Catalogue*, 5th revised ed. (1991), NASA Astronomical Data Center / CDS catalogue V/50 | J2000 positions and visual magnitudes of the 22 brightest stars | Distributed by NASA ADC and CDS for free use; catalogue facts. Credited. |
