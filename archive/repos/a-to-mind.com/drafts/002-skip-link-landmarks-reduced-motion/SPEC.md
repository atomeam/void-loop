# Run 002 — skip-link-landmarks-reduced-motion

Status: specified. Hold-gate. Do not merge into live `index.html` until a human seals this issue.

Slug: `skip-link-landmarks-reduced-motion`
Date: 2026-09-28
Repo: atomeam/a-to-mind.com

## What existing sites do (2026)

Most marketing sites treat this as a scanner checkbox.

- One “Skip to main content” link, often the first focusable node. GitHub, Wikipedia, and The New York Times still do this. It satisfies WCAG 2.2 SC 2.4.1 Bypass Blocks (Level A) via technique G1.
- HTML5 landmarks (`header`, `nav`, `main`, `footer`) so screen-reader rotors can jump regions (ARIA11). Many pages then slap `role="banner"` / `role="main"` on the native elements, which is redundant and sometimes creates duplicate landmarks.
- Skip targets frequently lack `tabindex="-1"`. Hash navigation then scrolls the box without moving keyboard focus — a known failure for sighted keyboard users and some WebKit histories.
- Skip links are hidden with `display: none` or `visibility: hidden`, which removes them from the tab order. Correct pattern is off-canvas until `:focus` / `:focus-visible`.
- Extra skip links pile up (“skip nav”, “skip search”, “skip ads”) until the skip pack itself needs a skip link. WebAIM still recommends one primary skip.
- `prefers-reduced-motion` is usually a late global hammer that zeros durations after the page already opted into motion.
- Focus rings are often animated away, or reduced-motion users lose the only cue that focus moved.
- Claims are implicit. Nobody hashes the landmark map.

## Better A-to-Mind version

- Default-deny motion: animate only under `prefers-reduced-motion: no-preference`.
- One skip link to `#main`. Native landmarks, no duplicate roles.
- `tabindex="-1"` on main plus a 12-line focus helper. Works without JS.
- Attested JSON landmark ledger with SHA-256 of the canonical map.
- Live homepage is unchanged until a human copies `proposed-index.html`.
