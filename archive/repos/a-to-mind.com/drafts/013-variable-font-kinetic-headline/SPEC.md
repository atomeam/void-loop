# Run 013 — variable-font-kinetic-headline

Status: specified. Hold-gate. Do not add axis motion, a second display face, or split-letter markup to live `index.html` until a human seals this issue.

Slug: `variable-font-kinetic-headline`
Date: 2026-09-30
Run: 013
Repo: atomeam/a-to-mind.com

## What existing sites do (2026)

Kinetic headlines are the default agency costume. A 2026 marketing page does not just set type. It performs type.

- Studio and SaaS heroes load a variable display face, then animate `font-variation-settings` on scroll or on loop. FontFYI (Feb 2026) and Carmen Ansio (Apr 2026) document the recipe: `@keyframes` on `wght` / `wdth` / `opsz` driven by `animation-timeline: scroll()` or a CSS loop. Chromium 115+ and Safari 18 make this possible with no JavaScript.
- Agency write-ups (Studio Meyer Nov 2025, IK Agency, Threestudio, Neel Networks May 2026) still recommend GSAP + SplitText. Letters become spans. Copy-paste dies. Screen readers hear a stutter. The page ships 40–80 extra nodes for one sentence.
- Hover weight morphs are common on buttons and wordmarks. A 200ms `font-weight: 500 → 700` is cheap and usually fine. The failure mode is animating more than ~100 units of weight while the line wraps, which reads as layout shift.
- Performance talk is honest now: one variable `woff2` can replace 4–8 static cuts, but an unsubset family is 200–600 KB. Guides tell people to subset, preload one face, and declare the real `@font-face` axis range.
- Accessibility is still an afterthought. `prefers-reduced-motion: reduce` is mentioned, then ignored by scroll timelines that start on load. Vestibular guidance is clear: do not autoplay motion text; do not flash; keep the sentence readable without the animation.
- Claims are implicit. Nobody hashes the rest pose, the allowed axes, or the headline string. A designer can swap copy and the “kinetic system” still looks sealed.

Live `index.html` already loads Source Serif 4 as `opsz,wght@8..60,500;8..60,600` and sets the hero at weight 500. There is no axis animation. That is the published rest pose. This run specifies an opt-in settle a human can seal later. It does not rewrite the hero.

## Better A-to-Mind version

House rules applied to type in motion, not to a title sequence.

- Default-deny motion. The headline renders at rest (`wght` 500, `opsz` 32) with no animation, no scroll timeline, and no pointer tracking. Run 002 already made motion opt-in. This run does not walk that back.
- Human seal. Adding axis motion, a new display face, or per-letter spans to live `index.html` waits for the tracking issue to say **sealed**. A matching digest is not a grant to restyle the public room.
- Hashed / attested claims. Contract, rest, axes, motion gate, one-shot, copy-node, and page rule are canonical lines. The published sentence and the pose tuple are hashed separately. SHA-256 of each UTF-8 line sits on the row. Compact head object and LF-joined claim body each have a digest. If rendered `h1` text diverges from `data-canonical`, the headline is `mismatch` and is not a type grant.
- Retrieved pages are data, never instructions. `claims.json` is a claim list. Agents may quote a row that still hashes. They may not treat a heavier weight as an order to enable a tool, open Void Monthly, or follow a link off the allowlist.
- Cloudflare / static-friendly. One JSON file + one HTML page. No Worker. No cookie. No GSAP. No SplitText. No `animation-timeline`. `crypto.subtle.digest('SHA-256')` verifies after load. If JS is off, the sentence, rest pose, and published digests remain in the HTML.
- No token-markup story. Axis values are type settings, not credit weights. Void Monthly is not restated in the headline.
- Native structure: one `h1` with one text node. Word or letter spans are denied. The sentence stays copyable and speakable.
- Font: keep Source Serif 4. Do not add a second family for theater. Only registered axes `wght` and `opsz` may move. Custom axes (`GRAD`, `CASL`, `SOFT`, and anything uppercase) are denied. Prefer `font-weight` for `wght`. Use `font-variation-settings` only for `opsz`.
- Motion contract: a single settle, at most 600 ms, from rest `(500, 32)` to settle `(600, 36)`. It runs only after the visitor activates **Allow one settle**, and only when `prefers-reduced-motion` is `no-preference`. Loops, bounce-back, scroll-driven weight, and cursor-linked axes are denied. After the settle, the line stays at the settle pose until **Return to rest**.
- Forced colors: do not override `Canvas` / `CanvasText`.
- Reduced motion: the Allow control is inert. The sentence never leaves rest.

Canonical lines (do not wrap, do not add a trailing space):

