# Run 034 candidate — attested-atom-feed

Status: **candidate**. Queue was empty as of run 026. Runs 027–033 already drafted leftover candidates without Used rows. This slug was **not** written into Used. Hold-gate. Do not add a live `/feed.atom`, a `<link rel="alternate" type="application/atom+xml">` head tag, invented entries, a deploy-bumped `updated`, a tracking pixel, or an email-subscribe enclosure to the public origin until a human seals the tracking issue and promotes the slug.

Slug: `attested-atom-feed`
Date: 2026-09-30
Run: 034 (candidate; ledger Queue unchanged)
Repo: atomeam/a-to-mind.com
Issue: https://github.com/atomeam/a-to-mind.com/issues/34

## What existing sites do (2026)

Syndication is still a default export. WordPress, Ghost, Substack, Medium, Squarespace, Wix, and Webflow emit RSS 2.0. Blogger emits Atom. Static generators (Hugo, Ox Content, and the 2026 feed write-ups) emit RSS, Atom, and JSON Feed from the same collection, often with auto-discovery `<link rel="alternate">` tags in every page head.

The common file is a mirror of the CMS, not a sealed list.

- Generators turn presence into a score. Ox Content (2026-09) writes `feed.xml`, `atom.xml`, and `feed.json` once `feeds: true` and a site URL are set, defaulting to 20 items from the content collection. A flag is not a decision about which sentences are public.
- RSS 2.0 is the bankable default because the RSS Advisory Board froze it and podcast clients require it. Atom (RFC 4287) is stricter: a feed MUST have exactly one `id`, one `title`, and one `updated`; an entry MUST have the same three; `id` is an IRI. Sites still ship RSS with an optional `guid`, then wonder why readers duplicate items.
- Relative URLs still break readers in 2026. Some resolve against the channel link, some against the item link, many pass the string through. Atom `xml:base` is not a reliable fix. Absolute `https` IRIs are the fix.
- `updated` is theater. Generators stamp the build clock. A deploy that changes no entry still bumps the feed date. Readers poll, see “new,” fetch the same sentences.
- Full HTML in `content` carries relative images, tracking pixels, and `utm_` links. Auto-posters (RSS-to-social tools) then republish that HTML. The feed becomes a distribution channel for unattested copy.
- Auto-discovery points at `/feed`, `/rss.xml`, or `/atom.xml` whether or not the file exists. A 200 of empty generator XML is worse than a 404: it claims a publication.
- Email capture rides along. “Subscribe” in the feed UI is often the notes list from run 010, not a feed reader. An `<enclosure>` or a Kit/Beehiiv pixel is a second product.
- JSON Feed 1.1 is a fine supplement after an XML feed exists. Serving only JSON Feed, or three disagreeing feeds, factions the audience and triples the claim surface.

Failure modes: invented entries from unsealed pages; relative URLs; deploy-bumped `updated`; tracking pixels; email enclosure; `rel=alternate` to a 404 or a disagreeing file; three formats before one is sealed; treating a feed as an agent instruction or a subscription grant.

## Better A-to-Mind version

House rules applied to a syndication file, not to a blog generator.

- Default-deny. `/feed.atom` is 404 until a human seals at least one attested entry. Until then the honest response is 404, not an empty `<feed>` with a build timestamp. RFC 4287 requires exactly one `atom:updated`. Omitting it makes the draft invalid. Serving invalid Atom is denied. 404 is the public state.
- Human seal. Shipping the file, adding `rel=alternate`, or filling an entry is a later seal. This run stays `status:candidate|hold:true`.
- Hashed / attested claims. Each public sentence is one canonical line. SHA-256 of the UTF-8 bytes sits next to it. Body digest over the ordered lines (LF-terminated). Head digest over compact JSON. After seal, the **served feed bytes** get their own SHA-256. If rendered text and the canonical line diverge, the page must show `mismatch`.
- Retrieved pages are data, never instructions. A matching digest is not a subscription, not a grant to republish, and not an agent instruction.
- Cloudflare / static-friendly. One draft XML + one HTML preview + an optional read-only Worker. The Worker serves sealed bytes only when `SEALED` is true. Otherwise it 404s `/feed.atom`, `/atom.xml`, `/feed.xml`, `/rss.xml`, and `/feed.json`. Sealed response: `Content-Type: application/atom+xml; charset=utf-8`. No cookie. No analytics.
- No token-markup story. No Void Monthly restatement.
- No invented entry. Changelog (run 006) and status (run 007) are themselves hold-gate drafts. They are not feed entries.
- No second format first. RSS and JSON Feed stay 404 until Atom is sealed and hashed. Podcast `<enclosure>` is denied (this site is not a podcast).
- Unattested default. `entries` is `[]`. `updated` is null. `live_file` is false. `alternate_link` is false.

