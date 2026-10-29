# Playbook: Verse's own coding agent

Verse makes a real, multi-file change by itself, with no Claude builder in the loop (owner, 2026-10-26: "build verse so that it can"). The
agent is `tools/verse-agent.mjs`, it runs in `.github/workflows/verse-agent.yml`, and its brains are listed in `docs/brains.md`.

## What starts it

- **From the conductor (`tools/conductor.mjs`, every 10 minutes):** `gh workflow run verse-agent.yml -f job=<queue id>`. The conductor has
  already claimed the job (state `building`). The agent reads it by id (`GET /api/queue?state=building&limit=200`) and never claims it again.
  For a `heal:` job, the `pick` job reads the failing run's log (`gh run view --log-failed`) into the task. At the end, the queue is always
  told what came of it:
  `done` (landed: "verse-agent <run url>: <sha> <first line>"), `failed` (it gave up, the gate refused, or the tests still failed after five
  repairs: the reason), or `queued` with "tries N · why" (it could not start, the job was not found, out of neurons or steps, or it passed the
  gate but main moved before it landed), so the conductor retries with backoff. A job left `building` for over 3 hours is requeued by the
  conductor.
- **By hand or from another session:** Actions > Verse agent > Run workflow, or
  `gh workflow run verse-agent.yml --ref main -f task="…" -f tests="tower card, unit:tower"`.
- **From another loop (tower-self, earn-self, self-fix):** call it as a job:
  ```yaml
  build:
    uses: ./.github/workflows/verse-agent.yml
    with: { task: "…", tests: "unit:tower" }
    secrets: inherit
    permissions: { contents: write, actions: write }
  ```
  Its outputs are `landed` (`1` when the change is on main) and `sha`. A loop that cannot call a workflow files a queue job instead,
  `POST /api/queue { ask: "<the task in words>", target: "<kind>:<slug>" }`, and the conductor sends it here. Each kind gets its own hint in the
  task (`KIND_HINTS` in `tools/verse-agent.mjs`): heal, flake, feature, gap, versus, miss, review, will, voice, novelty, auto. A hand-given task
  that does not land is filed as an `agent:` job with the reason.
- **A good task** names the file or the card, the behaviour wanted, and the test that proves it. For example: "On /password/, the copy button
  has a 44 px tap target on phones; add a case to tools/password.test.mjs". Give `tests` the browser-suite section words when the change
  reaches the site (`node tools/test_void.mjs --list`). The gate refuses a site change that names no section.

## What it does

1. **pick:** the task given, or the job the conductor claimed, read by id, with the kind's hint, the job's draft and, for a heal job, the failing log.
2. **agent** (no write token, no owner key): a branch `verse/builder-<run id>` in the runner. A step that runs no model code mints an agent ticket
   from the owner key (`--ticket`, `lib/agent-ticket.js`). The ticket opens only `/api/agent-brain`, the site's own Workers AI binding, for at most
   three hours. The step hands it over as a file the agent reads once and deletes. Root is taken away before the loop (sudo and docker off, ptrace
   limited), so the model's code cannot read the agent process's memory. `--check` tries each brain once. Then the loop runs: the plan
   on a strong model, small steps on a fast one, and a repair on a strong one after every failed test. A repair sees the exact failure and
   the code it last edited. The model has fixed tools: `list_files`, `search`, `read_file` (numbered lines, at most 160),
   `patch_file` (an exact search/replace, unique, at most 80 lines), `create_file` (new files only, at most 220 lines) and `run_tests` (a
   name, never a shell: `unit:<x>`, `browser:<words>`, `checks`, `skills-index`, `refresh`). Then it calls `done` or `give_up`. The loop is
   capped at 30 steps, 2,500 neurons a run, 45 minutes and 5 repairs. A run starts only when the account's real Workers AI use today leaves at least
   600 neurons past the 4,000 kept for the site (`--budget`, the analytics token). When that use cannot be read, the agent's own count in the
   Actions cache is held to 3,000 a day.
3. **gate**, on a commit, in this order: scope (paths, no deletions, at most 14 files and 600 added lines, no assertion removed from a
   test), the secret scan, Verse's review (`review-pr.mjs --gate`), `checks.mjs --changed`, every named test, then a check that the tree did
   not change while they ran. Every step is in the run summary.
4. **land** (contents: write; it runs nothing the model wrote): checks out main again, runs main's `--scope` on the patch, `git apply`, adds a
   growth-ledger line `--by verse`, refreshes `tools/verse-agent.incidents.json`, commits with the trailer `Verse-Agent-Run: <run id>`,
   pushes to main, and starts `deploy.yml` and `verify.yml`.
5. **report:** PATCHes the job `done`, `failed` or `queued` with "tries N · why" (`--outcome`, `outcomeOf`). It files a new `agent:` job when a hand-given task did not land.

## How to tell it worked

- The job summary has the table (task, steps, neurons, brains, edits), the gate's lines, and every model call and action.
- On main: a commit titled `Verse agent: …` by github-actions with `Verse-Agent-Run:`, and a growth-ledger line `by: verse`. The self card's
  progress block says "Changes I made myself this week: N", which counts the ledger lines by Verse itself.
- `verify.yml` on that head is green. When it goes red, or live-revert reverts the commit, the next run's
  `--incidents --write` records it, and every later run reads the last five in its prompt.

## Mistakes made (and what fixed them)

- A nested `node --test` inherits `NODE_TEST_CONTEXT` from a parent test runner, reports to the parent and exits 0, so a failing test read
  as passing. The children's environment drops it (`childEnv`).
- The Workers AI token in a step's `env:` reaches every child process, including the model's code that the tests run. It is written to a
  file in an earlier step, read once and deleted.
- GitHub Models was in the first design. It was retired on 2026-07-30, and the docs say so. Check a provider's current docs before you
  design around it (`docs/brains.md`).
- `sw.js`, `void.html` and the server functions are off limits to the agent: one bad edit there reaches every page. A task there stays a
  builder's job.
- The repo's `CLOUDFLARE_API_TOKEN` answers 401 for Workers AI (found by the Versus loop on 2026-10-26). The agent's brain goes through the
  site's own binding with a ticket instead. Never hand the agent job the owner key itself: the tests run model-written code.

## Commands

```
node tools/verse-agent.mjs --check                          which brains answer with the token held
node tools/verse-agent.mjs --task "…" --test "<words>" --dry   the loop and the gate locally (needs CLOUDFLARE_ACCOUNT_ID + a token)
node tools/verse-agent.mjs --scope agent.patch              may the agent land this patch?
node tools/verse-agent.mjs --incidents [--write]            reverted agent commits (each run also reads them from git log itself)
node tools/verse-agent.mjs --pick | --budget f | --outcome f the workflow's steps: the task or claimed job, today's neurons, what the queue is told
node --test tools/verse-agent.test.mjs                      the agent's own tests (a scripted brain in a scratch repo)
```
