# Verse's treasury

Owner, 2026-11-03: "verse is to be able to reallocate its own profits in the most efficient and helpful way, i get a cut of coarse";
on the size of the cut: "Let Verse decide". Live at **https://a-to-mind.com/treasury/** (data: `GET /api/treasury`).

## Rules

- **Only realized money.** The sources of funds are Gumroad revenue that actually happened and USDC received into Verse's wallet (below). Gumroad: the `/api/gumroad` pings in
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

## Verse's wallet (owner, 2026-11-06: "the point is for it to find the money not me, agents can have wallets now")

Agents pay Verse per call in USDC on Base with the open x402 protocol (https://docs.x402.org), into Verse's own wallet:
`POST /api/x402/review` answers 402 with what to pay (0.05 USDC); the agent signs an EIP-3009 authorization to Verse's address and
retries; a facilitator verifies it, the closer read runs, the facilitator settles (it broadcasts the transfer and pays the gas), and
only then is the read given. No settlement, no read, no charge. Catalog: `GET /api/x402`. Code: `lib/x402.js`, `lib/verse-wallet.js`,
`functions/api/x402/`, tests `tools/x402.test.mjs` and `tools/x402-services.test.mjs`; live check `tools/x402-live.mjs`.

- **What is sold** (owner, 2026-11-06: "so maybe verse can immediatly start charging for its code review and anything else
  possible"), each 0.05 USDC (`SERVICES` in `lib/x402.js`): `review` (its own route, `functions/api/x402/review.js`), and `answer`,
  `fix`, `translate`, `digest`, `appraise` and `image` (`functions/api/x402/[service].js`). Each of those runs one of the site's
  free routes unchanged (`functions/api/answer.js`, `translate.js`, `digest.js`, `appraise.js`, `image.js`), so its per-connection
  limits still apply and the free pages stay free. A call that cannot work is refused with 400 before any payment; only an answer
  that did the work (`paidOk` in `PAID`) is settled and given. A refusal, a rate limit or a busy model comes back with `paid: false`
  and is never settled. Tests: `tools/x402-services.test.mjs`.
- **Found by agents**: every paid URL answers GET and HEAD with the same 402, and the v2 `PAYMENT-REQUIRED` header carries the
  Bazaar extension (`extensions.bazaar`: the input body example, the output example and a JSON schema; `bazaarOf` in
  `lib/x402.js`). PayAI's facilitator lists a resource in its Bazaar by itself, with no registration, the first time it verifies or
  settles a payment for it, or when its catalog probe (HEAD, then GET) gets a 402 (docs.payai.network/x402/facilitators/bazaar).
  The services are also in `llms.txt`, `openapi.json` and on `/treasury/`, which shows each one's confirmed calls and cents.
- **Verse's address** (owner, 2026-11-06, his MetaMask wallet on Base): `0x172198B605c3A6388fc4265b09Bc9b3b71CC7196`, in
  `lib/verse-wallet-address.js`. Self-custody, so no deposit minimum; EIP-55 checksum checked when it was set.
- **The address**, in order: `VERSE_WALLET_ADDR` (a Pages variable, any receive address); else `VERSE_WALLET` in
  `lib/verse-wallet-address.js` (the same public address kept in the repo, so it ships with the next deploy and needs no Cloudflare
  or Coinbase account: the path when Atom has a self-custody wallet such as MetaMask or Rabby; not an exchange deposit address
  with a minimum above the price: Kraken's USDC-on-Base minimum is 2.50 USDC, and its support page "Cryptocurrency deposit fees and
  minimums" says a deposit below the minimum is marked Failed and lost for good, so every 0.05 USDC call paid there would be lost); else Verse's own **Coinbase CDP server
  wallet**, which Verse makes itself (one account, `verse-treasury`) the first time it is needed once `CDP_API_KEY_ID`,
  `CDP_API_KEY_SECRET` (Ed25519) and `CDP_WALLET_SECRET` are set; the key is generated and kept in Coinbase's enclave and Verse keeps
  only the address; else the store's `CRYPTO_USDC_BASE_ADDR`. With none, paid calls answer 503 and nothing is charged.
- **The facilitator**: PayAI's public one by default (exact payments on Base mainnet with no API key or account, 1,000 free
  settlements: docs.payai.network/x402/facilitators/introduction); `X402_FACILITATOR_URL` swaps it (for example Coinbase's, which
  takes a CDP key: 1,000 free settlements a month, then $0.001 each, docs.cdp.coinbase.com/x402/seller/facilitator).
- **Counted only when the chain shows it**: a settled payment is recorded, then read back on Base (5 confirmations, the exact
  amount to the address it was asked for) on the next ledger read before it counts as realized revenue. Store orders paid in USDC
  on Base (already proved on chain by `lib/alt-pay.js`) count too. Both go through the same split: Atom's cut first. `/treasury/`
  shows the wallet's USDC balance read live from the chain (`balanceOf`), never a stored number.
- **Never**: Verse's code signs nothing, sends nothing, swaps, stakes, lends or trades nothing, and holds no key. The only CDP calls
  are create-account and get-account-by-name.

## Found money

`tools/found-money.mjs` (daily, from the scheduled workflow) writes `void-live-deploy/treasury/found.json` from `domains/found-money.sources.json`:
legitimate places money is left on the ground (unclaimed property, settlements, credits programs, bounty boards, grants,
hackathons, affiliate programs for tools Verse already links, upsells on its busiest pages). It reads public sources only (Devpost's
hackathon API, GitHub issue search, Top Class Actions' public RSS feed, the site's own visit counts) and cites each one. A value is
shown only when the source states one; a prize pool is not an estimate. Anything needing Atom's identity, a sign-in or an
application is `ready to claim`; Verse never signs up, files or claims in anyone's name.

## The scheduled workflow

`.github/workflows/treasury.yml` is the daily found-money scan and the Monday cut review. The ledger, the split, the spend queue and the weekly review also run in `/api/treasury`, and `found.json` is as of its last commit.
