# Funding programs for Verse (x402 on Base): checked 2026-11-06

Read-only research on each program's own pages. Nothing was submitted, signed in to or registered.
Verse facts used: 7 pay-per-call services at 0.05 USDC on Base over x402 (v1 and v2), PayAI facilitator, self-custody
wallet, MCP server with paid_* tools, a pull-request review GitHub Action; payments went live 2026-11-06; no revenue yet.

| Program | Official URL read | Gives | Deadline | Fits Verse? | Draft |
| --- | --- | --- | --- | --- | --- |
| Base Builder Grants | https://docs.base.org/get-started/builders (form: https://forms.gle/urqjBJYJjR6Vqqre6) | Up to $5,000 plus GTM and product support; Builder Stack credits if accepted | Rolling, none stated ("next cohort") | **Yes**: "agents (commerce, x402 ...)" is a named area. Blockers: the form requires a Base Builder Code and a "Contract address on Base" | [base-builder-grants.md](base-builder-grants.md) |
| Base Batches | https://www.base.org/batches , https://docs.base.org/get-started/base-batches.md | $100K investment from the Base Ecosystem Fund, 8-week virtual program, Demo Day | Batch 004 closed Sep 10, 2026 (Demo Day Nov 17, 2026). Next batch not announced; runs twice a year | **Yes, for the next batch**: pre-seed, Base-first, focus areas include payments and agents. Not open today | [base-batches.md](base-batches.md) |
| Base Ecosystem Fund | https://www.base.org/ecosystem-fund , https://www.base.org/ecosystem-fund/apply | Pre-seed / seed investment with Coinbase Ventures, partner credits, Coinbase access | Rolling, none stated | **Yes, if Adam wants equity investment** (it is an investment, not a grant; needs a company) | [base-ecosystem-fund.md](base-ecosystem-fund.md) |
| Base Builder Stack (credits) | https://docs.base.org/get-started/base-services-hub.md | Partner credits and discounts (e.g. Alchemy, QuickNode, CDP) | Per provider | Yes, but each provider is claimed on its own; no application to draft | none |
| Base Builder Quests | https://docs.base.org/get-started/builders | Rewards for themed challenges, amounts not stated | Announced on the Build on Base X account | Unknown until a quest is posted | none |
| CDP Builder Grants (Coinbase Developer Platform) | https://www-marketing.coinbase.com/developer-platform/discover/launches/summer-builder-grants | Past rounds: $30K across 13 projects (Summer 2025) | No open round found | **No open round** today | none |
| CDP / x402 docs | https://docs.cdp.coinbase.com/x402/support/faq | No grants; Bazaar listing is automatic | n/a | n/a (see note on Bazaar below) | none |
| x402 Foundation | https://www.x402.org , https://x402.org/get-involved/ , https://x402.org/announcements/ | No grants, bounties or funding listed; working groups and membership only | n/a | **No** funding program exists | none |
| Optimism Retro Funding / Superchain grants | https://optimism.io/blog/season-9-from-experiment-to-organization , https://gov.optimism.io/t/season-9-governance-fund-missions/10526 , https://gov.optimism.io/t/s8-retro-funding-missions/10003 | Retro Funding paused "for at least the next 12 months" (Jan 8, 2026). Season 9 Grants Council funds DEX TVL on lending pairs, needs own contracts | n/a | **No**: paused, and current missions target DeFi liquidity | none |
| Gitcoin Grants | https://gitcoin.co/campaigns , https://grants.gitcoin.co/ , https://gitcoin.co/campaigns/gitcoin-grants-24-gg24 | Last round GG24 ended Oct 2025; ongoing campaigns are TheDAO Security Fund and Protocol Guild | No open round | **No** open round for x402 or Base | none |
| PayAI Grants Program | https://payai.gitbook.io/payai-docs/updates/grants-program | 0.2 to 3 SOL per agent (onboarding, service bounty, innovation) | "Applications open Monday, March 10" with no year; rolling; no form link on the page | **Unconfirmed**: paid in SOL, needs a PayAI marketplace listing, page undated | none (ask PayAI whether it still runs first) |
| SKALE x402 Agentic Commerce Hackathon | https://blog.skale.space/blog/skale-google-coinbase-virtuals-edge-node-and-vodafone-present-the-sf-agentic-commerce-x402-hackathon-with-50-000-in-prizes | $50K prizes | Feb 11 to 13, 2026 (past) | **No**: over | none |

## Things to fix before applying (from the official docs)

1. **Base Builder Code.** The Base grant form asks "What's your Base Builder Code?" and the builders page calls integrating
   Builder Codes the first step toward eligibility. Register a project on https://dashboard.base.org/ (Settings, Project
   Settings, Builder Code). For x402 the seller declares it per route as the `builder-code` extension in the 402 response
   (`extensions["builder-code"] = { a: "<code>" }`, docs.x402.org/extensions/builder-code); the facilitator then appends it to
   the settlement calldata (ERC-8021 Schema 2). The CDP Facilitator does this; the docs do not say whether PayAI does.
   The repo has no builder code today (`void-live-deploy/lib/x402.js` declares only the `bazaar` extension).
2. **Bazaar indexing.** The CDP FAQ says a CDP Bazaar listing is triggered by "one successful paid call through the CDP
   Facilitator" and there is no registration form. Verse settles through PayAI, so CDP's Bazaar may never index it. The CDP
   Facilitator's free tier is 1,000 onchain transactions a month, then $0.001 each.
3. **"Contract address on Base"** is a required field on the Base grant form. Verse deploys no contract; the honest answer is
   the receiving wallet plus the USDC contract it settles in. [Adam: decide what to put.]
4. **No LICENSE file** at the repo root. If the repo is meant to be open source, add one before reviewers look.
5. **Usage numbers** are required on the Base form. Payments went live 2026-11-06; fill in only confirmed on-chain figures.

## Files

- docs/grants/base-builder-grants.md
- docs/grants/base-batches.md
- docs/grants/base-ecosystem-fund.md
