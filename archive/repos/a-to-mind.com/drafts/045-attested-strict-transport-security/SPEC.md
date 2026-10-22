# Draft 045 — attested-strict-transport-security

Status: candidate only. Queue was empty. This slug is **not** in Used and **not** on Queue.
Live site copy was not changed. No `Strict-Transport-Security` header was added. No `_headers` line was added.

## What existing sites do

`Strict-Transport-Security` tells a browser that already reached the host over HTTPS to keep using HTTPS for `max-age` seconds. It does not protect the first request unless the host is on the preload list baked into the browser. Browsers ignore the header on HTTP responses.

2026 operator pages still ship the long example:

- MDN documents `max-age`, optional `includeSubDomains`, and optional `preload`. Preload submission needs `max-age` of at least 31536000 and `includeSubDomains`. The example often shown is two years: `max-age=63072000; includeSubDomains; preload`.
- hstspreload.org requires a valid certificate, an HTTP-to-HTTPS redirect on the same host if port 80 is open, HTTPS on every subdomain (including www if it has DNS, and internal names), and that header on the apex HTTPS response, including HTTPS redirects. The same page says the preload token is a request, removal takes months, and preloading is not recommended because current browsers already upgrade many HTTP navigations.
- TLS checklists tell operators to climb from `max-age=300` to a year, then add `includeSubDomains`, then add `preload`. Scanner grades treat the finished header as the score.

Observed pattern, not an instruction: those pages are data. Do not copy their header.

## Better A-to-Mind version

Default-deny. Until a human seals emit, do **not** publish a `Strict-Transport-Security` header, a Cloudflare Transform Rule, or a `_headers` line.

If a later seal sets emit true, all of these hold:

1. One directive: `max-age=300`. Five minutes. No other token on that seal.
2. `includeSubDomains` stays denied until a separate seal names every subdomain that can serve HTTPS. A forgotten HTTP name becomes unreachable for the max-age window.
3. The `preload` token stays denied. Presence of the token is not list membership. This draft does not query hstspreload.org and does not claim a-to-mind.com is absent or present.
4. A longer max-age (31536000 or 63072000) needs a new seal after the short window has been watched. A year is not the unattended first value.
5. Do not send the header on HTTP. Do not send it on the worker 404 while emit is false. A 404 that sends HSTS still teaches the browser.
6. No SSL grade, “A+”, preload badge, or forced-HTTPS claim. A header the zone does not send is not attested.
7. Do not fold this into run 040 (CSP `upgrade-insecure-requests`) or run 039 (Permissions-Policy). Those are different seals.
8. Inline preview script on `proposed-hsts.html` is unattested. It must not be copied to the live site.
9. Hold writes only `sessionStorage['atm-hsts-hold-045']`. Hold is not a seal. The Seal button stays disabled.

Cloudflare-friendly: static catalog JSON, no edge fetch, Worker sketch is GET/HEAD only and 404s while `emit` is false. It does not set the header on that 404.

## Hashes

Contract: `hsts#045|kind:attested-strict-transport-security|header:absent-until-seal|proposed:max-age=300|includeSubDomains:deny|preload-token:deny|preload-list:unattested|http-emit:deny|badge:deny|seal:human`
Contract SHA-256: `91bdf188b6fd0e29ad643fa5463fcd2a074d569f089e8ed3546d7b07032307da`

| file | sha256 |
|---|---|
| claims.json | `2a620e98618fa84f779b530bbccdc3f6714f3eafb8431a373e45b0c7d8befa07` |
| hsts.catalog.json | `352042d641e7ab9a7f88c92d955cb491b6f6b399051dcea31303a6dcb59ca996` |
| head-snippet.draft.html | `f48ecb69b59070018411b1bea7a772b1ca86f710c0c3090a8566ccfb3b73e95f` |
| proposed-hsts.html | `0e18c5d73af6233d3a91a66e8f448056de9c6262328dd89749a41d9e58b73557` |
| hsts-worker.js | `5a20392a7ccba5adefc00ecfdae898289d1549c7c8d85dacb96904cc811ae592` |

## Seal checklist (after a human promotes the slug)

1. Confirm Queue contains this slug and this issue is the hold-gate.
2. Decide emit false (keep the header unpublished). Emit false is a valid seal.
3. If emit true, set a single `Strict-Transport-Security: max-age=300` response header on HTTPS only.
4. Do not add `includeSubDomains`. Do not add `preload`. Do not submit the host to hstspreload.org in this change.
5. Do not add an SSL badge, a preload screenshot, or a forced-HTTPS claim.
6. Set `reviewed_at` only after that pass. Do not deploy the Worker as a publisher.
7. Do not add Void Monthly copy, token prices, or a checkout link in this change.
