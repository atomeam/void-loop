# The Verse loop: Verse works on itself, one item per lap

`tools/verse-loop.mjs` (also `npx verse-loop`) is a thin terminal wrapper over pieces this repo already has. One lap does this:

**No human in the loop, ever** (owner rule, 2026-10-28): nothing a lap does waits for a person. Its guards are all automatic: the key scan, no new red, no test weakening (verse-coder's guard and propose-fix's gates), plain pushes only.

1. It takes a lock (`.git/verse-loop.lock`). If the loop is paused (the back-off, below) it stops here. It settles PRs earlier laps opened (merged or closed), skips if the tree has local changes, and fetches.
   - **Self-heal first:** if an open `loop/*` PR has a failed check, the lap reads the failure log (`gh run view --log-failed`), checks out that branch, has the brain fix it, gates it like any lap, pushes a plain fast-forward to the same branch and starts `verify.yml` there. That is the whole lap: no new branch, no new PR. A branch gets 3 heal tries; after that it counts toward the back-off.
   - Otherwise it detaches at `origin/main`.
2. It runs the fast checks (`tools/verse-loop.checks.json`: `guard-source.mjs`, `growth-suites.mjs`; add lines to add checks).
3. It picks **one** item:
   - something is red: the brain fixes the **first red check**, never by weakening a test. With the default `verse` brain that is Verse's own coding agent, `tools/verse-coder.mjs` (below).
   - all green, `verse`, and `VOID_OWNER_TOKEN` set with no `--task`: the oldest open `probe:` job, through `tools/propose-fix.mjs` and its four gates. When there is none (exit 3), the same lap goes on to `docs/NEXT.md` with `verse-coder`.
   - all green otherwise: `--task`, or the top of **Verse's queue** in `docs/NEXT.md`, with a prompt built from `docs/TAGTEAM.md`, `docs/GATE-STANDARDS.md` and the task.
