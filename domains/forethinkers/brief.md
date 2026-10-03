# The Forethinkers — one brief for every worker

A-to-Mind does everything (STANDING.md). The Forethinkers are its research: everything that comes through is researched,
always, and nothing is capped. Four topics was never the system. It was a cut.

## Tracks are everything in the repo

`python tools/forethinkers.py tracks` lists them, read fresh every cycle:

- every venture domain file (`domains/*.md` with a **Title:** line): Handoff Studio, Aquifer Yield, Grid Salvage,
  Embodied error, Model Fight League, RelicWeaver and the rest. The older files are not dropped: Void is the form they
  become.
- every row of `domains/void.assimilate.md`, from AutoSalvage and the edit engine to the work-finder, intent-canvas and
  your own Void;
- every open miss on the board (`domains/void.misses.md`; asks already grown or answered, and probes, are left out);
- the Forethinkers' own track files in `domains/forethinkers/tracks/`: printed machines, living figures, life
  extension and cures, restoring the planet, influence science, and every track added later.

New tracks get a file when a miss or an old project does not fit an existing one.

## The unit is a shared part or a Void stage

The four first tracks and Void are one system, and so is everything else. Printed machines are the body. Living figures
are why a person wants that body, and the thing they can buy: a toy that comes alive. The same parts move an assistive
device or a field robot. The ventures share their own parts (one intake, the gatekeeper packet, the consent record, the
partner bench, the back office). Void is the path that makes any of it ownable: **summon, spin, export, print, own**.

So a cycle never starts from a question on a track. It starts from `convergence.md`, and every cycle works **every** row:

1. Each part and each blocked stage goes to every track it touches. Each of those tracks' workers asks one thing: what
   does this part or stage mean through my track, with a dated source? Tracks a row does not touch stay quiet on it.
2. One convergence pass per row keeps **only** what changed the map (a node established, a new part, a new edge) or
   unblocked a stage.
3. Every track that touches no row yet is worked too, until it joins the map: it touches a part or stage, adds a part it
   shares with another track, fits an existing track (a miss or an old project), or gets its own track file.

A finding that helps no other track and no product stage is a **dead run**, even if the source is real.

A domain file's "Shared parts: … uses:" line is a declared link. `sync` puts it on the map and `check` fails while one is
missing, so the map can't drift from what the ventures say they use.

## Labels mean something

- **established**: a dated source (URL + the date on the page) and a named part. The source must be one the worker's own
  search returned in that cycle; a URL from memory is not a source.
- **hypothesis**: the map says so and nobody has checked. A hypothesis row carries no source.

`python tools/forethinkers.py check` holds every row and finding to this in CI. The only established node so far is the
MIT printed linear motor (news.mit.edu, 2026-02-18). Everything else stays hypothesis until a worker dates a source.

## Characters, gadgets and what gets sold

- The idea of a toy that comes alive is ours to build. The title and the portrayal of *The Indian in the Cupboard* are
  not ours to sell, so every character is original.
- Our 3D miniatures live in the Void first: summoned, spun and played with (holodeck worlds, Model Fight League arenas,
  gadgets like the Syndicate Wars persuadatron that the miniatures carry and use). In the Void a gadget acts on simulated
  figures only, never on the person at the screen.
- The safe 3D items move into the real world later, for physical sales: export, print, own. Anything sold carries an
  original name and design. The Syndicate Wars persuadatron, like any studio's character or gadget, is a reference, not
  ours to sell.
- Toys R Us stays a research line (what a toy shop for living figures would look like), not a plan.

## The science behind it, and defences

Every gadget and future tech gets its real science researched (the influence-science track for the persuadetron). Where
the system finds an effect real, with dated sources, the work is on defences: protecting the person at the screen from
real manipulation (the persuasion-defence part, next to `domains/void.defences.md`). Research builds shields, not the
weapon.

## Safety

Future tech that Void is asked for (holodecks, replicators, anything named) is summoned in a sandboxed simulation first,
with limits on energy, matter and environmental impact, and on human safety, consent and reversibility. Nothing leaves
simulation for the real world without established nodes, verified sources and a person's review.

## Running it

- **Every cycle works everything.** `python tools/forethinkers.py plan` prints the exact count. On 2026-10-03 that is
  32 rows plus 32 unjoined tracks: up to 211 model calls a cycle, each worker with up to `MAX_SEARCHES` (3) web
  searches. The number grows with the map, and drops as unjoined tracks find their place.
- The schedule fires at :03 every hour; the gate keeps even ET hours (02:03 ET runs on both sides of the 2026-11-01
  DST change; odd hours skip): 12 cycles a day. It runs once `ANTHROPIC_API_KEY` is set; adding the key is the yes on
  the spend. `FORETHINKERS_SCHEDULE=off` (repo variable) is the off switch. `ACTIVE_TRACKS` and `UNIT` exist for a
  manual run that wants one slice; the default is all.
- Model: repo variable `MODEL` (default claude-opus-5-5), effort medium.
- Silence is the default. A cycle that changed nothing writes nothing. A cycle that changed the map opens a PR with the
  rows, findings, placements and new track files, plus one `[think-tank]` line on `domains/void.growth.md` for each
  established (sourced) finding that reaches a Void stage.
- The webhook (secret `NOTIFY_WEBHOOK`) stays off (`FORETHINKERS_WEBHOOK_ON` unset) until a run has written a real
  finding with a source; after that it carries breakthrough notes only.

## Files

- `domains/forethinkers/convergence.md` — the map (parts, stages, edges). The source of truth.
- `domains/forethinkers/findings.json` — kept findings, where each miss or old project was placed, and the runs that
  changed something. Dead runs write nothing; each run's counts show in its Actions job summary.
- `domains/forethinkers/tracks/` — track files (the first four, influence science, and every new one).
- `tools/forethinkers.py` — `check`, `sync`, `tracks`, `plan`, `gate`, `cycle`, `selftest`.
- `.github/workflows/forethinkers.yml` — the cycle.
