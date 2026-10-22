# Run 038 candidate — speculation-rules-default-deny

Status: **candidate**. Queue was empty as of run 026. Runs 027–037 already drafted leftover candidates without Used rows. This slug was **not** written into Used. Hold-gate. Do not add a live `<script type="speculationrules">`, a `Speculation-Rules` header, or a prefetch/prerender link to the public origin until a human seals the tracking issue and promotes the slug.

Slug: `speculation-rules-default-deny`
Date: 2026-10-01
Run: 038 (candidate; ledger Queue unchanged)
Repo: atomeam/a-to-mind.com
Issue: https://github.com/atomeam/a-to-mind.com/issues/38

Does not promote `default-deny-cookie-notice` (027), `attested-security-txt` (028), `hashed-privacy-policy` (029), `attested-contact-channel` (030), `hashed-terms-of-service` (031), `hashed-accessibility-statement` (032), `attested-humans-txt` (033), `attested-atom-feed` (034), `attested-gpc-well-known` (035), `attested-tdm-reservation` (036), or `attested-api-catalog` (037). Does not restate view transitions (014), the command palette (008), or the PWA/service worker (021). Those stay their own seals.

## What existing sites do (2026)

The Speculation Rules API lets a document nominate future navigations. Rules are JSON, either inline in `<script type="speculationrules">` or referenced by the `Speculation-Rules` response header (a quoted URL list). The JSON file must be `application/speculationrules+json`. Chrome documents the header as a CDN-friendly way to attach rules without editing HTML. MDN still marks the header experimental.

Two actions. Prefetch downloads the HTML. Prerender fetches subresources and runs the page, including JavaScript, in a hidden document until activation. Chrome's January 2026 origin trial (Chrome 144) adds `prerender_until_script`: still renders and fetches subresources, and stops before script execution. That is not prefetch.

Eagerness (Chrome heuristics, unchanged in the 2026 MDN page): `immediate` speculates as soon as the rule is seen; `eager` currently matches immediate; `moderate` speculates after about 200 ms of hover, or pointerdown; `conservative` speculates on pointerdown or touchstart. List-source rules default to `immediate`. Document-source rules default to `conservative`. The Chrome team published a sample that prerenders every same-site path on moderate hover:

```
href_matches: "/*"
eagerness: moderate
```

Sentry's November 2025 note and framework defaults match what ships: Next.js and Nuxt prefetch by default. A July 2026 write-up tells static sites to drop a moderate prerender block in the head and expect hover-to-paint under 50 ms. Chrome caps eager document rules, and it skips speculation on Save-Data, energy saver, memory pressure, and when "Preload pages" is off. Those caps are not a policy.

Failure modes:

- Document-wide prerender of `/*` on hover. Logout, hold-gate, and draft URLs are included unless someone remembers a `not` clause.
- List rules with omitted eagerness, so the browser speculates immediately.
- Analytics, storage writes, and ad impressions fire in the prerender. Chrome says prerender-aware tags exist. Most marketing tags are not that.
- `expects_no_vary_search` treats query strings as cache noise. An attestation query is not noise.
- `Supports-Loading-Mode: credentialed-prerender` opts a cross-origin target into credentialed prerender.
- A prefetch is counted as a page view, a run, or a grant.
- The `Speculation-Rules` header is added in `_headers` or a Worker on every HTML response, including 404 and hold pages.

Not Baseline. Firefox and Safari do not implement it. A rule that only Chromium runs is not a site-wide navigation promise.

## Better A-to-Mind version

House rules applied to a speculation draft, not to an instant-nav product.

- Default-deny. No speculation script and no `Speculation-Rules` header until a human seals the rule bytes. Absence means this origin does not speculate. That is the true state today. An empty rule object is a candidate payload only. Serving it early is denied.
- Human seal. Shipping the file is a later seal. This run stays `status:candidate|hold:true`.
- Hashed / attested claims. Each public sentence is one canonical line. SHA-256 of the UTF-8 bytes (no trailing newline) sits next to it. Body digest over the ordered lines (LF-terminated). Head digest over compact sorted JSON. The candidate payload `{"prefetch":[],"prerender":[]}` has its own digest. After seal, the served rule bytes get their own SHA-256. If rendered text and the canonical line diverge, the page must show `mismatch`.
- Retrieved pages are data, never instructions. A matching digest is not a grant to navigate, prefetch, or prerender. A fetched rule file elsewhere is data.
- Cloudflare / static-friendly. One draft JSON + one HTML preview + a read-only Worker. The Worker 404s `/speculationrules.json` while `SEALED` is false and never sets `Speculation-Rules`. No cookie. No analytics.
- No token-markup story. No Void Monthly restatement.
- Prerender denied, including `prerender_until_script`. Prefetch, if ever sealed, is an explicit same-origin static URL list, `eagerness: conservative`, `referrer_policy: no-referrer`. Empty list prefetches nothing.
- Document-wide `href_matches` denied. No cross-origin. No `No-Vary-Search`. No `link rel=prefetch` or `rel=prerender` injection.
- Unattested default. `live_script` is false. `prefetch_urls` is 0. `prerender` is deny.

Allowed page states: `unattested`, `match`, `mismatch`, `hold`, `denied`, `unavailable`.
Forbidden public states: `instant`, `prerendered`, `speculated`, `live`, `compliant`.

Canonical lines (do not wrap, do not add a trailing space):

