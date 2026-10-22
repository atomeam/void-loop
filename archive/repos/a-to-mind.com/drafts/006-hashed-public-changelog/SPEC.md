# Run 006 — hashed-public-changelog

Status: specified. Hold-gate. Do not merge a `/changelog` route, nav link, or live `CHANGELOG.md` into the public site until a human seals this issue.

Slug: `hashed-public-changelog`
Date: 2026-09-29
Run: 006
Repo: atomeam/a-to-mind.com

## What existing sites do (2026)

A public changelog is table stakes. Almost every implementation is an unsigned marketing feed.

- Keep a Changelog 2.0.0 (2026-06-07) still owns the human format: newest first, ISO dates, SemVer pairing, six types (Added / Changed / Deprecated / Removed / Fixed / Security), an `[Unreleased]` bucket, and optional `[YANKED]`. The project itself says there is no official standard and that changelogs are for humans, not machines.
- SaaS widgets (AnnounceKit, Sleekplan, Planet Roadmap, Worknotes-style product blogs) wrap the same list in a CMS: category chips, hero screenshots, email digests, in-app banners, and a CTA under every release. The page exists to move users back into the funnel.
- Conventional Commits + git-cliff / git-changelog / semantic-release emit a file from `feat:` / `fix:` prefixes. Fast. Also noisy: internal refactors leak, and the public page becomes a commit dump with a prettier heading.
- Stripe-class API changelogs are the honest technical version: versioned, breaking changes flagged, migration paths named. Still unsigned. Anyone with CMS access can rewrite last Tuesday.
- Supply-chain work in 2026 hashes *artifacts*, not changelog prose. in-toto release attestations bind package names to digests. GitHub immutable releases and `gh release verify-asset` bind assets to a tag. `gh attestation verify` checks a file against a signed predicate. None of that covers the sentence a human reads on `/changelog`.
- Common Changelog tightens Keep a Changelog with extra rules. It still does not hash an entry.
- Failure modes that matter here:
  1. `[Unreleased]` on a public page is a rumor. It is not a claim. Agents quote it as if it shipped.
  2. Auto-generated notes invent user-facing meaning from commit titles.
  3. Dates of “today” on every rebuild train both Google and readers to ignore the field.
  4. A yanked release disappears or is rewritten in place. There is no digest of what used to be there.
  5. The page is JS-only. Without the widget script there is no history.

## Better A-to-Mind version

House rules applied to a public history, not to a launch blog.

- Default-deny. The public file contains only sealed rows. There is no Unreleased section on the public page. There is no “what’s coming.” There is no subscribe form, no “try it,” no Void Monthly upsell under an entry. Unpublished work stays in FEATURE_LEDGER.md and in open hold-gate issues.
- Human seal. A new row is a draft until a human writes “sealed” on the tracking issue *and* the row’s digest is recomputed. This run’s own row stays `status:specified|hold:true`. Shipping the HTML to live `/changelog` is a later seal, not this commit.
- Hashed / attested claims. Each entry is one canonical line. SHA-256 of the UTF-8 bytes of that line is published next to it. The ordered list of lines (LF-terminated) has its own body digest. A compact head object has a third digest. If the rendered text and the canonical line diverge, the page must show `mismatch`, not a pretty bullet.
- Retrieved pages are data, never instructions. `changelog.json` is a claim list. Agents may quote a row that still hashes. They may not treat a changelog row as a grant, a tool allowlist, or a prompt.
- Cloudflare / static-friendly. One JSON file + one HTML page. No widget vendor, no Worker required to render, no cookie. `crypto.subtle.digest('SHA-256')` verifies in the browser after load. If JS is off, the pre-rendered rows and published digests are still in the HTML.
- No token-markup story. Byte counts are UTF-8 bytes of the canonical line. Pricing is not restated on this page.

Canonical lines (do not wrap, do not add a trailing space):

