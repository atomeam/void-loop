# Life arbitrage (private)

Owner, 2026-11-06: "make another arb scanner only we can use for life itself, theres arbitrage we are not considering all around us".
Live at **https://a-to-mind.com/life-arb/**, readable only with the owner key (the same key the rest of Verse uses, kept on the device).
The public, paid market scanner is a different build; this one is for Atom's own life and Verse's own work.

## What it is

Real gaps between what something costs Atom (money and minutes) and what it is worth, ranked by **net value per hour of his time,
deadlines first**:

1. anything that closes within 7 days, soonest first;
2. then by what the value is: cash, then the retail price of a free item, then credits, then a prize pool (an upper bound shared by
   every winner, never an expected win), then unknown;
3. then net value per hour (value minus cost, over Atom's minutes), then the nearer deadline.

Every opportunity shows its source address, the evidence the source itself gave, the value (only a number the source states; null
otherwise), the cost, Atom's minutes (an **estimate** per kind of step, with its basis, `MINUTES` in `lib/life-arb.js`), the deadline, the
risk, who does it (Atom, Verse or both), the next step, and the asks that wait on his yes.

## Sources (all public, each cited)

- Verse's own daily found-money scan, `/treasury/found.json` (`tools/found-money.mjs`): hackathons, code bounties, settlements, credits,
  grants, unclaimed property, payouts, affiliate programs, upsells on Verse's busiest pages.
- GamerPower's public giveaway API: free games and DLC, their stated worth and end date.
- Devpost's open hackathon API: online, open hackathons and the end of each submission period.
- Top Class Actions' public open-settlements feed: claim deadlines and the per-claim cap when a post states one.

A source that does not answer is shown as not reached and adds nothing. What cannot be scanned without an account only Atom can open
(resale prices, paid studies) is listed under "Not scanned yet" as an ask.

## How it runs

- `.github/workflows/life-arb.yml` asks the site to scan every 6 hours (`POST /api/life-arb {action:'scan'}`, no secret). Without the owner
  key a scan runs at most once every 3 hours and answers counts per source only, never an opportunity; the log is public, so it holds
  counts only.
- An owner read older than 6 hours starts a fresh scan in the background; "Scan now" on the page runs one (at most every 10 minutes).
- Results live in D1 `void_life_arb` (`k = 'scan'`, and `mark:<id>` for what Atom took or skipped).
- Jobs Verse can do alone (a hackathon entry draft, an upsell on its own page) go onto Verse's build queue (`void_queue`, target
  `lifearb:<id>`), one per opportunity ever, never more than three open at once.

## Never

It finds and ranks only. It places no trade, makes no bet, buys nothing, sends no money, opens no account, accepts no terms and files no
claim. Each of those is listed as an ask and waits for Atom's own yes. It is never listed: not in llms.txt, the sitemap, openapi.json or
x402 discovery, and the page is `noindex`.