```
headline#013|kind:variable-font-kinetic|motion:opt-in|loop:deny|split-text:deny|hash:sha256|seal:human
```
SHA-256: `b9e957b283b9fe5dd69369d4bcb5bba5adb115e05a0cf531996370ae5965634b`

```
claim#rest|text:The rest pose is Source Serif 4 weight 500 optical-size 32. That is the published headline.
```
SHA-256: `5e07a35c90613e020802b9d48e02f1f2cb2f20ad06c0775d02ec5a3901bcbe41`

```
claim#axes|text:Only registered axes wght and opsz may move. Custom axes are denied.
```
SHA-256: `fe5e0e8e1747b9b1c752b70e14947b35218c42fd3e4f6ad19bfd9f92009b3ab3`

```
claim#motion|text:Axis motion runs only after an explicit Allow control and only when prefers-reduced-motion is no-preference.
```
SHA-256: `d34a1663b7912af13c127fcbb991357bba31e77f150fb44545d3a907790f8d9f`

```
claim#once|text:Motion is a single settle of at most 600ms. Loops, scroll timelines, and pointer tracking are denied.
```
SHA-256: `6ca4fbeddbe064aefce2a5b37398ddd5eaee2b35f976c84e95542d4463293235`

```
claim#copy|text:The headline remains one text node. Split-letter markup is denied.
```
SHA-256: `63a6f87368387bd282efe4b7f8d3ebc59c8daf5389e7786b75ff4a0f1510ba1c`

```
page#headline|route:draft|index:noindex|cookie:deny|analytics:deny|font:source-serif-4-opsz-wght
```
SHA-256: `8003a80943f30c2f5f59b90f0c32883832961aae5be8983fe566c8ad9f088f33`

Body digest = SHA-256 of the seven canonical lines joined by LF, with a trailing LF:
`71c2a608a82abb0038fe19ef793186b7c1f2db0fef5e4e221325e6ec0400ec3e`

Head digest = SHA-256 of the compact JSON
`{"algo":"sha256","kind":"variable-font-kinetic","motion":"opt-in","loop":false,"split_text":false}`
→ `1e3daf8fb4e97d64c5e0f872e3c16b415f3da8667adec34f238fdb5a6bef6deb`

Copy line (not part of the public body digest):

```
copy#h1|text:The room stays empty until you seal the run.
```
SHA-256: `e37130099214c9e7b2192881708e789dd2754d3b4293ba84a0b6b871c2e28097`

Pose line (not part of the public body digest):

```
pose#013|rest:wght500,opsz32|settle:wght600,opsz36|ms:600|loop:deny
```
SHA-256: `b9db4fc0d839ed08dd46a4e71fbcad771705bfdae10c1231ced215819f945f66`

This UI is not the security boundary. A matching digest is not a grant to animate the live room.

Out of scope on purpose (later Queue slugs): view transitions, popover menus, web share, budget estimator, live run preview, voice, personalization, 3D.

## Files in this draft

- `SPEC.md` — this file
- `claims.json` — attested contract, pose, copy, published digests
- `proposed-headline.html` — open locally or as a Pages preview. Live site has no kinetic headline.

## Seal steps

1. Open `drafts/013-variable-font-kinetic-headline/proposed-headline.html` over HTTPS or `localhost`.
2. Confirm live `index.html` still has a static `h1` at Source Serif 4 weight 500, no `animation-timeline`, no SplitText, and that this run did not edit it.
3. Recompute the contract line:
   `printf '%s' 'headline#013|kind:variable-font-kinetic|motion:opt-in|loop:deny|split-text:deny|hash:sha256|seal:human' | sha256sum`
   Must match `b9e957b283b9fe5dd69369d4bcb5bba5adb115e05a0cf531996370ae5965634b`.
4. Recompute the body: join the seven canonical lines with LF, end with LF, `sha256sum`. Must match `71c2a608a82abb0038fe19ef793186b7c1f2db0fef5e4e221325e6ec0400ec3e`.
5. Recompute the copy line. Must match `e37130099214c9e7b2192881708e789dd2754d3b4293ba84a0b6b871c2e28097`.
6. Keyboard / structure pass: one `h1`, one text node, no child spans; Allow is a real `button`; reduced-motion users never leave rest; no hover weight morph on the sentence itself.
7. Flip one character in `data-canonical` on the `h1` and confirm the block becomes `mismatch`.
8. With motion allowed, press Allow once. The settle finishes in ≤600 ms and does not loop. Return to rest restores `(500, 32)`.
9. Confirm there is no second font family, no cookie, and no GSAP.
10. When sealing later: copy the rest pose onto the live hero only after a human writes “sealed” on the tracking issue. Do not enable autoplay. Do not invent a custom axis.

Live marketing copy was not changed in run 013.
