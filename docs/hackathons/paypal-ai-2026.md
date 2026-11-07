# PayPal AI Hackathon 2026: Verse Code Review, paid with PayPal

- Event: https://paypalaihackathon.devpost.com/ (rules: /rules). Deadline Nov 12, 2026, 12:00 PM Pacific (3:00 PM Eastern).
- Rules that shape this entry: individuals may enter; an existing project counts if it was significantly updated during the
  submission period (Oct 1 to Nov 12), and the entry must say how; PayPal must be central and used through the sandbox; a working
  demo (hosted URL or run steps); a public repo with an open-source license file; a public YouTube video under 3 minutes; no
  third-party trademarks or music without permission.
- Prize lines it fits: Best Use of Agentic Commerce, Best Use of PayPal + AI, the overall prizes.

## What was built during the submission period

`lib/paypal.js`, `functions/api/paypal/`, the PayPal button on `/code-review/`, tests in `tools/paypal.test.mjs` (Nov 6, 2026).
Verse's code review already existed (rules, an AI closer read, a GitHub Action, x402 pay-per-call in USDC); PayPal checkout is new.

## Devpost text (draft, Atom pastes it)

**Name:** Verse Code Review, paid with PayPal

**Tagline:** An AI code reviewer that people and their agents can buy one read at a time with PayPal: no subscription, no account.

**What it does.** Paste code on a-to-mind.com/code-review/ (or POST it to the API) and Verse runs its instant checks for bugs and
security holes. For one dollar it adds the closer read: an AI reviewer that confirms the real findings, drops the wrong ones and adds
what the patterns missed. You pay with PayPal, and you only pay for a review you get.

**How PayPal is used.** Orders v2 on the REST API. Verse creates an order whose custom_id is a SHA-256 hash of the exact code to
review, so an approved order pays for that code and nothing else. The buyer approves it on PayPal. Verse reads the order back,
checks it is approved, for this code and for the full price, runs the AI read, and only then captures the payment; the read is
released only on a COMPLETED capture of the full amount. If the model is busy, nothing is captured and the same order can be tried
again. A used order cannot buy a second review. Sandbox by default; a single setting switches it to live.

**How AI is used.** The closer read runs on Cloudflare Workers AI (OpenAI's gpt-oss-120b). Every finding it makes must quote a line
of the submitted code; findings that quote nothing, quote text that is not there, or repeat known false claims are dropped before
the buyer sees them.

**Agentic commerce.** The same checkout is an API (`GET /api/paypal`, `POST /api/paypal/review`, listed in `llms.txt` and
`openapi.json`), so an AI agent can order a review for code it wrote, hand the PayPal approval link to its person, and collect the
read once it is approved. Agents that hold their own wallets can pay the same review per call in USDC over x402 instead.

**What's next.** Count live PayPal income in Verse's public treasury (only realized money, after fees) and sell Verse's other
services through the same checkout.

**Built with:** PayPal Orders v2 REST API (sandbox), Cloudflare Pages Functions, Workers AI, JavaScript.

**Try it:** https://a-to-mind.com/code-review/ (the "Closer read with PayPal" button appears once the sandbox keys are set).
Run steps: `node tools/paypal.test.mjs` runs the whole flow against a faked PayPal; with sandbox keys, the page runs it for real.

## Video script (about 2 minutes 30 seconds; Verse's own voice or Atom's, no music)

1. (0:00) The code-review page. "This is Verse. Paste code and it finds bugs and security holes in about a second, for free."
   Paste the login function with the SQL injection; press Review it; the findings appear.
2. (0:20) "For a dollar, an AI reviewer takes a closer look. You pay with PayPal, and you only pay for a review you get." Press
   Closer read with PayPal.
3. (0:35) The PayPal sandbox checkout opens; log in with a sandbox buyer; approve.
4. (0:55) Back on Verse: "reading your code, then capturing the payment". The closer read appears; the line says paid with PayPal.
5. (1:15) Show the order in the PayPal sandbox dashboard: captured, $1.00.
6. (1:30) Terminal: `curl https://a-to-mind.com/api/paypal`, then the order call, so an agent can buy a review the same way.
7. (1:55) The guard: change one character of the code and call review with the same order: refused, "the order was made for
   different code". Use the order twice: refused.
8. (2:15) "No capture, no read. No read, no capture. Verse Code Review, at a-to-mind.com."

## What only Atom can do (each waits for his yes)

1. Make a free PayPal developer account at developer.paypal.com and a sandbox REST app; put its client id and secret into the
   Verse Cloudflare Pages project as the secrets `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` (leave `PAYPAL_ENV` unset: sandbox).
2. Add an open-source license to the repo (the rules require one; MIT is the usual choice). Licensing is the owner's call.
3. Register on Devpost for the PayPal AI Hackathon, accept its rules, and submit with the text above and the video link.
4. Record or approve the video and upload it to YouTube as public.
