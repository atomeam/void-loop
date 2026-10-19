# Grow self: Verse works out what it lacks and fixes it

**Starts when:** every day at 1:41 PM New York time (`.github/workflows/grow-self.yml`), or by hand: `gh workflow run grow-self.yml` (`dry` plans, probes and reports but opens nothing).

**Why it exists:** `propose-fix.yml` and `build-miss.yml` only start from asks a visitor missed. With no misses they run, find nothing and stop; on 2026-10-19 neither had ever opened a pull request. This lane thinks the work up from Verse's own files, with no model and no network.

1. **Think it up** (`node tools/lacks.mjs`): every skill is scored for how little is proven about it (no benchmark ask: 100; fewer than three: 30; evidence tier experiment 40, checked 25, tested 10; 5 per failed run that names it). The ranking and the reasons are printed, so "why this one" is never a guess. Cards are ranked the same way (a thin description, under three examples, an old brand name) and listed for a builder to refine.
2. **Candidates** (`lacks.mjs plan`): up to three of each top skill's own example asks that the benchmark does not have, plain words only (no links, addresses or long tokens).
3. **The real page decides** (`node tools/bench.mjs --probe`): each candidate is typed in with outside services blocked. A probe that printed no result line is a broken run and opens nothing.
4. **Settle** (`lacks.mjs settle`): asks that routed to the skill that claims them become benchmark rows (`tools/append.mjs`); the rest go in the report and in `failed.json`.
5. **Pull request** (write token, only moves bytes): the patch may touch `tools/bench.json` and the agent log and nothing else; labelled `made by Verse`, `verse hardens`, `automerge`; Verse's review is the gate, `verify.yml` takes it back if main's suite goes red. At most one is open at a time, so a failing one is never followed by ten more.
6. **Gaps** (owner token only): `lacks.mjs queue` turns the asks that did not route into `probe:` jobs (at most two open, the daily probe's limit), which `propose-fix.yml` picks up.

**How to tell it worked:** the run summary has the ranking table, the rows added and the asks left out; the PR body repeats them.

**What it will not do:** write code, edit a skill, or add an ask the page did not answer with the right skill. Rewriting a card's words or fixing a routing gap is the propose-fix and builder lanes' job; this lane finds them and keeps the list current.

**Keeping cards current:** `node tools/refresh.mjs` regenerates every generated card in order (skill index, dependency map, families, the book, Verse's facts about itself, bench alarms). `deploy.yml` runs it before every deploy, so the live self card and book follow every build; `checks.mjs` fails a PR whose committed copies are stale.
