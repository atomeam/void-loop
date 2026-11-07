# Base Ecosystem Fund: draft application for Verse

- Program page: https://www.base.org/ecosystem-fund ; apply form: https://www.base.org/ecosystem-fund/apply
- Gives: pre-seed and seed capital, invested with Coinbase Ventures; hands-on support with partner integrations and
  distribution; partner credits (AWS, Azure, Alchemy, Spindl ad credits); priority access to Coinbase Prime, Coinbase
  Business and the Coinbase Onramp API. No check size stated. This is an equity-style investment, not a grant.
- Who it backs: startups that "choose Base as their home", building onchain businesses with real economic activity.
  The July 16, 2026 "Request for Builders" post (https://www.base.org/blog/request-for-builders-1) lists payments,
  stablecoins and agents among its focus areas and points applicants to this form.
- Deadline: none stated (rolling). Questions: https://www.base.org/contact-us?interest=ecosystem-fund
- Form sections: Company, Team, Idea, Funding, Why Base. Only the Company section's fields were visible without
  starting the form; the other sections below use standard questions. Re-map them to the real fields when filling it in.

[Adam: this fund invests in companies. Decide whether you want outside investment and whether to form an entity first.]

---

## Company

**Company Name**
Verse [Adam: legal entity name, or say not incorporated yet]

**What are you building?**
Verse sells AI work per call to agents and people. Seven services (code review, answers, fixes, translation, digests,
appraisals and images) each cost 0.05 USDC per call over x402 on Base, with no account or API key. The same services are
available as paid tools on Verse's MCP server and, soon, as pay-per-review in a GitHub Action for pull requests.

**Website URL**
https://a-to-mind.com

**X URL**
[Adam: https://x.com/<handle>]

## Team

- Founder: Adam ("Atom"), solo. [Adam: legal name, location, background, prior companies.]
- Contact: atom@a-to-mind.com
- Funding raised to date: none.
- Adam built and operates the whole product alone: the site and APIs on Cloudflare Workers and Pages, the x402 payment
  layer (v1 and v2), the MCP server listed in the official MCP registry, and the review Action, with a multi-agent build
  pipeline shipping to the public repository github.com/atomeam/void-loop.

## Idea

- Problem: agents increasingly buy work on behalf of people, but most AI services still need sign-up, an API key and a
  subscription. An agent can hold a wallet; it can't fill out a sign-up flow for every service.
- Product: priced, single-purpose services an agent can find in a catalog (GET /api/x402), pay for inside the HTTP request
  (x402), and get a result from in one round trip. Discovery is through the x402 Bazaar extension and the MCP registry.
- What is live: paid calls on Base mainnet since 2026-11-06; endpoints POST /api/x402/review, /answer, /fix, /translate,
  /digest, /appraise, /image; MCP paid_* tools through x402's MCP transport; settlement by the PayAI facilitator into a
  self-custody wallet.
- Trust model: Verse never holds customer funds or keys, and counts income only after on-chain confirmation.
- Traction: none yet beyond going live. [Adam: confirmed on-chain paid calls and USDC received at the time you apply.]

## Funding

- Raised so far: none. Revenue so far: none (payments live since 2026-11-06).
- Looking for: [Adam: amount and instrument, if any].
- Use of funds: model inference for paid calls while volume grows; the pay-per-review GitHub Action; Base Builder Code
  attribution and Bazaar indexing for every service; more paid services picked from real call data; public, chain-verified
  usage reporting.

## Why Base

- Per-call prices of 0.05 USDC need cheap, fast settlement in a dollar stablecoin; USDC on Base provides that.
- x402 on Base is where agent buyers already are: Base's own May 29, 2026 post ("The Agentic Economy Is Here") reports
  about 3.1M x402 transactions on Base in the prior 30 days.
- Base is Verse's only payment network (eip155:8453). [Adam: confirm Base stays the primary chain.]
- Next on Base: register a Builder Code and attribute every settlement to it, so Verse's activity is visible to Base.

## Links

- Site: https://a-to-mind.com
- Paid catalog: https://a-to-mind.com/api/x402
- MCP server: https://a-to-mind.com/api/mcp (registry: io.github.atomeam/void)
- Repo: https://github.com/atomeam/void-loop
- Demo: [Adam: video link]
