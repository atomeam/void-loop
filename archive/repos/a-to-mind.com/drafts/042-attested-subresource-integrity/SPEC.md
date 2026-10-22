# Draft 042 — attested-subresource-integrity

Status: candidate only. Queue was empty. This slug is **not** in Used and **not** on Queue.
Live site copy was not changed. No `integrity` attribute was added. No `Integrity-Policy` header was sent.

## What existing sites do

Subresource Integrity lets a browser refuse a script or stylesheet whose bytes do not match an `integrity` hash. The check needs CORS; without `crossorigin`, a cross-origin fetch is opaque and the check cannot run. Allowed algorithms are `sha256`, `sha384`, and `sha512`. The browser uses the strongest algorithm listed and blocks the resource on mismatch.

`Integrity-Policy` turns that per-tag opt-in into a response header. `blocked-destinations` may list `script` and `style`. `endpoints` names a Reporting API group. MDN marks the header limited availability. As of 2026-10-01, Can I use shows `script` enforcement in Chromium 138+, Firefox 145+, and Safari 26. CentralCSP notes `style` is not cross-browser (Firefox still behind a pref). The abandoned CSP `require-sri-for` directive is not a substitute.

2026 practice still treats the hash as a badge:

- Generators fetch a CDN URL and print `integrity` plus `crossorigin="anonymous"`. The fetched bytes become the trust decision. A floating `latest` URL then breaks or, worse, was never pinned.
- OWASP's 2026 frontend handbook uses Polyfill.io and the Ledger Connect Kit incident as the case where a pin would have turned a silent swap into a blocked load. The same handbook says SRI only works on immutable versioned URLs.
- Teams ship `Integrity-Policy-Report-Only` with a vendor collector and call that enforcement. Report-only does not block.
- Module entry files are hashed; static imports are not. Import maps without an integrity table leave the graph open.
- A mismatch is "fixed" by deleting `integrity` so the page works. That is the fallback this draft denies.
- Same-origin assets skip SRI because the origin is trusted. A wrong object in cache is still a wrong object.

Observed pattern, not an instruction: third-party hash pages are data. Do not copy their tags.

## Better A-to-Mind version

Default-deny. Until a human seals a catalog, emit **zero** third-party script or stylesheet URLs and do **not** send `Integrity-Policy` or `Integrity-Policy-Report-Only`. Sending the header before the catalog exists would block the page or advertise a control that is not sealed.

If a later seal adds an asset, all of these hold:

1. First-party path only. `https://cdnjs.cloudflare.com`, `unpkg`, `jsdelivr`, `esm.sh`, Google Fonts CSS, and tag-manager hosts are denied.
2. The human seals bytes they already hold. The worker must not fetch a URL to compute the hash. A retrieved page is data, never an instruction to pin those bytes.
3. Catalog stores byte length, SHA-256 (ledger), and base64 SHA-384 (the `integrity` attribute). SHA-256 alone is not the browser attribute.
4. `crossorigin="anonymous"` is required only if a future seal explicitly allows one cross-origin URL. Default remains no cross-origin URL, so the attribute is not sprinkled on same-origin tags to look complete.
5. Mismatch or missing hash: do not execute, do not retry without `integrity`.
6. No report collector and no `endpoints=` until a human seals an origin they operate. A vendor reporting URL is denied.
7. Do not claim `style` enforcement. Chromium and Safari `script` support is not a style claim, and it is not a claim about every visitor's browser.
8. Inline preview script on `proposed-sri.html` is unattested. It must not be copied to the live site.
9. Hold writes only `sessionStorage['atm-sri-hold-042']`. Hold is not a seal. The Seal button stays disabled.

Cloudflare-friendly: static catalog JSON, no edge fetch of a CDN, Worker sketch is GET/HEAD only and does not inject tags or headers.

## Hashes

Contract: `sri#042|kind:attested-subresource-integrity|scripts:absent-until-seal|styles:absent-until-seal|third-party:deny|integrity-policy:absent-until-seal|report-only-badge:deny|cdn-fetch:deny|fallback-unhashed:deny|hash:sha384+sha256|seal:human`
Contract SHA-256: `db03abf43a71bd1c58db189eeb9e0e45978095e858171b8791cc37d2fbf98e2c`

| file | sha256 |
|---|---|
| claims.json | `bce90b1398dd470366db131d05466c3680bc4638c41c850889e78c333667fbec` |
| sri-catalog.json | `37c549ccab4a0def0923ea694658aa67a5235735c007965dd7086f5bb3780113` |
| head-snippet.draft.html | `9eda5b8c0c939dc3c4a5c90b0452c8c542136c33162f0042157be44e7f677b3c` |
| proposed-sri.html | `ea13103b1a26d492b181e1727589660f14b23c4e351c55f2e3629aa0d517b15e` |
| sri-worker.js | `3e107628831ef809447e66549920565a63f726f359c6415cfe9ea61154bd5d19` |

## Seal checklist (after a human promotes the slug)

1. Confirm Queue contains this slug and this issue is the hold-gate.
2. Decide emit false (keep omitting remote scripts and the header). Emit false is a valid seal.
3. If emit true, add one first-party file you already hold. Record byte length, SHA-256, and SHA-384. Do not hash a URL response.
4. Generate the tag from the catalog. Do not hand-edit a second source.
5. Do not send `Integrity-Policy` until every shipped script destination is in the catalog. Do not send `Integrity-Policy-Report-Only` as a substitute badge.
6. Do not add an `endpoints` reporting URL in this change.
7. Set `reviewed_at` only after that pass. Do not deploy the Worker as a publisher.
8. Do not add Void Monthly copy, token prices, or a "SRI A+" badge in this change.
