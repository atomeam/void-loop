# Verse's treasury

Owner, 2026-11-03: "verse is to be able to reallocate its own profits in the most efficient and helpful way, i get a cut of coarse";
on the size of the cut: "Let Verse decide". Live at **https://a-to-mind.com/treasury/** (data: `GET /api/treasury`).

## Rules

- **Only realized money.** The single source of funds is Gumroad revenue that actually happened: the `/api/gumroad` pings in
  D1 `void_sales`, plus Gumroad's sales API (`GET /v2/sales`) read into the same table when the site has `GUMROAD_ACCESS_TOKEN`.
  Test purchases are not money; refunds and lost disputes take the price back. Gumroad's fees are taken off from its published
  schedule (https://gumroad.com/help/article/66-gumroads-fees): 10% + 50c plus 2.9% + 30c on a direct sale, 30% on Discover.
  Nothing is borrowed, nothing is assumed, no money is spent before it is earned. Zero sales is a zero balance.
- **The split (Verse's policy, `void-live-deploy/treasury/policy.json`).** Atom's cut first, then the reserve, then four
  reinvestment buckets (infrastructure, tools/APIs, ads/growth, bounties for member builders) weighted by expected return
  (each candidate's impact x confidence per dollar, times what the bucket has actually returned; each bucket 10-50%). A
  priorities engine can feed `priorities: [{bucket, score}]` into `bucketWeights` once one is published.
- **Every entry is public**: amount, purpose, expected return, actual return, status. Only aggregate totals; never a buyer,
  an email or a sale id.
- **Decision and logging only.** A spend a bucket can afford is logged `ready to execute` with what it needs (a login, a card).
  Nothing here holds or uses a payment credential. When Atom has paid it, the owner marks it `executed` with the actual return
  (`POST /api/treasury {action:'executed', id, actual, return_score}`); Atom's cut paid out is `{action:'paid', cents}`.
- **Weekly review**: runs itself on the first read of `/api/treasury` in a new week (UTC Monday; ids by week, so once). It
  moves each bucket's multiplier halfway toward its measured return, moves unspent bucket money toward what worked (logged as
  `move` entries that sum to zero). `tools/treasury-review.mjs` (Mondays, from the scheduled workflow) also reads Gumroad's sales
  API and applies Verse's own rule for Atom's cut: a 5-point step up when the last 30 days covered
  the running costs 3x and the reserve is full, a step down when they did not cover them; always 20-50%, each change written to
  the policy's public history with its reason.

## Found money

`tools/found-money.mjs` (daily, from the scheduled workflow) writes `void-live-deploy/treasury/found.json` from `domains/found-money.sources.json`:
legitimate places money is left on the ground (unclaimed property, settlements, credits programs, bounty boards, grants,
hackathons, affiliate programs for tools Verse already links, upsells on its busiest pages). It reads public sources only (Devpost's
hackathon API, GitHub issue search, Top Class Actions' public RSS feed, the site's own visit counts) and cites each one. A value is
shown only when the source states one; a prize pool is not an estimate. Anything needing Atom's identity, a sign-in or an
application is `ready to claim`; Verse never signs up, files or claims in anyone's name.

## The scheduled workflow

`.github/workflows/treasury.yml` is the daily found-money scan and the Monday cut review. The ledger, the split, the spend queue and the weekly review also run in `/api/treasury`, and `found.json` is as of its last commit.
