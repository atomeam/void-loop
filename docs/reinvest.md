# How Verse reinvests its own money

Adam, 2026-10-15: "Verse can repurpose its own money in the smartest possible way." The repo is public, so this page and
`domains/void.reinvest.json` hold only the ranking and plan logic (candidates at their public list prices). Real income,
reserve and spend amounts never land here: they stay behind owner-only APIs.

## Where the money comes from

Store sales and tips through Gumroad (each ping recorded in D1 `void_sales`), and Stripe once it is turned on. The allocator
reads net earnings (after refunds and lost disputes) from the existing owner-only `GET /api/earnings`, in memory only. There
is no second income ledger, and no money figure is shown on the site.

## How it is split (lib/reinvest.js, daily via .github/workflows/reinvest.yml)

1. **Reserve first.** At least 20% of every new dollar is kept as a safety buffer and never spent.
2. **Free first.** Every item with a free path (free tiers, own code, edge caches, free promotion) is done before
   anything is bought. A paid item can be funded only once its free path is used up, or when a live outage can't wait.
3. **ROI per dollar.** The rest goes to the eligible items with the best expected return per dollar: things that unlock
   revenue (Workers Paid lifting the AI caps, Stripe, business email, the domain, ads-free promotion), then speed (compute
   minutes) and quality. Monthly items are funded three months ahead. What doesn't fit yet is saved toward the best next item.
4. **Honest payoff test.** Before each spend, the one metric it should move (sales, sign-ups or misses fixed), its baseline
   now and a check date (30 days on) are recorded with the proposal. On the check date the metric is measured again and
   compared with that baseline; only that comparison moves the kind's multiplier (`payoff()`, `learn()`). No baseline or
   no measurement: nothing is learned.
5. **Verse's own voice.** Verse is asked (tools/ask-void.mjs) how it would reinvest; its answer, logged word for word in
   docs/void-voice.md, bends the ranking at weight 0.3. Input, not a gate.

## Who spends it

Verse holds no card, opens no account and stores no payment details. A funded item becomes a **spend proposal** on the existing
confirm line (`POST /api/approval`, `order.place`): item, cost, expected payback, check-by date and the payoff test, all
owner-only in D1. It is marked **ready** when it is bought through an account Adam already pays for (Cloudflare, GitHub,
Gumroad); otherwise **queued**. Every real payment is made by Adam from his own accounts; a yes on the line records the
approval, and nothing is bought automatically.

## The plan for a hypothetical first $100

<!-- plan -->
_As of 2026-10-31. Rewritten daily by tools/reinvest.mjs._

**The first $100:** keep $20 in reserve; do every free path first (below); fund 3 items for $40.50; hold $39.50 for the next item that becomes worth buying (re-ranked daily).

| Spend proposal | Cost | Status | Why | Expected return |
| --- | --- | --- | --- | --- |
| a-to-mind.com renewal, set aside (Cloudflare at-cost .com, about $10.50/yr) | $10.50 | ready | the store and every film link live on the domain; losing it would end all revenue | the domain never lapses |
| Cloudflare Workers Paid | $15 | ready | the free AI cap was hit (125% on Oct 14): answers fail after it, and every failed answer is a lost visitor or sale | no more capped answers; 10M requests and 1M KV writes a month |
| a small test batch of printed Forge models (V01D's 'micro-business test') | $15 | queued | V01D asked for a tiny product test; physical prints show whether people pay for the objects, not just the files | first physical-goods sale or a clear no |

**Free first ($0, built before anything is bought):**

- Turn on Stripe for fixed-price checkout (no monthly fee; per-sale fee only)
- Ads-free promotion: post every V01D film as a Short, list V01D in AI directories and the MCP registry (live), share store packs
- CI compute: keep the public repo on GitHub's free runners and trim the slowest workflows
- stay under Workers AI's free 10k neurons/day and 1k KV writes/day (wishlist 1 and 2: gemma, edge cache)
- Cloudflare Email Routing to Adam's inbox (free) plus the bot inbox
- keyless CoinGecko behind a 2-minute edge cache (live), then the free Demo key
- official embeds, Bluesky and Mastodon (live)

**Verse's own answer as input** (weight 0.3): it named reserve 40%, quality 30%, revenue 30% among the kinds it can fund; the reserve it asked for is 20% (the floor is 20%). Not fundable: $50 for "Buy fractional shares or a diversified ETF" (Verse holds no brokerage or bank account and none is opened for it; that share stays in the held fund).

**Learned so far** (outcome multipliers, 1 = no evidence yet): revenue 1, speed 1, quality 1.
<!-- /plan -->
