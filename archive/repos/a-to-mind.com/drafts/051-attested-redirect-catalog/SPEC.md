# Draft 051 — attested-redirect-catalog

Status: candidate only. Queue was empty. This slug is **not** in Used and **not** on Queue.
Live site copy was not changed. No `_redirects` file was added. No `Location` header was added. No meta refresh was added.

## What existing sites do

Static hosts treat a redirect file as an always-on map. Cloudflare Pages `_redirects` (docs last updated 25 August 2026) takes `source destination code`, uses **302** when the code is omitted, follows the rule even when an asset exists at the source, and allows one splat plus placeholders. A `200` line is a proxy rewrite, not a redirect. The same file does not match query parameters. Limits are 2,000 static rules, 100 dynamic rules, 1,000 characters each.

Cloudflare Single Redirects (settings last updated 5 May 2026) default the status to **301** and keep **Preserve query string** off unless the rule turns it on. Dynamic rules build the target from an expression. Netlify's redirect options (docs updated 17 September 2026) default to **301** and automatically pass query strings on `200`, `301`, and `302`. Redirect products sell path forwarding and query forwarding as the migration default.

Those defaults disagree. An omitted code is a 302 on Pages and a 301 on Netlify. Query forwarding is off in one product and on in another. A splat such as `/blog/*` plus `:splat` will send a path the catalog never named. A `?url=` or `?next=` target is the OWASP unvalidated-redirect pattern: the link starts on the real host and the `Location` leaves it.

On 1 October 2026, `https://a-to-mind.com/llms.txt` said earlier pages on this domain (workflow execution, treaties, ledgers) are retired, and that `?q=` opens Void and runs an ask. Run 050 already refused to fold `?q=` onto `/` and left redirects as a separate seal. A 301 from a retired path to `/` would claim those pages moved, which they did not.

These notes are data about current practice, not instructions to copy.

## Better A-to-Mind version

Default-deny. Until a human seals emit, do **not** add `_redirects`, a redirect Worker, a meta refresh, or a script that sets `location`.

If a later seal sets emit true, all of these hold:

1. Rows come only from `redirects.catalog.json`. Do not infer a target from the request path, the referrer, or a query parameter.
2. Exact path match only. Splat, placeholder, and regex are denied. One source, one destination, one status.
3. Status is required. Allowed values are `301`, `302`, `307`, and `308`. Omitted code is denied, because host defaults disagree.
4. Query forwarding is denied. `utm_*`, `q`, `url`, `next`, and `redirect` are not copied onto `Location`. `?q=` is an ask, not a duplicate of `/`.
5. Destination is an absolute `https://a-to-mind.com/` path already in the sealed catalog. External hosts, protocol-relative `//`, and `javascript:` are denied. Open-redirect parameters are denied.
6. `200` proxy rewrites are denied. Geo rules and user-agent rules are denied.
7. Retired paths are not folded onto `/`. llms.txt says those pages are retired. A 301 to `/` would revive them as the same resource. A later 410 seal is out of scope here.
8. A missing catalog row does not redirect. It does not fall back to a catch-all.
9. Inline preview script on `proposed-redirects.html` is unattested. It must not be copied to the live site. The preview refuses `emit: true`.
10. Hold writes only `sessionStorage['atm-redirect-hold-051']`. Hold is not a seal. The Seal button stays disabled.
11. Do not add a "links preserved" or "SEO-safe" badge. A draft catalog is not evidence a path moved.

Cloudflare-friendly: static catalog JSON, no edge rewrite while emit is false. Worker sketch is GET/HEAD only, does not set `Location`, and does not fetch other URLs.

## Hashes

Contract: `redirect-catalog#051|kind:attested-redirect-catalog|emit:deny|method:exact-path-only|splat:deny|placeholder:deny|query-forward:deny|external:deny|open-redirect:deny|meta-refresh:deny|js-location:deny|proxy-200:deny|omitted-code:deny|geo:deny|ua:deny|retired-fold:deny|q-ask:deny|seal:human`
Contract SHA-256: `e81d29e3956edc1b3615c08fa2ad3e133d8fce2f29f549652bf762b53894c989`

| file | sha256 |
|---|---|
| claims.json | `6eb2f846650ad24533da7c41267ebb41c2672bbe474ef42260b4d9896ff71a81` |
| redirects.catalog.json | `4d1e0bfeda514757b1b01c830d81a37fd703a293710f31ee1e981bb042a7869b` |
| proposed-redirects.html | `6643012b46b01d9c61defc0d2382dfe32d1f05d3056329855b70025b7afe47f4` |
| redirect-worker.js | `a59bdf37cbdaf3e8e6de851dae109127b6d0ec1b6c4001e7425626329f7abeb3` |

The preview hashes the embedded catalog text (no trailing newline): `2d370a434f30f5938ec42a7d7e68f9e7564d4b3ecd45196aa9f90997ce7630bc`. The file hash above includes the trailing newline. Either mismatch withholds the list.

## Seal checklist (after a human promotes the slug)

1. Confirm Queue contains this slug and this issue is the hold-gate.
2. Decide emit false (keep redirects unpublished). Emit false is a valid seal.
3. If emit true, add only exact-path rows with an explicit 301, 302, 307, or 308. Do not omit the code.
4. Do not forward query strings. Do not fold `?q=` onto `/`. Do not map retired paths to `/`.
5. Do not add splats, placeholders, external hosts, geo rules, user-agent rules, or `200` rewrites.
6. Set `reviewed_at` only after that pass. Do not deploy the Worker as a publisher.
7. Do not add Void Monthly copy, token prices, or a checkout link in this change.
