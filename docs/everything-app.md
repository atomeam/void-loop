# Verse, the everything app: what works, what's legal, what's next

Owner, 2026-10-15: "Verse should be the only site you need ... social, dating, crypto, food delivery via waymo, you name it,
get it all working." Motto: *You name it, Verse learns it and does it better.*

This file is the honest map. Each vertical lists what Verse does **now** (live, legal, no keys), the **official** routes
that exist (APIs, embeds, deep links, cited), what Adam would need (accounts, keys, money), and the **next step**.
Paid items, with their free paths, are ranked in [`docs/wishlist.md`](wishlist.md). Checked 2026-10-15.

## Rules that hold across all verticals

- **Adapters, not hard-wiring.** Every outside provider sits behind one adapter (`void-live-deploy/skills/providers.js`:
  `{ id, name, kind, web(q), app(q), order }`). Today `order` is `null` and the card deep-links; when a real API and an
  account exist, the adapter gains `order(req)` and the cards don't change.
- **Official routes only.** Public APIs, official embeds, deep links, RSS. No scraping against a site's terms, no shared keys.
- **Free tier.** No gpt-oss calls for these cards; no KV write per request (edge cache, `caches.default`, instead).
- **Money and people.** Crypto is read-only. Dating and social never show real users' data without auth, 18+ gating,
  block/report and moderation designed first.

## Crypto — live (read-only)

- **Now:** "crypto prices" / "crypto board": top 8 coins, price, 24 h change, 7-day sparkline (`skills/markets.js`) from
  `/api/markets` (`functions/api/markets.js`), CoinGecko `coins/markets?sparkline=true`, edge-cached 2 min, no KV.
  "bitcoin price" (single coin) stays with `skills/crypto.js`. "bitcoin wallet <address>" reads a public BTC address from
  mempool.space. Typing "my seed phrase is…" gets a warning, never stored.
