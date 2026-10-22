# hold

Company: **A-to-Mind**.
Phase 1.5 execution plane: CRA Article 14 clock + AlphaGenome dry-run.
**No human gates.** Policy auto-releases every hold.

The old monorepo is archive. Do not clone it here.

## Canonical

| Item | Value |
|---|---|
| Remote | `https://github.com/atomeam/hold.git` |
| Runtime | Cloudflare Worker + D1 + R2 |
| Live D1 | `aether-bridge-db` `f29243db-5b7a-407b-aa38-64091c1e0676` |
| Worker host | `bridge.a-to-mind.com` |
| Brand | A-to-Mind |

## Automation

1. `POST /v1/cra/cases` opens a case, writes Art.14 deadlines, auto-releases a policy hold, enqueues and scores an AG dry-run.
2. Cron `* * * * *` ticks due deadlines and writes **stub** SRP packets to R2 (`CRA_SRP_LIVE=0`).
3. `POST /v1/ag/runs/:id/score` scores immediately. Never 409 `HOLD_REQUIRED`.
4. `POST /v1/holds/:id/allow` returns **410**. The route is dead.

## Flags

- `AG_TOS_OK=0` — dry-run only, `fetch_count=0`
- `CRA_SRP_LIVE=0` — submissions stay `dest=STUB`
