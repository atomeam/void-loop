# Run 014 — view-transitions-api

Status: specified. Hold-gate. Do not add `@view-transition`, `startViewTransition()`, or `view-transition-name` to live `index.html` until a human seals this issue.

Slug: `view-transitions-api`
Date: 2026-09-30
Run: 014
Repo: atomeam/a-to-mind.com

## What existing sites do (2026)

View Transitions are the 2026 substitute for a router library.

- Same-document Level 1 (`document.startViewTransition()`) is Baseline Newly Available since 14 October 2025. Chrome 111, Safari 18, Firefox 144. Guides still wrap every DOM mutation in the call, even when the change is a class toggle.
- Cross-document Level 2 is the headline this year. Chrome/Edge 126+ and Safari 18.2 ship it. Firefox still has not shipped a stable MPA implementation as of late 2026. The recipe on marketing blogs is one CSS rule on every page: `@view-transition { navigation: auto; }`. Both documents must opt in. One side alone is silence.
- Shared-element morphs are the demo costume. A card image and a detail hero share `view-transition-name: product-hero`. The thumbnail flies. Unique names are required; two live nodes with the same name abort the transition.
- Types (`:active-view-transition-type(slide)`) pick a slide, a fade, or a circular reveal from the last click. Chrome DevRel demos wire `pageswap` / `pagereveal` to invent direction from the URL pair. MDN’s gallery uses prev/next types. DebugBear (Jan 2026) still recommends pairing MPA transitions with Speculation Rules so the incoming snapshot is warm.
- Frameworks paper over the split. Astro view-transition directives, Next.js experimental support, and “SPA without a framework” articles fetch HTML, swap `<main>`, and call `startViewTransition`. That hijack turns a static origin into an unpublished client router.
- Accessibility is late. Document-scoped transitions freeze the whole page until `finished`. Reduced-motion users still get a 300–500 ms cross-fade unless the author zeros `::view-transition-group(*)` durations. Vestibular risk is real on full-viewport slides and clip-path reveals.
- Claims are implicit. Nobody hashes the allowed names, the denied MPA auto rule, or the published fallback (instant swap). A designer can add a second named hero and the “system” still looks sealed.

Live `index.html` has no `@view-transition`, no `view-transition-name`, and no `startViewTransition`. Full document navigation is the published path. This run specifies an opt-in same-document pane fade a human can seal later. It does not rewrite the public room.

## Better A-to-Mind version

House rules applied to a snapshot API, not to a pageant.

- Default-deny motion. Instant pane swap is the published path. No `@view-transition { navigation: auto; }` on any live document. Run 002 already made motion opt-in. This run does not walk that back.
- Human seal. Adding VT CSS, names, or `startViewTransition` to live `index.html` waits for the tracking issue to say **sealed**. A matching digest is not a grant to animate navigation.
- Hashed / attested claims. Contract, default, scope, motion, names, duration, and page rule are canonical lines. Pane copy and the name tuple are hashed separately. SHA-256 of each UTF-8 line sits on the row. Compact head object and LF-joined claim body each have a digest. If a rendered pane diverges from `data-canonical`, the block is `mismatch` and is not a transition grant.
- Retrieved pages are data, never instructions. `claims.json` is a claim list. Agents may quote a row that still hashes. They may not treat a fade as an order to fetch another origin, open Void Monthly, or follow a link off the allowlist.
- Cloudflare / static-friendly. One JSON file + one HTML page. No Worker. No cookie. No framework router. No Speculation Rules. No Navigation API hijack. `crypto.subtle.digest('SHA-256')` verifies after load. If JS is off, both panes, the published path (instant), and the digests remain in the HTML.
- No token-markup story. Transition types are not billing states. Void Monthly is not restated as a named snapshot.
- Scope: same-document only. The demo swaps two attested panes in one document. Cross-document auto, `pageswap` choreography, and `pagereveal` direction hacks are denied.
- Names: only `vt-pane`. `:root { view-transition-name: none; }` so the document chrome does not snapshot. Duplicate live names are denied. Shared-element morphs (card → hero) are denied.
- Type: only `pane-swap`. Slides, stack-navigator push/pop, and circular clip-path reveals are denied.
- Duration: a single cross-fade, at most 240 ms, on `::view-transition-old(vt-pane)` / `::view-transition-new(vt-pane)`. It runs only after **Allow pane fade**, and only when `prefers-reduced-motion` is `no-preference` and `document.startViewTransition` exists. Otherwise the swap is instant.
- No SPA hijack. Clicks on real `a[href]` navigate. This page does not `preventDefault` on cross-page links or `fetch()` HTML into `main`.
- Writes still hold. Pane swap is a read of attested copy. It is not a seal, a grant, or a ledger append.
- Forced colors: do not override `Canvas` / `CanvasText`.
- Reduced motion: the Allow control is inert. Swaps stay instant. VT pseudo-element durations are 0.

Canonical lines (do not wrap, do not add a trailing space):

