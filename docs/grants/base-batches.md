# Base Batches: draft application for Verse (for the next batch)

- Program pages: https://www.base.org/batches and https://docs.base.org/get-started/base-batches.md
- Gives: $100K investment from the Base Ecosystem Fund for selected teams, an 8-week virtual program with a dedicated
  advisor and weekly support, content capture, and a Demo Day in front of investors. This is an investment, not a grant.
- Eligibility (from the page): early stage (pre-product to post-MVP, no formal Seed round raised); strong conviction;
  Base first (Base as the default network); focus areas trading, payments, agents, financing and asset issuance.
- Status on 2026-11-06: Batch 004 is closed (applications Aug 19 to Sep 10; program Sep 29 to Nov 15; Demo Day Nov 17,
  2026 in New York). No date for Batch 005 is published; the program runs twice a year and the apply page says to follow
  Base on X for announcements. Apply at https://www.base.org/batches/apply once it reopens.
- The page lists no application questions while closed, so this draft uses standard sections. Re-map it to the real
  questions when Batch 005 opens.

[Adam: Batches invests in a company. Decide whether to form an entity and whether a solo founder is acceptable; the FAQ
lists a "team types" question but its answer is not shown on the page.]

---

## Company

- Name: Verse [Adam: legal entity name, or "not incorporated yet"]
- Website: https://a-to-mind.com
- Repository: https://github.com/atomeam/void-loop
- Country: [Adam: country]
- Contact: atom@a-to-mind.com
- X: [Adam: handle]

## One line

Verse sells AI work per call to agents and people, 0.05 USDC per call over x402 on Base, with no account, no API key and
no custody of anyone's funds.

## What it is

Verse is a site where anything someone asks appears as a card. Behind it are services an agent can call and pay for in the
same HTTP request:

- Seven paid endpoints: POST /api/x402/review, /answer, /fix, /translate, /digest, /appraise and /image, 0.05 USDC each on
  Base (eip155:8453). A machine-readable catalog is at GET /api/x402.
- x402 v1 and v2 both supported; the services are declared for the x402 Bazaar discovery extension.
- An MCP server at https://a-to-mind.com/api/mcp, listed in the official MCP registry as io.github.atomeam/void, whose
  paid_* tools charge through x402's MCP transport (`_meta["x402/payment"]`).
- A GitHub Action (atomeam/void-loop/review) that reviews pull requests, getting a pay-per-review mode over x402.

## What is live today

- Paid x402 calls on Base mainnet went live on 2026-11-06.
- Settlement runs through the PayAI facilitator into Verse's self-custody wallet. Verse never signs for, holds or moves a
  customer's funds or keys; income is counted only after on-chain confirmation.
- Revenue to date: none (live as of 2026-11-06). [Adam: update with confirmed on-chain figures at application time.]

## Team

Solo founder: Adam ("Atom"). [Adam: background, prior companies, location.] No outside funding raised. Adam built the
whole stack alone on Cloudflare Workers and Pages and runs a multi-agent build pipeline that ships changes to the public
repository continuously.

## Why Base and x402

- Payments of 0.05 USDC only make sense where settlement is cheap and fast; Base with USDC makes a per-call price workable.
- x402 lets an agent pay inside the HTTP request it was already making, so there is no sign-up step between an agent and
  a service. Verse is built for buyers that are programs.
- Base is the default and only network Verse sells on. [Adam: confirm you commit to Base as the primary chain, which the
  program requires.]

## Insight

AI work is being bought more and more by agents, not people. Agents can't fill sign-up forms or hold API keys for every
service, but they can hold a wallet. Small, priced, single-purpose services that answer one call for one payment are the
shape that fits them, and code review is the first place where developers already accept paying per unit of work.

## What the investment would build (8 weeks and after)

1. Pay-per-review GitHub Action live: any repository pays per pull-request review from a funded wallet.
2. Discovery: Base Builder Code attribution on every settlement, Bazaar indexing for every service, and listings in the
   x402 and MCP directories.
3. More paid services chosen from what agents actually call, priced per call.
4. Public, chain-verified metrics: confirmed paid calls and USDC received per week.

## Milestones

- [Adam: Week 2: pay-per-review Action released]
- [Adam: Week 4: Builder Code attribution and Bazaar indexing confirmed on chain]
- [Adam: Week 8: target for weekly confirmed paid calls. Set it from real data; do not guess]

## Links

- Site: https://a-to-mind.com
- Catalog: https://a-to-mind.com/api/x402
- MCP server: https://a-to-mind.com/api/mcp (registry name io.github.atomeam/void)
- Repo: https://github.com/atomeam/void-loop
- Demo video: [Adam: link]
