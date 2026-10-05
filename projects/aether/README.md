# Aether Dispatcher

Cloudflare Worker running on a scheduled cron trigger to fetch unanswered asks from `/api/misses`, apply strict redaction, and format into the job queue structure for void-loop's builders.

## Architecture

```
┌─────────────────────┐
│  D1: void_misses    │
│  + KV: old rows     │
└──────────┬──────────┘
           │
           v
    ┌──────────────┐
    │ /api/misses  │ (owner-only, bearer token)
    └──────┬───────┘
           │
           v
   ┌──────────────────┐
   │ Aether Dispatcher│ (runs hourly)
   └────────┬─────────┘
            │
       ┌────┴──────────────────┐
       │ Redaction Logic        │
       │ (tools/misses.mjs)     │
       │ • Drop secrets/keys    │
       │ • Mask emails          │
       │ • Mask digit runs      │
       └────────┬───────────────┘
                │
                v
     ┌────────────────────┐
     │ Job Queue Format   │
     │ {id, ask, kind,    │
     │  count, last, state│
     │  queued}           │
     └────────┬───────────┘
              │
              v
      ┌─────────────────┐
      │ Bridge (TBD)    │
      │ Durable Objects?│
      │ Message Queue?  │
      └─────────────────┘
```

## Setup

1. **Install Wrangler**
   ```bash
   npm install -g wrangler
   ```

2. **Configure the token**
   ```bash
   wrangler secret put VOID_API_TOKEN --env production
   # Paste your Pages READ_TOKEN (same as VOID_MISSES_TOKEN)
   ```

3. **Deploy**
   ```bash
   cd projects/aether
   wrangler deploy --env production
   ```

4. **Verify the cron trigger**
   - The worker will run every hour at the top of the hour (`:00`)
   - Logs appear in Cloudflare Workers dashboard

## Key Design Decisions

### Redaction is Strict
The dispatcher replicates `tools/misses.mjs` exactly:
- **Drops** any ask containing an "unlock" command or a key-like pattern (16+ chars mixing letters/digits)
- **Masks** email addresses → `[email]`
- **Masks** digit runs (phone/card numbers) → `[number]`

This ensures no raw secrets ever reach the job queue or public infrastructure.

### Job ID is Deterministic
Each job gets an ID = `SHA256(redacted_ask).slice(0, 24)`. This means:
- The same ask always produces the same ID
- Jobs can be deduplicated on the bridge side
- No PII in the ID itself

### No Direct D1 Writes
The dispatcher **reads** from `/api/misses` via bearer token, but doesn't write directly to D1. The bridge (next phase) will handle:
- Deduplication
- State transitions (`queued` → `building` → `done`)
- Dead-letter queue for unresolvable asks

## Next Steps (Goal 3b: Bridge)

The bridge will:
1. Consume the job queue from Aether
2. Route jobs to builders (GitHub Issues? Manual queue? Automated tools?)
3. Track state via Durable Objects or D1
4. Report back to void-loop when a job is claimed/completed

This turns Void from reactive (responds to asks when online) to persistent (work continues asynchronously).

## Troubleshooting

**Worker won't start:**
```bash
wrangler deploy --env production
# Check Cloudflare Workers dashboard for build errors
```

**Token 401 errors:**
```bash
# Verify the token is set
wrangler secret list --env production
# Should show: VOID_API_TOKEN (redacted)
```

**Not running on schedule:**
Check Cloudflare Workers dashboard → your worker → Triggers → Crons. Should show `0 * * * *` and last execution time.