- **Official routes:** CoinGecko API, keyless public endpoints plus a free Demo key (10k calls/mo, 100/min, attribution)
  ([pricing](https://www.coingecko.com/en/api/pricing), [coins/markets](https://docs.coingecko.com/v3.0.1/reference/coins-markets));
  mempool.space REST ([docs](https://mempool.space/docs/api/rest)); Ethereum addresses via Etherscan API (free key,
  [docs](https://docs.etherscan.io/)).
- **Adam needs:** nothing today. A free CoinGecko Demo key would make limits predictable; commercial use at scale needs a
  paid plan (Basic $35/mo, $29 billed yearly; same page).
- **Never:** hold funds, keys or seed phrases; trades; advice. The card says "not financial advice".
- **Next:** ETH/Solana address lookup with free keys; per-coin chart card on the 3D stage; price alerts kept on the device.

## Food delivery — live (deep links)

- **Now:** "food and rides", "pizza delivery to <address>": Uber Eats and DoorDash open on the food and address (web and app links).
- **Official routes:** No public consumer ordering API from Uber Eats or DoorDash. Uber Direct and DoorDash Drive are
  *merchant* delivery APIs (send a courier for your own goods), not "order from any restaurant":
  [DoorDash Drive](https://developer.doordash.com/en-US/api/drive) charges $9.75 per delivery within 5 miles +$0.75/mile
  ([pricing](https://developer.doordash.com/en-US/docs/drive/overview/pricing_payment/)); [Uber Direct](https://developer.uber.com/docs/deliveries/overview) needs a business agreement.
- **Waymo + food:** Uber Eats via Waymo in Phoenix **ended** when Waymo and Uber parted ways in Phoenix, June 2026
  ([TechCrunch](https://techcrunch.com/2026/06/29/waymo-and-uber-quietly-part-ways-in-phoenix/)). Waymo now delivers in
  metro Phoenix **through DoorDash** ([KJZZ](https://www.kjzz.org/business/2025-12-03/waymo-and-doordash-now-offering-grocery-and-meal-delivery-to-phoenix-area-homes));
  the customer can't pick a Waymo, DoorDash assigns one. So Verse's honest route is the DoorDash deep link.
- **Next:** a delivery backend only if Verse sells its own goods (prints, miniatures): DoorDash Drive adapter, ~$9.75/drop.

## Rides and Waymo — live (deep links + "where does Waymo run")

- **Now:** "ride to <place>": Waymo, Uber (pickup = my location, dropoff prefilled) and Lyft. "where does waymo run",
  "is waymo in austin" answer from Waymo's FAQ: own app in Phoenix, SF Bay Area, LA, Dallas, Denver, Houston, Las Vegas,
  Miami, Nashville, Orlando, San Antonio, San Diego, Tampa; through Uber in Austin and Atlanta ([Waymo FAQ](https://waymo.com/faq/)).
- **Official routes:** Waymo has **no public ride or ordering API** (none on waymo.com or its developer pages; rides are booked
  in the Waymo app or, in Austin/Atlanta, the Uber app). Uber's ride deep links are documented
  ([Uber deep links](https://developer.uber.com/docs/riders/ride-requests/tutorials/deep-links/introduction)); Uber's Ride
  Request API is restricted to approved partners. Lyft deep links: [docs](https://developer.lyft.com/docs/deeplinking).
- **Adam needs:** for in-V01D booking, a partner agreement with Uber (or Waymo, if it ever opens one). None today.
- **Next:** keep the Waymo city list current (a weekly check of waymo.com/faq); map card with the service area.

## Social — live (read-only public feeds)

- **Now:** paste an X post link (official embed via `platform.twitter.com/widgets.js`), a Bluesky post link (embed.bsky.app)
  or handle (public AppView `app.bsky.feed.getAuthorFeed`), a Mastodon post link (server `/embed`) or `@user@server`
  (public `accounts/lookup` + `statuses`).
- **Official routes:** [X embedded posts](https://developer.x.com/en/docs/x-for-websites/embedded-posts/overview),
  [Bluesky API](https://docs.bsky.app/docs/advanced-guides/api-directory) and [embeds](https://embed.bsky.app/),
  [Mastodon API](https://docs.joinmastodon.org/methods/accounts/) and [oEmbed](https://docs.joinmastodon.org/methods/oembed/).
  X timelines, search and posting need the paid X API ([pricing](https://docs.x.com/x-api/getting-started/pricing)).
- **Needs before more:** posting and your own timeline need OAuth per network (Bluesky app passwords/OAuth and Mastodon
  OAuth are free). A Verse-native social layer needs accounts (passkeys exist), moderation, block/report, rate limits and
  a D1 schema; designed first, not built here.
- **Next:** Bluesky OAuth sign-in to read your own timeline; a Verse "follow list" kept on the device.

## Dating — the beginning (on-page only)

- **Now:** "dating profile" / "icebreaker coach": an 18+ check, then a profile builder (bio from your fields) and three
  openers from your interests. Nothing leaves the page; no matching, no other people.
- **Official routes:** none worth using: Tinder/Hinge/Bumble have no public APIs.
- **Needs before matching:** auth (passkeys), age and identity verification (a paid vendor, e.g. Persona or Stripe Identity,
  per-check fees), photo moderation, block/report with human review, location privacy (rounded), data deletion, and
  legal review (e.g. state dating-safety laws). Ranked in the wishlist.
- **Next:** profile saved on the device; a "date ideas" card from places near you (free OSM data).

## Shopping, maps, music, news, email, payments

| Vertical | Now in Verse | Official routes | Adam needs | Next |
| --- | --- | --- | --- | --- |
| Shopping | nothing native | Amazon PA-API needs an Associates account with qualifying sales ([docs](https://webservices.amazon.com/paapi5/documentation/)); Gumroad for Verse's own goods (already wired) | Associates account | product search by deep link; Verse's own store first |
| Maps | map skill (`skills/map.js`) on OpenStreetMap | OSM tiles under the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/); Nominatim ([policy](https://operations.osmfoundation.org/policies/nominatim/)) | nothing | Waymo service area overlay |
| Music | YouTube embeds via the video track | Spotify Web API needs OAuth and Premium for playback ([docs](https://developer.spotify.com/documentation/web-api)); Internet Archive audio is free | Spotify app (free) | Spotify embed by link (official, no key) |
| News | news skill (`skills/news.js`) | RSS from publishers; NewsAPI free tier is dev-only | nothing | more RSS sources |
| Email | Verse's email worker (owner) | Gmail API OAuth | already connected for Adam | nothing public |
| Payments | Gumroad links for Verse's goods | Stripe Checkout (Adam's account) | Stripe account | no peer-to-peer money; ever: no custody |

## What is not possible (today)

- Ordering a Waymo ride or a Waymo food delivery from Verse: no public API. Deep links only.
- Ordering from Uber Eats or DoorDash inside Verse: no consumer API. Deep links only.
- Real matching or a real social graph without auth, verification and moderation: not safe, not built.
- Any crypto action beyond reading: not done, by rule.
