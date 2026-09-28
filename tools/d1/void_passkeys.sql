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
