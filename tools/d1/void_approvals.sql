-- The confirm line (plan item 7): paused actions and their decisions, plus the ledger they write.
-- Run once:  npx wrangler d1 execute a-to-mind-board --remote --file tools/d1/void_approvals.sql
CREATE TABLE IF NOT EXISTS void_approvals (
  id TEXT PRIMARY KEY,          -- approvalId (= correlateKey)
  state TEXT NOT NULL,          -- pending | deciding | done | approved-not-run | failed | reject | timeout | escalate
  record TEXT NOT NULL,         -- ApprovalEvent v0 JSON (requested fields + decision fields)
  at TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS void_ledger (
  id TEXT PRIMARY KEY,          -- ledgerEntryId
  approval_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  at TEXT NOT NULL,
  entry TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS void_ledger_at ON void_ledger (at);
