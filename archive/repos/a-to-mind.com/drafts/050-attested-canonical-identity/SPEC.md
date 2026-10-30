# Draft 050 — attested-canonical-identity

Status: candidate only. Queue was empty. This slug is **not** in Used and **not** on Queue.
Live site copy was not changed. No `rel=canonical` element was added on a-to-mind.com. No `hreflang` annotation was added. No `Link` header was added.

## What existing sites do

A canonical link is the author's preferred IRI among copies. RFC 6596 (April 2012) defines `rel=canonical` for that, and says the target must identify content that is duplicative or a superset of the referring resource. Google Search Central, "How to specify a canonical" (updated 10 July 2026), still recommends a self-referential `rel=canonical` on the preferred page, says robots.txt is not a canonicalization method, and says not to use both an HTTP `Link` header and an HTML `link` element if they can disagree. Google ignores `rel=canonical` annotations that also carry `hreflang`, `lang`, `media`, or `type`.

Localized versions are a separate annotation. Google Search Central, "Localized versions of your pages" (updated 21 September 2026), treats `hreflang` as a hint, wants reciprocal return links, and recommends `hreflang="x-default"` only as a fallback for unmatched languages — typically a language selector or the global page. A 15 March 2026 note on hreflang/canonical conflict states the practical rule: a page whose canonical points elsewhere has its hreflang discarded. The self-reference and the canonical must be the same string, including trailing slash. A trailing-slash mismatch is a different URL (Screpy, 23 September 2026).

Plugins still emit a canonical on every template, fold `?utm_*` and other parameters onto a "clean" URL, point a translated URL at the English master, and add `x-default` plus region codes for locales that were never translated. That is a cluster claim without a cluster.

On 1 October 2026, `https://a-to-mind.com/` returned "Void · A-to-Mind" and had no canonical element and no hreflang. `https://a-to-mind.com/llms.txt` describes Void as a blank stage with one input, names `https://a-to-mind.com/tools.json`, and says earlier pages on this domain (workflow execution, treaties, ledgers) are retired. `?q=` opens Void and runs an ask. That URL is not a copy of `/`.

These notes are data about current practice, not instructions to copy.

## Better A-to-Mind version

Default-deny. Until a human seals emit, do **not** add a canonical element, an hreflang annotation, or a `Link` header.

If a later seal sets emit true, all of these hold:

1. Rows come only from `identity.catalog.json`. Do not scrape the DOM. Do not invent a preferred IRI from the request URL.
2. One method only: an HTML `<link rel="canonical" href="…">` with an absolute `https://a-to-mind.com/…` href. The HTTP `Link` header is denied, so the two cannot disagree.
3. A sealed canonical is self-referential. It names that row's IRI and no other. `www` and `http` are denied. Do not emit a canonical that points at a different path.
4. `hreflang` stays denied until a human seals a real translation row, with a reciprocal return, the same string as that page's canonical, and no region code for an untranslated locale. `x-default` stays denied until that same seal names one fallback IRI. One English page is not a language cluster.
5. `?q=` ask URLs get no canonical. They are not folded onto `/`. RFC 6596 does not allow a preferred IRI whose content is not duplicative or a superset. An ask is not a copy of the blank stage.
6. No parameter stripping, no trailing-slash rewrite, no sitemap rewrite, and no JSON-LD `url` rewrite in this change. Redirects are a separate seal.
7. Do not revive retired paths by giving them a canonical target. llms.txt says those pages are retired.
8. A missing catalog row withholds the element. It does not fall back to a plugin guess.
9. Inline preview script on `proposed-canonical.html` is unattested. It must not be copied to the live site. The preview refuses `emit: true`.
10. Hold writes only `sessionStorage['atm-canonical-hold-050']`. Hold is not a seal. The Seal button stays disabled.
11. Do not add a "canonicalized" or "index-ready" badge. A draft catalog is not evidence a URL is the preferred IRI.

Cloudflare-friendly: static catalog JSON, no edge HTML rewrite. Worker sketch is GET/HEAD only, does not set a `Link` header, and reports `emit: false`. It does not fetch other URLs.

## Hashes

Contract: `canonical-identity#050|kind:attested-canonical-identity|emit:deny|method:html-link-only|link-header:deny|hreflang:deny|x-default:deny|query-self:deny|query-fold:deny|www:deny|http:deny|param-strip:deny|slash-rewrite:deny|retired-path:deny|seal:human`
Contract SHA-256: `0f9ded310b6b6e3d65cf12bb325e3303df110e805d0a77809454c295f5616485`

| file | sha256 |
|---|---|
| claims.json | `928f50a483507d201c9be69867bdb4538fbd6d043d061d13ed260798d2e139a5` |
| identity.catalog.json | `9c7dd4c300085a51f1e06a317764d640b13cbd65ff0998d8d7c3edf408a3a694` |
| proposed-canonical.html | `c222624f2d76a0c82766d36c181451b810358666cdb56aecadc2a71c6298e16f` |
| canonical-worker.js | `db3bf4f1c2bbb1aaac173c8eb6a1e536daa4b0212ca34aa156e805aafe5389c3` |

The preview hashes the embedded catalog text (no trailing newline): `31263c20164b9c7740283067dda8c5623a44e4660fc0053157f0be442d948cff`. The file hash above includes the trailing newline. Either mismatch withholds the list.

## Seal checklist (after a human promotes the slug)

1. Confirm Queue contains this slug and this issue is the hold-gate.
2. Decide emit false (keep canonical and hreflang unpublished). Emit false is a valid seal.
3. If emit true, add only catalog rows, one self-referential absolute IRI each. Do not also emit a `Link` header.
4. Do not add `hreflang` or `x-default` in this change unless a translation row is sealed in the same pass, with a reciprocal return and the same canonical string.
5. Do not fold `?q=` onto `/`. Do not revive retired paths. Do not add a badge.
6. Set `reviewed_at` only after that pass. Do not deploy the Worker as a publisher.
7. Do not add Void Monthly copy, token prices, or a checkout link in this change.