4. It scans the diff's added lines for keys (and refuses any `.env`), then runs the checks again. Only **no new red** (and, on a fix lap, the target green; `--strict` wants all green) goes on.
   - a probe patch under 0.8 confidence is tried again, up to 2 more times. Still under the bar, it is **dropped** and logged to `.git/verse-loop.dropped.jsonl` (time, skill, each try's confidence); the lap ends `dropped`. Nothing is left waiting for a person.
5. It commits to `loop/<time>` with one line appended to `docs/TAGTEAM.md`, pushes with a plain `git push` (never forced), opens a PR with `gh` labelled `automerge`, and starts `gh workflow run verify.yml --ref <branch>` so the branch is verified at once.

**Grooming.** Every lap re-ranks the open work into one block at the top of `docs/NEXT.md` (between `<!-- verse-groom -->` markers, before the hand-written list, which stays as it is): red checks, the open `NEXT.md` items, and the assimilation gaps (`**Still missing…**` / `**Gaps.**` lines in `docs/PARITY.md`), **easiest first**: red checks, then items with an open PR to land, then gaps, then the rest by size; blocked, far-future and partner items last. The ranking is plain code, so the same input gives the same text. On a green lap, when the queue changed and no groom PR is open, the lap ships just that (`Verse loop: groom docs/NEXT.md`); otherwise it takes the top of the queue.

**The back-off, which resumes by itself.** A lap that ends `error`, `rejected`, `refused`, `no-change`, `pushed` or `dropped`, or a loop PR closed without merging, adds one to a streak; a merged PR or a healed branch resets it (`idle`, `skipped` and open PRs count neither way). At 3 in a row the loop pauses for 6 hours and opens an issue titled `Verse loop paused` with the last three reasons. Laps skip while paused; the first lap after 6 hours closes the issue itself (comment "Resumed by itself after 6 hours") and starts a fresh streak. The pause also reads the open issue's age, so a fresh Actions runner obeys it. State lives in `VERSE_LOOP_STATE` (default `.git/verse-loop.state.json`; Actions keeps it in the cache). A dry run never writes state or touches issues.

Other outcomes: `healed`, `paused`, `dropped`, `rejected` (new red), `refused` (a possible key, or a patch outside its skill), `no-change`, `idle`, `skipped`. Each lap prints one JSON line.

```
node tools/verse-loop.mjs --once [--dry-run] [--agent verse|opencode|aider|cmd] [--every <minutes>] [--task "..."] [--strict]
```

`--dry-run` runs the checks and the brain but does not fetch, commit, push, open a PR or write TAGTEAM.

## Drop it in: a terminal (three steps)

1. **A clone of its own.** The loop detaches HEAD and refuses a dirty tree, so give it its own clone or worktree:
   `git clone https://github.com/atomeam/void-loop ~/verse-loop && cd ~/verse-loop && npm ci && gh auth login`
2. **Keys in the environment only**, in a file outside the repo, e.g. `~/.config/verse-loop.env` (mode 600), with lines `VOID_OWNER_TOKEN=…` and, for a coding agent, `VERSE_LOOP_AGENT=opencode`, `VERSE_LOOP_MODEL=…` and one free-tier key (order below). Try it: `set -a; . ~/.config/verse-loop.env; set +a; node tools/verse-loop.mjs --once --dry-run`
3. **Run it on a timer**, pick one:
   - cron (hourly): `41 * * * * cd ~/verse-loop && set -a && . ~/.config/verse-loop.env && set +a && node tools/verse-loop.mjs --once >> ~/verse-loop.log 2>&1`
   - systemd user timer: `~/.config/systemd/user/verse-loop.service`
     ```
     [Service]
     Type=oneshot
     WorkingDirectory=%h/verse-loop
     EnvironmentFile=%h/.config/verse-loop.env
     ExecStart=/usr/bin/env node tools/verse-loop.mjs --once
     ```
     and `verse-loop.timer`
     ```
     [Timer]
     OnCalendar=*-*-* *:41:00
     Persistent=true
     [Install]
     WantedBy=timers.target
     ```
     then `systemctl --user daemon-reload && systemctl --user enable --now verse-loop.timer`
   - or simply leave it running: `node tools/verse-loop.mjs --every 60`

## Drop it in: GitHub Actions (three steps)

`.github/workflows/verse-loop.yml` runs `--once` every hour at :41 and on demand. It is off until you turn it on.

1. Repo secrets (by name; values never go in a file): `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` (Workers AI, Verse's coder), `VOID_OWNER_TOKEN` (already set for propose-fix: probe jobs), optionally `VERSE_LOOP_TOKEN` (the workflow token is used without it, now that Actions may open PRs), and as fallbacks any of `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `CEREBRAS_API_KEY` (and `VERSE_LOOP_MODEL` for opencode or aider).
2. Repo variable `VERSE_LOOP_ENABLED` = `true` (`gh variable set VERSE_LOOP_ENABLED --body true`).
3. First lap by hand: `gh workflow run verse-loop.yml -f dry=true`, then `gh workflow run verse-loop.yml`.

## Brains, and the free-tier order

| `--agent` | What runs | Keys |
| --- | --- | --- |
| `verse` (default) | red checks and NEXT items: `tools/verse-coder.mjs`, Verse's own coding agent on the free stack below; probe jobs: `tools/propose-fix.mjs` through `/api/propose-fix` | coder: `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, or any one fallback key; probes: `VOID_OWNER_TOKEN` |
| `opencode` | `opencode run [--model $VERSE_LOOP_MODEL] <prompt>` | the provider's key from the env |
| `aider` | `aider --yes-always --no-auto-commits --message-file <prompt>` | the provider's key from the env |
| `cmd` | `$VERSE_LOOP_AGENT_CMD` in a shell, prompt on stdin, its path in `$VERSE_LOOP_PROMPT_FILE` | whatever it reads from the env |

The fallback order when one runs out: **1.** Verse's own Workers AI (free, no key beyond `VOID_OWNER_TOKEN`) → **2.** OpenRouter's free models (`OPENROUTER_API_KEY`, a `:free` model) → **3.** Groq's free tier (`GROQ_API_KEY`) → **4.** Gemini's free tier (`GEMINI_API_KEY`) → **5.** Cerebras' free tier (`CEREBRAS_API_KEY`) → **6.** a local model through Ollama (no key). Set `VERSE_LOOP_MODEL` to the provider's model name as opencode or aider expect it. A key is never written to a file in the repo, never passed on a command line, and the diff scan refuses one that slips in.

## Verse's coder (`tools/verse-coder.mjs`)

A plain agent loop, no CLI to install. Each turn the model answers with one JSON tool call: `list`, `read`, `search` (ripgrep), `edit` (a unified diff, applied with `git apply`), `check` (one check from the checks file by name, or `node --test` on one test file) and `finish`. It walks the free stack in order, Workers AI (`CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`, model `FREE_MODEL` from `lib/models.js`) → OpenRouter → Groq → Gemini → Cerebras, moving on at a 429 or an error; with no key it exits 4 and the lap is `idle`. Model names can be changed with `VERSE_CODER_CF_MODEL`, `VERSE_CODER_OPENROUTER_MODEL`, `VERSE_CODER_GROQ_MODEL`, `VERSE_CODER_GEMINI_MODEL`, `VERSE_CODER_CEREBRAS_MODEL` (never a gpt-oss model).

Limits it enforces itself, whatever the model says:
- **Caps:** 30 turns and 250,000 tokens by default (`--max-turns`, `--max-tokens`).
- **Where it writes:** only inside the repo. Never `.env*`, `.dev.vars`, `.github/workflows` or `.github/actions`, anything that looks like a secret (`secrets.*`, `*.pem`, `*.key`), `.git`, `node_modules`, or the loop's own guards (`verse-coder.mjs`, `verse-loop.mjs`, `verse-loop.checks.json`, `lib/patch-guard.js`). No renames and no binary patches.
- **Tests:** `lib/patch-guard.js` runs on every edited JS, HTML and JSON file (stubs, a large shrink, broken syntax, lost functions). A test-weakening guard covers test files and the scripts the checks run: fewer assertions or test cases, a skip, `.only` or `todo`, a dead branch, an early clean exit, or an assertion that cannot fail is refused and undone. A test is never deleted.
- **Finishing:** on a fix lap the target check must be green, then Verse's review (`tools/review-pr.mjs --gate` on a throwaway commit of the change) and the key scan run on its own diff. A bug or risk finding goes back to the model; after three refused finishes it gives up.
- **Keys:** checks and the review run with every `*_KEY`, `*_TOKEN` and secret variable removed from their environment.

Exit 0 leaves the change in the tree for the loop's checks, commit and PR. Any other exit (3 nothing, 4 no key, 5 a cap, 6 no model answered) has put back every file it touched. The last line it prints is JSON. It runs on its own too: `node tools/verse-coder.mjs --task "make the calc check green" --target <check>`. Its tests (`tools/verse-coder.test.mjs`) drive it with a fake model that scripts its tool calls (`VERSE_CODER_SCRIPT`).

Other knobs: `VERSE_LOOP_CHECKS` (a checks file), `VERSE_LOOP_AGENT_TIMEOUT_MIN` (default 45), `VERSE_LOOP_GH` (a stand-in for gh, for tests), `VERSE_LOOP_FETCH_IN_DRY_RUN=1`.

## Reused, and new

Reused as they are: `tools/propose-fix.mjs` and its gates (the free brain), `automerge.yml` / `tools/automerge.mjs` (merges the labelled PR on Verse's review), `verify.yml` with `tools/revert-target.mjs` and `live-revert.yml` (revert a red main or a bad deploy), `watchdog.yml` (the issue when main is red), `deploy.yml`, `loop-critic.yml` (reads the PR), `guard-source.mjs` and `growth-suites.mjs` (the checks), and `docs/NEXT.md`, `docs/TAGTEAM.md`, `docs/GATE-STANDARDS.md` (the work and the rules). `dispatcher.yml`, `grow-self.yml`, `void-tick.yml`, `upkeep.yml`, `tools/cron-gate.mjs` and `tools/lap-items.mjs` keep their own jobs; the loop does not duplicate them (`--task` or a line in the checks file can point a lap at any of them).

New: Verse's coder (`tools/verse-coder.mjs`, test `tools/verse-coder.test.mjs`), the terminal lap itself (`tools/verse-loop.mjs`: lock, before/after verdict, key scan, coding-agent adapters, one TAGTEAM line, a PR from a terminal), `tools/verse-loop.checks.json`, the gated hourly workflow `verse-loop.yml`, this page, and `tools/verse-loop.test.mjs` (dry-run laps in a throwaway repo with a fake brain, a fake gh and positive and negative controls).
