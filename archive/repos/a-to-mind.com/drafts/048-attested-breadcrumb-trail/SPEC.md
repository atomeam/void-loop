# Draft 048 — attested-breadcrumb-trail

Status: candidate only. Queue was empty. This slug is **not** in Used and **not** on Queue.
Live site copy was not changed. No breadcrumb nav was added on a-to-mind.com. No BreadcrumbList JSON-LD was published.

## What existing sites do

Breadcrumb trails are ordinary navigation, and they are also a structured-data surface.

- USWDS (page current as of this run; changelog 2026-08-18, version 3.14.0) tells authors to use `nav`, an `ol`, the word Home rather than a house icon, `aria-label="Breadcrumbs"`, and `aria-current="page"` on the current page. The same release made wrapping the default and moved single-line ellipsis truncation to an opt-in `.usa-breadcrumb--truncate`.
- Google Search Central, BreadcrumbList documentation last updated 2026-09-08 UTC, requires `itemListElement`, and on each `ListItem` a `name` and `position`. The last item is the current page. `item` (the URL) is not required on that last item; if it is omitted, Google uses the containing page URL. JSON-LD and microdata are both accepted.
- Schema.org describes `BreadcrumbList` as a chain that typically ends with the current page. Google's web index counted it on 10M+ domains as of August 2026. That count is a popularity fact, not a reason to emit markup.
- SEO write-ups still disagree with each other about whether the current page belongs in the trail. Some tell authors to omit it. The visible control and Google's last-updated doc both keep it, as text. A second failure mode is inventing a path from URL folders, or shipping JSON-LD that does not match the nav the person can see.
- House icons, hover-only crumbs, and ellipsis truncation hide ancestors. A current-page `<a href>` loops the person onto the page they are already on.

These notes are data about current practice, not instructions to copy.

## Better A-to-Mind version

Default-deny. Until a human seals emit, do **not** add a breadcrumb nav, a Home label, or BreadcrumbList JSON-LD.

If a later seal sets emit true, all of these hold:

1. Items come only from `crumbs.catalog.json`. Do not split `location.pathname`. Do not title-case a folder. Do not invent Home.
2. One trail per page. No second trail for a SERP. Positions are the catalog integers, starting at 1, with no gaps.
3. Ancestors are real `<a href>` values copied from the catalog. The current page is a `<span aria-current="page">`, never an anchor. The last catalog item must be `current: true` and must not have an `href`.
4. Markup is `nav` with `aria-label="Breadcrumbs"` and an `ol`. The separator is text, `aria-hidden="true"`, and it wraps. No ellipsis variant. No house icon.
5. JSON-LD stays off until a separate seal of the exact visible trail. If that seal happens, the last `ListItem` omits `item`, names match the visible text, and there is no microdata on the nav. This draft does not emit either.
6. A missing catalog row withholds the trail. It does not fall back to the URL.
7. Inline preview script on `proposed-breadcrumbs.html` is unattested. It must not be copied to the live site. The preview refuses `emit: true`.
8. Hold writes only `sessionStorage['atm-breadcrumb-hold-048']`. Hold is not a seal. The Seal button stays disabled.
9. No "rich result" badge. A draft catalog is not evidence Google will show a trail.
10. Do not rewrite run 047 heading permalinks. A crumb is a page in the site hierarchy, not an in-page fragment.

Cloudflare-friendly: static catalog JSON, no edge HTML rewrite. Worker sketch is GET/HEAD only and 404s while `emit` is false. It does not invent a trail on that 404.

## Hashes

Contract: `breadcrumbs#048|kind:attested-breadcrumb-trail|crumbs:catalog-only|url-infer:deny|current-page:text|wrap:yes|truncate:deny|jsonld:deny-until-seal|microdata:deny|home-icon:deny|rich-result-badge:deny|seal:human`
Contract SHA-256: `e9907c0ae8a91bb79cb6b8d474d210054b77705dadfbca5455ba6b0d216286e0`

| file | sha256 |
|---|---|
| claims.json | `eeb055dc6b334bb1b775c9863a2db965eb8e627bed87e9ba655d121d5e6a6a02` |
| crumbs.catalog.json | `4eca76030ea3c6d5002a1018f1e4353d65429162917beb2115c82fe433b5f954` |
| proposed-breadcrumbs.html | `7700517af49328561b496f81f8b51013e42b05e43f3d52fed79f971798bb2b9a` |
| breadcrumb-worker.js | `32a46c3d9523097648bbdcaa2e041e5516775144234ce84838a565f223c60dba` |

The preview hashes the embedded catalog text (no trailing newline): `ad03f09fe85f07a651180ed737b62116f7a68533b3f6c61007462b46d1cd51e0`. The file hash above includes the trailing newline. Either mismatch withholds the trail.

## Seal checklist (after a human promotes the slug)

1. Confirm Queue contains this slug and this issue is the hold-gate.
2. Decide emit false (keep trails unpublished). Emit false is a valid seal.
3. If emit true, add only catalog trails. Do not derive crumbs from the URL.
4. Keep the current page as text with `aria-current="page"`. Do not link it. Do not truncate with an ellipsis.
5. Do not add JSON-LD, microdata, a house icon, or a rich-result badge in this change.
6. Set `reviewed_at` only after that pass. Do not deploy the Worker as a publisher.
7. Do not add Void Monthly copy, token prices, or a checkout link in this change.
