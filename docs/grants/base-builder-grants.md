# Base Builder Grants: draft application for Verse

- Program page: https://docs.base.org/get-started/builders
- Form: https://forms.gle/urqjBJYJjR6Vqqre6 (Google Form "Base Builder Grant Program: Application")
- Gives: up to $5,000 in early seed capital plus GTM and product support. Accepted teams can unlock Builder Stack credits.
- Deadline: none stated; "Apply to be included in our next cohort." Applicants are contacted after review.
- The form says applicants should have a live product in use and need product, GTM and launch help more than capital.

Before submitting:
- Get a Base Builder Code (dashboard.base.org, Settings, Project Settings, Builder Code) and declare it on every x402
  route as the `builder-code` extension. Check that the facilitator writes it into settlement calldata (the CDP
  Facilitator does; PayAI's support is not documented). Without this, question 15 has no answer.
- Record a short Loom demo (question 9).
- Fill usage numbers only from confirmed on-chain settlements (question 12).

The answers below follow the form's questions in order. All are required on the form.

---

**1. Email**
[Adam: atom@a-to-mind.com or another address]

**2. Full name**
[Adam: full legal name]

**3. Email** (the form asks twice)
[Adam: same address]

**4. X (Twitter) handle**
[Adam: handle]

**5. Telegram username**
[Adam: Telegram username]

**6. Project name + one-line description of what it does**
Verse (a-to-mind.com): AI services that agents and people pay for per call, 0.05 USDC each over x402 on Base, with no
account or API key.

**7. Tell us about the founding team** (prior companies/exits, funding raised, relevant domain expertise)
Solo builder: Adam ("Atom"). No outside funding raised. [Adam: prior companies or exits, if any.] Adam built and runs
all of Verse alone: the site and its APIs on Cloudflare Workers and Pages, the x402 payment layer (v1 and v2), the MCP
server and the GitHub Action, and the multi-agent automation that builds, tests and merges changes to the open
repository github.com/atomeam/void-loop.

**8. Link to your live product**
https://a-to-mind.com
Paid service catalog: https://a-to-mind.com/api/x402

**9. Link to a Product Demo (Loom)**
[Adam: Loom link. Suggested 2-minute flow: GET /api/x402 shows the catalog; an unpaid POST /api/x402/review returns 402
with the price; a paying client signs, the facilitator settles on Base, the result comes back with the settlement header;
the transaction on Basescan landing in the wallet; the same service called as a paid_* MCP tool.]

**10. Contract address on Base**
Verse does not deploy its own contract. Payments settle as USDC transfers (Circle USDC on Base) into Verse's self-custody
wallet. Receiving wallet: [Adam: 0x... wallet address]. [Adam: confirm whether to give the wallet, the USDC token
contract, or both. Do not invent a contract.]

**11. Which track best fits what you're building?**
Agents / Agentic Commerce

**12. Share your key usage numbers** (all-time users, DAU, WAU, all-time volume, last-30-day volume)
Paid calls went live on 2026-11-06, so there is no history yet and no revenue yet. Verse counts income only after on-chain
confirmation. As of [Adam: date]: [Adam: number of confirmed paid calls] paid calls, [Adam: USDC] all-time volume,
[Adam: USDC] in the last 30 days. Users, DAU and WAU: [Adam: fill only from a real count, or write "not tracked yet".]

**13. How does your product make money today?**
Per-call fees. Seven services (review, answer, fix, translate, digest, appraise, image) each cost 0.05 USDC per call,
paid over x402 on Base into Verse's own wallet. The same services are sold as paid_* tools on Verse's MCP server through
x402's MCP transport, and a pay-per-review mode is being added to Verse's GitHub Action for pull-request reviews. Revenue so
far: none; payments went live on 2026-11-06.

**14. What's your GTM plan for the next 3 months?**
1. Discovery where agents already look: the services are declared for the x402 Bazaar extension, and the MCP server is in
   the official MCP registry (io.github.atomeam/void). Next, make sure each service is indexed by Bazaar and get listed in
   the x402 ecosystem directories.
2. Developers through GitHub: ship the pay-per-review mode of the review Action so any repository can pay per pull-request
   review from a funded wallet, with no subscription.
3. MCP clients: publish the paid_* tools with examples so agent builders can call them with an x402 client.
4. Content: short public write-ups of each service with a working curl / client example and its on-chain receipt.
5. Measure only from chain: weekly confirmed paid calls and USDC received, published from real settlements.

**15. What's your Base Builder Code?**
[Adam: Builder Code from dashboard.base.org. Not registered yet at the time of drafting.]

**16. What is the primary challenge or bottleneck you are currently facing as you grow your project?**
User acquisition

**17. Which credits would be most useful for you as you build? (e.g. Privy, AWS, etc.)**
LLM inference credits first (each paid call runs model inference), then Coinbase Developer Platform credits (CDP
Facilitator for settlement and Bazaar indexing), and RPC credits (Alchemy or QuickNode) for confirming payments on chain.
