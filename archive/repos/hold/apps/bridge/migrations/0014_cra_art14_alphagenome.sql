PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS orgs (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  main_est_iso2 TEXT NOT NULL CHECK (length(main_est_iso2) = 2),
  csirt_hint    TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS products (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES orgs(id),
  name          TEXT NOT NULL,
  pde_class     TEXT NOT NULL CHECK (pde_class IN ('DEFAULT','IMPORTANT','CRITICAL')),
  version       TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS cra_cases (
  id              TEXT PRIMARY KEY,
  org_id          TEXT NOT NULL REFERENCES orgs(id),
  product_id      TEXT NOT NULL REFERENCES products(id),
  kind            TEXT NOT NULL CHECK (kind IN ('AEV','SI')),
  title           TEXT NOT NULL,
  summary         TEXT,
  awareness_at    TEXT NOT NULL,
  measure_at      TEXT,
  notify_users    INTEGER NOT NULL DEFAULT 0 CHECK (notify_users IN (0,1)),
  status          TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','EARLY_WARNED','NOTIFIED','FINAL','CLOSED')),
  created_by      TEXT NOT NULL,
  created_at      TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cra_cases_awareness ON cra_cases(id, awareness_at);

CREATE TABLE IF NOT EXISTS cra_deadlines (
  id          TEXT PRIMARY KEY,
  case_id     TEXT NOT NULL REFERENCES cra_cases(id),
  stage       TEXT NOT NULL CHECK (stage IN ('early_24h','notify_72h','final_14d','final_1m')),
  due_at      TEXT,
  filed_at    TEXT,
  UNIQUE (case_id, stage)
);

CREATE TABLE IF NOT EXISTS cra_submissions (
  id          TEXT PRIMARY KEY,
  case_id     TEXT NOT NULL REFERENCES cra_cases(id),
  stage       TEXT NOT NULL CHECK (stage IN ('early_24h','notify_72h','final_14d','final_1m')),
  payload_sha TEXT NOT NULL,
  r2_key      TEXT NOT NULL,
  dest        TEXT NOT NULL DEFAULT 'STUB' CHECK (dest IN ('STUB','SRP')),
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (case_id, stage)
);

CREATE TABLE IF NOT EXISTS holds (
  id            TEXT PRIMARY KEY,
  kind          TEXT NOT NULL CHECK (kind IN ('run','packet','score','notify_users')),
  subject_type  TEXT NOT NULL CHECK (subject_type IN ('cra_case','ag_run','packet')),
  subject_id    TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ALLOWED','DENIED','EXPIRED')),
  reason        TEXT,
  version       INTEGER NOT NULL DEFAULT 1,
  created_by    TEXT NOT NULL,
  decided_by    TEXT,
  decided_at    TEXT,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_holds_pending ON holds(status, kind);
CREATE INDEX IF NOT EXISTS idx_holds_subject ON holds(subject_type, subject_id);

CREATE TABLE IF NOT EXISTS ag_runs (
  id            TEXT PRIMARY KEY,
  org_id        TEXT NOT NULL REFERENCES orgs(id),
  hold_id       TEXT NOT NULL REFERENCES holds(id),
  assembly      TEXT NOT NULL DEFAULT 'hg38',
  interval_json TEXT NOT NULL,
  variant_json  TEXT,
  mode          TEXT NOT NULL DEFAULT 'DRY_RUN' CHECK (mode IN ('DRY_RUN','LIVE')),
  status        TEXT NOT NULL DEFAULT 'QUEUED' CHECK (status IN ('QUEUED','RUNNING','SCORED','FAILED','BLOCKED')),
  error         TEXT,
  created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS ag_scores (
  id          TEXT PRIMARY KEY,
  run_id      TEXT NOT NULL REFERENCES ag_runs(id),
  modality    TEXT NOT NULL,
  score_json  TEXT NOT NULL,
  fetch_count INTEGER NOT NULL DEFAULT 0,
  evidence_id TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS evidence_objects (
  id           TEXT PRIMARY KEY,
  sha256       TEXT NOT NULL UNIQUE,
  r2_key       TEXT NOT NULL UNIQUE,
  bytes        INTEGER NOT NULL,
  content_type TEXT NOT NULL DEFAULT 'application/json',
  subject_type TEXT NOT NULL,
  subject_id   TEXT NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE INDEX IF NOT EXISTS idx_evidence_subject ON evidence_objects(subject_type, subject_id);

INSERT OR IGNORE INTO orgs (id, name, main_est_iso2, csirt_hint)
VALUES ('org_atomind', 'A-to-Mind', 'IE', 'NCSC-IE');

INSERT OR IGNORE INTO products (id, org_id, name, pde_class, version)
VALUES ('prd_bridge', 'org_atomind', 'aether-bridge', 'IMPORTANT', '0.1.5');