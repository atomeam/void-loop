# Verse's loop against the best self-improving agent loops

Written 2026-10-21. Each row names a part a published loop relies on, the source, and what Verse has for it today
(have / partial / missing), with the file that does it. "Verse" here is the loop in this repo: `grow-self.yml` + `tools/lacks.mjs`
(think up what it lacks), `tools/bench.mjs --probe` (the real page decides), `tools/grow-gate.mjs` (one preview in flight, closed
only when it answers live), `tools/reflect.mjs` (Verse's own asks), `tools/grow-lessons.*` (skills whose asks keep missing),
`tools/revert-target.mjs` + `revert-records.mjs` (auto-revert on a red suite), `void-live-deploy/void.growth.json` (the ledger).

## Sources

| Loop | Source |
|---|---|
| Voyager | Wang et al. 2023, *Voyager: An Open-Ended Embodied Agent with LLMs*, https://arxiv.org/abs/2305.16291 |
| Reflexion | Shinn et al. 2023, *Reflexion: Language Agents with Verbal Reinforcement Learning*, https://arxiv.org/abs/2303.11366 |
| Self-Refine | Madaan et al. 2023, *Self-Refine: Iterative Refinement with Self-Feedback*, https://arxiv.org/abs/2303.17651 |
| Generative Agents | Park et al. 2023, *Generative Agents: Interactive Simulacra of Human Behavior*, https://arxiv.org/abs/2304.03442 |
| STOP | Zelikman et al. 2023, *Self-Taught Optimizer*, https://arxiv.org/abs/2310.02304 |
| ADAS | Hu et al. 2024, *Automated Design of Agentic Systems*, https://arxiv.org/abs/2408.08435 |
| Darwin Gödel Machine | Zhang et al. 2025, https://arxiv.org/abs/2505.22954 |
| AlphaEvolve | Google DeepMind 2025, https://deepmind.google/discover/blog/alphaevolve-a-gemini-powered-coding-agent-for-designing-advanced-algorithms/ |
| SWE-agent | Yang et al. 2024, https://arxiv.org/abs/2405.15793 |
| OpenHands | Wang et al. 2024, https://arxiv.org/abs/2407.16741 |
| DSPy / MIPRO | Khattab et al. 2023, https://arxiv.org/abs/2310.03714 ; Opsahl-Ong et al. 2024, https://arxiv.org/abs/2406.11695 |
| Canary + rollback | Google SRE Workbook, *Canarying Releases*, https://sre.google/workbook/canarying-releases/ |
| Bandit picking | Sutton & Barto, *Reinforcement Learning: An Introduction* ch. 2 (multi-armed bandits), http://incompleteideas.net/book/the-book-2nd.html |

## Parts vs Verse

| Part | From | Verse | Where / what is missing |
|---|---|---|---|
| Automatic curriculum (next task from what is weakest) | Voyager | have | `tools/lacks.mjs` ranks skills by how little is proven |
| Skill library, retrieved by similarity before a new task | Voyager | **built here** | `tools/loop-library.mjs`: past builds retrieved for a want (was missing: the ledger was written, never read back) |
| Environment feedback + self-verification before keeping a skill | Voyager | have | `bench.mjs --probe` in the real page; only routed asks become rows |
| Verbal reflection memory of failures, read on the next try | Reflexion | **built** | `grow-lessons.json` keeps wins, misses and why each miss happened (what answered instead); `lacks.mjs` reads it |
| Evaluator step on each output | Reflexion, Self-Refine | **built here** | `tools/loop-critic.mjs` + `loop-critic.yml` critique visitor-facing lines before merge (fails the PR on a finding) |
| Iterative refine until the critic is quiet | Self-Refine | **built** | `tools/loop-refine.mjs` rewrites by rule (ellipsis to full stop, counts to listed phrases), re-critiques, max 3 passes; grow-self runs it |
| Memory retrieval by recency + importance + relevance | Generative Agents | **built here** | scoring in `tools/loop-library.mjs` (0.995^hours decay, importance from kind/try/revert, word overlap) |
| Periodic reflection that writes higher-level insights | Generative Agents | have | `reflect.mjs --daily`; `#1207` drops asks already built |
| Archive of variants, keep stepping stones, select by benchmark | DGM, AlphaEvolve | **built** | `grow-lessons.json` `variants`: every missed candidate kept with what answered; `retryable()` returns them once the skill's chance rises |
| Population / evolutionary search over many candidates | AlphaEvolve, ADAS | missing | one candidate per cycle by design (owner rule: close out before next preview) |
| Improver that improves the improver | STOP, DGM | partial | grow-self can only add benchmark rows, never edit its own code (deliberate safety limit) |
| Meta search over agent designs | ADAS | missing | out of scope while the loop is model-free in CI |
| Agent-computer interface: lint/test on every edit | SWE-agent, OpenHands | have | `tools/checks.mjs`, verify.yml browser suite |
| Sandboxed execution | OpenHands | have | build job has no token and no network; write job only moves allowlisted files |
| Parity inventory of every site before calling it beaten | owner 2026-10-28 | **built** | `tools/parity.mjs` + `tools/parity-catalog.mjs` write `docs/PARITY/<slug>.md`; `tools/site-history.mjs` writes cited `docs/HISTORY/<slug>.md`; `lib/obituary.js` keeps "beaten" for 0 gaps and 9 of 9 |
| Study the leader before building a parity feature | STRATEGY.md, REA | **built** | `tools/loop-study.mjs` files a passive REA study for parity picks (private memory only); `loop-library --studies` retrieves them on the owner's machine |
| Prompt/program optimisation against a metric | DSPy/MIPRO | missing | Verse's prompts are hand-edited; no metric-driven search |
| Eval-driven development (benchmark gates merges) | eval practice | have | `bench.json`, `bench.best.json`, bench floors |
| Canary + automatic rollback | SRE | **built** | red browser suite reverts (`revert-target.mjs`); a failed live check (MCP live) opens a revert PR (`live-revert.yml`); no staged canary yet |
| Expected-value / bandit want picking | bandits | **built** | `lacks.mjs` orders by lack x chance x market reach (`tools/revenue-tags.json`, docs/STRATEGY.md) (Beta(1,1) mean of wins/misses, `grow-lessons.chance`); `familyScores` gives per-family outcomes |
| Progress over time (proven, miss rate, speed) | eval practice | missing | no time series on the self card yet |

## Left, highest value first

1. Self-card charts over time: skills proven, miss rate, answer speed.
2. Critic gates (drop `|| true`) once hardening lines list their phrases.
3. Variant archive: failed candidates kept with their score so a later run can retry from them.
4. Live-watch failure → revert, through the same `revert-target.mjs` safety checks.

## Unknown unknowns (2026-10-22)

Adam: "Verse needs to learn to check things it can't think of yet." For the five parts, see docs/COMPLETENESS.md.

| Part | Verse | Where |
|---|---|---|
| Expectation mining (manuals and leading sites to expected features, then gaps, then wants) | **built** | `tools/expectations.mjs` (private study text, topic-only wants) |
| Persona playtests (new, phone, keyboard, screen reader) | **built** | `tools/persona-playtest.mjs`, in `tools/checks.mjs` |
| Generalize every miss into a rule for all skills | **built** | `RULES` + `tools/completeness-rules.json` (learned) in `tools/completeness.mjs` |
| Cross-skill analogy | **built** | `analogies()` in `tools/completeness.mjs` |
| Mutation and fuzz testing of asks | **built** | `fuzz()` in `tools/completeness.mjs`, run on every game |
| Vision critic on persona screenshots | missing | screenshots are saved; no automatic look-and-judge pass yet |
| The same approach for skills that are not games | missing | next |

## The lap loop: everything, around and around (owner, 2026-10-22)

Nothing is ever finished; everything upgrades for ever. No item is marked done anywhere: each keeps a rolling next upgrade.

- **What a lap covers:** every item in `void-live-deploy/lap.items.json` (written by `node tools/lap-items.mjs --write`): each skill, the
  surfaces (games, cards, the book, the store, films, the podcast, Mind Field, Tilt Arena, the loop itself), every doc, every archived repo in
  `archive/repos/` (its reusable parts), every check and tool, every business plan in `domains/` and the Forethinkers research. Plans and
  research get one concrete improvement each per lap, never an external action. On 2026-10-22 that is 675 items.
- **Order:** a lap goes around every item one by one (fix gaps, add basics, apply every discovered rule), then adds 100 new features (the
  will's own wants: studies, Grok drafts, frontier ideas), then the next lap starts over the whole, now bigger, set. Items can be weighted
  within a lap (rarely used, earning, stale: `staleness()` is one point per week since the last upgrade), but every item is touched each lap.
  An item added mid-lap joins this lap's tail.
- **Measurably better:** each upgrade records the item's facts before (counts only, such as lines, tests, examples, sections, reused parts).
  The next lap compares them (`compare()`, `lapProgress()`): an item is better only when a fact rose and none fell.
- **Resume:** the position is kept in `void_kv` row `lap` by `functions/api/will.js`, and moves on only when a job is queued, so an
  interruption resumes at the same item.
- **Public tracker (counts only):** `GET /api/will?lap=1`, and the will card shows the line, e.g. "Lap 2: upgraded 140 of 316 items, 37 of
  100 new this lap". Code: `void-live-deploy/lib/lap.js`, tested by `tools/lap.test.mjs` in `tools/checks.mjs`.

**Lap 1 is a full overhaul** (owner, 2026-10-22: "everything needs an overhaul again"): each item gets a persona playtest
(`tools/persona-playtest.mjs`: new player, power user, phone, screen reader) and a best-site comparison, then whatever is weak is rebuilt:
layout, completeness, clarity, speed, beauty in the void look, phone, no cut-off text. Order: the home page, the ask flow, cards, the book,
then games, then the rest (`overhaulWeights()` in `lib/lap.js`). Each item ships as its own small PR, and the tracker line is posted after each batch.

**The only site you need** (owner, 2026-10-22: "a-to-mind should be the only website you need"): `tools/lap-items.mjs` lists 24 popular
site categories (search, video, social, email, shopping, news, maps, weather, music, chat, docs and notes, translate, calendar, photos,
games, finance, sports, recipes, calculator, timer and clock, learning, podcasts, travel, jobs), most used first, with the Verse skills that
cover each. Status from facts only: missing (no skill), partial (one skill, or none tested), replaced (two or more skills, one tested).
Each category is a lap item (`site:<category>`) weighted right after the most-used surfaces, so every lap shrinks missing and upgrades
partial. 2026-10-22: 7 replaced, 12 partial, 5 missing (email, chat, podcasts, travel, jobs). Public at `GET /api/will?lap=1` (`onlySite`).

**The tower** (owner, 2026-10-22): the only-site-you-need list as a fighting-game ladder ("the tower", "verse tower", "which sites have you
beaten"; `skills/tower.js`, `lib/tower.js`). Each of 24 floors is one real site, named in plain text only as a comparison (no logos, brand
art or styling, no affiliation implied; Verse's skills keep their own names). Hard gate: a floor is beaten only when every aspect on its
checklist (9 common: speed, accuracy, completeness, mobile, accessibility, offline, sharing, design polish, reliability, plus the site's own)
is verified better in an automated head-to-head against the live site (`tools/tower-gate.mjs` writes `tower.evidence.json`: verdicts and
numbers; screenshots stay private outside the repo). A pass that turns worse keeps `was` and un-beats the floor. The marker never passes a
floor whose gate fails. Floors with evidence sort easiest to hardest by measured gap. Automated today: speed, reliability, mobile,
accessibility; every other aspect is unverified until its check exists, so it never counts. First real run (2026-10-22, calculator floor):
accessibility better, reliability and mobile equal (not a win), speed worse (Verse 3341 ms vs 908 ms). 0 of 11 aspects beaten.
The detailed per-site checklists come from passive study (loop-study / rea-study) and stay in private memory.
