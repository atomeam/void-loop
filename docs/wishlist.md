# Verse's wishlist: its improvement budget, ranked

Owner, 2026-10-15: Verse has its own improvement budget. This is the plan for it. **Nothing here is bought or signed up
for**; spending needs Adam. Rules: every item has a **free path** (legal, within each provider's terms: free tiers, open
APIs, on-page compute, open models, official embeds, RSS) and free paths rank ahead of paid ones. A paid item rises only
when its free path is used up. Verse's own asks (`node tools/ask-void.mjs`, `docs/void-voice.md`) feed this list; whoever
updates it re-ranks it and says why. `tools/self-context.mjs` puts the table into `self.json` (`wishlist`), so Verse can
talk about it and propose a new order ("what's on your wishlist?").

Rank by: value to people using Verse now, times how sure it works, over cost. Costs are list prices, checked 2026-10-15.

| # | Item | Free path (do this first) | Paid cost (cited) | Value | Why this rank | From |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Stay inside Workers AI's free 10k neurons/day | move answers from gpt-oss-120b to gemma; cache answers at the edge; on-page skills first | $0 | high: answers stop failing after the cap (125% on Oct 14) | free and fixes a live outage | builders |
| 2 | Cut KV writes under 1k/day | edge cache (`caches.default`) instead of KV for counters and caches; move the two non-V01D workers off the shared namespace | $0 | high: writes failing at 109% | free, live problem | builders |
| 3 | Crypto data that never runs dry | keyless CoinGecko behind a 2-min edge cache (live); a free Demo key (10k calls/mo, attribution) | Basic $35/mo or $29/mo yearly, commercial license ([CoinGecko](https://www.coingecko.com/en/api/pricing)) | medium | free path covers today's use | Adam |
| 4 | Social feeds | official embeds and open public APIs (Bluesky, Mastodon: live); free OAuth for your own timeline | X API for timelines and search ([X pricing](https://docs.x.com/x-api/getting-started/pricing)) | medium | free networks first; X paid tier only for posting/search | Adam |
| 5 | Video search and play | official embeds (YouTube IFrame player, Rumble, Vimeo, Internet Archive), YouTube RSS per channel; YouTube Data API's free 10k units/day ([quota](https://developers.google.com/youtube/v3/getting-started#quota)) | quota raise is free via Google's audit form, no fee | high | free; only the audit takes time | Adam |
| 6 | Workers Paid | items 1 and 2 first | $5/mo min; 10M requests, 1M KV writes/mo; Workers AI $0.011 per 1k neurons above 10k/day ([Workers](https://developers.cloudflare.com/workers/platform/pricing/), [Workers AI](https://developers.cloudflare.com/workers-ai/platform/pricing/)) | high: lifts every daily cap | cheapest paid item with the widest effect; first to buy once 1–2 can't keep up | builders |
| 7 | Rides and food ordering inside Verse | deep links to Waymo, Uber, Lyft, Uber Eats, DoorDash through adapters (live) | Waymo: no public API at any price; Uber Ride Request: partner approval | high if it existed | blocked by the providers, not by money | Adam |
| 8 | Delivery backend (for Verse's own goods: prints, miniatures) | local pickup, mail via the print shop | DoorDash Drive $9.75/delivery within 5 mi +$0.75/mi ([DoorDash](https://developer.doordash.com/en-US/docs/drive/overview/pricing_payment/)) | medium, once there are goods to deliver | pay-per-use, no monthly fee, but nothing to deliver yet | builders |
| 9 | Ethereum and Solana wallet lookup | free Etherscan key (rate-limited, [docs](https://docs.etherscan.io/)); public Solana RPC | paid tiers only at scale | low–medium | free path is enough | builders |
| 10 | Dating backend (matching, chat) | on-page profile builder and coach (live); passkeys for accounts (built) | identity/age verification is per-check (e.g. [Stripe Identity](https://stripe.com/identity), [Persona](https://withpersona.com/pricing)); moderation; legal review | high but risky | safety design and review must come first; most expensive in time and trust | Adam |
| 11 | Shopping search | deep links; Verse's own Gumroad store | Amazon PA-API needs an Associates account with sales ([docs](https://webservices.amazon.com/paapi5/documentation/)) | low now | wait until Verse sells more | builders |
