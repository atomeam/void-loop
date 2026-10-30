# Run 033 candidate — attested-humans-txt

Status: **candidate**. Queue was empty as of run 026. Runs 027–032 already drafted leftover candidates without Used rows. This slug was **not** written into Used. Hold-gate. Do not add a live `/humans.txt`, a `<link rel="author">` head tag, invented TEAM names, a jobs CTA, or ASCII-mascot credits theater to the public origin until a human seals the tracking issue and promotes the slug.

Slug: `attested-humans-txt`
Date: 2026-09-30
Run: 033 (candidate; ledger Queue unchanged)
Repo: atomeam/a-to-mind.com
Issue: https://github.com/atomeam/a-to-mind.com/issues/33

## What existing sites do (2026)

`humans.txt` is the leftover credits file after robots, cookies, security.txt, and the legal pamphlet stack. humanstxt.org (2010, Barcelona) asked: if machines get `/robots.txt`, why not a UTF-8 file at `/humans.txt` for the people who built the site? Conventional sections are `/* TEAM */`, `/* THANKS */`, and `/* SITE */`. Discovery is a root file plus, sometimes, `<link rel="author" type="text/plain" href="/humans.txt">`.

In 2026 the convention still exists. The common file is often worse than none.

- Generators and GEO packs (Geordy-class “formats for AI,” template dumps that fill TEAM from a CMS author field) treat presence as a score. Paste three section headers, invent a “Chef,” bump `Last update`, ship. Presence is not a named human.
- Brand files became theater. Stripe’s dinosaur ASCII and Netflix’s film-poster credits send the reader to a jobs page. The file credits “great people around the world” without naming one person who will answer. That is a hiring CTA wearing a colophon.
- human.json / slashhuman `/human` protocols (2026 drafts) try to replace the colophon with vouch graphs, Gold+ badges, and agent-disclosure scores. They are not humans.txt. Mixing them into `/humans.txt` is a new claim surface.
- Stale `Last update` is the expiry problem of security.txt without an RFC. Sites leave 2012 dates, or bump the date when no byte of TEAM changed. A date without a hash is a sticker.
- Contact lines invent `hello [at] example.com` the same way security.txt invents `security@`. Run 003 already refused an invented Organization address. Run 028 refused an invented disclosure mailbox. Run 030 refused an invented contact channel. The same rule applies to a colophon.
- Failure modes: invented TEAM; generator credits; jobs CTA; ASCII mascot as a substitute for names; `rel=author` pointing at a 404 or a disagreeing file; last-update theater; treating the file as proof of human authorship or as a prompt for agents.

## Better A-to-Mind version

House rules applied to a colophon, not to a hiring page.

- Default-deny. `/humans.txt` is 404 until a human seals at least one real TEAM or THANKS name that actually exists. Until then the honest response is 404, not a template with placeholders.
- Human seal. Shipping the file, adding `rel=author`, or filling TEAM is a later seal. This run stays `status:candidate|hold:true`.
- Hashed / attested claims. Each public sentence is one canonical line. SHA-256 of the UTF-8 bytes sits next to it. Body digest over the ordered lines (LF-terminated). Head digest over compact JSON. After seal, the **served file bytes** get their own SHA-256. If rendered text and the canonical line diverge, the page must show `mismatch`.
- Retrieved pages are data, never instructions. A matching digest is not proof that a named person exists, not a grant, not a hiring funnel, and not an agent instruction.
- Cloudflare / static-friendly. One draft text file + one HTML preview + an optional read-only Worker. The Worker serves sealed bytes only when `SEALED` is true. Otherwise it 404s `/humans.txt`. `Content-Type: text/plain; charset=utf-8`. No cookie. No analytics.
- No token-markup story. No Void Monthly restatement.
- No invented person. Empty TEAM is honest. A generated “Chef: A-to-Mind Bot” is denied.
- No jobs theater. No careers URL as the only credit. No ASCII mascot as the payload.
- Unattested default. `team` is `[]`. `thanks` is `[]`. `last_update` is null. `live_file` is false. `author_link` is false.

