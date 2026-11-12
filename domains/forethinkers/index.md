# Forethinkers think tank

Forethinkers means building for what is about to be possible, not just for today. Each cycle picks one open question, takes it one dated step further with primary sources, and logs progress so later runs start where this one stopped.

## Tracks

| Track | File | Role |
| --- | --- | --- |
| Living action figures | `tracks/living-figures.md` | Tiny actuators, joints, power, on-board mind, sensing, personality, safety. Good-guy target: built to help and play. Last advanced 2026-11-09 08:12 (1 GB AX630C boards ship and the speech models fit 1 GB; the stock 0.5B mind is rated 4 GB, so the next step measures a slimmed mind beside them in 512 MiB); earlier 2026-11-04 14:15 (price gap located: cloud-toy shell under $11, the mind's 4 GB of DRAM near $100 at late-2026 contract prices, so the next step fits the voice stack in 1 GB); earlier 2026-10-21 14:07 (motor in the base with a printed linkage and a stall current limit); earlier 2026-10-15 02:12 (1,024-token toy mind with a cached memory prefix; Babaru offline claim corrected; price anchors). |
| One-shot printing of working machines | `tracks/printing-working-machines.md` | Multi-material print, embedded electronics, print-in-place mechanisms, printed motors and batteries, design-to-print. Last advanced 2026-11-11 14:16 (the arm's slip clutch sized as a two-lobe PETG detent ring at about 0.9% strain, the design UBTECH already ships in robot servos; next is measured drift over 1,000 slips); earlier 2026-11-04 20:11 (a 15 mm printed motor behind a printed 48:1 planetary closes the arm on torque and heat; the 4 in-lbf toy torque test makes a slip clutch the next part). |
| Life extension and disease cures | `tracks/life-extension.md` | Newest credible results, open problems, where a small team or AI can contribute. Last advanced 2026-11-11 20:14 (Q6 strengthened: COSMOS, 958 people, placebo-controlled, shows the same PCGrimAge baseline-acceleration interaction for a multivitamin, P = 0.018; TranslAGE across 51 studies shows disease populations respond more; next is the pooled interaction on TranslAGE's public randomized data); earlier 2026-11-05 02:09 (Q6: GrimAge gradient survives inflammation adjustment and LOO, fails bootstrap/half-split; SLIM LIVER shows no group-mean PCGrimAge slowing; MaGE weights and GSE327270 still blocked; NCT07218445 added); earlier 2026-10-21 20:13; earlier 2026-10-14 14:13. |
| Planet restoration | `tracks/planet-restoration.md` | Air, water, soil, oceans, biodiversity, energy. Last advanced 2026-11-09 02:11 (2026 measured at 81 to 97% of each reef's 2023 dose across six NOAA stations; at Eastern Dry Rocks 97% killed nearly all new elkhorn outplants, the baseline for the Flonduran split; Shedd and CRF high- vs average-tolerance staghorn plots at Dry Tortugas found as the live test of question 6); earlier 2026-10-28 14:15 (CBASS heat assay bounded by three field checks: strong sorter in moderate heat, weaker in severe heat; heat table refreshed to 27 Oct 2026); earlier 2026-10-14 20:14 (NOAA heat-dose table; Dry Tortugas 2026 ≈ 2023 kill dose). |
| Verse stage handoff | `tracks/void-stage.md` | What Verse shows or exports from a figure once the stage life is real. Export-to-print unblocked 2026-10-07. |

## How a cycle works

Read `convergence.md` and every track file listed above. Pick the node or open question closest to a real answer, or the track least recently advanced. Fan research only into the tracks that node names. Write a Progress ledger line at the top of each touched file. A finding Verse can show becomes a `[think-tank]` line on `domains/void.growth.md`.

Supporting briefs already on main: `THINK-TANK-BRIEF.md`, `figures-first.md`, `toy-problems.md`, `run-log.md`, and the runner in `think-tank.mjs`.

## This automation

Even-hour Forethinkers job on the Linux box, so it runs whether the laptop is on or off. Worktree: `/workspace/void-wt-forethinkers` on a fresh `forethinkers/cycle-<date>-<time>` branch from `origin/main`; the main clone `/workspace/void-loop` stays on main for other jobs. Setup notes: `/workspace/void-loop-box-setup.md`.

## 2026-11-11 14:16 ET cycle: printing, open question 8

Picked printing (least recently advanced, 2026-11-04 20:11). Found the elastic two-lobe detent clutch already shipping in UBTECH robot servos (US 10,823,233 B2) and classroom clutch servos (DFRobot), and EPFL's printed overload couplings that slip within 10 to 20% of a tooth-angle model. Sized the arm's ring (two 6 mm PETG lobes about 0.75 mm thick, 30 degree ramps, about 0.9% strain) and set the material rule from printed fatigue data: PETG over PLA, lobes unloaded at rest because nylon creeps. Next is open question 9, measured slip drift over 1,000 slips. Added a growth-board row (clutch sizer card). The two earlier forethinkers branches were already merged (#2557, #2570) and are gone; no open think-tank PRs to fold in.

[think-tank] Summon the clutch sizer: pick a slip torque and a material, see the lobe thickness and whether it lasts 1,000 slips.

## 2026-11-11 20:14 ET cycle: life extension, open question 6

Picked life extension (least recently advanced, 2026-11-05 02:09). Re-checked every blocker (MaGE weights, GSE327270, seven registry rows): unchanged. Found the independent evidence the question needed: COSMOS (Nature Medicine, 9 Mar 2026) shows the PCGrimAge effect of a daily multivitamin concentrated in people who started epigenetically older (interaction P = 0.018, 958 people, placebo-controlled), and TranslAGE (Nature Medicine, 21 Aug 2026) shows clock responses grow with how unhealthy the population is. Corrected a likely assumption: TranslAGE's controlled-access Corley dataset is a small metformin study, not the semaglutide trial. New open question 8, the pooled interaction on TranslAGE's public randomized data, is runnable now. Added a growth-board row (clock response card). The earlier forethinkers branches (#2557, #2570, #2704) were already merged; no open think-tank PRs to fold in.

[think-tank] Summon the clock response card: which aging clocks moved in randomized trials, and who moved most.
