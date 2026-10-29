# Forethinkers think tank

Forethinkers means building for what is about to be possible, not just for today. Each cycle picks one open question, takes it one dated step further with primary sources, and logs progress so later runs start where this one stopped.

## Tracks

| Track | File | Role |
| --- | --- | --- |
| Living action figures | `tracks/living-figures.md` | Tiny actuators, joints, power, on-board mind, sensing, personality, safety. Good-guy target: built to help and play. Last advanced 2026-10-21 14:07 (motor in the base with a printed linkage and a stall current limit); earlier 2026-10-15 02:12 (1,024-token toy mind with a cached memory prefix; Babaru offline claim corrected; price anchors). |
| One-shot printing of working machines | `tracks/printing-working-machines.md` | Multi-material print, embedded electronics, print-in-place mechanisms, printed motors and batteries, design-to-print. Last advanced 2026-10-21 14:07 (smallest arm-waving printed motor sized from the full text; battery-toy heat rule corrected to ASTM F963 section 4.25). |
| Life extension and disease cures | `tracks/life-extension.md` | Newest credible results, open problems, where a small team or AI can contribute. Last advanced 2026-10-21 20:13 (GSE327270 holds 2 of 84 participants, so MaGE waits; Source Data split: GrimAge-only gradient, semaglutide gains most in the fastest-ageing third); earlier 2026-10-14 14:13 (one burden-enriched senolytic trial registered; MaGE). |
| Planet restoration | `tracks/planet-restoration.md` | Air, water, soil, oceans, biodiversity, energy. Last advanced 2026-10-28 14:15 (CBASS heat assay bounded by three field checks: strong sorter in moderate heat, weaker in severe heat; heat table refreshed to 27 Oct 2026); earlier 2026-10-14 20:14 (NOAA heat-dose table; Dry Tortugas 2026 ≈ 2023 kill dose). |
| Verse stage handoff | `tracks/void-stage.md` | What Verse shows or exports from a figure once the stage life is real. Export-to-print unblocked 2026-10-07. |

## How a cycle works

Read `convergence.md` and every track file listed above. Pick the node or open question closest to a real answer, or the track least recently advanced. Fan research only into the tracks that node names. Write a Progress ledger line at the top of each touched file. A finding Verse can show becomes a `[think-tank]` line on `domains/void.growth.md`.

Supporting briefs already on main: `THINK-TANK-BRIEF.md`, `figures-first.md`, `toy-problems.md`, `run-log.md`, and the runner in `think-tank.mjs`.

## This automation

Even-hour Forethinkers job on the Linux box, so it runs whether the laptop is on or off. Worktree: `/workspace/void-wt-forethinkers` on a fresh `forethinkers/cycle-<date>-<time>` branch from `origin/main`; the main clone `/workspace/void-loop` stays on main for other jobs. Setup notes: `/workspace/void-loop-box-setup.md`.