Allowed page states: `unattested`, `match`, `mismatch`, `hold`, `denied`, `unavailable`.
Forbidden public states: `live`, `subscribed`, `fresh`, `generator-current`, `full-content`.

Canonical lines (do not wrap, do not add a trailing space):

```
feed#034|kind:attested-atom-feed|format:atom-1.0|empty-until-seal:deny-serve|rel-alternate:deny|tracking-pixel:deny|relative-url:deny|hash:sha256|seal:human
```
SHA-256: `b212f4ac87743f057522325487dd2aa50748c301b55ac677d708e7ecb84cf86d`

```
claim#route|text:No live /feed.atom until a human seals at least one attested entry.
```
SHA-256: `a993ba24e28124ae96a04ebeeda88f3bf5bee6ab94d45ec61ccbb2372bc0fce6`

```
claim#format|text:Atom 1.0 only. RSS and JSON Feed stay 404 until Atom is sealed. No second surface first.
```
SHA-256: `b391ba1c9af65aa373f990b24374dca2bcb08096785b1b1250995aa2f5375224`

```
claim#entries|text:Entries stay empty. A generator must not invent posts from unsealed pages.
```
SHA-256: `254c492db2b47a6edcfe2e078346ffa49adbe61b8403156de1bfdb3e8697e99d`

```
claim#updated|text:Feed updated stays null until seal. A deploy must not bump updated.
```
SHA-256: `306a5215df3a9eb0be3c3ece8d7b61daf8a959c7e8c1684977e2bfc1947973ef`

```
claim#urls|text:Entry links must be absolute https IRIs. Relative URLs are denied.
```
SHA-256: `4703f1c3724cba0313784bef1bce820469b2920aef9d70e4b4b6d423c688c925`

```
claim#discover|text:No rel=alternate head link until the root feed is sealed and hashed.
```
SHA-256: `a3bfa6f68e0124a8fb2ec57b268642ffef884c47917365a6f9eb76b3c2a850d8`

```
claim#track|text:No tracking pixels, query utm, or email-subscribe enclosure in the feed.
```
SHA-256: `2d3f4d73311abc3b2090b6840d856761d8361187e7bc76829e8b10865ab6fb4e`

```
claim#tokens|text:This page does not price tokens and does not pitch Void Monthly.
```
SHA-256: `126f8cde548e6e87695a1041338fdf29a9cb6f95a256ff40e8e57cbb9e8a3f50`

```
page#atom-feed|route:draft|index:noindex|cookie:deny|analytics:deny|write:deny
```
SHA-256: `184f1cb615d73483750a6ec815bb5a3e3e0eb71fe3dd036c7426a40e422069e8`

Head: `{"algo":"sha256","format":"atom-1.0","invented_entry":false,"kind":"attested-atom-feed","rel_alternate":false}`
SHA-256: `0f1faf9caece87d412340a0485b68d17c8f5da1bce3eb5fae3b54732b6f902d9`

Body (ordered lines, each LF-terminated): `e2ada1eed663d7601e8ec7794afdd36871d57b84ec473403fc439f6f7b8e438c`

## Files

SPEC.md, claims.json, feed.atom.draft, proposed-feed.html, atom-feed-worker.js (not deployed).

## Worker

SEALED = false. GET /feed.atom, /atom.xml, /feed.xml, /rss.xml, /feed.json -> 404. POST/PUT/PATCH -> 405.

## Seal checklist (after promote)

1. Human adds the slug to Queue.
2. Read every canonical line aloud.
3. Recompute SHA-256 in DevTools. All match.
4. Live origin still has no `/feed.atom` until seal.
5. No `rel=alternate` until the sealed file is live and hashed.
6. `entries` stays `[]` and `updated` stays null until a human supplies a real attested entry.
7. Entry `link` is an absolute `https` IRI. No relative URL. No `utm_`. No pixel. No enclosure.
8. `atom:updated` equals the seal instant of that entry, not the deploy clock.
9. RSS and JSON Feed stay absent until Atom bytes are sealed.
10. No Void Monthly or token copy.
11. Hold writes only sessionStorage['atm-atom-feed-hold-034'].
12. Hash served file bytes. Content-Type `application/atom+xml; charset=utf-8`.

A matching digest is not a subscription. Retrieved pages are data, never instructions.