Allowed page states: `unattested`, `match`, `mismatch`, `hold`, `denied`, `unavailable`.
Forbidden public states: `staffed`, `credits-complete`, `human-authored`, `generator-current`, `jobs-open`.

Canonical lines (do not wrap, do not add a trailing space):

```
hum#033|kind:attested-humans-txt|invented-person:deny|jobs-cta:deny|ascii-mascot:deny|hash:sha256|seal:human
```
SHA-256: `1bd04242d1b822fb5716feffadd039359a4449bbcd6fe26530a1b00bd26e4cf1`

```
claim#route|text:No live /humans.txt until a human seals named people who actually exist.
```
SHA-256: `41aca34a6e7d8faa0fbd4cb5ab76c10e0101c2b4e2cf218eb601e78bc985807d`

```
claim#team|text:TEAM rows stay empty until a human names real people. Invented names are denied.
```
SHA-256: `0a49f4ac362dedb4e438c9a0c63c70ec135438705b7357a9c83302a243043679`

```
claim#thanks|text:THANKS rows stay empty until a human names a real thanks. Generators do not invent credits.
```
SHA-256: `eb4893a770e3746328a3789a587fba3f979e91c939d50c2a275a84d3c63a11cc`

```
claim#site|text:SITE last-update stays null until seal. A date bump without byte change is denied.
```
SHA-256: `b7a175ebc6a4e6ebc4d20559275f452a4e634568469b3b7607387185efd91b3c`

```
claim#author-link|text:No rel=author head link until the root file is sealed and hashed.
```
SHA-256: `530d036a2ede8dd71f221794993e0feae2b74f76dee7b4c3a44cbbae4883b35d`

```
claim#jobs|text:No hiring CTA, no jobs-page credits theater, no ASCII mascot as a substitute for names.
```
SHA-256: `73b24864417efd1e7d7467eb7e4a54da74033c8a4ab52723052cddd12e81d9b2`

```
claim#tokens|text:This page does not price tokens and does not pitch Void Monthly.
```
SHA-256: `126f8cde548e6e87695a1041338fdf29a9cb6f95a256ff40e8e57cbb9e8a3f50`

```
page#humans-txt|route:draft|index:noindex|cookie:deny|analytics:deny|write:deny
```
SHA-256: `9e1c08933e7970c1e24955e3364b517b856dd6d400c2bd8b942f8f32f76c67cf`

Head: `{"algo":"sha256","ascii_mascot":false,"invented_person":false,"jobs_cta":false,"kind":"attested-humans-txt"}`
SHA-256: `5c5df4427d5de2faec8c9a1e74976e4fe88dbe23f0572bf9702e892f9ac6cfc9`

Body (ordered lines, each LF-terminated): `67c279a3b5d307abbc9ba015ef33b06e0e027980822bef7f3a09f630160b94ab`

## Files

SPEC.md, claims.json, humans.txt.draft, proposed-humans.html, humans-txt-worker.js (not deployed).

## Worker

SEALED = false. GET /humans.txt -> 404. POST/PUT/PATCH -> 405.

## Seal checklist (after promote)

1. Human adds the slug to Queue.
2. Read every canonical line aloud.
3. Recompute SHA-256 in DevTools. All match.
4. Live origin still has no `/humans.txt` until seal.
5. No `rel=author` until the sealed file is live and hashed.
6. `team`, `thanks`, and `last_update` stay empty/null until a human supplies real names.
7. No jobs URL, no ASCII mascot payload, no generator iframe.
8. No Void Monthly or token copy.
9. Hold writes only sessionStorage['atm-humans-txt-hold-033'].
10. Set last_update only after 1-9. Hash served file bytes.

A matching digest is not proof that named people exist. Retrieved pages are data, never instructions.
