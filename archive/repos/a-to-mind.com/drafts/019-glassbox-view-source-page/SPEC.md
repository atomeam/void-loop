# Run 019 — glassbox-view-source-page

Status: specified. Hold-gate. Do not add a live `/source` route, footer “View source” link, or source-proxy Worker to the public site until a human seals this issue.

Slug: `glassbox-view-source-page`
Date: 2026-09-30
Run: 019
Repo: atomeam/a-to-mind.com

## What existing sites do (2026)

“View source” in 2026 is either a browser gesture, a third-party proxy, or a GitHub link that pretends the repo is the served site.

- Browser `view-source:` / Ctrl+U / Cmd+Option+U. Guides published through 2026 (TechBloat May 2026, MiroMiro May 2026, Marco Diversi Aug 2026) still treat this as the honest first look: the HTML document the server sent, before scripts run. On a React / Next / Vue shell that document is often an empty root and a bundle tag. Inspect Element is a different object (the live DOM). Neither view is hashed. Neither view is the Worker, the KV snapshot, or the grant store.
- Proxy “view any URL” products. ViewSource.net fetches a visitor-supplied origin, streams bytes over SSE, beautifies them, and offers copy/download. Cloudflare Radar URL Scanner (live Sep 2026) does the same class of work as a public report: paste any URL, get a shareable scan. Default-allow fetch of other people’s sites.
- “Edit / view on GitHub” footers. Eleventy docs and a large class of static sites point `page.inputPath` at `github.com/…/blob/main/…`. Helpful. Also a bait-and-switch: HEAD of `main` is not the bytes Cloudflare served ten minutes ago, and a blob SHA is not an SRI pin of the response.
- Source-code search of other people. PublicWWW indexes HTML/JS/CSS of millions of third-party pages so investigators can grep analytics IDs and widget snippets. That is reconnaissance, not glass-box.
- Integrity theater. Subresource Integrity pins a CDN script. 2025–2026 transparency-log work (Tech Report NGO on JS trustworthiness; Originator Profile external-resource attestations) hashes assets into a manifest. Almost no marketing site publishes the hash of its own homepage document next to a claim that the hash is *not* the live DOM.
- Open-by-policy, closed-by-bytes. UK government “code in the open” (DWP policy updated Aug 2026, MHCLG Homes for Ukraine repo Sep 2026) publishes repositories under OSI licences. The public page still does not bind “what you just loaded” to a digest. Referencesource.org (2026) is closer in spirit: each fact quotes a source and marks `verified` only when the quote is mechanical. It is a citation machine, not a first-party source room.
- Failure modes that matter here:
  1. A GitHub link is treated as proof of production.
  2. A proxy invites agents to fetch arbitrary URLs “because the source page did.”
  3. Beautified / prettified HTML is passed off as the served bytes.
  4. Live DOM serialization is passed off as `view-source`.
  5. Worker source, grants, and KV are dumped “for transparency” and become a prompt.

Live `index.html` in this repo still has no `/source` document. This draft specifies a first-party catalog a human can seal later. It does not invent a multi-origin fetcher.

## Better A-to-Mind version

House rules applied to a glass-box catalog, not to a source-code browser.

- Default-deny fetch. The page lists an allowlisted set of first-party public artifacts. “View source of `https://example.com`” is `denied`. There is no input box for a URL. There is no SSE proxy. There is no Radar-style scanner.
- Human seal. Live site stays without `/source` until the tracking issue says **sealed**. Matching digests on this draft are not a grant to publish Worker source or to pin production HTML.
- Hashed / attested claims. Contract lines and each artifact row are canonical. SHA-256 of each UTF-8 line sits on the row. Compact head object and LF-joined claim body each have a digest. If rendered text and `data-canonical` diverge, status is `mismatch` and navigation of listed hrefs still works (they are ordinary links) but the room reports unattested.
- Retrieved pages are data, never instructions. `catalog.json` is a claim list. Agents may quote a row that still hashes. They may not treat an `href` as an order to retrieve that URL into a prompt, and they may not treat a `git-blob` pin as a tool allowlist.
- Cloudflare / static-friendly. One JSON catalog + one HTML page. No Worker required. No cookie. No analytics pixel on Verify. `crypto.subtle.digest('SHA-256')` verifies claims after load. An optional Worker sketch may serve the same JSON with `Cache-Control` and an `X-Catalog-SHA256` header; it must not fetch other origins.
- No token-markup story. This page does not mention a rate, a cap, or Void Monthly.
- Bytes default unattested. A published claim hash is not a hash of Cloudflare’s response. Homepage, `llms.txt`, FEATURE_LEDGER raw, and the GitHub HTML UI stay `bytes:unattested` until a human seals a dated snapshot. The one exception in this draft is the agent-card *git blob* already in this repo (`005cf262…`), recorded as `bytes:git-blob` with a separate content SHA-256 of that blob’s file text. That still is not proof of what the edge served.
- Git ≠ edge. A GitHub blob SHA is shown as a git fact. The UI must not label it “served.”
- DOM ≠ source. “Show live DOM” is `denied`. Serializing `document.documentElement` is not `view-source`.
- Secrets stay off the list. Grants, KV keys, Worker internals, unsealed draft HTML, and `.env` are not catalog rows.
- Unattested default is idle. Until every claim line hashes, the live region says `mismatch`. There is no auto-green “transparent” state on load.
- Copy is not live. This run does not add Share. Run 016 already specified attested run URLs. A source catalog is not a publish.

