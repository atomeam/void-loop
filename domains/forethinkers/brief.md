# The Forethinkers — one brief for every worker

The Forethinkers is not four research topics. It is one system: the hardware and the reasons behind Atomind, and Void is how
any of it becomes something a person can own.

- **Printed machines** are the body: actuators, joints, sensors, materials.
- **Living figures** are why a person wants that body, and the thing they can buy. The idea is a toy that comes alive.
  The character is always original: the title and the portrayal of any book or film (*The Indian in the Cupboard* included)
  are not ours to sell.
- **Life extension** uses the same parts for people: assistive and prosthetic motion.
- **Planet restoration** uses the same parts for Earth: field robots.
- **Void** is the path that makes any of those ownable: **summon, spin, export, print**.

Toys R Us stays a research line (what a toy shop for living figures would look like), not a plan.

## The unit of a cycle is a shared part or a Void stage

A cycle does not start from a question on a track. It starts from `convergence.md`:

1. Pick **one** part or **one blocked stage** (a printed actuator; export-to-print).
2. Fan it into every track it touches. Each track's worker asks one thing: what does this part or stage mean through my
   track, with a dated source?
3. The convergence pass keeps **only** what changed the map (a node established, a new part, a new edge) or unblocked a
   stage. Everything else is dropped.

A finding that helps no other track and no product stage is a **dead run**, even if the source is real.

## Labels mean something

- **established**: a dated source (URL + the date on the page) and a named part. The source must be one the worker's own
  search actually returned in that cycle; a URL from memory is not a source.
- **hypothesis**: the map says so and nobody has checked. A hypothesis row carries no source.

`python tools/forethinkers.py check` holds every row and finding to this in CI. The only established node so far is the
MIT printed linear motor (news.mit.edu, 2026-02-18). Everything else on the seed map stays hypothesis until a worker
dates a source.

## Running it

- One manual Actions run (`Forethinkers cycle`, workflow_dispatch) first: `active_tracks: printing`, `max_searches` capped
  (default 3). That is one printing worker plus the convergence pass: 2 model calls.
- Full fan-out is up to 4 workers + 1 convergence = 5 calls a cycle; on every even ET hour that is about 60 a day. That
  number is watched, not left on: the schedule only fires when the repo variable `FORETHINKERS_SCHEDULE` is `on`.
- The schedule fires at :03 every hour and the gate keeps even ET hours only (02:03 ET runs on both sides of the
  2026-11-01 DST change; odd hours skip).
- Silence is the default. A cycle that changed nothing writes nothing. A cycle that changed the map opens a PR with the
  rows and findings. The webhook stays off (`FORETHINKERS_WEBHOOK_ON` unset) until a run has written a real finding
  with a source; after that it carries breakthrough notes only.

## Files

- `domains/forethinkers/convergence.md` — the map (parts, stages, edges). The source of truth.
- `domains/forethinkers/findings.json` — every kept finding and every run (dead runs included, so the cost is visible).
- `tools/forethinkers.py` — `check`, `gate`, `plan`, `cycle`, `selftest`.
- `.github/workflows/forethinkers.yml` — the cycle.
