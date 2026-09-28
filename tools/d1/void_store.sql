-- Atom's Gumroad store (plan item 12). /api/catalog and /api/gumroad create these on first use (the deploy doesn't run SQL).
-- To make them ahead of time:  npx wrangler d1 execute a-to-mind-board --remote --file tools/d1/void_store.sql
-- Nothing ever deletes from these tables: a product that leaves the store stays (available = 0, with its history);
-- every Gumroad ping stays on record.
CREATE TABLE IF NOT EXISTS void_catalog (
  slug TEXT PRIMARY KEY,        -- the /l/<slug> path on moonbeam846.gumroad.com
  data TEXT NOT NULL,           -- { short, name, price_cents, currency, recurrence, native_type, url, first_seen, last_seen, unavailable_since, history[] }
  available INTEGER NOT NULL,   -- 1 = in the store and published; 0 = gone or unpublished (kept, never offered)
  updated TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS void_catalog_meta (
  k TEXT PRIMARY KEY,           -- 'refreshed' = when the live store was last read (refreshed on read after 6 hours)
  v TEXT
);
CREATE TABLE IF NOT EXISTS void_sales (
  id TEXT PRIMARY KEY,          -- resource : sale_id or subscription_id : event time (a repeated ping is recognised, not re-applied)
  resource TEXT NOT NULL,       -- sale | refund | dispute | dispute_won | cancellation | subscription_ended | subscription_restarted | ...
  sale_id TEXT,
  subscription_id TEXT,
  product TEXT,                 -- product permalink or name as Gumroad sent it
  void_id TEXT,                 -- url_params[void]: the passkey account the page put on the checkout link
  verified INTEGER NOT NULL,    -- 1 = read back from Gumroad's API
  effect TEXT,                  -- what it did: tier paid / tier free (cancellation) / not verified: ... / recorded
  raw TEXT NOT NULL,            -- the ping exactly as received
  at TEXT NOT NULL
);
