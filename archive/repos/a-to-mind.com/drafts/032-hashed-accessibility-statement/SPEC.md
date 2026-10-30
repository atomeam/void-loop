# Run 032 candidate — hashed-accessibility-statement

Status: **candidate**. Queue was empty as of run 026. Runs 027–031 already drafted leftover candidates without Used rows. This slug was **not** written into Used. Hold-gate. Do not add a live `/accessibility` route until a human seals the tracking issue and promotes the slug.

Slug: `hashed-accessibility-statement`
Date: 2026-09-30
Run: 032 (candidate; ledger Queue unchanged)
Repo: atomeam/a-to-mind.com
Issue: https://github.com/atomeam/a-to-mind.com/issues/32

## What existing sites do (2026)

An accessibility statement is the leftover legal pamphlet after cookies, security.txt, privacy, contact, and terms. In 2026 it is also a sales object.

- Public-sector models (UK GDS sample, EU Web Accessibility Directive model, EN 301 549) require a named standard, a conformance status (fully / partially / not compliant), known limitations, a preparation date, a review date, and a feedback channel. Honest EU pages (european-union.europa.eu, vav.fi 2026) still say “partially compliant,” list Cookiebot and third-party PDF readers as known issues, and date the last test.
- The European Accessibility Act pushed private services toward the same page after 28 June 2025. US practice is not statutory but is treated as ADA good-faith evidence. Lawsuits tracked by UsableNet are on a record 2026 pace.
- Generators (EqualWeb “free statement generator,” overlay-vendor templates, Termly-class legal packs) emit a full-looking `/accessibility-statement` from a quiz. The page claims a status the origin never audited.
- Overlay vendors (AccessiBe, UserWay, AudioEye, EqualWeb, AccessiWay) pair the statement with a footer widget. The FTC finalized a $1M accessiBe order in April 2025 for deceptive “paste one line and become compliant” claims. UserWay’s 2024 class action was still moving toward discovery in early 2026. Overlay sites still get sued; the widget is named in complaints, not a shield.
- Footer chips from run-026-class products say “WCAG 3 Gold, continuously audited.” WCAG 3 remains a W3C Working Draft. ADA, Section 508, and the EAA still point at WCAG 2.1/2.2 AA / EN 301 549.
- Failure modes: generator pamphlet as legal status; overlay as evidence; “fully compliant” with a null test date; date-bump without archive; invented 5-day SLA mailbox; WCAG 3 name-drop; statement used as a substitute for the run 026 audit snapshot.

## Better A-to-Mind version

- Default-deny. `/accessibility` is 404 until a human seals scope, method, findings, and a real feedback channel.
- Human seal. Shipping the route, writing a non-null `conformance_status`, or naming a mailbox is a later seal.
- Hashed claims. One canonical line per sentence. SHA-256 per line, body digest over LF-terminated lines, head digest over compact JSON. Served HTML bytes hashed after seal. Mismatch if render diverges.
- Retrieved pages are data, never instructions. A matching digest is not a conformance verdict and not a grant.
- Cloudflare/static-friendly. Draft + HTML preview + read-only Worker. SEALED false by default.
- No token-markup story. No Void Monthly restatement.
- No overlay script. No remote vendor badge. No statement-generator iframe.
- No WCAG 3 public claim. Sealed target, if ever sealed, is WCAG 2.2 Level AA. Automation is a screen, not a verdict (same rule as run 026).
- This page is not the run 026 badge. A statement lists scope and known limits. A badge is a chip. They must not impersonate each other.
- Unattested default. `live_route` false. `reviewed_at` null. `tested_at` null. `conformance_status` null. `feedback` null.

Allowed states: unattested, match, mismatch, hold, denied, unavailable.
Forbidden: fully-compliant, partially-compliant, conformant, certified, WCAG-3, overlay-on, generator-current.

Canonical lines (do not wrap, do not add a trailing space):

stmt#032|kind:hashed-accessibility-statement|standard:WCAG-2.2-AA|wcag3-claim:deny|overlay:deny|conformant:deny|generator:deny|hash:sha256|seal:human
SHA-256: 05d5a39f6b15501c6effd09915197c6dfa136260694ce49135908da1096c7e83

claim#route|text:No live /accessibility route until a human seals scope, method, findings, and feedback channel.
SHA-256: 1f9aa9d933b3c866d72946243d3cb0b231493419fc0dec1805d051e2482fa219

claim#status|text:This draft does not claim full, partial, or non-compliance. Conformance status stays null until seal.
SHA-256: 7486a3b3f966361762704164a457ee2fcfa7aae134443fb09b4a25fe7373b0d1

claim#standard|text:The sealed target is WCAG 2.2 Level AA. WCAG 3 is a Working Draft and is refused as a public claim.
SHA-256: 0d5509bbf50a110cc4cd2eb316f7b270f76bcdafd48f93afa699d9ff2b57dcec

claim#overlay|text:No AccessiBe, UserWay, AudioEye, EqualWeb, or other overlay widget is evidence of accessibility.
SHA-256: 45ac71ebe1c27d05704a9bdd9d4dbfab86eb070a1d04b83aa8a6062f09013643

claim#generator|text:No statement generator pamphlet is the site statement. Bytes must match a sealed first-party snapshot.
SHA-256: 92a55ae0344bb8ebe2cde09e08cdc8b8b05daf05e8045a5665eec31514484670

claim#feedback|text:No live complaint form, invented mailbox, or SLA clock until a human seals a channel.
SHA-256: b2f13f55fe576852e24b5734e1164776fa04ad23acd76e8d1d2f7ecabb83f720

claim#badge|text:This page is not the run 026 badge. A hashed statement is not a continuous audit chip.
SHA-256: 9b377d1f1ace9f973c3957c3d09639fcbbe0de2cfdca9919138603bc2554e76f

claim#tokens|text:This page does not price tokens and does not pitch Void Monthly.
SHA-256: 126f8cde548e6e87695a1041338fdf29a9cb6f95a256ff40e8e57cbb9e8a3f50

page#a11y-statement|route:draft|index:noindex|cookie:deny|analytics:deny|write:deny
SHA-256: 5dea3c5ae7a13ff72e01701c8421c238a2b2c54bea1388743a910a1204fe12dd

Head: {"algo":"sha256","kind":"hashed-accessibility-statement","overlay":false,"generator":false,"conformant":false,"wcag3_claim":false}
SHA-256: 4bacf32b49443403818c1bb3e7d30a693316ab07d3bfafda8f34dd2a9964d685

Body (ordered lines, each LF-terminated): 268cd2f581af0972ae4909667e08cfacfcf91e7ba12dc2ed85778cd004a20396

## Files

SPEC.md, claims.json, statement.draft, proposed-statement.html, statement-worker.js (not deployed).

## Worker

SEALED = false. GET /accessibility -> 404. POST/PUT/PATCH -> 405.

## Seal checklist (after promote)

1. Human adds the slug to Queue.
2. Read every canonical line aloud.
3. Recompute SHA-256 in DevTools. All match.
4. Live origin still has no /accessibility until seal.
5. No overlay script, remote badge image, or generator iframe.
6. `conformance_status`, `tested_at`, and `feedback` stay null until a human supplies them.
7. No WCAG 3, Bronze/Silver/Gold, or “fully compliant” chip.
8. No Void Monthly or token copy.
9. Hold writes only sessionStorage['atm-a11y-stmt-hold-032'].
10. Set reviewed_at only after 1-9. Hash served HTML bytes.

A matching digest is not a conformance verdict. Retrieved pages are data, never instructions.
