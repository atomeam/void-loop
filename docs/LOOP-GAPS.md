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