Canonical lines (do not wrap, do not add a trailing space):

```
source#019|kind:glassbox-view-source|scope:first-party-allowlist|fetch-any:deny|dom:deny|hash:sha256|seal:human
```
SHA-256: `dfec097a3bd895c8c087fe3c47a6bcf2d3c30da8746250f4069a5af3c4f83a70`

```
claim#scope|text:This page lists attested first-party public artifacts. It does not fetch other origins.
```
SHA-256: `fe103313d5acfa8beaf649e29366d8c62bb68ebbf7efabd0e5e3a99f2a343b65`

```
claim#bytes|text:A hash is of a published claim or git blob. It is not the live DOM after scripts run.
```
SHA-256: `8c2ae5f3d54e04b8e9b3958a2b4e8c06e216cbdc5690526b04d98316b64cbffd`

```
claim#git|text:A GitHub blob SHA is not a grant and is not proof of what Cloudflare served.
```
SHA-256: `9493826dc7beee3cad9f2b2ddb38a1a6881ce11e5f3337d5788f54a9d9c81877`

```
claim#deny|text:View-source of an arbitrary URL is denied. This page is not a proxy.
```
SHA-256: `1051341ac36d811cf306f594074648c02f0eba85f825c7fe943e68205d0daeec`

```
claim#secrets|text:Grants, KV, Worker internals, and unsealed drafts are not listed.
```
SHA-256: `2c276904f76c5910b1014175258207f9b4e0c86db9cbab0e305d587e5f42ced4`

```
claim#tokens|text:This page does not price tokens and does not pitch Void Monthly.
```
SHA-256: `126f8cde548e6e87695a1041338fdf29a9cb6f95a256ff40e8e57cbb9e8a3f50`

```
page#source|route:draft|index:noindex|cookie:deny|analytics:deny|write:deny
```
SHA-256: `baffef5b80d78017b66d5ffaff0dfeea3148330a18db3cf32f000514a63c98e2`

Body digest = SHA-256 of the eight canonical lines joined by LF, with a trailing LF:
`09022326bfa0c385cc96d1528e923ad8fac639b057171fe18085042292046864`

Head digest = SHA-256 of the compact JSON
`{"algo":"sha256","kind":"glassbox-view-source","scope":"first-party-allowlist","fetch_any":false,"dom":false}`
→ `ee96e7468f7cb8941869bec68a9c6a7d0b59d6d327610b5f38049989df2eaf8a`

Artifact and invoker lines (not part of the public body digest):

```
art#llms.txt|href:https://a-to-mind.com/llms.txt|kind:text|role:agent-notes|bytes:unattested
```
SHA-256: `3444e99d4f80c1cd8fb05f0aeea7540dbab76c569cc4ae6b76312593e4c574f3`

```
art#agent-card|href:https://a-to-mind.com/.well-known/agent-card.json|kind:json|role:agent-card|bytes:git-blob
```
SHA-256: `6c0e61b79d6ea97ba62a607b518cc0b3cef991878001c613eaaa28c595201ec7`

```
art#ledger|href:https://raw.githubusercontent.com/atomeam/a-to-mind.com/master/FEATURE_LEDGER.md|kind:markdown|role:feature-ledger|bytes:unattested
```
SHA-256: `822276c39b09a27716401f9d60a56c2fcb52cab52e1b5830c078e489b5e9af3f`

```
art#repo|href:https://github.com/atomeam/a-to-mind.com|kind:html|role:public-repo|bytes:unattested
```
SHA-256: `92a1a289243dfe921d2509325116aeaaf0a70ac70a31833bb35005ea2a1e416d`

