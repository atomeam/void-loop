# hold

Company: **A-to-Mind**.
This repo is the Phase 1.5 execution plane: CRA Article 14 clock, human hold-gate, AlphaGenome dry-run.

The old monorepo is archive. Do not clone it here. Do not name new files after it.

## Canonical

| Item | Value |
|---|---|
| Remote | `https://github.com/atomeam/hold.git` |
| Local | `C:\\Users\\adamm\\hold` |
| Runtime | Cloudflare Worker + D1 + R2 |
| Live D1 | `aether-bridge-db` `f29243db-5b7a-407b-aa38-64091c1e0676` (binding name stays until rotated) |
| Worker host | `bridge.a-to-mind.com` |
| Brand | A-to-Mind |

## In this repo

```
apps/bridge/          Worker, D1 migrations, hold-gate, clock, AG client
packages/ledger/      evidence types only
AGENTS.md             one-tree contract
```

## Not in this repo

- homebase / void / Pages apex demo
- cra-plane
- Clerk / Vercel dashboard (Phase 2)
- Kraken, KDP, Notion marketplace, CI-Medic chaos
- anything from `C:\\aether`

## First ticket

Issue #1 — `0014` schema + `POST /v1/holds/:id/allow` (human key) + `POST /v1/ag/runs/:id/score` (409 until ALLOWED, `AG_TOS_OK=0`).
