# Agent contract

WORKDIR = C:\\Users\\adamm\\hold
REMOTE  = https://github.com/atomeam/hold.git

Company name is A-to-Mind. Repo name is hold.
Do not create files, branches, or comments that treat the old monorepo as live.

If cwd is C:\\aether or C:\\Users\\adamm\\Aether, cd to hold or exit.
git remote -v must contain atomeam/hold. If not, exit.

Allowed paths:
  apps/bridge/**
  packages/ledger/src/alphagenome.ts
  AGENTS.md

Forbidden:
  apps/cra-plane
  apps/void
  apps/homebase rewrite
  DROP TABLE runs
  wrangler pages deploy --project-name=a-to-mind
  new D1 database
  git push --force origin main
  copying the old monorepo into this tree

Allow is human-only: header x-hold-human-key.
Service key cannot ALLOW its own hold.
AG_TOS_OK=0 — no live AlphaGenome fetch.
CRA_SRP_LIVE=0 — no live ENISA submit.

Migration file: apps/bridge/migrations/0014_cra_art14_alphagenome.sql
Tables: orgs products cra_cases cra_deadlines cra_submissions holds ag_runs ag_scores evidence_objects
Do not create incidents / filings / artifacts_v2 / science_runs.
