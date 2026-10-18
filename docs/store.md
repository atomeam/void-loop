# Verse's own store

Owner, 2026-10-15: "we can have our own working gumroad type store built on Verse to skip that and host and make that itself
a profitable product". Follow-up the same day: **keep Gumroad as the primary checkout for now** (it also helps promote small
AI startups), with the provider behind an adapter so Stripe can switch on later.

Live: **https://a-to-mind.com/store/** · API `/api/store/*` (`void-live-deploy/functions/api/store/[[path]].js`) ·
catalog and crypto `void-live-deploy/lib/store.js` · Verse answers "what can I buy" (`skills/store.js`) · tests `tools/store.test.mjs`.

## Rules

- **We never handle card numbers.** Every checkout is a hosted page (Gumroad today, Stripe Checkout later). PCI scope stays SAQ A.
- The page, cart, receipts, downloads and license keys are ours; the provider is one adapter (`ADAPTERS` in `lib/store.js`).
- No account is created by an agent. Keys are entered by Adam in the Cloudflare dashboard, never pasted in chat.

## Phase 1 (live now)

| Piece | How |
| --- | --- |
| Catalog | `STORE_PRODUCTS`: the 8 live Gumroad products (Verse Monthly `yinmj`, Code Review Pro `void-code-review`, alias of the original `dkmcjk`, Automation Cleanup `eozcma`, First Automation Setup, Full Stack Audit, Keep-It-Running, The Big Board `gqsgib`, Join the Team), a free 3D download (the CC0 chess set) and the VoidQuest minis pack (coming soon) |
| Page | `/store/`: Verse-style cards, live three.js previews you can spin (GLB + meshopt), a cart in localStorage, "or buy on Gumroad" on every card |
| Checkout handoff | `POST /api/store/checkout` asks the adapter. Gumroad: one hosted link per item (Gumroad has no multi-product cart link). Stripe: one Checkout Session with every line item |
| Webhook | `POST /api/store/webhook/stripe`: verifies `Stripe-Signature` (HMAC-SHA256 of `t.body`, 5 min tolerance); `checkout.session.completed` + `paid` saves the order in D1 `store_orders`; `charge.refunded` marks it refunded. Gumroad sales keep using the existing Ping at `/api/gumroad` |
| Signed downloads | `/api/store/download?t=`: base64url payload + HMAC-SHA256, 24 h expiry, order must still be `paid` (a refund kills every link). Free files come from static assets; paid files from R2 under `store/` |
| License keys | `Verse-XXXX-XXXX-XXXX-XXXX` = HMAC(order, product): recomputable, so checking one needs no lookup |
| Receipt | `/store/receipt/?session=cs_...`: polls until the webhook lands, then shows the order code, keys and fresh links |
| Order lookup | email + the 8-letter order code (emails are stored only as an HMAC) |
| Status | `GET /api/store/status`: provider and whether each key is set, as true/false. Never a value |

