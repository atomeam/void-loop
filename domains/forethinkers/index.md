# Forethinkers think tank

Forethinkers means building for what is about to be possible, not just for today. Each cycle picks one open question, takes it one dated step further with primary sources, and logs progress so later runs start where this one stopped.

## Tracks

| Track | File | Role |
| --- | --- | --- |
| Living action figures | `tracks/living-figures.md` | Tiny actuators, joints, power, on-board mind, sensing, personality, safety. Good-guy target: built to help and play. Last advanced 2026-10-07 (offline mind module). |
| One-shot printing of working machines | `tracks/printing-working-machines.md` | Multi-material print, embedded electronics, print-in-place mechanisms, printed motors and batteries, design-to-print. Last advanced 2026-10-07 (five-slot 3MF layout, slicer-tested). |
| Life extension and disease cures | `tracks/life-extension.md` | Newest credible results, open problems, where a small team or AI can contribute. |
| Planet restoration | `tracks/planet-restoration.md` | Air, water, soil, oceans, biodiversity, energy. |
| Void stage handoff | `tracks/void-stage.md` | What Void shows or exports from a figure once the stage life is real. Export-to-print unblocked 2026-10-07. |

## How a cycle works

Read `convergence.md` and every track file listed above. Pick the node or open question closest to a real answer, or the track least recently advanced. Fan research only into the tracks that node names. Write a Progress ledger line at the top of each touched file. A finding Void can show becomes a `[think-tank]` line on `domains/void.growth.md`.

Supporting briefs already on main: `THINK-TANK-BRIEF.md`, `figures-first.md`, `toy-problems.md`, `run-log.md`, and the runner in `think-tank.mjs`.

## This automation

Even-hour Forethinkers job on the Linux box, so it runs whether the laptop is on or off. Worktree: `/workspace/void-wt-forethinkers` on a fresh `forethinkers/cycle-<date>-<time>` branch from `origin/main`; the main clone `/workspace/void-loop` stays on main for other jobs. Setup notes: `/workspace/void-loop-box-setup.md`.
