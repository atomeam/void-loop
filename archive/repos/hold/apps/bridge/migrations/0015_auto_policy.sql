-- 0015: retire human hold-gate. Holds become policy locks.
-- CHECK on holds.status stays (PENDING|ALLOWED|DENIED|EXPIRED).
-- Automation writes ALLOWED + decided_by='policy:auto' on insert.
-- Pending rows left by the old gate are released now.

PRAGMA foreign_keys = ON;

UPDATE holds
SET status = 'ALLOWED',
    decided_by = 'policy:auto',
    decided_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'),
    reason = COALESCE(reason, 'NO_HUMAN_GATE'),
    version = version + 1
WHERE status = 'PENDING';

CREATE TABLE IF NOT EXISTS automation_ticks (
  id          TEXT PRIMARY KEY,
  ran_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  due_scanned INTEGER NOT NULL DEFAULT 0,
  filed       INTEGER NOT NULL DEFAULT 0,
  missed      INTEGER NOT NULL DEFAULT 0,
  scored      INTEGER NOT NULL DEFAULT 0
);
