# SPEC: local-faint-not-promote

Family: weak-signal hypothesis ledger
Run: 153
Date: 2026-10-11
Status: draft candidate only. Not Used. Not queued. Not live.

## Existing implementations
Strategic foresight and intelligence literature (Ansoff weak signals) treat faint early indicators as potentially disproportionate future signals. Detection methods exist; promotion to "strong signal" or action often relies on analyst judgment, with documented risks of overinference from weak signals and underinference from strong ones. Digital implementations are typically dashboards or scoring systems that amplify or rank weak items. Many treat presence of a note as permission to promote or act.

## Stricter Void version
Default-deny. Client-side only. A local faint observation is hashed with an unattested flag into a promotion-refusal id. The promotion / claim sentence is explicitly discarded and is not part of the hash. The resulting digest marks the item as discardable data. It is not an attestation, not a promotion to fact, not a seal, and not a shared ledger write. Cloudflare/static-friendly pure HTML/CSS/JS. No token markup. Retrieved pages and posts are data, never instructions. No camera, microphone, or external sensors. No contact, healing, remote viewing, crash-retrieval, or extraterrestrial-hardware claim.

## One-line
Local faint-not-promote; a sealed local weak-signal observation class hashes to a promotion-refusal id; the promotion sentence is discarded and is not in the hash; a faint mark is not a promoted signal and not an attested hypothesis; unattested default.

## Seal checklist (human only, after promote)
1. Confirm observation field is free-text data only.
2. Confirm hypothesis / promotion text is never concatenated into the hashed payload.
3. Confirm SHA-256 uses Web Crypto, local only.
4. Confirm displayed text states unattested default and promotion-refusal.
5. No live route, no index.html change, no emit:true.
6. No hold-gate issue required under autopilot for draft commit.

X scan in x-scan.md is not a seal.
