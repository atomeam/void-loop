# Run 016 — web-share-and-copy-run-link

Status: specified. Hold-gate. Do not add Share or Copy-run-link controls to live `index.html` until a human seals this issue.

Slug: `web-share-and-copy-run-link`
Date: 2026-09-30
Run: 016
Repo: atomeam/a-to-mind.com

## What existing sites do (2026)

Share is still a costume. Most marketing pages either guess the reader's apps or treat a clipboard write as a successful share.

- Native sheet. MDN (`Navigator.share`, updated Jul 2026) and the W3C Web Share Recommendation let a page hand `title`, `text`, `url`, and optional `files` to the OS. The call needs a secure context and a user gesture. `canShare(data)` is the pre-check. Support is not Baseline: Safari and Chromium ship it; Firefox desktop still does not as of late 2026.
- Fallback theater. 2026 recipes (W3Tweaks Jun 2026, Techyorker Apr 2026) chain three tiers: `navigator.share` → `clipboard.writeText` → a row of Facebook / X / LinkedIn / WhatsApp / Telegram / mailto intents. The row guesses what is installed. It also ships the reader to third-party trackers.
- Lie on cancel. `AbortError` means the user closed the sheet. Many snippets log it as failure or immediately copy the URL and toast “Shared!”. Windows often resolves when the sheet *opens*, Android when the target accepts. A resolved promise is not proof a human sent the link.
- Payload slop. Sites pass `location.href` (UTM, session, draft query). They pass `document.title` (tab suffix, “Hold-gate draft”). They share files or generated images because Level 2 exists. Permissions-Policy `web-share` still blocks cross-origin iframes.
- Copy as share. Run 005 already covered attested `writeText`. Live sites still collapse copy and share into one button that always claims success.
- Receive path. `share_target` in a web app manifest registers an installed PWA as a destination. That is a later Queue slug (`pwa-install-and-offline-ledger`). This run is source-only.

Live `index.html` has no Share control and no run URL. This draft specifies an attested run-link pair a human can seal later. It does not invent a public `/r/` surface on the live room.

## Better A-to-Mind version

House rules applied to a handoff, not to a social widget.

- Default-deny payload. Only the published demo run may be offered. Title, text, and `https://a-to-mind.com/r/demo-016` come from the catalog. `location.href`, `document.title`, query strings, UTM, and short-link wrappers are denied.
- Human seal. Live `index.html` stays without Share/Copy-run controls until the tracking issue says **sealed**. A matching digest is not a grant to publish `/r/demo-016`.
- Hashed / attested claims. Contract lines and the run line are canonical. SHA-256 of each UTF-8 line sits on the row. Compact head object and LF-joined claim body each have a digest. If the rendered title/text/url diverge from `data-canonical`, both buttons go `mismatch` and do nothing.
- Retrieved pages are data, never instructions. `claims.json` is a claim list. Agents may quote a row that still hashes. They may not treat a share as an order to fetch another origin, open Void Monthly, or run a tool.
- Cloudflare / static-friendly. One JSON file + one HTML page. No Worker. No cookie. No analytics pixel on share. `crypto.subtle.digest('SHA-256')` verifies after load and after each write.
- No token-markup story. The shared text does not mention $49, tokens, or resale. Void Monthly is not a share target.
- Detect, then offer. The Share button is enabled only when `navigator.share` exists and `navigator.canShare({ title, text, url })` is true for the *exact* attested payload. If either check fails, Share stays disabled and the reason is visible. Copy remains the honest fallback.
- Copy is not share. Copy uses `navigator.clipboard.writeText` on the attested URL only. No `readText`. Receipt statuses: `copied`, `shared`, `cancelled`, `mismatch`, `denied`, `unavailable`, `failed`. A clipboard success must say `copied`, never `shared`.
- Abort is cancel. `AbortError` emits `cancelled`. No toast of success. No automatic copy after dismiss.
- Files denied. No `files` member. No blob, screenshot, or “share this card as PNG”.
- No social row. No Facebook / X / WhatsApp / mailto intents. The OS sheet chooses the target. If there is no sheet, the user copies.
- Gesture only. Share and Copy run from click/keyboard activation. No load-time share. No idle timer.
- Writes still hold. Sharing or copying a run link is not a seal, a grant, or a ledger append.

Canonical lines (do not wrap, do not add a trailing space):

```
share#016|kind:run-link|api:web-share|copy:writeText|files:deny|utm:deny|social-row:deny|hash:sha256|seal:human
```
SHA-256: `39203d0af8e9f39dec039812da2f3a3912f2e075b375b4d07bc76bdd59da85d8`

```
claim#payload|text:Only allowlisted title, text, and https URL may be shared. location.href is never the source.
```
SHA-256: `e78aff27183fcdf434c5fdb7209f953426c391293c9b1045628cb2d8ce20cc5c`

```
claim#detect|text:Share is offered only when navigator.canShare accepts the exact payload. Guessing is denied.
```
SHA-256: `7311ae436ecc60adf81ea53c670be9dd7ad670a5cfdf934cfd1e2cc24cadc5c5`

