-- Times the free model fell short (lib/shortfall.js). Created on first use; to make it ahead of time:
--   npx wrangler d1 execute a-to-mind-board --remote --file tools/d1/void_shortfalls.sql
-- One row per day, place and reason, counted up. No ask text is ever stored.
CREATE TABLE IF NOT EXISTS void_shortfalls (
  day TEXT NOT NULL,     -- YYYY-MM-DD (UTC)
  place TEXT NOT NULL,   -- answer | fix | will
  reason TEXT NOT NULL,  -- free limit | busy | empty | error
  n INTEGER NOT NULL,
  last TEXT NOT NULL,    -- ISO time of the latest one
  PRIMARY KEY (day, place, reason)
);
