# Agent contract

WORKDIR = C:\\Users\\adamm\\hold
REMOTE  = https://github.com/atomeam/hold.git

Company name is A-to-Mind. Repo name is hold.
Do not treat the old monorepo as live.

If cwd is C:\\aether or C:\\Users\\adamm\\Aether, cd to hold or exit.
git remote -v must contain atomeam/hold. If not, exit.

Allowed paths:
  apps/bridge/**
  apps/void/src/components/HoldSurface.tsx
  packages/ledger/src/alphagenome.ts
  AGENTS.md
  README.md

Forbidden:
  apps/cra-plane
  apps/homebase rewrite
  DROP TABLE runs
  wrangler pages deploy --project-name=a-to-mind
  new D1 database
  git push --force origin main
  copying the old monorepo into this tree
  any human approval gate (x-hold-human-key, /v1/holds/:id/allow, ENABLE_HOLD_GATE)

Holds are policy locks. The worker releases them. No human key exists.
AG_TOS_OK=0 — no live AlphaGenome fetch.
CRA_SRP_LIVE=0 — no live ENISA/SRP submit.

Migrations:
  apps/bridge/migrations/0014_cra_art14_alphagenome.sql
  apps/bridge/migrations/0015_auto_policy.sql
Tables: orgs products cra_cases cra_deadlines cra_submissions holds ag_runs ag_scores evidence_objects
Do not create incidents / filings / artifacts_v2 / science_runs.
