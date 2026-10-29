# Revenue: how Verse earns, every day, by itself

**What starts it.** `.github/workflows/earn-self.yml` at 07:41 UTC every day (or by hand: Actions, "Verse earns", Run workflow). Owner, 2026-10-26: "i mean for Verse to go after and make money"; "its not me whos going after the money its Verse, and its meant to be very good at it so that it doesnt need me to find money and lots of it". It runs on Verse's own free model (Workers AI) and its own tools. No builder's model is in the loop, and `tools/earn.test.mjs` fails if the loop or its workflow ever names one.

## The loop (tools/earn.mjs; every decision is a pure function in tools/earn-core.mjs)

| Step | What Verse does | Where it lands |
| --- | --- | --- |
| Measure | Offer views and buy-button presses come from the public offer counter (`GET /api/tally?of=offer-view` and `offer-click`; `/offer.js` on every offer page). Sales and revenue per product and per page come from `/api/earnings` (`by_offer`, `by_page`; owner token). Only counts and totals are kept. | `domains/earnings-log.json` |
| Learn | Each platform's weight is its prior times what its pages get pressed and sold, capped at 3x. A Verse-made page that is 60 days old, was seen 100 times and never got a press or a sale is retired. Retired is salvage, not deletion: the file stays, the page leaves the hub and the sitemap, and the loop writes a line in `docs/SALVAGE.md`. | `log.weights`, `tools/fix-pages.json` `status: retired` |
| Find | Reads the official error indexes in `domains/earn.sources.json` (Vercel's error codes, Cloudflare 5xx, n8n common issues, GitHub Actions troubleshooting, Make error types). Ranks the candidates by expected sales per effort: platform weight × urgency (a login, a limit, a timeout or a hard failure stops work) × how often Verse's own misses name it. | `domains/earn.candidates.json` |
| Build | Takes the top candidates, up to the caps (40 pages read, 6 model calls and 3 new pages a day). It fetches the official page. **The error text must be on that page word for word, or the candidate is dropped.** The free model drafts the meaning and 3 to 6 steps from the page's own text, and **each step must carry a quote found on the page word for word**. Any error code the draft names must be on the page. Links, markup and anything shaped like a key are refused. The title and the error line are templates. The page's "Ask Verse" link must be one Verse's fixer accepts. A failure is dropped with its reason and retried after 30 days. | `tools/fix-pages.json`, then `tools/fix-pages.mjs` and `tools/sitemap.mjs` write the pages |
| Price | Verse appraises the One-Time Fix from rival prices (`domains/earn.comps.json`, each with where and when it was seen) and its own record. With no sales yet it charges the common starting price. Every 3 proven sales move it one step toward the top rivals. 30 presses with no sale move it to the low end. Nothing a visitor types reaches a price. | `void-live-deploy/store/prices.json` (linked from the store footer) |
| Publish | The same checks a builder runs (`fix-pages --check`, `sitemap --check`, the secret scan, `checks.mjs --changed`). Then a commit and push to main, then the workflow starts `deploy.yml`. A push with GITHUB_TOKEN starts no workflow, but a dispatch does. IndexNow announces the new sitemap pages at the deploy. | main, a-to-mind.com |
| Report | One line, for example "Earned $0 this week from 12 offer views; published 2 new fix pages; next I'm trying a fix page for Vercel DEPLOYMENT_NOT_FOUND." | agent log, `self.json` `earning` |

**Spending.** Spending is off until something is earned (STANDING.md: the budget is what Verse has earned). Every day's row says `spending: off` or `allowed inside the caps`.

## How to tell it worked

- The run's summary (the job's Summary tab) shows `published`, `dropped` with reasons, `priced`, `fetches`, `modelCalls` and `notes`.
- `domains/earnings-log.json` has today's row.
- A new `/fix/<slug>/` page carries "Written by Verse. The error text was checked word for word against the official page on <date>."
- After a deploy, `GET /api/tally?of=offer-view` returns counts for the offer ids.

## Measuring by hand

- Sales (owner): `curl -H "authorization: Bearer $READ_TOKEN" https://a-to-mind.com/api/earnings`. The response has `earned_cents`, `sales`, `by_offer` (Gumroad permalink) and `by_page` (the `utm_campaign` the buy links carry: the fix page's slug, the service page's id, or `v01d-store`).
- Views and presses (anyone): `https://a-to-mind.com/api/tally?of=offer-view` and `?of=offer-click`.
- Visits: `domains/traffic.json` (tools/traffic.mjs), and `/fix/`, `/store/` and the service pages now send the visit beacon too.

## Adding to it

- **A new offer page:** give it `<meta name="offer" content="<id>">`, `data-offer-click="<id>"` on its buy link, and `/offer.js` plus `/visit.js`. Then add the id to `offerIds()` in `tools/fix-pages.mjs`, which writes the closed list `lib/offer-ids.js`. The counter refuses any id not on that list.
- **A new error source:** add a row to `domains/earn.sources.json`. Use an official host only, a `link` regex for its pages, and a `heading` regex when the errors are headings. Add a test fixture in `tools/earn.test.mjs`.
- **A new comparable price:** add a row to `domains/earn.comps.json` with `who`, `cents`, `seen` and `source`.

## What worked and what did not (first run, 2026-10-26)

- The money-path audit found these, all fixed:
  - The Full Stack Audit page said $325 while its Gumroad listing and the store said $300.
  - The store showed Keep-It-Running as "$49" instead of "$49 a month".
  - The Code Review Pro plans read "On its own" and "Paid Verse" in place of prices, and the buy button was hidden whenever `/api/review` was slow.
  - The First Automation Setup page claimed "most of our setup customers…" with no sales.
  - The store had no way back when its catalog failed (an empty grid) and still said V01D.
  - Fix pages put the paid offer only at the very bottom.
  - Nothing counted views or presses per offer, and earnings had no breakdown per product or page.
- Mistakes made: the loop's first draft quoted the owner with a word the "no builder's model" test forbids. Paraphrase in these files. The error heuristic was case-sensitive at first, so "Bad request" was missed.
- Open, needs the owner (no API for it here): the Gumroad listing prices change only on Gumroad. The repo holds no Gumroad API token, so when Verse's appraisal moves, `prices.json` says `gap` until the listing follows.
