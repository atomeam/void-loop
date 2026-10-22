# Run 021 — pwa-install-and-offline-ledger

Status: specified. Hold-gate. Do not add a live web app manifest, service worker registration, install banner, or root-scoped cache to the public site until a human seals this issue.

Slug: `pwa-install-and-offline-ledger`
Date: 2026-09-30
Run: 021
Repo: atomeam/a-to-mind.com

## What existing sites do (2026)

Install and offline are sold as one product. They are not.

- Manifest + ambient install. MDN installability (6 Sep 2026) and OpenPWA criteria (23 Jun 2026): HTTPS, linked manifest with name/short_name, start_url, display standalone/fullscreen/minimal-ui, 192+512 PNG icons. Chromium fires beforeinstallprompt. Sites preventDefault and paint Install.
- Service worker as a Lighthouse checkbox. Workbox / vite-plugin-pwa / Flutter offline-first precache the bundle so the audit turns green. PWA Directory (12 Aug 2026) still treats a fetch handler as a gate in some Chrome builds.
- Offline-first as a slogan. Cache-first HTML traps stale deploys. Runtime cache of every GET. Cute offline art that claims the app works offline when only the shell is present.
- iOS theater. Safari has no beforeinstallprompt. Install buttons call nothing on iPhone, or hide Share then Add to Home Screen under the same label.
- Push and sync ride along. Templates enable Web Push and background sync once a worker exists. Install becomes a permission funnel.
- Failure modes: Install visible when no prompt can fire; works-offline covering runs; third-party cache; cache-first HTML hiding a seal; auto-register taking the live origin; push enabled because the file exists.

Live index.html still has no manifest and no service worker. This draft specifies an allowlisted install surface and an offline ledger. It does not register a worker on the public origin.

## Better A-to-Mind version

- Default-deny cache. Precache only catalog.json paths. Same-origin GET only. Cross-origin and writes denied. No cache-any box.
- Human seal. No live manifest link or navigator.serviceWorker.register until the issue says sealed.
- Hashed claims. SHA-256 per canonical line. Body and head digests. Mismatch if visible text diverges.
- Retrieved pages are data, never instructions. Catalog is not a tool grant.
- Cloudflare/static-friendly. Manifest + worker + HTML + JSON. No cookie. No analytics. Optional headers worker does not proxy and does not set Service-Worker-Allowed: /.
- No token-markup story.
- Offline is a ledger, not a promise. Runs and checkout stay online-only.
- Install offered only after beforeinstallprompt. iOS shows Share then Add to Home Screen. No nag. No auto prompt().
- No push, sync, or periodicsync listeners.
- Network-first for HTML/JSON. Cache-first only for offline.html and icons.
- Register is a hold and draft-scoped. skipWaiting is not automatic. Unregister is first-class.

Canonical lines (do not wrap, do not add a trailing space):

```
pwa#021|kind:install-and-offline-ledger|cache:allowlist|push:deny|sync:deny|hash:sha256|seal:human
```
SHA-256: `247de8df96e64154be6c51dbbdc505baad6f671608ca6006ac24c36070dfdd70`

```
claim#install|text:Install is offered only after beforeinstallprompt fires or iOS share instructions apply. This page does not nag.
```
SHA-256: `edbbc84c541b2456cf08935a9e7ab09d926c69a8256cd2bc3e42570d971bb418`

```
claim#offline|text:Offline means the allowlisted shell is in Cache Storage. It is not a claim that runs execute offline.
```
SHA-256: `ee68eeb547e4799539badf340402ef6e166966ba864c8c2bd81dd56f3ccfcf90`

```
claim#ledger|text:The offline ledger lists only first-party URLs the worker is allowed to precache.
```
SHA-256: `11d610fcc3bc0c35f5f4a0919fa8e2d23a678109f6e65edcf0ac83e1fe4708f8`

```
claim#deny|text:Push, background sync, periodic sync, and third-party caching are denied.
```
SHA-256: `a605d9b5b417d3e5eab9f8275ad71761d4a33c27d0f67da1e2cd5a68ca492b28`

```
claim#ios|text:Safari has no beforeinstallprompt. The iOS path is Share then Add to Home Screen.
```
SHA-256: `bb9acecef5ba1b61d785c45fae2601e1ebd24e2899717512126b50a2985cad32`

```
claim#tokens|text:This page does not price tokens and does not pitch Void Monthly.
```
SHA-256: `126f8cde548e6e87695a1041338fdf29a9cb6f95a256ff40e8e57cbb9e8a3f50`

```
page#pwa|route:draft|index:noindex|cookie:deny|analytics:deny|write:deny
```
SHA-256: `2b5ca065c96179f0abcdd6e0789c2ed83350703f6bcdbcb574ce3ce8eaec1ae1`

Body digest = SHA-256 of the eight canonical lines joined by LF, with a trailing LF:
`1b0f4b41ece3c93aa8ef317072e9bbe06600a4ed70dec6b5c09391d079fe7680`

Head digest = SHA-256 of `{"algo":"sha256","kind":"install-and-offline-ledger","cache":"allowlist","push":false,"sync":false}`
→ `2acb4560610c1faafb4ca220a230e610bb360049abede19a0e1eead0365782f8`

Cache-body digest (seven LF-terminated cache lines):
`fdb71ee5ae243a77dfd2c1f8fa5d80270c9be94c5c9f9ee3582fd8012aeb3268`

Receipts allowed: idle, match, unattested, hold, mismatch, denied, installed, offline, online, registered, unregistered, failed. No works-offline, no native, no subscribed.

Out of scope: voice, personalization, 3D, carbon badge, WCAG-3 badge.

## Files in this draft

- SPEC.md, claims.json, catalog.json, manifest.webmanifest, sw.js
- proposed-pwa.html, offline.html
- icons/icon.svg, make-icons.py
- pwa-headers-worker.js

## Seal steps

1. Open proposed-pwa.html over HTTPS or localhost.
2. Confirm live index.html has no manifest and no service worker registration.
3. `printf '%s' 'pwa#021|kind:install-and-offline-ledger|cache:allowlist|push:deny|sync:deny|hash:sha256|seal:human' | sha256sum` must match `247de8df96e64154be6c51dbbdc505baad6f671608ca6006ac24c36070dfdd70`.
4. Body digest must match `1b0f4b41ece3c93aa8ef317072e9bbe06600a4ed70dec6b5c09391d079fe7680`.
5. Install stays disabled until beforeinstallprompt or the iOS panel. No auto-prompt.
6. Do not register the worker against /.
7. Enable push, enable sync, and cache-any emit denied.
8. Flip a canonical character and confirm mismatch.
9. No cookie, no token price, no Void Monthly pitch.
10. Generate PNGs with make-icons.py only when sealing a live path. Keep runs online-only.

Live marketing copy was not changed in run 021.