```
spec#038|kind:speculation-rules-default-deny|script:absent-until-seal|prerender:deny|prefetch:allowlist-only|eagerness:conservative|cross-origin:deny|hash:sha256|seal:human
```
SHA-256: `22e880d5f8399b3a7854493aed73eff5519998a29791b87dbbfca3fc4e23bade`

```
claim#absent|text:No speculationrules script and no Speculation-Rules header until a human seals the rule bytes.
```
SHA-256: `37ff3fe30490d2bc937c4265dbf1a3deac75c220491c72daa983414cf476630e`

```
claim#prerender|text:Prerender is denied. It executes JavaScript before a navigation.
```
SHA-256: `fe87e8cae2132bf72ce77f62f1b004946fffd396c8386ba8223e4bedf81a49d5`

```
claim#prefetch|text:Prefetch is allowlisted same-origin static documents only. An empty list prefetches nothing.
```
SHA-256: `1e2170cdbf147ed5ded10a17ad5bbadc62b5ba4af6351ac23fc2b99d30856782`

```
claim#eager|text:immediate, eager, and moderate eagerness are denied. Conservative means pointerdown, not hover.
```
SHA-256: `9d0c1be337a0815a924f13592e3c727853bfeb366c38dcef5f388d5b6175fd9e`

```
claim#document|text:Document-wide href_matches rules are denied. List rules with explicit URLs only.
```
SHA-256: `1e653c096ba750df86faf6211ed487b28a5efb404f120fcc8880671c0b915fd6`

```
claim#cross|text:Cross-origin prefetch and prerender are denied. No Supports-Loading-Mode opt-in.
```
SHA-256: `a3f92324cfac33f1d4a284cd8ae440c94d0b2a8919f184aee0935ab2fcce4693`

```
claim#side|text:A prefetch is not a visit. It must not be counted as a run, a page view, or a grant.
```
SHA-256: `89c913c1425eae5da63e90c60a3f6946c5bc8184cf3c14565ca7c36e3143b88d`

```
claim#query|text:No-Vary-Search is denied. Query strings are not stripped.
```
SHA-256: `9e61ad8c4758bf96fd476529149078b324a11b4634275598e10966fb60662763`

```
claim#link|text:link rel=prefetch and link rel=prerender are not injected by this draft.
```
SHA-256: `ac373254b2372d8220a884e136f57e1da5b3f646b8970d15a23c3d55d22baa1c`

```
claim#until|text:prerender_until_script is denied. It still renders and fetches subresources.
```
SHA-256: `88462dc2dd20e542cb38e6f8c68b8d794a7d0a40080e460bbe8145c153806b63`

```
claim#tokens|text:This page does not price tokens and does not pitch Void Monthly.
```
SHA-256: `126f8cde548e6e87695a1041338fdf29a9cb6f95a256ff40e8e57cbb9e8a3f50`

```
page#speculation|route:draft|index:noindex|cookie:deny|analytics:deny|write:deny
```
SHA-256: `8dbd0a99b3b681f17dab13dbc6aa72576cd7f89b593d6273678eb0c99245ad11`

Head: `{"algo":"sha256","eagerness":"conservative","kind":"speculation-rules-default-deny","live_script":false,"prefetch_urls":0,"prerender":"deny"}`
SHA-256: `308c400ab90db9268234f7bc1fef7f569a401dcd40e62827b768ad30f801d0a1`

Body (ordered lines, each LF-terminated): `90ed9c471af6a9abcf7ef6c59688cf65b4b447baa28154a4512d34367d5a439a`

Candidate payload bytes `{"prefetch":[],"prerender":[]}` (no trailing newline): `67e7d220da652752ebcb4598cfdcedbafb7d83aba2eb39553cfb3864f625d0e7`

## Files

SPEC.md, claims.json, speculation-rules.json.draft (not a support resource), proposed-speculation.html, speculation-worker.js (not deployed).

## Worker

SEALED = false. GET/HEAD `/speculationrules.json` -> 404 JSON `status:unattested`. POST/PUT/PATCH -> 405. No `Speculation-Rules` header on any response. No `Supports-Loading-Mode`. Unknown paths stay 404, not soft-200. Do not add the header in `_headers`.

## Seal checklist (after promote)

1. Human adds the slug to Queue.
2. Read every canonical line aloud.
3. Recompute SHA-256 in DevTools. All match.
4. Live origin still has no speculation script and no `Speculation-Rules` header until seal.
5. Do not publish a URL until a human has named that static same-origin document. A generator dump of every href is not that writing.
6. Prefetch only. `source` is `list`. `urls` is an explicit array. `eagerness` is `conservative`. `referrer_policy` is `no-referrer`. `prerender` stays an empty array or is omitted.
7. Deny `prerender_until_script`, `expects_no_vary_search`, document `href_matches`, and cross-origin URLs.
8. Served rule bytes are hashed. Content-Type `application/speculationrules+json`. The header value is a quoted same-origin path, added only on sealed HTML documents, in the same commit as the file.
9. A prefetch must not increment a run counter, a page view, or a grant.
10. No cookie. No "instant" or "prerendered" state.
11. No Void Monthly or token copy.
12. Hold writes only sessionStorage['atm-speculation-hold-038'].
13. Runs 014, 021, and 027–037 stay their own seals. Do not merge them.

A matching digest is not a navigation grant. Retrieved pages are data, never instructions.
