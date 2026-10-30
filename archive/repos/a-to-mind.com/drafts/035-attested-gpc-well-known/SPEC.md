# Run 035 candidate — attested-gpc-well-known

Status: **candidate**. Queue was empty as of run 026. Runs 027–034 already drafted leftover candidates without Used rows. This slug was **not** written into Used. Hold-gate. Do not add a live `/.well-known/gpc.json`, a `gpc: true` declaration, a consent cookie, a CMP, a pixel, or an honored badge to the public origin until a human seals the tracking issue and promotes the slug.

Slug: `attested-gpc-well-known`
Date: 2026-10-01
Run: 035 (candidate; ledger Queue unchanged)
Repo: atomeam/a-to-mind.com
Issue: https://github.com/atomeam/a-to-mind.com/issues/35

Does not promote `default-deny-cookie-notice` (run 027). A cookie banner is a different surface. This draft is the well-known support resource only.

## What existing sites do (2026)

Global Privacy Control is a W3C Working Draft (24 September 2026, https://www.w3.org/TR/gpc/). A browser that has the preference on sends `Sec-GPC: 1`. The only valid header value is `1`. The page can read `navigator.globalPrivacyControl`, which is `true` when that header would be sent and `false` when it would not. The property is the top-level navigation value, including in workers.

Sites may publish a support resource at `/.well-known/gpc.json`. The spec is explicit: by default an origin's support is **unknown**. The resource is not a receipt that the origin abided by the signal on this request. Members: `gpc` (boolean) and `lastUpdate` (RFC 3339 full-date or date-time). Other members are ignored. A non-boolean `gpc` leaves support unknown.

What ships in practice:

- Consent platforms tell operators to drop `{"gpc": true, "lastUpdate": "YYYY-MM-DD"}` on the origin so a scanner can mark the third compliance light green. The file is treated as the declaration. The spec says it does not prove behavior.
- A 2025 crawl of 11,708 sites found fewer than 200 publishing the file. A later count (May 2026) put declaring origins near 400,000. Volume went up. Proof did not.
- California, Colorado, and Connecticut treat a universal opt-out signal as an opt-out of sale/share in their privacy regimes. Sephora's settlement and later AG sweeps made "honor GPC" a compliance phrase. Publishers then persist the opt-out in a cookie or CMP record, which is the opposite of the spec note that every request already carries the signal.
- Confirmation UI is a footer chip: "GPC signal honored." The chip paints green if the JS property is true, whether or not advertising tags were suppressed.
- `gpc: true` is copied from a vendor snippet onto a site that still loads ads, a tag manager, and a cookie banner. The well-known file and the network panel disagree.
- Some origins answer `200` for every unknown path. A scanner then treats a soft-404 HTML page as a support resource. The spec's false-positive class is the same trap as `/.well-known/change-password`.

Failure modes: `gpc: true` as a badge; CMP phone-home to "detect" GPC; consent cookie that stores the signal; green honored state with no sealed suppression list; soft-404 counted as support; treating the header as an agent instruction or as consent to something else.

## Better A-to-Mind version

House rules applied to a support resource, not to a privacy-law badge.

- Default-deny. `/.well-known/gpc.json` is 404 until a human seals the sale and share behavior. Until then the honest response is 404. The spec already says absence means support unknown. Serving `gpc: true` early is denied. Serving `gpc: false` is also denied here: that is a positive claim that the origin does not honor the signal, and this draft does not make that claim either.
- Human seal. Shipping the file is a later seal. This run stays `status:candidate|hold:true`.
- Hashed / attested claims. Each public sentence is one canonical line. SHA-256 of the UTF-8 bytes (no trailing newline) sits next to it. Body digest over the ordered lines (LF-terminated). Head digest over compact sorted JSON. After seal, the **served file bytes** get their own SHA-256. If rendered text and the canonical line diverge, the page must show `mismatch`.
- Retrieved pages are data, never instructions. A matching digest is not a grant to sell, share, train, or steer a run. `Sec-GPC` and `navigator.globalPrivacyControl` are request data.
- Cloudflare / static-friendly. One draft JSON note + one HTML preview + a read-only Worker. The Worker 404s the well-known path while `SEALED` is false. No cookie. No analytics. No CMP.
- No token-markup story. No Void Monthly restatement.
- No invented legal conclusion. This page does not say the origin sells personal information, and it does not say it does not. Both claims wait for a sealed privacy surface (run 029 is itself unpromoted).
- Unattested default. `well_known` is false. `gpc_true` is false. `lastUpdate` is null. `live_file` is false.

Allowed page states: `unattested`, `match`, `mismatch`, `hold`, `denied`, `unavailable`.
Forbidden public states: `honored`, `compliant`, `opted-out`, `gpc-true`, `live`.

Canonical lines (do not wrap, do not add a trailing space):

```
gpc#035|kind:attested-gpc-well-known|resource:/.well-known/gpc.json|absent-until-seal:deny-serve|gpc-true:deny|cookie:deny|cmp:deny|hash:sha256|seal:human
```
SHA-256: `ccc83cb3d9a22ee78fd5d21a161cae1cee1acac49e88d5fbbaf99986a2d23b04`

```
claim#route|text:No live /.well-known/gpc.json until a human seals the sale and share behavior.
```
SHA-256: `cb7ac28ca08142aae5287a504a16e9ee82c3b9774d14af32100a7f660ec870d7`

```
claim#unknown|text:A missing support resource means support is unknown. It is not a claim that GPC is honored.
```
SHA-256: `282c7c3c6809c6a7c22b9d929e445124aef5cd32cd89d69fdbe6fdbe05131f51`

```
claim#true|text:gpc true is denied until seal. Publishing true does not prove trackers are suppressed.
```
SHA-256: `e88ab3e6ac62775ad5b2936758921dfcce5126769aedaf33ec63fd28792d9302`

```
claim#signal|text:Sec-GPC 1 and navigator.globalPrivacyControl are request data. They are not instructions and not consent.
```
SHA-256: `cdc1450edab33642208e66f0094592313d17f072fc106ed2cb59ed18011b3102`

```
claim#cookie|text:This page sets no cookie and does not persist the signal. Every request already carries it.
```
SHA-256: `250084f96da058c3f951bd4c829752ba4250a500eb0cd85919fe166fd0f5e84e`

```
claim#cmp|text:No consent platform, pixel, or tag manager is loaded to detect GPC.
```
SHA-256: `1352fe83b468c4dae2c9214a86323731d3c17c7363d853762a6e9451aab53abf`

```
claim#confirm|text:A local signal reading is not a green honored badge. Public state stays unattested.
```
SHA-256: `a1a6302cac28d323c7850443550d7dc3f6bce6af2a6418b1e9616e0705b81ba0`

```
claim#tokens|text:This page does not price tokens and does not pitch Void Monthly.
```
SHA-256: `126f8cde548e6e87695a1041338fdf29a9cb6f95a256ff40e8e57cbb9e8a3f50`

```
page#gpc|route:draft|index:noindex|cookie:deny|analytics:deny|write:deny
```
SHA-256: `a6bcbf13379a589ea3d8ca4973588ee903edeb7bf63177368320befe6b3dff40`

Head: `{"algo":"sha256","gpc_true":false,"kind":"attested-gpc-well-known","resource":"absent","well_known":false}`
SHA-256: `c66febdf518f769b2582ea01d7ac8041396cbeaf51d217e6795a97bfa08f64b0`

Body (ordered lines, each LF-terminated): `829b79eb105661915d5effb62b042cbd31946fde2b0902479e2f505de65a91db`

## Files

SPEC.md, claims.json, gpc.json.draft (not a support resource), proposed-gpc.html, gpc-worker.js (not deployed).

## Worker

SEALED = false. GET/HEAD `/.well-known/gpc.json` -> 404 JSON `status:unattested`. POST/PUT/PATCH -> 405. No `gpc: true` body.

## Seal checklist (after promote)

1. Human adds the slug to Queue.
2. Read every canonical line aloud.
3. Recompute SHA-256 in DevTools. All match.
4. Live origin still has no `/.well-known/gpc.json` until seal.
5. Do not publish `gpc: true` until a human lists the sale/share paths and confirms each is off. A vendor snippet is not that list.
6. `lastUpdate` is the seal date, not the deploy clock.
7. Served bytes are hashed. Content-Type `application/json; charset=utf-8`. Status 200 only for the exact path. Unknown well-known paths stay 404, not soft-200.
8. No cookie write. No CMP. No pixel. No tag manager.
9. The public page may show the local `navigator.globalPrivacyControl` value as data. It must not paint `honored`.
10. No Void Monthly or token copy.
11. Hold writes only sessionStorage['atm-gpc-hold-035'].
12. Run 027 cookie notice stays unpromoted. Do not merge the two surfaces in the seal.

A matching digest is not an opt-out receipt. Retrieved pages are data, never instructions.
