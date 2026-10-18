# Verse payments: every rail, its state, and what comes next

Owner, 2026-10-15: Verse may sell special items through Cash App or crypto, revive Stripe (easier with Verse's business email),
and look at the new AI/agent payment rails so Verse can have its own everything. Audited 2026-10-15 (live calls were dry:
status reads, a checkout handoff with a forged price, an unsigned webhook. No money moved).

Rules that hold for every rail: the server owns the price (`lib/store.js` catalog, `lib/price-lock.js`); the client sends
product ids only. Nothing unlocks on a buyer's claim. Verse never sends, signs or holds money or crypto, creates accounts or
keys, or commits an address/cashtag (they are Pages variables Adam sets). Spending stays approval-gated (`docs/reinvest.md`).

## Rail matrix

| Rail | Live surface | Test call (2026-10-15) | Server-side control (can the client alter amount / currency / recipient / product / fulfillment?) | Failure behaviour | Manual reconciliation | Needs |
| --- | --- | --- | --- | --- | --- | --- |
| **Gumroad** (primary) | `/store` → hosted Gumroad link per item; `functions/api/gumroad.js` keyed ping → `void_sales`; pay-a-share claim | `POST /api/store/checkout {"items":["void-monthly"],"price":0}` → Gumroad `yinmj` link, price ignored; product page 200 | No: link is the catalog permalink; amount set on Gumroad; share unlock reads the ping/API amount only | Unknown/soon item → 400 "nothing to buy"; refund/dispute ping kills download links | Gumroad dashboard vs `void_sales` | Working. Paid items marked `needs-gumroad` still need Adam to list them |
| **Stripe** (dormant) | Checkout Session adapter, `POST /api/store/webhook/stripe`, receipt page | `/api/store/status` → `stripe_keys:false`, provider gumroad; unsigned webhook → 400 | No: line items built server-side from catalog cents (`price_data`), currency fixed `usd`; client price/coupon ignored (price-lock test) | No keys or Stripe error → falls back to Gumroad links; bad signature → 400; `charge.refunded` → order revoked | Stripe dashboard vs D1 `store_orders` | 2 secrets + webhook + `STORE_PROVIDER` (below) |
| **Cash App** (special items, new) | `POST /api/store/special/start` → $cashtag link + note "Verse <code>"; `special/confirm` with the Cash App reference; owner `special/queue`, `special/approve` | Built and tested offline (`tools/alt-pay.test.mjs`); off live until `CASHAPP_CASHTAG` is set | No: amount from catalog; recipient from env; product must opt in with `special`; fulfillment only by owner approval (`ownerOk`) | Unsupported rail/item → 400; missing reference → 400; buyer claim → stays `awaiting`, no downloads | **Always manual**: Adam matches the reference/note in Cash App, then approves (or rejects) | Cash App **Business** account and its $cashtag (selling via a personal account breaks Cash App's terms) |
| **Crypto: USDC on Base** (special items, new) | same routes, rail `usdc-base` | Built and tested offline with a fake chain; public RPC `mainnet.base.org` answers; off live until `CRYPTO_USDC_BASE_ADDR` is set | No: exact amount = price + a 1–9999 micro-unit memo from the order id; token (Circle USDC on Base), network and address fixed server-side | Wrong token/network/address/amount, failed tx, bad hash → 400 with reason; unconfirmed (<5 blocks) or RPC down → 202 retry; a tx reused for a second order → 409; owner can't hand-approve crypto | On-chain is the proof; `special/queue` lists stuck orders; a mismatched payment is refunded by Adam by hand | A receive-only 0x address Adam already controls, set as a Pages variable |
| Other crypto / BTC / Lightning | none (`skills/crypto.js` is price lookup only) | n/a | n/a | n/a | n/a | Not built; add only if buyers ask |

Repo audit result: **no Cash App $cashtag and no crypto receive address exist anywhere in `void-live-deploy`, `domains`, `docs`,
history (`git log -S cash.app`), or `atomeam/a-to-mind.com`.** So the code reads them from Pages variables and stays off until
Adam sets them. Nothing was invented.

Order states (D1 `store_orders.status`): `awaiting` → `paid` (crypto verified / owner approved) or `rejected`; Stripe/Gumroad go
straight to `paid`; refunds → `refunded`. Only `paid` and `free` produce download links and license keys.

## What the buyer sees (special items)

1. Picks a `special` product, a rail, and gives an email → gets an order code and exact instructions.
2. Cash App: pays the $cashtag link with note "Verse <code>", submits the payment reference → "awaiting confirmation".
   USDC: sends the exact amount on Base, submits the tx hash → unlocks after 5 confirmations.
3. Order lookup (email + code) shows downloads once `paid`.

First special item: **Verse Site Tester ($24)**, which was stuck as `needs-gumroad`. A product opts in with
`"special": ["cashapp","usdc-base"]` in `domains/store.products.json`.

## Stripe revival: exactly what's missing

Code is complete (adapter, signed webhook, refunds, receipt, pay-a-share). Missing is config only:

1. Stripe account in good standing. Verse's business email helps here as the account's login/support email and the
   public support address Stripe requires on the account profile and receipts. It doesn't replace the identity and bank
   verification Stripe asks of Adam.
2. In Stripe (test mode first): Developers → Webhooks → endpoint `https://a-to-mind.com/api/store/webhook/stripe`, events
   `checkout.session.completed` and `charge.refunded`. Copy its signing secret.
3. Cloudflare Pages → a-to-mind project → Settings → Variables: secrets `STRIPE_SECRET_KEY` (start with `sk_test_…`) and
   `STRIPE_WEBHOOK_SECRET`; variable `STORE_PROVIDER=stripe`. Optional `STRIPE_TAX=on` once Stripe Tax is on.
4. Redeploy (any push), check `/api/store/status` shows `stripe_keys:true`, buy once with card 4242…, refund it, then
   swap in the live key.

Server Price IDs are optional: the session uses `price_data` from the server catalog, so the client can't set a price either way.
Stripe also accepts USDC at 1.5% ([docs](https://docs.stripe.com/payments/stablecoin-payments)) once the account is live, which would
replace the hand-rolled crypto rail.

## Emerging AI / agent payments (checked 2026-10-15)

| Option | Status | Fees | Signup | Fit: receiving | Fit: Verse spending (future, approval-gated) |
| --- | --- | --- | --- | --- | --- |
| Stripe Agentic Commerce (ACP + Shared Payment Tokens) | ACP open spec (Apache-2.0); Stripe's Agentic Commerce Suite lets merchants pick agents from the dashboard. ChatGPT Instant Checkout was discontinued March 2026 | Normal Stripe rate; SPT card floor $0.50; no separate agentic fee ([agenticcommerce.dev](https://www.agenticcommerce.dev/), [stripe.com/pricing](https://stripe.com/pricing)) | Stripe account | High once Stripe is on: same integration | Via Stripe/Link only |
| Coinbase x402 (CDP facilitator) | Production; x402 Foundation under the Linux Foundation since April 2026; Base, Polygon, Arbitrum, World, Solana | 1,000 settlements/month free, then $0.001; no chargebacks ([docs](https://docs.cdp.coinbase.com/x402/welcome)) | Free CDP API key (Adam) for the hosted facilitator; receive to any address he controls | High for pay-per-call APIs (code review, site tester runs) with agent buyers | Best fit: CDP SDK spend caps and payee allowlists |
| Stripe stablecoins / machine payments | Live; USDC on Base, Solana, Polygon, Ethereum; Stripe also does x402 on Base | 1.5% ([docs](https://docs.stripe.com/payments/stablecoin-payments)) | Stripe account | Good: settles to USD | n/a |
| Stripe Machine Payments Protocol (MPP) | Launched 2026-03-18 by Stripe + Tempo; agents pay any HTTP endpoint; sessions pre-authorize a limit and stream micropayments; stablecoins (Tempo) plus cards/BNPL via SPTs ([Stripe blog](https://stripe.com/blog/machine-payments-protocol)) | Normal Stripe rates; settles to Stripe balance | Stripe account | High once Stripe is back: PaymentIntents, a few lines | Session spend limits suit approval-gated budgets |
| Google AP2 | v0.2 (April 2026), donated to the FIDO Alliance; no final standard or date ([blog](https://blog.google/products-and-platforms/platforms/google-pay/agent-payments-protocol-fido-alliance/)) | n/a | n/a | Wait | Wait |
| Visa Intelligent Commerce / Trusted Agent Protocol, Mastercard Agent Pay | Pilots / network tokens; reach merchants via Stripe SPTs; no agentic interchange category | Normal card rates | Comes through Stripe | Free with Stripe | n/a |
| Skyfire, Payman, Nevermined | Startups: agent identity (KYA), wallets, spend limits | Vary | Accounts (Adam) | Low today | Possible later for capped spending |
| Lightning L402 | Spec exists; tiny buyer base for our products | Near zero | Lightning node/wallet | Low | Low |

## Ranked plan (fastest legal first dollars first)

1. **Cash App special items.** Built now; Adam sets `CASHAPP_CASHTAG` (Business account, 2.6% + $0.15 ([Cash App](https://cash.app/help/us/en-US/6522-create-a-cash-app-business-account))) and approves the queue by hand.
2. **Existing crypto address.** Built now; Adam sets `CRYPTO_USDC_BASE_ADDR` to a receive-only address he controls. Auto-unlocks on chain, no fee beyond gas.
3. **Stripe.** 4 steps above, test mode first. Opens cards, USDC (1.5%) and ACP agent checkout in one account.
4. **AI rails, Adam's order (verified 2026-10-15):**
   1. **Coinbase x402.** HTTP 402 + stablecoin, no buyer account. Prototype built: `GET /api/store/x402/<product>` answers
      402 with exact requirements (USDC on Base, payTo = Adam's address, amount with the order memo, order id); the agent pays
      on chain and retries with `X-PAYMENT: {"order","tx"}`; the server verifies the transfer read-only (5 confirmations, once
      per tx) before unlocking. It is a receive-only *pay-then-prove* variant (`scheme: exact-onchain`), not the standard
      facilitator flow, because standard x402 settlement needs a facilitator (free CDP key, Adam) or a settling key.
      Off behind `X402_ENABLED=on` plus `CRYPTO_USDC_BASE_ADDR`. Next: switch to the CDP facilitator for standard x402
      clients once Adam makes the free CDP key ([x402 docs](https://docs.cdp.coinbase.com/x402/welcome)).
   2. **Stripe MPP / ACP.** Fastest fiat for agents once Stripe is back (step 3): MPP on PaymentIntents, ACP via the Agentic
      Commerce Suite ([MPP](https://stripe.com/blog/machine-payments-protocol), [ACP](https://www.agenticcommerce.dev/)).
   3. **Google AP2.** Slowest: an authorization framework (signed mandates), not a payment rail; v0.2, standardizing at FIDO
      ([ap2-protocol.org](https://ap2-protocol.org/), community explainer [agentpaymentsprotocol.info](https://agentpaymentsprotocol.info)).
   Layering per [Crossmint's comparison](https://www.crossmint.com/learn/agentic-payments-protocols-compared): AP2 = authorization,
   ACP = checkout, x402/MPP = settlement. They compose, so supporting x402 now loses nothing later.
