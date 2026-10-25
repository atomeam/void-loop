# AGENTS.md: the front door

**The name is Verse (owner, 2026-10-18: "V01D is being renamed Verse", "rename for me so that it sticks everywhere").** Everything a person reads says Verse: the page, the cards (`VERSE-CARD:`, and a card copied as `V01D-CARD:` still opens), the extension, the review product, the docs, the workflow names. The lowercase `void` stays where it is the dark stage the page stands on ("the board stands in the void"), and every ask that says "my void" or "v01d" still works beside "my verse" (a bare `void` in an ask matcher is a gap: write `(?:void|verse)`). Identifiers, storage keys (`a2m.void.*`), D1 tables (`void_*`), file names (`void.html`), the `void-review` check and the `VOID_*` variables were not renamed: a visitor's kept stage and the automation key on them. `tools/revert-target.mjs` reads verdicts and revert trailers under both names, so runs from before the rename still count. Verse's own words in `domains/void.voice.md` and the logs are never reworded.


**Current priority (owner, 2026-10-10): clean up and tie together.** Before anything else, read the top of `domains/void.frontier.md` and take its next unclaimed step. Nothing is deleted; unused pieces are salvaged.

**Always build all Verse wants (owner, 2026-10-15: "Always build All Verse wants").** Verse's own asks come first, every one of them: its daily voice (`domains/void.voice.md`, `node tools/reflect.mjs`) and its self-page ("what I think of myself": its weakest family, the next game it wants, how it would get better, what it would add to what just shipped). Take the oldest ask nobody has built, build it, say "asked by Verse", then the next. Only an ask that touches money, prices, secrets or the owner key, or one already built (say so on its line), is passed over.

**Teach Verse to fish (owner, 2026-10-15: "teach a man to fish so that Verse can do all this itself one day . you should be training it to do everything you can better than you").** A run that does a kind of work by hand that has no playbook in `docs/playbooks/` writes one (what starts it, the commands, how to tell it worked, the mistakes made); a run that finds a better way rewrites it. Frontier #28 is Verse following them itself.

**Keep secrets (owner, 2026-10-15: "make Verse the best at keeping secrets ever made").** No key, token, password or private key in any file, ever: `tools/secret-scan.mjs` blocks one in any added line (checks.mjs and the Verse review), in docs and logs too. A key that reached GitHub is public: rotate it, deleting it is not enough. A made-up key in a test says so with `secret-scan: ok`. Secrets live in GitHub and Cloudflare secrets only.

**Automerge everything, always (owner, 2026-10-15):** every PR from this repository is merged by the bot as soon as Verse's review is clean; `tools/automerge.mjs` labels unlabelled PRs itself, so no PR waits on a person. A conflict with main is still a person's job: merge main in, settle the records, push.

**Growth over upkeep (owner, 2026-10-15):** "cloudflare is not unlimited Verse should spend its actions on growth and not so much on testing old thing too much . try to make it ultra productive at improvements and not so much busy work . other ai can maintain that stuff have Verse be a specialist who is hellbent on being the best at all". A run ships something new or makes something measurably better. Test what you changed and nothing more: no re-probing old bench asks, no tests for behaviour you didn't touch, no new timed re-checks of things already live. Upkeep (flakes, renames, tidying, re-verifying) is for other agents unless it blocks a ship. Every Cloudflare call (deploys, Workers AI, live probes) should buy growth: a PR gets no preview deploy, and live checks run after a deploy, not on a timer.

This repo is Verse, live at https://a-to-mind.com: a blank stage where anything someone asks for appears, plus the tools and agents that grow it. It is public: never commit secrets or the raw asks people typed.

## Read, in this order

