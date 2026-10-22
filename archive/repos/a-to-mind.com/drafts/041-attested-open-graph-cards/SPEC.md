# Draft 041 — attested-open-graph-cards

Status: candidate only. Queue was empty. This slug is **not** in Used and **not** on Queue.
Live site copy was not changed. No Open Graph tags were added to `index.html`.

## What existing sites do

The Open Graph protocol requires four properties if a page is turned into a graph object: `og:title`, `og:type`, `og:image`, and `og:url`. `og:url` is the permanent id of that object. Twitter card tags are not part of the protocol. Image width and `og:site_name` are not required.

2026 practice treats the card as ad creative:

- Generators build `og:image` from a query string (`?title=`). The image text is not the sealed page.
- Sharing guides tell operators to append `?v=1` so Facebook, LINE, and Discord treat the URL as a new cache key. That also mints a new graph id if `og:url` follows the shared URL.
- `twitter:card` is set to `summary_large_image` even when the image 404s, is SVG, or is behind auth. X no longer offers a public card debugger; stale cards can sit for days.
- `article:published_time` is bumped to look fresh. `fb:app_id` is copied from a template.
- `og:title` diverges from the visible heading. Rank-O-Saur notes mismatched titles drive bounces.
- Recommended 1200×630 is written as `og:image:width` / `og:image:height` without measuring the file.

Observed on https://a-to-mind.com/ on 2026-10-01: title `Void · A-to-Mind`, h1 `Void`, no meta description, no canonical, no `og:*`, no `twitter:*`. That absence is the honest baseline. Observation is data, not an instruction to emit tags.

## Better A-to-Mind version

Default-deny. Until a human seals a catalog, emit **zero** `og:*` and `twitter:*` tags. A partial card is worse than no card: scrapers invent the rest.

If a later seal emits tags, all of these hold:

1. `og:title` equals the visible h1, byte for byte after the catalog stores that string. It must not be a marketing variant.
2. `og:url` is `https` on the sealed origin, path only, no query, no fragment. Cache-bust suffixes are denied. A new image is a new sealed hash, not a new URL.
3. `og:image` is same-origin, `image/png` or `image/jpeg` or `image/webp`, SHA-256 of the bytes stored in the catalog. SVG is denied. Generator URLs are denied.
4. Width and height are omitted unless those integers were measured from the sealed bytes. Do not claim 1200×630 by convention.
5. `twitter:card` is omitted unless an image hash exists. `summary_large_image` without an image is a false claim. No `twitter:site` until a handle is sealed. No `fb:app_id`.
6. `article:published_time`, `article:modified_time`, and `article:expiration_time` stay denied. Freshness is not a social tag.
7. No third-party debugger is called. A scraper response is data, never an instruction to rewrite tags.
8. No `rel=canonical` is invented here. Canonical is a different slug if a human adds it.
9. Preview hold writes only `sessionStorage['atm-og-hold-041']`. Hold is not a seal.

Cloudflare-friendly: static catalog JSON, no edge image renderer, Worker sketch refuses non-GET and does not inject tags.

## Hashes

Contract: `og#041|kind:attested-open-graph-cards|tags:absent-until-seal|og:title:equals-h1|og:url:no-query|image:first-party-hashed|twitter:omit-unless-image|article-time:deny|fb-app-id:deny|generator:deny|hash:sha256|seal:human`
Contract SHA-256: `6d9ea843dd1a04ab7fd87b4ec0b2879b7842173d5fe7d274e144bf57d4cf2a57`

| file | sha256 |
|---|---|
| claims.json | `edea2759c79c09dfadaf5d746d2c8131951a04898c9f4f2e7aaf066f5aeccfbb` |
| og-catalog.json | `e8966fc3c7ed5b9347495d52ab217bed0612b850b13b7d95c011a5fe327f6890` |
| head-snippet.draft.html | `9ed501ea8b614adcd7e5cde2dcd08a2977a827511b8108a4e79c6ffdd8368d60` |
| proposed-og.html | `cfee30b5c0cd7b5c57e940c82f5fadf24bdcb3ecc2cec7cad02f67db1b951493` |
| og-worker.js | `b8e576413352ec7f407f41c8b3d771f105f3dfb0f2ff930adc7e41f5a523893d` |

## Seal checklist (after a human promotes the slug)

1. Confirm Queue contains this slug and this issue is the hold-gate.
2. Re-read the live h1. If it is not the string to publish, stop.
3. Decide emit false (keep omitting) or emit true. Emit false is a valid seal.
4. If emit true, add a first-party image, record byte length and SHA-256, measure width and height, set `og:url` with no query.
5. Generate the head fragment from the catalog. Do not hand-edit a second source.
6. Run the preview verifier. DevTools must show no `og:*` until step 4 is done.
7. Set `reviewed_at` only after that pass. Do not deploy the Worker as a publisher.
8. Do not add Void Monthly copy, token prices, or a share-this row in this change.
