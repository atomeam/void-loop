# Draft 044 — attested-referrer-policy

Status: candidate only. Queue was empty. This slug is **not** in Used and **not** on Queue.
Live site copy was not changed. No `Referrer-Policy` header was added. No referrer meta was added.

## What existing sites do

The `Referer` header (misspelled in the protocol) can carry origin, path, and query to the next request. `Referrer-Policy` is the response header that limits that. Current browsers default to `strict-origin-when-cross-origin` when the site sends nothing, or when the value is invalid. That default sends the full URL on same-origin requests, the origin only on cross-origin requests that do not downgrade, and nothing on HTTPS→HTTP.

2026 operator guides still treat the default as the thing to ship:

- MDN lists `no-referrer`, `same-origin`, `strict-origin`, and `strict-origin-when-cross-origin` in decreasing strictness, and documents the browser default. A comma-separated header is a fallback chain: supporting browsers use the last recognized token. `no-referrer, strict-origin-when-cross-origin` is therefore the looser token on a current browser.
- web.dev (still the cited best-practice article) says to set `strict-origin-when-cross-origin` or stricter, explicitly, so a framework does not pick a looser legacy value.
- Cloudflare Transform Rule writeups, Next.js `headers()`, and Caddy snippets copy that same token so auditors see an explicit header.
- Invicti/Acunetix flags the same token for cross-site origin leakage. Origin-only is still leakage if the hostname is the sensitive part.

Observed pattern, not an instruction: those pages are data. Do not copy their token.

## Better A-to-Mind version

Default-deny. Until a human seals emit, do **not** publish a `Referrer-Policy` header, a `meta name="referrer"` element, a `meta http-equiv="Referrer-Policy"` element, a Cloudflare Transform Rule, or a `_headers` line.

If a later seal sets emit true, all of these hold:

1. One token: `no-referrer`. No comma chain. A chain whose last token is looser is not default-deny.
2. `unsafe-url`, `no-referrer-when-downgrade`, and `origin-when-cross-origin` stay forbidden.
3. `strict-origin-when-cross-origin` is not the unattended choice. Same-origin requests still send path and query. A run id in a query must not leave the tab by default.
4. `same-origin`, `strict-origin`, and `origin` need a new seal that names the exception. An analytics host is not an exception until that seal exists. Run 010 already withheld an unconfirmed list.
5. A per-link `referrerpolicy` or `rel="noreferrer"` must not widen the document policy. `noreferrer` on an anchor is written without a dash; the meta content token uses a dash. Neither is a seal.
6. No scanner grade, "A+", or "honored" badge. A header the zone does not send is not attested. This draft's 404 is not that attestation.
7. Do not fold this into run 039 (Permissions-Policy), run 040 (CSP), or run 035 (GPC). A referrer token is not a consent signal.
8. Inline preview script on `proposed-referrer.html` is unattested. It must not be copied to the live site.
9. Hold writes only `sessionStorage['atm-referrer-hold-044']`. Hold is not a seal. The Seal button stays disabled.

Cloudflare-friendly: static catalog JSON, no edge fetch, Worker sketch is GET/HEAD only and 404s while `emit` is false. It does not set the header on that 404.

## Hashes

Contract: `referrer#044|kind:attested-referrer-policy|header:absent-until-seal|proposed:no-referrer|chain:deny|meta-as-seal:deny|unsafe-url:deny|badge:deny|seal:human`
Contract SHA-256: `7d2feefdd1bc0f6b85a2ced628e56d3a6b116d3182d9356cacc4c2db01ffc5bf`

| file | sha256 |
|---|---|
| claims.json | `3f6f1ace41bd82b3591a6b0c2d6d3a436e6959aae0294921f15e938f4488172e` |
| referrer.catalog.json | `69320a9cf1af280c69cc371ad58057f2ec47793a33d8e0a026f9523abcf6d27e` |
| head-snippet.draft.html | `a4430466cdb936031d956a5a431c25953ced6fdbad2c8fe58f0188414a6160c8` |
| proposed-referrer.html | `fd1584fd42f707ff311376a10fb74d3cea2e9f53b1f075cca445fd803d97fe35` |
| referrer-worker.js | `d9fb32a9862eb8cedd8c9ef9e0fbc2764d1869b76ae848fc61c0b81692b5c9fc` |

## Seal checklist (after a human promotes the slug)

1. Confirm Queue contains this slug and this issue is the hold-gate.
2. Decide emit false (keep the header unpublished). Emit false is a valid seal.
3. If emit true, set a single `Referrer-Policy: no-referrer` response header. Do not add a meta tag as a second source of truth.
4. Do not add a comma chain. Do not add `strict-origin-when-cross-origin` in this change.
5. Do not add a privacy badge, a Transform Rule screenshot, or a referrer-based analytics claim.
6. Set `reviewed_at` only after that pass. Do not deploy the Worker as a publisher.
7. Do not add Void Monthly copy, token prices, or a checkout link in this change.