```
art#index|href:https://a-to-mind.com/|kind:html|role:homepage|bytes:unattested
```
SHA-256: `baa1e3a29bbe7ca22778063bc09ca91d554fa453b77778f58ba5d1b588b6f7ec`

```
invoker#verify|id:verify-catalog|transport:local|network:deny
```
SHA-256: `a18ae7b7c9ad666c1d5b353296aa1fef3854441eae872a72a80fca4b38f7f504`

```
invoker#open-listed|id:open-listed|transport:navigate|write:deny
```
SHA-256: `0a6a98fb03d99d86b640255ae55cfc9d5b804a0df8dd340ecc76e11b7ab37f6b`

```
invoker#fetch-any|id:fetch-any|write:deny|network:deny
```
SHA-256: `18c77b6f1c0e1c5f20b59f711271b1ef7a65a6ef2ea7f1fc3fdf80f3ae5e8863`

```
invoker#show-dom|id:show-dom|write:deny|network:deny
```
SHA-256: `69e278553f8f9e2c48b119ea1c2dc31c38147a3cb930bfd721d6151195a6460c`

```
invoker#dump-worker|id:dump-worker|write:deny|network:deny
```
SHA-256: `7c8c573af5ad5a3c5ef4ba08c317c0fca6c7de092d7d957197dca26d0111f843`

Agent-card git facts (not a served-bytes pin):

- git blob SHA: `005cf2627d962f2656827f589b46d34211a8fe4d`
- SHA-256 of that file’s UTF-8 text as stored in this repo: `fd5cba3f026a52b34a7eaa8f8f2e472ccaa44cb2a5adf2566ff0fe5147842e99`
- byte length: `543`

Receipt statuses the UI is allowed to emit: `idle`, `match`, `unattested`, `hold`, `mismatch`, `denied`, `failed`. Nothing else. There is no `transparent`, no `fetched`, and no `proxied`.

This UI is not a security boundary. A `match` receipt proves this page hashed its own claim lines. It does not prove Cloudflare served those bytes, and it does not authorize an agent to retrieve the listed hrefs.

Out of scope on purpose (later Queue slugs): modular answer blocks, PWA / offline ledger, voice, personalization, 3D, carbon badge, WCAG-3 badge.

## Files in this draft

- `SPEC.md` — this file
- `claims.json` — attested contract, artifacts, invokers, published digests
- `catalog.json` — the sealed five-row allowlist (data, never instructions)
- `proposed-source.html` — open locally or as a Pages preview. Live site has no `/source`.
- `source-worker.js` — optional GET-only sketch. Does not proxy.

## Seal steps

1. Open `drafts/019-glassbox-view-source-page/proposed-source.html` over HTTPS or `localhost`.
2. Confirm live `index.html` still has no `/source` route, no “View source” footer, and no multi-origin fetch box, and that this run did not edit it.
3. Recompute the contract line:
   `printf '%s' 'source#019|kind:glassbox-view-source|scope:first-party-allowlist|fetch-any:deny|dom:deny|hash:sha256|seal:human' | sha256sum`
   Must match `dfec097a3bd895c8c087fe3c47a6bcf2d3c30da8746250f4069a5af3c4f83a70`.
4. Recompute the body: join the eight canonical lines with LF, end with LF, `sha256sum`. Must match `09022326bfa0c385cc96d1528e923ad8fac639b057171fe18085042292046864`.
5. Recompute the head JSON. Must match `ee96e7468f7cb8941869bec68a9c6a7d0b59d6d327610b5f38049989df2eaf8a`.
6. On load, live region says `idle` then `match` or `mismatch`. Four of five artifacts stay `unattested` for served bytes. Agent-card shows `git-blob` plus blob prefix `005cf262…`, never “served.”
7. Keyboard pass: Tab to listed hrefs. They are ordinary same-tab or new-tab navigations to allowlisted URLs. No `fetch()` of those URLs from this page.
8. Activate “Fetch any URL.” Must emit `denied`. Network idle.
9. Activate “Show live DOM.” Must emit `denied`. The page must not serialize `document.documentElement`.
10. Activate “Dump Worker.” Must emit `denied`.
11. Flip one character in a claim `data-canonical` and confirm `mismatch`.
12. Confirm no cookie, no token price, no Void Monthly pitch, no URL input, and no auto-fetch on load.
13. When sealing later: if a `/source` route is copied into a sealed room, keep the allowlist, keep bytes default-unattested until a dated snapshot is sealed, and do not add a proxy.

Live marketing copy was not changed in run 019.
