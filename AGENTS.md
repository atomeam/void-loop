# AGENTS.md — a-to-mind-loop

This is the live Void (a-to-mind.com) and the private company Loop.

Read `STANDING.md` first: it explains what we are building and where things are.

Then read `domains\void.growth.md` (what's next) and the last lines of `domains\void.agents.log.md` (what just happened).

## Working fast (learned 2026-10-04)

- `node tools/checks.mjs` runs every fast check in one go (fringe ledger, skill collisions, calendar, glyphs, the full benchmark against its floor, the miss reader's redaction). Run it before every push; CI runs the full browser suite.
- `node tools/bench.mjs --probe candidates.json` tries a batch of new asks (same shape as tools/bench.json) and prints only the misses. Probe 30–40 at once, fix the misses, then add the batch with `tools/append.mjs bench --skip`.
- Never wait on CI. Push, then run `node tools/merge-when-green.mjs <pr>` in the background; it merges when test-and-deploy (and the parallel bench job) pass on the PR's current head, and stops with the failing run's link otherwise.
- A new push to a PR cancels the older run of that PR (deploy.yml "Supersede older runs"); on a PR the benchmark runs as its own job, in parallel with the suite.
- `node tools/merge-main.mjs` merges origin/main and settles the append-only files (bench.json, grown.json, the agent log) by keeping both sides.
- `node tools/misses.mjs` reads the real miss board (owner-only /api/misses, needs VOID_MISSES_TOKEN). It only prints: this repo is public, so raw asks never get committed.
- `node tools/fringe.mjs --record <draft> <sources.json>` adds a fringe run in the ledger's own style.
- Don't run the browser suite and the benchmark at the same time on one machine: the benchmark reads answers on a timer and misses them when the CPU is shared.
