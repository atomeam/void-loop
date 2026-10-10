# Intake: a buyer's emailed reply reaches their job

The sale-to-job pipe (lib/sale-jobs.js) queues `serve <product> for <domain>: wait for their reply to the receipt, then …`.
The reply arrives by email; the email worker (`email-worker/`) forwards it on to the owner's inbox and attaches it to
its job — no outside service. (The earlier setup, a Gmail filter plus a Zapier zap, is retired: both lived in outside
accounts and took two clicks; this takes one.)

## How it works

1. Each receipt-reply draft carries a `[sale:<id>]` tag in its subject (the four drafts the browser assistant wrote),
   so the buyer's reply keeps the tag and the match is mechanical.
2. Cloudflare Email Routing hands every message sent to the routed address on a-to-mind.com to the `void-email`
   worker. The worker always forwards the message to the owner's verified inbox first (nothing is ever lost), then,
   when the subject carries the tag, reads the text body out of the raw MIME and POSTs it to
   `https://a-to-mind.com/api/handoff` with the bearer token.
3. The endpoint stores the reply (redacted, 7-day TTL, unguessable link), appends `reply received: <url>` to the
   job whose target is `sale:<id>`, and writes a `sale.reply` execution record — so "my actions" and the board show
   the reply the moment it lands. The endpoint compares the sender's domain with the one the job names: a reply from
   another domain (a personal address, say) still lands, and the record says so. A retry gets the stored handoff back
   instead of a second line.

## Setup (once)

Deploy the worker and give it the secret (same wrangler login as the share worker; the Pages-only token cannot):

```
cd email-worker && npx wrangler deploy
npx wrangler secret put HANDOFF_TOKEN        # the same secret the Pages project holds
```

**Adam's one step** — turn on Email Routing for the domain and point an address at the worker:

1. Cloudflare dashboard → **a-to-mind.com** → **Email** → **Email Routing** → enable it (it adds the MX records itself).
2. Under **Destination addresses**, add and verify the inbox the mail should also land in (it is `FORWARD_TO` in
   `email-worker/wrangler.toml`; change it there before deploying if it should be another inbox).
3. Under **Routing rules**, add a rule: **atom@a-to-mind.com** → **Send to a Worker** → `void-email`.
   (All other mail to the address keeps arriving: the worker forwards everything, tagged or not.)

Test with a real reply to a receipt: the message arrives in the inbox as before, and within a few seconds the job on
the board ends with `· reply received: <url>` and "my actions" shows the `sale.reply` record. `npx wrangler tail
void-email` shows each message's one-line outcome (`forwarded, handoff answered 201`).

## What the owner sees

- "my actions" on the void (owner key): `✓ sale.reply · sale:<id> from <domain> · reply received: <url> appended to job <jobid>`
  — with ` (sender <domain> differs from the job's <domain>)` on the end when the reply came from another domain.
- The job on the board now ends with `· reply received: <url>` — the builder claiming it opens the link and has the
  buyer's own words, and the claim drafts the proposal from it (lib/job-draft.js).
