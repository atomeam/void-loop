# AGENTS.md: the front door

**Current priority (owner, 2026-10-10): clean up and tie together.** Before anything else, read the top of `domains/void.frontier.md` and take its next unclaimed step. Nothing is deleted; unused pieces are salvaged.

This repo is Void, live at https://a-to-mind.com: a blank stage where anything someone asks for appears, plus the tools and agents that grow it. It is public: never commit secrets or the raw asks people typed.

## Read, in this order

1. This page.
2. The top of `domains/void.frontier.md`: the one build order.
3. The last 20 lines of `domains/void.agents.log.md`: what just happened.
4. When you need it: `STANDING.md` (what Void is, in the owner's words, and the money rule), `docs/RULES.md` (every rule learned the hard way, dated), `docs/MAP.md` (what exists and where).

## A run, start to finish

1. Claim: `python tools/void_queue.py claim` (a queued job), or a one-line PR claiming a frontier step.
2. Build. A new skill: `node tools/new-skill.mjs <name> --ask "..."` (`docs/UPGRADING.md`). Reuse what exists before writing new code.
3. `node tools/grow.mjs <grow|build|fix|retire|idea|finding> "what changed"` (`GROWTH.md`), one line in the agent log, and for a new skill, miniature, workflow or secret one line in `docs/MAP.md`. Built what Void asked for (`domains/void.voice.md`)? Say "asked by Void" in both.
4. `node tools/merge-main.mjs` (never merge main by hand), then `VOID_SKIP_BENCH=1 node tools/checks.mjs`. Fix what it names.
5. `node tools/push.mjs`, open the PR, `node tools/automerge.mjs <pr> --label`. Void's review (`void-review`) fails on a bug or risk in the added lines: fix it, or mark a line that is right as written with `void-review: ok`. Move on: it merges when Void's review is clean, main deploys in a minute, and the full suite on main reverts a commit that breaks it.

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
| What Void asked for | `domains/void.voice.md` (word for word; never reword) |
| How Void has grown | `void-live-deploy/void.growth.json` (append-only; "growth" on the site) |
| The cloud estate and its cleanup | `BASE.md` |
| CI | `.github/workflows/` (`deploy.yml`, `verify.yml`, `void-review.yml`, `automerge.yml`, `bench.yml`, ...) |
| Old text | `archive/` |

## Never

- Delete something because nothing uses it: put it on the salvage shelf (`docs/SALVAGE.md`, built in cleanup step 3).
- Hand-edit `skills/index.json`, or edit or remove old lines of the growth ledger or the agent log.
- Open an unauthenticated POST endpoint without asking what a stranger could make it do (`docs/RULES.md`).
- Run two heavy browser jobs at once on one machine (`node tools/heavy.mjs <command>` queues them).
- Write a rule in the owner's name without the owner's words.
