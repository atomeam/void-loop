-- Your Void follows you (plan item 6): passkey accounts, used-once challenges, sessions and the synced Void.
-- /api/passkey and /api/mine create these themselves on first use (the deploy doesn't run SQL). To make them ahead of time:
--   npx wrangler d1 execute a-to-mind-board --remote --file tools/d1/void_passkeys.sql
-- No passwords, no email, no names: an account is a random user handle plus the passkeys registered to it.
CREATE TABLE IF NOT EXISTS void_passkeys (
  id TEXT PRIMARY KEY,          -- credential id (base64url)
  user_id TEXT NOT NULL,        -- WebAuthn user handle (16 random bytes, base64url)
  public_key TEXT NOT NULL,     -- COSE public key (base64url)
  alg INTEGER NOT NULL,         -- -7 ES256 | -8 EdDSA | -257 RS256
  sign_count INTEGER NOT NULL,  -- last signature counter (0 for most synced passkeys)
  transports TEXT,              -- JSON array the browser reported
  backed_up INTEGER,            -- BS flag: 1 = synced passkey
  at TEXT NOT NULL,
  used TEXT
);
CREATE INDEX IF NOT EXISTS void_passkeys_user ON void_passkeys (user_id);
CREATE TABLE IF NOT EXISTS void_passkey_challenges (
  id TEXT PRIMARY KEY,          -- the challenge (32 random bytes, base64url); deleted before it's checked = used once
  kind TEXT NOT NULL,           -- create | add | get
  user_id TEXT,                 -- the account a create/add challenge belongs to
  expires INTEGER NOT NULL      -- epoch ms, 5 minutes after minting
);
CREATE TABLE IF NOT EXISTS void_sessions (
  id TEXT PRIMARY KEY,          -- SHA-256 of the session token (the token itself is only on the device)
  user_id TEXT NOT NULL,
  at TEXT NOT NULL,
  expires INTEGER NOT NULL      -- epoch ms, 180 days
);
CREATE INDEX IF NOT EXISTS void_sessions_user ON void_sessions (user_id);
CREATE TABLE IF NOT EXISTS void_mine (
  user_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,           -- { v, state, look, entered } JSON: stage things (kept cards included) and the look
  rev INTEGER NOT NULL,         -- bumps on every write; a stale write gets 409
  updated TEXT NOT NULL
);
-- Plan item 12 (paid Void, asked for, not advertised): a passkey account's tier. No row = 'free'.
-- Written only by /api/gumroad after Gumroad's API confirms a Void Monthly sale; forget me deletes it.
CREATE TABLE IF NOT EXISTS void_accounts (
  user_id TEXT PRIMARY KEY,
  tier TEXT NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'paid')),
  sale_id TEXT UNIQUE,          -- the Gumroad sale that linked it (one sale, one Void)
  subscription_id TEXT,         -- the Void Monthly membership (cancellation / ended / restarted pings find the Void by this)
  updated TEXT NOT NULL
);

-- Owner login: passkeys the owner bound with the key itself (/api/passkey 'owner-bind').
CREATE TABLE IF NOT EXISTS void_owner_passkeys (id TEXT PRIMARY KEY, at TEXT NOT NULL);
