# Internal credits faucet

**Starts when:** a member earns internal credits on `/prizes/` or by asking "credits".

1. `void_credits` is append-only in D1 (`lib/credits.js`). `POST /api/credits/claim` needs the member session, Turnstile if `TURNSTILE_SECRET` is set, otherwise proof of work for this hour and address.
2. Daily use is once a day. A tool must be a skill the site serves. A bug must be that member's answered support ticket. A build must be that member's shipped idea. Over the day's cap (24) or the credits still issuable from realized earnings, the claim is refused. Earnings are read, never spent.
3. `GET /api/credits/latest` masks names and returns no email or account id. An empty ledger says there are no claims yet.

**Worked when:** `node --test tools/credits.test.mjs` passes and live `/api/credits/latest` is that JSON.
