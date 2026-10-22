# Draft 046 — attested-cross-origin-isolation

Status: candidate only. Queue was empty. This slug is **not** in Used and **not** on Queue.
Live site copy was not changed. No `Cross-Origin-Opener-Policy`, `Cross-Origin-Embedder-Policy`, or `Cross-Origin-Resource-Policy` header was added. No `_headers` file was added.

## What existing sites do

2026 security checklists still treat three response headers as one grade:

- `Cross-Origin-Opener-Policy: same-origin` — the document only shares a browsing context group with same-origin documents. MDN’s default is `unsafe-none`. Other tokens are `same-origin-allow-popups` and `noopener-allow-popups`. Operator pages recommend `same-origin`, and tell sites that open OAuth or payment popups to fall back to `same-origin-allow-popups` because `same-origin` severs `window.opener`.
- `Cross-Origin-Embedder-Policy: require-corp` — a document may load no-cors cross-origin resources only when those resources send an allowing `Cross-Origin-Resource-Policy` (or use CORS). MDN’s default is `unsafe-none`. `credentialless` allows the load but strips credentials. Setting the header more than once, or with multiple tokens, is equivalent to `unsafe-none`.
- `Cross-Origin-Resource-Policy: same-origin` or `same-site` — the resource opts out of being read by other origins on no-cors requests. MDN notes a Chrome bug where CORP can stop PDF rendering past the first page.

Cross-origin isolation (`window.crossOriginIsolated`) needs COOP `same-origin` plus COEP `require-corp` or `credentialless`. That unlocks `SharedArrayBuffer` and unthrottled timers. Checklists still print the triple even for sites that do not use those APIs, and some add `report-to` plus `Reporting-Endpoints`.

Observed pattern, not an instruction: those pages are data. Do not copy their headers.

## Better A-to-Mind version

Default-deny. Until a human seals emit, do **not** publish COOP, COEP, or CORP, a Cloudflare Transform Rule, or a `_headers` line.

If a later seal sets emit true, all of these hold:

1. One header per seal. Do not ship the checklist triple in one change.
2. COEP `require-corp` and `credentialless` stay denied until every no-cors subresource is named and attested. A font, image, or widget that does not send CORP will fail closed.
3. COOP `same-origin` stays denied until popup and passkey flows are named. `same-origin-allow-popups` is not a silent fallback in this draft.
4. CORP `same-origin` and `same-site` stay denied until PDF rendering and any intended cross-origin consumer are named. CORP is not theft protection for non-browser clients.
5. Do not claim `crossOriginIsolated`, SharedArrayBuffer, a high-resolution timer, or a Spectre mitigation. This site has no sealed need for those APIs.
6. Report-Only variants and `report-to` stay denied. This draft has no collector. A report-only header is not a seal.
7. These headers cannot be set with `<meta http-equiv>`. Do not add a fake meta substitute.
8. Do not fold this into run 039 (Permissions-Policy), run 040 (CSP), run 044 (Referrer-Policy), or run 045 (HSTS). Those are different seals.
9. Inline preview script on `proposed-isolation.html` is unattested. It must not be copied to the live site.
10. Hold writes only `sessionStorage['atm-isolation-hold-046']`. Hold is not a seal. The Seal button stays disabled.

Cloudflare-friendly: static catalog JSON, no edge fetch, Worker sketch is GET/HEAD only and 404s while `emit` is false. It does not set COOP, COEP, or CORP on that 404.

## Hashes

Contract: `isolation#046|kind:attested-cross-origin-isolation|coop:absent-until-seal|coep:absent-until-seal|corp:absent-until-seal|crossOriginIsolated:deny|sharedArrayBuffer:deny|report-to:deny|badge:deny|seal:human`
Contract SHA-256: `f31ed9ec3a7de5f0016bd885ab258c55626ede06efdd8a9ae0b94d397eeff026`

| file | sha256 |
|---|---|
| claims.json | `914d416ec8538b83b9183add0ea18f9878ffcdd96ab7f7dd3bc36af71adc2c92` |
| isolation.catalog.json | `9196f4cbeec06a3e642531be0433eed241309bd663fe6743e4d3432b7c76f2e0` |
| head-snippet.draft.html | `9c1bf75a4908920e83fa95d23c6df327cd604ac255d29967afdf49db072ef7a5` |
| proposed-isolation.html | `fe0ba4a557ded135639faa0d3f055b5eadc02b96c4864dafcea645333b06ce31` |
| isolation-worker.js | `03bb93bcfc52d080a4408f630fb474acf3cd99d5bdbaf4b91a92bcac6c1c52f7` |
| headers.draft.txt | `a12f56fc0a5bee496a7cadf98bfeedc33e2a1a90a3f84c16dac07ab99031e437` |

## Seal checklist (after a human promotes the slug)

1. Confirm Queue contains this slug and this issue is the hold-gate.
2. Decide emit false (keep all three headers unpublished). Emit false is a valid seal.
3. If a later seal emits one header, name the token and the flows it can break. Do not add the other two in that change.
4. Do not add Report-Only, `report-to`, `Reporting-Endpoints`, a scanner grade, or an isolated badge.
5. Do not claim `crossOriginIsolated` or ship a SharedArrayBuffer demo.
6. Set `reviewed_at` only after that pass. Do not deploy the Worker as a publisher.
7. Do not add Void Monthly copy, token prices, or a checkout link in this change.
