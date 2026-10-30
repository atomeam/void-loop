# Florida coral heat-dose tracker

Answers planet-restoration open question 5 (heat-dose half): pull NOAA Coral Reef Watch degree heating weeks for the Flonduran trial sites and line them up against published survival checkpoints.

## Method

- Product: NOAA CRW 5 km single-pixel virtual stations (experimental collaborator files), index [florida_keys.php](https://coralreefwatch.noaa.gov/product/vs_single_pixel_exp/florida_keys.php).
- Stations: Key Biscayne Cluster (July 2025 Flonduran outplant), Dry Tortugas Nursery (April 2026 side-by-side trial), Carysfort Reef and Looe Key Reef (Mission: Iconic Reefs reference sites from the 2023 die-off).
- Season window: 1 May to 30 November each year.
- Metrics: peak DHW and its date, max SST, days with SST ≥ 31 °C, days with DHW ≥ 4 and ≥ 8 (CRW's significant-bleaching and severe-mortality thresholds), max BAA.
- Rebuild: `node domains/forethinkers/experiments/heat-dose.mjs` (needs network). Output: `florida-heat-dose-2023-2026.csv`.

## Reading the table (cycle 2026-10-14)

CRW's own rule of thumb: DHW ≥ 4 means significant bleaching is likely; DHW ≥ 8 means severe bleaching and significant mortality are likely. The 2023 Keys kill that erased Acropora (Manzello et al., Science 2025) sat well above 8 at every Keys site in this table.

| Site | 2023 peak DHW | 2025 peak DHW | 2026 peak DHW (through 13 Oct) |
| --- | ---: | ---: | ---: |
| Key Biscayne Cluster | 11.85 | **7.07** | 10.45 |
| Dry Tortugas Nursery | 14.35 | 6.57 | **13.70** |
| Carysfort Reef | 16.21 | 8.41 | 14.86 |
| Looe Key Reef | 17.97 | 8.72 | 16.50 |

So the Flondurans' first Miami summer (2025) never crossed the severe-mortality DHW line, and Andrew Baker said on record it "wasn't really a hard test" ([WLRN, 8 Jul 2026](https://www.wlrn.org/environment/2026-07-08/coral-bleaching-heat-florida)). Their first Dry Tortugas bleaching summer (2026) peaked at 13.70 DHW — within about 0.65 of that site's 2023 kill dose — so the coming six-month check is against a real heatwave, not a mild one.

## Refresh 2026-10-28 14:15 ET

Re-ran `heat-dose.mjs` against NOAA Coral Reef Watch files through 27 Oct 2026. `peak_date` is the last day the season sits at its peak DHW (the script keeps a later day on a tie), so refreshed NOAA files moved some earlier peak dates later while peak values stayed the same. Dry Tortugas 2026: peak 13.70, 59 days at DHW 8 or more, DHW 11.47 and alert level 0 on 27 Oct.
