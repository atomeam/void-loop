# Playbook: the conductor (Verse runs its own work)

Owner, 2026-10-26: "look at Verse autonomy and fix it so it definitly will work on its own without either of us and make it impeccibly effeciently productive"; "get Verse automated like its very life depends on it".

## What starts it

Nothing by hand. `.github/workflows/grow-clock.yml` runs one conductor tick (`node tools/conductor.mjs tick`) and releases the runner. The schedule is every 10 minutes, with an hourly cron if that schedule is late. A dispatch that finds the last tick already stale starts one more run; a tick that just landed does not chain. `will.yml` starts the clock when no run is going and the last one is more than 10 minutes old. The tick record is pushed to the `conductor-state` branch (a push there does not deploy); `domains/conductor.json` on main is updated when that copy is more than 3 hours old. The conductor restarts Verse's other clock, `void-tick.yml`, when no run of it is going or waiting. That clock knocks once per run too.

## What a tick does

1. Reads every `queued` and `building` job from the build queue (`GET /api/queue?state=queued,building`, owner token `VOID_OWNER_TOKEN`).
2. Reads the newest runs of every loop it starts or stands on (`WATCH` in `tools/conductor.mjs`; `gh api` with the workflow's own token).
3. Plans with `tools/conductor-core.mjs` (pure, tested in `tools/conductor.test.mjs`):
   - **Who takes what.** `probe` → `propose-fix.yml`; `miss` on the new-skill lane → `build-miss.yml` (other misses → the coding agent); `store-gap` → `store-gap.yml`; `heal`, `will`, `voice`, `versus`, `feature`, `review`, `gap`, `novelty`, `auto`, `flake`, `member` → the coding agent (`verse-agent.yml`). `sale` and anything unknown are held (a sale is a person's).
   - **What comes first.** `FIRST`: a broken loop's repair, then a paid member's idea (`member`, lib/members.js), go before any score. Then `WEIGHT`: a broken loop's repair 100, Verse's own asks (will, voice) 95, money (store-gap) 90, the tower (versus) 85, features 75, reviews 70, misses and gaps 60, the rest lower; +2 a day of waiting (up to +30); −25 a try.
   - **Limits.** One start per executor a tick, none while it runs, a daily cap per executor (`ROUTES[].cap`), a job retried waits 2 hours a try, a self-claiming executor is not handed the same job again within 6 hours.
   - **Dead runs.** A job the conductor claimed that is still `building` after 3 hours goes back with a try counted; at 3 tries it is set aside with its last reason, so a hopeless job stops costing runs.
   - **Broken loops.** Three failed runs in a row (cancelled runs do not count) queue a `heal:<workflow>` job for the coding agent and shut the loop; after 6 hours it gets one trial run (half-open), so a repair is noticed.
   - **Probe asks** (`probe-asks.yml`) only when 2 or fewer probes wait: hourly, or every 6 hours while fewer than 1 in 10 of its fixes pass (the probes and fixes spend the free model budget the site shares with visitors).
   - **The proving pass** (`grow-self.yml`) at most every 2 hours. It locks in asks Verse answers right and queues the ones it misses as fixes. The owner's 2026-10-24 words were read as "no self hardening" and the pass was taken off the clock; the owner put it right on 2026-10-26: "never said there a no self hardening i said to elaborate what that means", "it needs to say what it improved".
4. Acts: requeues, sets aside, queues repairs, claims (the coding agent's jobs only; the others claim for themselves), starts runs. A start that fails gives the claimed job back.
5. Writes `domains/conductor.json` (the last 24 hours of ticks, broken loops, held jobs; counts and ids only) and the run summary. The clock commits it every 3 hours (and on the last tick of a run). Hourly commits were 27 of main's 78 commits in a day (2026-11-03); the runner keeps the state between commits.

## The coding agent's contract

The conductor claims the job (`building`, note `claimed by conductor`) and runs `verse-agent.yml -f job=<id>`. The agent reads the job (`GET /api/queue?state=building`), and always ends with `PATCH /api/queue {id, state, note}`: `done` when the change landed on main, `failed` with the reason, or `queued` with `tries N · reason` to be retried. A run that dies without reporting is handled by the 3-hour rule.

## How to tell it worked

- The run summary of `Verse grows` shows a `### Conductor` block every 10 minutes: what started, what was put back, what is held and why, which loops are broken.
- `domains/conductor.json`: `last24h.started` goes up; `held` names the missing executors; `broken` is empty or has a `heal:` job queued.
- The queue: the oldest `queued` jobs move to `building`, then `done`, `failed` or back with `tries N`.

## Commands

- `node tools/conductor.mjs tick --dry` (needs `VOID_OWNER_TOKEN`; plans and prints, changes nothing). `VOID_API=http://127.0.0.1:8799/api/queue` points it at a test queue.
- `node --test tools/conductor.test.mjs tools/grow-clock.test.mjs tools/queue.test.mjs`
- A dry clock run by hand: `gh workflow run grow-clock.yml -f dry=true -f ticks=1`.

## Mistakes made

- The clock used to stop for good when one run failed or was cancelled, and GitHub's schedule can come hours late; the chain step now runs `if: always()` and retries.
- `GET /api/queue` returned only the newest 20 jobs; the conductor needs the whole backlog (`?state=`).
- A broken loop shut forever deadlocks (it can never succeed again); the half-open trial run fixes that.
- `ticks` from a hand run went into bash arithmetic, which would evaluate an expression; it is checked as digits first.
- Never print a whole GitHub API response while debugging: filter it (`--jq`).
- Committing `domains/conductor.json` every hour was 27 of main's 78 commits in a day (2026-11-03). The clock still ticks every 10 minutes; the public record on main is written when it is more than 3 hours old. Each tick's record is on the `conductor-state` branch, which does not deploy.
- One run that slept for 33 ticks held a runner for about five and a half hours, and a `git fetch` with no timeout could sit there until the 345-minute job limit (2026-11-04). A tick is one job of at most 20 minutes. `git fetch` and `git push` give up after 90 seconds.