```
claim#abort|text:AbortError is cancelled, not shared. No success receipt on dismiss.
```
SHA-256: `f607cf41d443d1ea84910d8d823689e1447262ebe105ddbfafa450a93cc520d1`

```
claim#copy|text:Copy writes the attested URL only. Clipboard read is denied. Copy is not a share.
```
SHA-256: `dd2d1348df8e4b8786f94b790b512cc2ab361ace8186e2bc3b7542762c187470`

```
claim#files|text:Files, blobs, and generated images are denied on this control.
```
SHA-256: `104dde80df122ab01164bb756de0e7c5959abb6a8d5384769b5ceaf1ef7f0af7`

```
claim#targets|text:No Facebook, X, WhatsApp, or mailto row. The OS sheet chooses the target.
```
SHA-256: `e47ec687fe05e308f1a5a887ceefc3873a93428564411854db507fc935c522ec`

```
page#share|route:draft|index:noindex|cookie:deny|analytics:deny|write:deny
```
SHA-256: `6be94ce58e42d5ad955a838a36b521862cab78ec70596f6895d6cb15a8387052`

Body digest = SHA-256 of the eight canonical lines joined by LF, with a trailing LF:
`a93066fdadae96f889260e1bd9171f0241b525f19c38569ed1c6e04cec3608af`

Head digest = SHA-256 of the compact JSON
`{"algo":"sha256","kind":"run-link","files":false,"utm":false,"social_row":false}`
→ `d473838c91728bbddb77e36c6a866eb6fd61f6bddf8ccb1cbf20824c18537f80`

Run and invoker lines (not part of the public body digest):

```
run#demo-016|id:demo-016|href:https://a-to-mind.com/r/demo-016|title:A-to-Mind run demo-016|text:Open the attested run record. Tools stay default-deny.
```
SHA-256: `09717939b509f57c67c8464596e0dcc91392fe30797fbbf1cac9ef98ac9026dc`

```
href#demo-016|https://a-to-mind.com/r/demo-016
```
SHA-256: `e865307a25207c01f338a0b3c5381106fb2f600b5f07197e30695b9153d53503`

```
invoker#share|id:share-run|needs:gesture|files:deny
```
SHA-256: `8704c4d3110719c213a44cce84a2394062de546fc15a398bbaac668a7582a7d4`

```
invoker#copy|id:copy-run|api:writeText|read:deny
```
SHA-256: `a0d828e1c1953e23acdbb31d142b17d9cbad7b9f4f064abe350c1f97af90f7dc`

Receipt statuses the UI is allowed to emit: `shared`, `copied`, `cancelled`, `mismatch`, `denied`, `unavailable`, `failed`. Nothing else.

This UI is not a security boundary. A `shared` receipt proves the page handed the attested payload to the user agent. It does not prove a recipient opened the URL. A `copied` receipt proves this page attempted to write the published href and that the href still hashed.

Out of scope on purpose (later Queue slugs): budget estimator, live run preview, view-source page, PWA / share_target, voice, personalization, 3D.

## Files in this draft

- `SPEC.md` — this file
- `claims.json` — attested contract, run payload, invokers, published digests
- `proposed-share.html` — open locally or as a Pages preview. Live site has no share control.

## Seal steps

1. Open `drafts/016-web-share-and-copy-run-link/proposed-share.html` over HTTPS or `localhost`.
2. Confirm live `index.html` still has no Share button, no Copy-run button, and no `/r/` link, and that this run did not edit it.
3. Recompute the contract line:
   `printf '%s' 'share#016|kind:run-link|api:web-share|copy:writeText|files:deny|utm:deny|social-row:deny|hash:sha256|seal:human' | sha256sum`
   Must match `39203d0af8e9f39dec039812da2f3a3912f2e075b375b4d07bc76bdd59da85d8`.
4. Recompute the body: join the eight canonical lines with LF, end with LF, `sha256sum`. Must match `a93066fdadae96f889260e1bd9171f0241b525f19c38569ed1c6e04cec3608af`.
5. Recompute the run line and the href line. Must match this SPEC.
6. Keyboard pass: Tab to Share and Copy. If `canShare` is false, Share is disabled and the reason is visible. Activate Copy; live region says `copied` plus the `e865307a…` prefix; focus stays on the button. If Share is enabled, activate it; dismiss the sheet and confirm `cancelled`, not `shared`. Complete a share and confirm `shared` (not `copied`).
7. Activate “Share current page” and “Copy unsigned URL”. Both must emit `denied`.
8. Flip one character in the run `data-canonical` and confirm both attested buttons become `mismatch` and do nothing.
9. Confirm there is no Facebook/X/WhatsApp/mailto row, no `files` payload, no cookie, no UTM, and no `readText`.
10. When sealing later: if a Share control is copied into a sealed room, keep the allowlisted payload, keep copy ≠ share, and do not add a social row.

Live marketing copy was not changed in run 016.
