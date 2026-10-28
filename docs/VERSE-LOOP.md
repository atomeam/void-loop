# The Verse loop: Verse works on itself, one item per lap

`tools/verse-loop.mjs` (also `npx verse-loop`) is a thin terminal wrapper over pieces this repo already has. One lap does this:

1. It takes a lock (`.git/verse-loop.lock`), skips if the tree has local changes, fetches and detaches at `origin/main`.
2. It runs the fast checks (`tools/verse-loop.checks.json`: `guard-source.mjs`, `growth-suites.mjs`; add lines to add checks).
3. It picks **one** item:
   - something is red: a coding agent fixes the **first red check**, never by weakening a test. The free brain fixes skills, not checks, so with it the lap reports `blocked` (watchdog.yml already has the issue open).
   - all green, free brain: the oldest open `probe:` job, through `tools/propose-fix.mjs` and its four gates.
   - all green, coding agent: `--task`, or the top open item of `docs/NEXT.md`, with a prompt built from `docs/TAGTEAM.md`, `docs/GATE-STANDARDS.md` and the task.
4. It scans the diff's added lines for keys (and refuses any `.env`), then runs the checks again. Only **no new red** (and, on a fix lap, the target green; `--strict` wants all green) goes on.
5. It commits to `loop/<time>` with one line appended to `docs/TAGTEAM.md`, pushes with a plain `git push` (never forced), and opens a PR with `gh` labelled `automerge` (a free-brain patch under 0.8 confidence is labelled `waits for owner`, the same gate as propose-fix.yml).

Anything else stops the lap and leaves the tree for a look: `rejected` (new red), `refused` (a possible key, or a patch outside its skill), `no-change`, `idle`, `skipped`. Each lap prints one JSON line.

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

1. Repo secrets (by name; values never go in a file): `VOID_OWNER_TOKEN` (already set for propose-fix), `VERSE_LOOP_TOKEN` (a fine-grained token with contents and pull-requests write: the workflow token cannot open PRs, and its pushes start no checks; without it a lap runs dry), and for the coding agents one of `OPENROUTER_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `CEREBRAS_API_KEY` plus the variable `VERSE_LOOP_MODEL`.
2. Repo variable `VERSE_LOOP_ENABLED` = `true` (`gh variable set VERSE_LOOP_ENABLED --body true`).
3. First lap by hand: `gh workflow run verse-loop.yml -f dry=true`, then `gh workflow run verse-loop.yml`.

## Brains, and the free-tier order

| `--agent` | What runs | Keys |
| --- | --- | --- |
| `verse` (default) | `tools/propose-fix.mjs`: Verse's own model on Workers AI through `/api/propose-fix`, free | `VOID_OWNER_TOKEN` |
| `opencode` | `opencode run [--model $VERSE_LOOP_MODEL] <prompt>` | the provider's key from the env |
| `aider` | `aider --yes-always --no-auto-commits --message-file <prompt>` | the provider's key from the env |
| `cmd` | `$VERSE_LOOP_AGENT_CMD` in a shell, prompt on stdin, its path in `$VERSE_LOOP_PROMPT_FILE` | whatever it reads from the env |

The fallback order when one runs out: **1.** Verse's own Workers AI (free, no key beyond `VOID_OWNER_TOKEN`) → **2.** OpenRouter's free models (`OPENROUTER_API_KEY`, a `:free` model) → **3.** Groq's free tier (`GROQ_API_KEY`) → **4.** Gemini's free tier (`GEMINI_API_KEY`) → **5.** Cerebras' free tier (`CEREBRAS_API_KEY`) → **6.** a local model through Ollama (no key). Set `VERSE_LOOP_MODEL` to the provider's model name as opencode or aider expect it. A key is never written to a file in the repo, never passed on a command line, and the diff scan refuses one that slips in.

Other knobs: `VERSE_LOOP_CHECKS` (a checks file), `VERSE_LOOP_AGENT_TIMEOUT_MIN` (default 45), `VERSE_LOOP_GH` (a stand-in for gh, for tests), `VERSE_LOOP_FETCH_IN_DRY_RUN=1`.

## Reused, and new

Reused as they are: `tools/propose-fix.mjs` and its gates (the free brain), `automerge.yml` / `tools/automerge.mjs` (merges the labelled PR on Verse's review), `verify.yml` with `tools/revert-target.mjs` and `live-revert.yml` (revert a red main or a bad deploy), `watchdog.yml` (the issue when main is red), `deploy.yml`, `loop-critic.yml` (reads the PR), `guard-source.mjs` and `growth-suites.mjs` (the checks), and `docs/NEXT.md`, `docs/TAGTEAM.md`, `docs/GATE-STANDARDS.md` (the work and the rules). `dispatcher.yml`, `grow-self.yml`, `void-tick.yml`, `upkeep.yml`, `tools/cron-gate.mjs` and `tools/lap-items.mjs` keep their own jobs; the loop does not duplicate them (`--task` or a line in the checks file can point a lap at any of them).

New: the terminal lap itself (`tools/verse-loop.mjs`: lock, before/after verdict, key scan, coding-agent adapters, one TAGTEAM line, a PR from a terminal), `tools/verse-loop.checks.json`, the gated hourly workflow `verse-loop.yml`, this page, and `tools/verse-loop.test.mjs` (dry-run laps in a throwaway repo with a fake brain, a fake gh and positive and negative controls).
