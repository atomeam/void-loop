# Intake: a buyer's emailed reply reaches their job

The sale-to-job pipe (lib/sale-jobs.js) queues `serve <product> for <domain>: wait for their reply to the receipt, then …`.
The reply lands in Gmail; this page is the exact setup that forwards it onto the job. Two pieces live in Adam's
accounts (the Gmail filter and the Zapier zap — nothing else can create them); everything they call is already on main.

## How it works

1. Each receipt-reply draft carries a `[sale:<id>]` tag in its subject (the four drafts the browser assistant wrote),
   so the buyer's reply keeps the tag and the match is mechanical.
2. A Gmail filter labels those replies; a Zapier zap watches the label and POSTs each one to
   `https://a-to-mind.com/api/handoff` with the bearer token.
3. The endpoint stores the reply (redacted, 7-day TTL, unguessable link), appends `reply received: <url>` to the
   job whose target is `sale:<id>`, and writes a `sale.reply` execution record — so "my actions" and the board show
   the reply the moment it lands. A webhook retry gets the stored handoff back instead of a second line.

## Gmail (one filter)

1. Gmail → Settings → **Filters and Blocked Addresses** → **Create a new filter**.
2. **To:** `atom@a-to-mind.com` · **Subject:** `[sale:` — Create filter.
3. Tick **Apply the label** → new label `void-intake` (and optionally **Skip the Inbox** once the zap is proven).

## Zapier (one zap)

1. **Trigger:** Gmail → *New Labeled Email* → account `atom@a-to-mind.com` → label `void-intake`.
2. **Action 1 (parse the tag):** Formatter → Text → *Extract Pattern* on the subject with pattern `\[sale:([A-Za-z0-9._-]+)\]`
   → output is the sale id.
3. **Action 2 (post it):** Webhooks by Zapier → *Custom Request*:
   - Method `POST`, URL `https://a-to-mind.com/api/handoff`
   - Headers: `Authorization: Bearer <HANDOFF_TOKEN>` (the same secret as the Pages project), `Content-Type: application/json`
   - Data (JSON):
     ```json
     {
       "name": "{{subject}}",
       "author": "{{from_email}}",
       "body": "{{body_plain}}",
       "job": "sale:{{extracted sale id from Action 1}}"
     }
     ```
   The endpoint keeps only the domain of `author`, sanitizes the subject itself (a job-bound name is reduced to its
   letters, digits, `. _ -` and spaces, first 80 characters — a reply never bounces on its punctuation), and redacts
   keys and secrets from `body` before storing.
4. Test with a real reply to a receipt: the zap's response should be `201` with a `job: reply received: … appended
   to job …` line. A `404` means the subject's sale id has no job (check the tag); a repeat run answers `200
   already received` and changes nothing.

## What the owner sees

- "my actions" on the void (owner key): `✓ sale.reply · sale:<id> from <domain> · reply received: <url> appended to job <jobid>`
- The job on the board now ends with `· reply received: <url>` — the builder claiming it opens the link and has the
  buyer's own words.