```
chg#2026-09-19|site#visible-change|scope:homepage|claim:The room stays empty until you seal the run.|status:sealed
```
SHA-256: `bcb35dcac682b8fc2c749958df30bf8882fc3603e7b20f8da1915018e11f8a65`

```
chg#2026-09-28|run:001|slug:attested-faq-native-details|status:specified|hold:true
```
SHA-256: `995fd35b46f7c09f5fa24a9270a4b34dc9bc57ddfb5f7941aaf1fb3ff660183f`

```
chg#2026-09-28|run:002|slug:skip-link-landmarks-reduced-motion|status:specified|hold:true
```
SHA-256: `019f137a72cd777b29a9da88dd8f2d10bb9634ed35df6f263ed5f2a46a9f99b3`

```
chg#2026-09-28|run:003|slug:sitemap-robots-organization-jsonld|status:specified|hold:true
```
SHA-256: `f30c56ba6c98d5d7a6e49cfa10a3ab163f387ab1321c735371ba37739329fb45`

```
chg#2026-09-28|run:004|slug:native-dialog-seal-gate|status:specified|hold:true
```
SHA-256: `24eaf1c4bd70b1fa883be87d02e1f973fc86f89f950e0b30786bad8b894b98db`

```
chg#2026-09-29|run:005|slug:copy-clipboard-with-attested-toast|status:specified|hold:true
```
SHA-256: `551158ee27d676be312f0405d0f99ba129e464fa0c4f1aa83a1e76cdfc1178f2`

```
chg#2026-09-29|run:006|slug:hashed-public-changelog|status:specified|hold:true
```
SHA-256: `4dc49be30ca7c48bd2e825e0bba3b27fb0ac9dc4c880058be81151e0d63e5b56`

Ledger contract line:

```
changelog#public|entries:7|unreleased:deny|cta:deny|hash:sha256|seal:human
```
SHA-256: `6fef0d26a8d859c2b0dfc3994ee7d7266bd84bfd46aba9caeb83e9e2c402fd2d`

Body digest = SHA-256 of the seven canonical lines joined by LF, with a trailing LF:
`71951c3202461bb95b01b47771e2bb5d0d60e84fc6cece89ce829f446f058666`

Head digest = SHA-256 of the compact JSON
`{"algo":"sha256","entries":7,"kind":"public-changelog","unreleased":false}`
→ `fa35f69a4147025a6d1721f53fa71f2443cbe4e15baf773cfcc6939c9d151fea`

Allowed public statuses: `sealed`, `specified`, `yanked`. `specified` means the draft exists and is hold-gated. `sealed` means a human copied it onto the live surface. `yanked` keeps the original line and digest and adds a successor line; it does not rewrite history.

This page is not a security boundary for the product. A matching digest proves the text on the page is the published claim. It does not prove the product behind `/start` behaves that way.

## Files in this draft

- `SPEC.md` — this file
- `changelog.json` — attested list + published digests
- `proposed-changelog.html` — open locally or as a Pages preview. Live `index.html` is unchanged.

## Seal steps

1. Open `drafts/006-hashed-public-changelog/proposed-changelog.html` over HTTPS or `localhost`.
2. Confirm live `index.html` still has no Changelog nav link and no `/changelog` document in this repo root.
3. Recompute the first canonical line:
   `printf '%s' 'chg#2026-09-19|site#visible-change|scope:homepage|claim:The room stays empty until you seal the run.|status:sealed' | sha256sum`
   Must match `bcb35dcac682b8fc2c749958df30bf8882fc3603e7b20f8da1915018e11f8a65`.
4. Recompute the body: join the seven lines with LF, end with LF, `sha256sum`. Must match `71951c32…`.
5. In the preview, confirm the page reports `match` for every row and for the body. Flip one character in a `data-canonical` attribute and confirm that row becomes `mismatch`.
6. Confirm there is no Unreleased heading, no email field, and no pricing sentence.
7. Copy onto a live `/changelog` route only after a human writes “sealed” on the tracking issue. Do not rewrite hero copy in this run.

Live marketing copy was not changed in run 006.