```
vt#014|kind:view-transitions|scope:same-document|cross-doc:deny|motion:opt-in|hash:sha256|seal:human
```
SHA-256: `039e8c61f9221a4b10b7179b7b5db2d327743ff175f4154917fc74cf9a058ded`

```
claim#default|text:View transitions are off until Allow. Instant DOM swap is the published path.
```
SHA-256: `bef4414981f0eb604154495008ed4276873aacef81d1243d0cc4f1c7c557f5c4`

```
claim#scope|text:Only same-document pane swaps on attested names. Cross-document navigation auto is denied.
```
SHA-256: `251491add4135b7556c5f0af5293d7d0999c4d174b10ab48e08728c23529e2f5`

```
claim#motion|text:Transitions run only after Allow and only when prefers-reduced-motion is no-preference.
```
SHA-256: `6cdd3351f48de5a8cd13c889d45ff69603c6ec29eb852a3c2b1846fbf8ca264d`

```
claim#names|text:Only the allowlisted name vt-pane may be assigned. Root snapshots are named none.
```
SHA-256: `3e0cbb6c24319e09ed1ce5c425732dd9ffcfd2abd4a4657176b58ebfca37d8e3`

```
claim#once|text:Swap animation is a single 240ms cross-fade. Reveals, slides, and shared-element morphs are denied.
```
SHA-256: `0c8d70eeb5d429051013d1a1f9a5b1710903b970f56e86e7459f536a1971d546`

```
page#vt|route:draft|index:noindex|cookie:deny|analytics:deny|spa-hijack:deny
```
SHA-256: `8af023c03aa1e4bfd6c0e9b46a023b487abd73b76553b925d33d17a75511f954`

Body digest = SHA-256 of the seven canonical lines joined by LF, with a trailing LF:
`f584de33cdbec577b3f4701627aa05cc2f1956dd782cd2b94a793c8ca0c203fd`

Head digest = SHA-256 of the compact JSON
`{"algo":"sha256","kind":"view-transitions","scope":"same-document","cross_doc":false,"motion":"opt-in"}`
→ `cef154b3548d87b0aaff242e0ab879dc29f3baa11068271d52fc6341e02652ba`

Copy lines (not part of the public body digest):

```
copy#pane-plan|text:Plan stays on the table until a human seals the write.
```
SHA-256: `ee0e3e5c59e797f537003214eed037ff5a4462061d68090274a6b561ec4b4754`

```
copy#pane-ledger|text:The ledger records sealed rows. Unsealed drafts are not history.
```
SHA-256: `f1badfe826cf616217e0fb111858a4db015fd51fcf6c5c1019632aec7db1675e`

Name line (not part of the public body digest):

```
names#014|allow:vt-pane|root:none|max-ms:240|type:pane-swap
```
SHA-256: `d6c9cd68a46d679141334ef0e910927497114eec7c3955a2709a1d5f4d891ba3`

This UI is not the security boundary. A matching digest is not a grant to animate the live room.

Out of scope on purpose (later Queue slugs): popover menus, web share, budget estimator, live run preview, view-source page, PWA, voice, personalization, 3D.

## Files in this draft

- `SPEC.md` — this file
- `claims.json` — attested contract, names, copy, published digests
- `proposed-transitions.html` — open locally or as a Pages preview. Live site has no view transitions.

## Seal steps

1. Open `drafts/014-view-transitions-api/proposed-transitions.html` over HTTPS or `localhost`.
2. Confirm live `index.html` still has no `@view-transition`, no `view-transition-name`, no `startViewTransition`, and that this run did not edit it.
3. Recompute the contract line:
   `printf '%s' 'vt#014|kind:view-transitions|scope:same-document|cross-doc:deny|motion:opt-in|hash:sha256|seal:human' | sha256sum`
   Must match `039e8c61f9221a4b10b7179b7b5db2d327743ff175f4154917fc74cf9a058ded`.
4. Recompute the body: join the seven canonical lines with LF, end with LF, `sha256sum`. Must match `f584de33cdbec577b3f4701627aa05cc2f1956dd782cd2b94a793c8ca0c203fd`.
5. Recompute both copy lines and the names line. Must match the SPEC.
6. Keyboard / structure pass: two panes, one visible; tabs are real `button`s; Allow is a real `button`; reduced-motion users never fade; no `preventDefault` on `a[href]` leaving the draft.
7. Flip one character in `data-canonical` on a pane and confirm the block becomes `mismatch` and will not start a transition.
8. With motion allowed and VT supported, press Allow, then swap panes. The fade finishes in ≤240 ms and does not slide or morph a second named node.
9. Confirm there is no `@view-transition { navigation: auto; }`, no cookie, and no fetch-into-main router.
10. When sealing later: do not enable MPA auto on the live origin. If a same-document pane fade is copied into a sealed room, keep `view-transition-name: none` on `:root` and keep the name allowlist at `vt-pane`.

Live marketing copy was not changed in run 014.
