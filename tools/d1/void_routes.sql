-- The router's log (lib/router.js). Made on first use by the Pages Functions; this file is for reference / manual setup.
CREATE TABLE IF NOT EXISTS void_routes (id TEXT PRIMARY KEY, ask TEXT NOT NULL, route TEXT NOT NULL, skill TEXT, model TEXT, outcome TEXT, would TEXT, score REAL, scores TEXT, ms INTEGER, waited INTEGER, count INTEGER NOT NULL, first TEXT NOT NULL, last TEXT NOT NULL);
-- Escalation counter per day: void_kv k = 'router:escalated:YYYY-MM-DD'
CREATE TABLE IF NOT EXISTS void_kv (k TEXT PRIMARY KEY, v TEXT);
