-- The router's tables (lib/router.js). Made on first use by the Pages Functions; applying this file is idempotent:
--   npx wrangler d1 execute a-to-mind-board --remote --file tools/d1/void_routes.sql
CREATE TABLE IF NOT EXISTS void_routes (id TEXT PRIMARY KEY, ask TEXT NOT NULL, route TEXT NOT NULL, skill TEXT, model TEXT, outcome TEXT, would TEXT, score REAL, scores TEXT, ms INTEGER, waited INTEGER, count INTEGER NOT NULL, first TEXT NOT NULL, last TEXT NOT NULL);
-- Counters: void_kv k = 'router:escalated:YYYY-MM-DD' (free escalations a day), 'router:paid:<spend id>:<period>' and 'router:paid:total' (cents)
CREATE TABLE IF NOT EXISTS void_kv (k TEXT PRIMARY KEY, v TEXT);
-- Standing spends said yes to on the confirm line (tool models.spend); the newest one is in force (cap 0 = stopped)
CREATE TABLE IF NOT EXISTS void_spends (id TEXT PRIMARY KEY, approval_id TEXT, model TEXT NOT NULL, cap_cents INTEGER NOT NULL, per TEXT NOT NULL, at TEXT NOT NULL);
