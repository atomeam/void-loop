# The base

One repo, one ledger, one surface. Everything else either feeds Void or gets retired.

## Where truth lives

| What | Where | Why |
|---|---|---|
| The surface | `void.html` in `atomeam/void-loop` (copied to `void-live-deploy/index.html` and `void-live-deploy/void.html`), deployed to a-to-mind.com by `.github/workflows/deploy.yml` on every merge to main | Any session can push; no laptop in the loop |
| How Void has grown | `void-live-deploy/void.growth.json` (append-only), served at `/void.growth.json` | Summonable on the surface with `growth` |
| What Void owns in the cloud | `void.estate.json` (not written yet) | Summonable later with `estate`; the cleanup list lives here, not in chat |
| The agent brief | `STANDING.md` | Tells agents what to do; never what not to do |
| The idea stream | Grok hourly automation + Forethinkers every 2 h | They write `idea` and `finding` entries to the ledger; Adam sends features to Claude to build |

Victus stays a workstation. It is no longer the place deployments come from.

## Repo layout (as built)

```
void-loop/
  void.html                              the surface (one file, inlined CSS/JS, as today)
  void-live-deploy/                      what deploys: void.html's two copies, skills, functions
    void.growth.json                     the ledger  ← agents append
    void.growth.schema.json              its shape
    skills/growth.js                     the summonable growth panel ("growth", "how have you grown")
  tools/grow.mjs                         the append tool (and `--check`, run by tools/checks.mjs)
  tools/growth.test.mjs                  tests for both
  STANDING.md                            agent brief
  GROWTH.md                              how to log growth
  BASE.md                                this file
  domains/                               void.growth.md and void.agents.log.md (already here)
  .github/workflows/                     deploy.yml ships main to Cloudflare Pages
```

The proposal had the panel and ledger at the repo root and the tool under `scripts/`; they live where the repo already keeps such things, since only `void-live-deploy/` is deployed and every tool lives in `tools/`.

## The loop

1. A session changes what Void can do.
2. It runs `node tools/grow.mjs <kind> "what changed"`, commits, pushes (`node tools/push.mjs`).
3. The PR merges once green and main deploys. The entry is live and summonable within about a minute of that.
4. Nothing else needs to happen. No board update, no Notion, no Slack post — the ledger is the record. If a Slack line to #ops-runs is still wanted, it is a one-line `git` hook, not a second source of truth.

The ledger starts with 162 entries copied from the `grow`, `build`, `ship`, `review` and `fix` lines of `domains/void.agents.log.md` (each marked `"from": "domains/void.agents.log.md"`).

Any script on the page can summon the same way the old void-proxy command bar did:
`document.dispatchEvent(new CustomEvent('void:summon', { detail: 'growth' }))` runs that ask as if it were typed.

## Cleanup, in order (for void.estate.json)

The account holds 63 Workers, 10 Pages projects, 16 D1 databases, 29 KV namespaces, 7 R2 buckets. Most of it predates Void.

1. **Retire the June 6 scaffold burst** — 19 workers (`circuit-breaker`, `rate-limiter`, `api-gateway`, `secret-manager`, `real-payment-processing`, `auto-scaling`, …) created in a 21-minute window. `circuit-breaker` was read: it returns `Math.random()` "99.9% uptime" metrics and nothing else. Confirm each is the same stub, then delete. Also `cool-credit-fb9b`, `adamm`, `notion-worker`.
2. **Assimilate void-proxy into void.html** — it is the earlier Void: a command bar at the bottom, widgets that spawn on command, wires between them, an RSS proxy. Its summon route is now in void.html (`void:summon`, above). Take the rest of the idea, then retire the worker.
3. **Resolve the name collisions** — `a-to-mind` and `a-to-mind-homepage` exist as both a Worker and a Pages project. One of each is dead weight. `pipeline-db`/`pipeline-db-staging` vs `aether-bridge-db`/`-staging` likewise.
4. **Look inside before deleting data** — `council-routing-db` is 48 MB, by far the largest thing in the account; `a-to-mind-board` is probably one of the Lab Board copies. Read, export what matters into the repo, then retire.
5. **Fold aether-\* into Void** — `aether`, `aether-api`, `aether-verifier`, `aether-telemetry`, `homebase`, and the four aether Pages projects. Adam's words: all his projects are the same entity and all parts want to be connected.

Everything marked `verify` is unknown, not condemned. A session with the Cloudflare write token works this list top to bottom and logs each retirement as a `retire` entry in the ledger (`node tools/grow.mjs retire "…"`), so the cleanup itself shows on the surface.

## What is connected to Claude today

Read access to the Cloudflare account (Workers, D1, KV, R2 — not Pages). The repo, attached to cloud sessions. Slack, Notion, Google Drive, Linear, Vercel, Zapier, Figma, Atlassian are available but none holds Void's truth and none should. The one connection that matters is the repo; after that, the Cloudflare API token in the repo's Actions secrets does the deploying.