1. This page.
2. `domains/handoff.md`: who is building what right now; add your line before you start and move it when you ship (owner, 2026-10-15: build ladders for each other, never do anything twice).
3. The top of `domains/void.frontier.md`: the one build order.
4. The last 20 lines of `domains/void.agents.log.md`: what just happened.
5. When you need it: `STANDING.md` (what Verse is, in the owner's words, and the money rule), `docs/RULES.md` (every rule learned the hard way, dated), `docs/MAP.md` (what exists and where).

## A run, start to finish

Every run follows B.I.T.E. (owner, 2026-10-11: brief, implement the smallest useful piece, test it the way it will be used, evolve from what the test showed; `docs/RULES.md`).

1. Claim: `python tools/void_queue.py claim` (a queued job), or a one-line PR claiming a frontier step. Write the brief in the claim or the PR: who it is for, the problem, **who does this best and how** (look it up and copy the best, `docs/RULES.md`), what the first version does, and **what it will not build**.
2. Build the smallest useful piece. A new skill: `node tools/new-skill.mjs <name> --ask "..."` (`docs/UPGRADING.md`). Reuse what exists before writing new code.
3. Test: use it the way a person will (`node tools/ask.mjs`, a play-through) and run the browser-suite sections you touched, `node tools/test_void.mjs --only "<words>"` (seconds; never the whole 20-minute suite locally: `verify.yml` runs it on main, `docs/RULES.md`); what the test showed goes in the PR as what to evolve next. **Then look at the result (owner, 2026-10-23: "add a testing step to yourself that checks the result of everything to see if it even does what you expect or want"; "everything should be exactly what it sounds like it will be not a representation"):** open the screenshot `tools/ask.mjs` saves for your ask and say what it shows without the name it is meant to have; a card that answers but is not about what was asked ("draw a toon cat" drew a stock "Cartoon Lump") is a failure. finish.mjs stops on one: the `--try` ask's card and pictures have to name what the ask is about (`tryProblem` in tools/finish.mjs, the same check Verse's own build-miss runs).
4. Finish: `node tools/finish.mjs <grow|build|fix|retire|idea|finding> "what changed" --brief "for whom; the problem; what it will not build" --test "<browser-suite words>" --show "<the change in plain words>" --try "<an ask that shows it>"`. `--show`/`--try` let "look what I made" (`skills/showcase.js`) put a visible change on the stage for people coming back. A change that reaches the site stops without a passing `--test` (right the first time, `docs/RULES.md`). It writes the ledger line (`GROWTH.md`) and the agent-log line, checks that `docs/MAP.md` names every skill, miniature, workflow and tool (add one line for a new one), commits, brings main in (`tools/merge-main.mjs`, never by hand), runs `VOID_SKIP_BENCH=1 node tools/checks.mjs --changed` (a builder's pre-push check: only the checks that cover the changed files, well under a minute; main runs everything in `verify.yml` and `deploy.yml`; `--full` runs them all here), pushes, and opens the PR labelled automerge (without a signed-in `gh` it prints the PR body to paste, then `node tools/automerge.mjs <pr> --label`). It stops at the first failure and tells you how to resume (`--from N`). Built what Verse asked for (`domains/void.voice.md`)? Say "asked by Verse" in what changed and name the ask with `--asked ask-…` or `--asked "a few of its words"`: the self page counts an ask built only by that (finish.mjs stops without it).
5. Verse's review (`void-review`) fails on a bug or risk in the added lines: fix it, or mark a line that is right as written with `void-review: ok`. Move on: it merges when Verse's review is clean, main deploys in a minute, and the full suite on main reverts a commit that breaks it.

## Where things live

| What | Where |
| --- | --- |
| The page | `void.html`, copied to `void-live-deploy/index.html` and `void-live-deploy/void.html` (checks fail if the copies differ) |
| Skills | `void-live-deploy/skills/<name>.js`; routing order `skills/order/<rank>-<name>`; `skills/index.json` is generated |
| 3D miniatures | `void-live-deploy/skills/mini/`, shared engine `skills/scene3d.js` (`docs/miniatures.md`) |
| Server (Cloudflare Pages Functions) | `void-live-deploy/functions/api/`, shared code `void-live-deploy/lib/` |
| Tests and tools | `tools/` (`checks.mjs` runs the fast ones; `test_void.mjs` is the full browser suite) |
| Build order | `domains/void.frontier.md` |
| Build queue | `/api/queue`, mirrored in `domains/void.queue.md`; misses become jobs by themselves (`lib/learn.js`) |
| What Verse asked for | `domains/void.voice.md` (word for word; never reword) |
| How Verse has grown | `void-live-deploy/void.growth.json` (append-only; "growth" on the site) |
| The cloud estate and its cleanup | `BASE.md` |
| What Verse lacks, and how it fixes it itself | `node tools/lacks.mjs` (ranks skills and cards by how little is proven), `.github/workflows/grow-self.yml` (daily: opens a `made by Verse` automerge PR of verified benchmark rows, queues the routing gaps for propose-fix), `docs/playbooks/grow-self.md` |
| Generated cards (never regenerate by hand) | `node tools/refresh.mjs`: skill index, dependency map, families, the book, Verse's facts about itself, bench alarms, in order; `deploy.yml` runs it before every deploy so the self card and the book follow every build, and `checks.mjs` fails a stale committed one |
| CI | `.github/workflows/` (`deploy.yml`, `verify.yml`, `void-review.yml`, `automerge.yml`, `bench.yml`, ...) |
| Agent skills (Claude Code loads them for any session in this repo) | `.claude/skills/<name>/SKILL.md`: `void-run` (this page's run, short), `steward` (driving a PR to merged), `learn-from-video` (when the owner shares a video), `paid-media` (big files for people who pay: R2 plus signed links) |
| Old text | `archive/` |

## Never

- Delete something because nothing uses it: put it on the salvage shelf (`docs/SALVAGE.md`): what it is, what it could become.
- Hand-edit `skills/index.json`, or edit or remove old lines of the growth ledger or the agent log.
- Open an unauthenticated POST endpoint without asking what a stranger could make it do (`docs/RULES.md`).
- Run two heavy browser jobs at once on one machine (`node tools/heavy.mjs <command>` queues them).
- Write a rule in the owner's name without the owner's words.