Free-tier limits checked: D1 free 100k writes/day and 5 GB (one write per order); R2 free 10 GB storage, 1M Class A and 10M
Class B ops a month, **no egress fees** ([R2 pricing](https://developers.cloudflare.com/r2/pricing/)); Pages Functions share the
Workers free 100k requests/day. A download is one request and one Class B read.

## Fees (checked 2026-10-15)

| Provider | Fee per sale | Sales tax / VAT | On a $9 pack | On a $49 sale |
| --- | --- | --- | --- | --- |
| Gumroad (direct/profile link) | 10% + $0.50 ([gumroad.com/pricing](https://gumroad.com/pricing)); 30% via Discover | Merchant of record since 2025-01-01: handled | $1.40 | $5.40 |
| Stripe Checkout / Payment Links | 2.9% + $0.30 domestic cards; +1% cross-border ([stripe.com/pricing](https://stripe.com/pricing)) | Not handled: we owe it. Stripe Tax is extra (see Tax on [stripe.com/pricing](https://stripe.com/pricing)) | $0.56 | $1.72 |
| Lemon Squeezy | 5% + $0.50 ([lemonsqueezy.com/pricing](https://www.lemonsqueezy.com/pricing)); +0.5–1% some methods/currencies | Merchant of record: handled | $0.95 | $2.95 |
| Paddle | 5% + $0.50 ([paddle.com/pricing](https://www.paddle.com/pricing)) | Merchant of record: handled | $0.95 | $2.95 |

Read: Stripe is cheapest by far but leaves sales tax to us; Lemon Squeezy/Paddle are half Gumroad's cut with tax handled.
Plan: Gumroad now (Adam's call, and it brings Discover traffic), Stripe for direct sales once the account is activated, and
Lemon Squeezy as the merchant-of-record adapter if international VAT becomes real work.

## Turning on Stripe (Adam, in the dashboards; nothing for an agent to do)

Adam's Stripe account already exists: **"Atom Bomb", acct_1TRrzX3JOCPVHdD6, on atomicmoonbeam88@gmail.com**, opened
2026-05-01, sandbox payment link made 2026-05-14, passkey added 2026-06-11. Stripe's last notice (2026-06-14) says it **cannot
take live payments until the business profile is completed**. A business email is not required by Stripe; a Gmail works.

1. Stripe dashboard → finish **Complete business profile** (legal name, address, SSN/EIN, bank account, website a-to-mind.com, product description).
2. Developers → API keys → copy the **secret key** (`sk_live_...`; a restricted key with Checkout Sessions write is better).
3. Developers → Webhooks → add endpoint `https://a-to-mind.com/api/store/webhook/stripe`, events `checkout.session.completed` and `charge.refunded` → copy the **signing secret** (`whsec_...`).
4. Cloudflare dashboard → Workers & Pages → **a-to-mind** → Settings → Variables and Secrets → Production, add as **Secret**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STORE_SIGNING_KEY` (any long random string); and as plain text `STORE_PROVIDER` = `stripe` (leave unset to stay on Gumroad). Optional `STRIPE_TAX` = `on` after Stripe Tax is set up.
5. Next deploy picks them up; `https://a-to-mind.com/api/store/status` then shows `"provider":"stripe"`.

## The creator platform (phase 2, the product we sell)

- **Stripe Connect, "you handle pricing" model**: each seller onboards through Stripe-hosted Express onboarding (KYC, bank, tax forms by Stripe); we create Checkout Sessions as destination charges with `application_fee_amount`. Stripe's Connect cost to us: **$2 per monthly active account + 0.25% + $0.25 per payout** ([stripe.com/connect/pricing](https://stripe.com/connect/pricing)). The "Stripe handles pricing" model has no platform fees but less control.
- **Our fee: 5% flat, no per-sale fixed fee, seller pays Stripe's 2.9% + 30¢.** On a $10 sale the seller keeps $8.91 (vs $8.50 on Gumroad's 10% + 50¢ before processing). We net about $0.50 minus Connect costs; at $2/active seller/month that's break-even at ~5 sales per seller per month, so: 5% with a $0.50 minimum fee, or **Verse Store Pro $9/month at 2%** for sellers doing volume.
- **Seller onboarding**: sign in with a passkey (already built, `/api/passkey`), "Start selling" → Stripe Express link → back to a seller page (products, files to R2 under `sellers/<id>/`, prices, payouts dashboard link). Every seller gets `a-to-mind.com/@handle/store` (the `/@handle` pages exist).
- **Why ours beats Gumroad**: 3D previews you can spin, Verse answering buyers' questions about each product, AI-made product pages and promo clips (`tools/clips.mjs`), half the fee.

## Business email for creators (new product idea, owner 2026-10-15)

Verse sets up `you@yourdomain.com` for a creator in minutes and charges for the setup and upkeep.

- **Free path:** [Cloudflare Email Routing](https://developers.cloudflare.com/email-routing/) is free: unlimited custom addresses on a domain on Cloudflare, forwarded to any inbox. Replying "as" the address: Gmail's "Send mail as" through a free SMTP relay tier, or Cloudflare's Email Service send binding (already wired, off, `lib/email-send.js`). The domain itself is the only cost (at-cost registrar, about $10/year for .com).
- **What Verse does:** checks the domain is on Cloudflare, adds the routing rules and MX/SPF/DKIM/DMARC records, sends a test, shows the "send as" steps. It needs the creator's own Cloudflare login (OAuth or a scoped token they make); Verse never asks for passwords.
- **Pricing:** $15 one-time setup (or free with any store plan), or **$3/month** for "Business Email Care": monitoring that mail still flows, DMARC reports read in plain words, new aliases on request. Bundled into Verse Store Pro.
- For Adam now: `atom@a-to-mind.com` via Email Routing would be free and gives Stripe/press a business address (it is not a Stripe requirement).

## Self-publishing (owner, 2026-10-15: "V01D can make a new product every time it needs in our store")

- **One catalog:** `domains/store.products.json`. `tools/store-publish.mjs sync` regenerates `void-live-deploy/lib/store-products.js`
  (what `lib/store.js`, `/api/store/*`, the `/store/` page and Verse's store card read), `void-live-deploy/store/changelog.json`
  (the public "New from Verse" list on `/store/`) and `docs/store-changelog.md`. `tools/store-publish.test.mjs` fails if they drift.
- **Publishing a shipped thing:** `node tools/store-publish.mjs forge-pack | clips-pack | publish --kind <k> --id <id> --name … --blurb … --files a,b [--preview x.glb] [--paid]`.
  It runs the guardrails, zips the files, uploads `store/<id>-v1.zip` to R2 (FILMS bucket `void-films`), writes the row (Verse's voice,
  price from `PRICE_RULE`, preview, licence tier), adds a changelog row and queues an ad clip. On the box set
  `WRANGLER_BIN=/workspace/.wrangler3/node_modules/.bin/wrangler` (wrangler 3, which can write its cache there).
- **Price:** free / pay what you want (the $1 tip jar) until Stripe is on. `--paid` prices by `PRICE_RULE` inside `PRICE_RANGE`
  ($1–$50) and sets status `needs-gumroad`: shown as coming soon, queued in `domains/store.queue.jsonl` for Adam to list by hand
  (there is no Gumroad API key, so no listing is faked).
- **Guardrails (checks, not approval gates):** price in range; no trademarked names (`TRADEMARKS`) in title, blurb or file names;
  every file made by Verse or under an allowed licence (`ORIGINS`); every STL closed, consistently wound, finite and inside a 180 mm
  bed (`checkStl`, from the bytes); a public changelog row per product; and `.github/workflows/store-check.yml` fetches every live
  download daily and unpublishes (by an automerge PR) any that fail.
- **Ad clips:** every published product goes into `domains/store.clips.jsonl`; `tools/clips.mjs` turns each into a moment that
  films the product's card at `/store/#<id>` and ranks it first for a week, so the daily clips run makes its ad.
- **Live (2026-10-15):** Verse Forge Printables (10 checked STLs, free) and Verse Clips Pack (10 shorts, free). The VoidQuest minis pack
  stays "coming soon": no VoidQuest miniature models exist yet to print.

## Next steps

1. Upload the first paid pack (VoidQuest minis STL/3MF zip) to R2 `store/voidquest-minis-v1.zip` and list it on Gumroad too.
2. Stripe on (Adam, above). 3. Order emails through the Email Service binding. 4. Connect onboarding (phase 2).

## Wishlist rows (for `docs/wishlist.md`, which lands with #721)

| # | Item | Free path (do this first) | Paid cost (cited) | Value | Why this rank | From |
| --- | --- | --- | --- | --- | --- | --- |
| 12 | Verse's own store (phase 1 live) | Gumroad stays the checkout (merchant of record, Discover buyers); our page, cart, signed downloads (R2 10 GB free, no egress) and license keys cost $0 | Stripe Checkout 2.9% + 30¢ ([stripe.com/pricing](https://stripe.com/pricing)) once Stripe's business profile is done; Stripe Tax extra | high: each sale keeps ~7% more | free today; Stripe is a dashboard step, not a purchase | Adam |
| 13 | Creator store platform (multi-seller, Connect) | passkeys and `/@handle` pages already built; Stripe-hosted Express onboarding | $2 per monthly active seller + 0.25% + 25¢ per payout ([Connect](https://stripe.com/connect/pricing)); we charge 5% | high: a product others pay for | waits on 12's Stripe step | Adam |
| 14 | Business email for creators | Cloudflare Email Routing, free ([docs](https://developers.cloudflare.com/email-routing/)); only the domain costs (~$10/yr) | none needed | medium: $15 setup or $3/mo | free path covers it; also gives Adam atom@a-to-mind.com | Adam |

## Self-made products: auto-publish (Adam, 2026-10-15)
Verse's own products go on sale automatically when the price is within the set range, they carry no trademarks, their files are tested, and each gets a public log entry. Anything outside the range stays a hidden draft. Recorded in domains/void.decisions.json (adam-20261015-store-autopublish).
Where ideas come from: when a buy/hire ask matches no product (or the sponsor-line gate in lib/gumroad.js rejects a weak match), no sponsor line shows; lib/product-gap.js adds one to a redacted topic count (word stems only, no person/device/IP). At 3 asks the topic queues a `store-gap:<topic>` job in void_queue.

## Verse sets its own prices (Adam, 2026-10-15)
Verse is the appraiser: lib/appraise.js prices each self-made product from comparables, effort, files, topic demand and sales, and writes a 'why this price' note into the public log. Paid items are never $0; anything over 10x the comparables' median is flagged, not blocked. Visitors can never change a price (lib/price-lock.js).

## Pay a share, get that share (Adam, 2026-10-15: "if they pay a smaller percentage they get that percentage of the product")
For a pay-what-you-want product **with an appraised price** (`pwyw: true`, `cents` > 0; `lib/pay-share.js`, tests `tools/pay-share.test.mjs`):
- **Stable order:** the product's items (`order`, Verse's value ranking with starter items first, else `contents`). README and any `freeItems` lead and are always included.
- **Mapping:** paying p% of the price unlocks the first `ceil(p% x N)` of the N paid items (integer math); any payment above $0 gets at least one; 100% or more gets everything. Example: pay $4 of $10, get 4 of 10 models.
- **Decided on the server, from the verified amount only:** Stripe's signed `amount_total` (a pay-a-share pack checks out alone, so the total is that pack's); Gumroad's keyed ping `price` (cents) already stored by `/api/gumroad` in `void_sales`. The checkout's `pay` field only sets what Stripe charges (clamped $1..price); price, discount, coupon or forged metadata fields change nothing, and download tokens carry only the order id: the item count is recomputed from the order row on every download. Price-lock rules still apply.
- **Delivery:** `/api/store/download?t=` (signed, 24 h, per purchase) streams a zip built from the unlocked items in R2 (`store/<id>/items/<name>`, uploaded by `store-publish publish --share`). Nothing else is rehosted. A refund (Stripe `charge.refunded`, Gumroad refund/dispute ping) kills the links.
- **Upgrade:** the receipt shows "Pay $6 more to unlock the other 6" and an Unlock-the-rest button. `POST /api/store/checkout {items:[id], upgrade: <order code>, email}` charges exactly the difference (server-computed); the top-up lands in `store_credits` keyed by the provider ref and credited to the order id (Stripe `metadata[upgrade]`; Gumroad `?upgrade=<code>` comes back as `url_params[upgrade]`).
- **Gumroad buyers:** `POST /api/store/share/claim {sale_id, email}` turns the stored ping into an order and returns the receipt (email must match the sale).
- **Card:** a slider with "Pay $4 of $10 and get 4 of 10 models", the ordered list with free items marked free.
- **Truly free products (price 0) stay fully free**: Forge Printables and Clips Pack are unchanged.
- **Publishing one:** `node tools/store-publish.mjs publish --share --cents <appraised> --gumroad <permalink> ...`. Without `--gumroad` it waits as `needs-gumroad` (Gumroad is the live checkout and its listing can't be made by an agent).

**What Gumroad verification needs:** with no API key, the amount is trusted only from the keyed ping (`/api/gumroad?k=GUMROAD_PING_KEY`, which only Gumroad knows), from Atom's `seller_id`, not a test, not refunded or disputed: the same trust the membership unlock uses. For an independent check, Adam adds Cloudflare secret **`GUMROAD_ACCESS_TOKEN`** (Gumroad → Settings → Advanced → Applications → create an application → generate an access token; scope `view_sales`): the claim then reads `sale.price` back from `GET https://api.gumroad.com/v2/sales/<sale_id>`. Each pay-a-share product also needs a Gumroad listing with **"Allow customers to pay what they want"** on (minimum $0 or $1), its permalink in the catalog row (`gumroad`), and the Ping URL already set.
