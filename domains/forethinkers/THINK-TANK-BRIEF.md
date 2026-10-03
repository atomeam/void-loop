# Forethinkers brief

Read this, then the files it names. Do the work. Do not invent findings.

## One system

A-to-Mind does everything. Void is the form each part becomes: summon, spin, export, print, own it. The tracks are not four topics. A cycle that picks living figures, printed machines, cures, and the planet, then stitches them, is still a silo.

Every cycle covers everything:

- every file in `domains/` that is a track (venture files and assimilate rows; skip only logs, queues, and this folder's runner notes)
- `domains/void.assimilate.md`
- `domains/void.growth.md`
- `domains/void.misses.md`
- `domains/forethinkers/convergence.md`

A new file under `domains/` is a track on the next cycle. There is no allowlist and no `ACTIVE_TRACKS` cut. If a miss or an old project fits no file, add a track file and a map row in the same cycle.

## What a cycle does

1. Read the whole set. Note which tracks a shared part or a blocked Void stage touches.
2. Advance the most promising open question that changes the shared map or unblocks a stage. One question can land in several track files. A finding that helps no other track and no product stage is a dead run: record that and stop.
3. Date every source. `established` means a dated source and a named part. `hypothesis` means the map says so and nobody has checked. Do not promote a hypothesis.
4. Edit only the track files you actually advanced, plus `convergence.md`. Append a `[think-tank]` line on `domains/void.growth.md` when a result can become a Void feature.
5. Stay silent. Post the webhook only for a real breakthrough, and include the source link.

## Names you do not sell

Inside Void, a reference is fine. A physical print that is sold needs an original name and an original design.

- The Indian in the Cupboard: title and characters are Lynne Reid Banks. The book is widely criticized for how it portrays Native people. A toy that comes alive is the idea. The character is not yours.
- Persuadatron: name and design come from Syndicate Wars (Bullfrog). Same rule. Do not print or sell that name or that design.

Toys R Us, or any brand acquisition, is a research line on the growth board, not a plan.

## Cost

One cycle sees every track. It does not spawn one model call per track. Cap web searches. Watch the first day before leaving it unattended.

## How the runner holds this (`tools/forethinkers.py`)

- Tracks are discovered: every file in `domains/` except logs, queues and the QA sheet; every numbered row of
  `void.assimilate.md`; every track file in `domains/forethinkers/tracks/` (printed machines, living figures, life
  extension, restoring the planet, influence science, and any added when a miss or old project fits no file).
- A domain's "Shared parts: … uses:" line is a declared link. `sync` puts it on `convergence.md`; `check` fails in CI
  while one is missing.
- One call per cycle sees every track and the whole map, with web searches capped (`MAX_SEARCHES`, default 5).
- What the call proposes is checked in code before anything is written. A source counts only if that call's own search
  returned the URL, with the page date; otherwise the row lands as hypothesis with no source. A change that helps no
  other track and no stage is dropped. Only established findings that reach a Void stage go on the growth board.
- No key, no model call: the job lists the tracks and stops. A cycle that changes nothing writes nothing; one that
  changes the map opens a PR. The webhook (`NOTIFY_WEBHOOK`) stays off until `FORETHINKERS_WEBHOOK_ON=on`.

## Gadgets, defences, physical sales

- Our 3D miniatures live in the Void first. Gadgets like the persuadatron act on simulated figures there, never on the
  person at the screen. Safe 3D items move into the real world later, for physical sales, always with an original name
  and design.
- The science behind every gadget is researched (influence-science track). Where the system finds an effect real, with
  dated sources, the work is defences for the person at the screen (persuasion-defence, next to `void.defences.md`).
- Future tech (holodecks, replicators) is simulated first; nothing leaves simulation without established nodes, dated
  sources and a person's review.
