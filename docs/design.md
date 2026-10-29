# Verse design system

Owner, 2026-10-15: "I wouldn't mind if Verse became unrecognizably good looking."

The idea in one line: **a dark stage lit from above, with glass that catches the light**. The page stays empty until you ask (that rule does not change); what changes is that the emptiness is a place: deep space, a breathing event-horizon glow, a pool of light where answers stand, and everything that appears stands in it.

## Benchmarks (what we take from whom)

| Site | What it does best | What Verse takes |
| --- | --- | --- |
| [linear.app](https://linear.app) | Near-black surfaces, a single cool accent, hairline borders lit from the top edge, motion that is fast and never bouncy on content | the 1px top highlight (`inset 0 1px 0`), restraint: one accent colour |
| [stripe.com](https://stripe.com) | Gradients with depth, layered ambient shadows, display numerals | multi-layer shadows (contact + ambient + coloured bloom), numerals as display type |
| [apple.com/apple-vision-pro](https://www.apple.com/apple-vision-pro/) and visionOS glass ([HIG: Materials](https://developer.apple.com/design/human-interface-guidelines/materials)) | Glass that stays legible: blur + tint + a bright rim, depth from light not lines | the glass recipe, the rim, "depth comes from lighting" |
| [raycast.com](https://www.raycast.com) | The command bar as the hero: one input, big, glowing, keyboard first | the ask bar is the product; its rim wakes on focus; send key lights up when there is text |
| [vercel.com](https://vercel.com) | Light done in pure CSS, still fast | (the perspective-grid floor was taken out 2026-10-15; see Never) |
| [perplexity.ai](https://www.perplexity.ai) | Answer cards: title, one big result, sources quiet beneath | the card hierarchy: h2, display result, quiet source line |
| [web.dev: Core Web Vitals](https://web.dev/articles/vitals) and [WCAG 2.2](https://www.w3.org/TR/WCAG22/) | The bar for fast and accessible | the gates below |

## Tokens (live in `void.html`, the "design phase 1" block)

**Colour.** Background `#050505` (unchanged, it is the void). Ink `--d-ink #f2f4fb`, `--d-ink-2 #c3c8d8`, `--d-ink-3 #8e94a8` (all ≥ 4.5:1 on the card glass). Light colours as rgb triplets so any alpha works: key `--d-key 158 178 255` (cool blue, the only accent), warm `--d-warm 255 170 214`, teal `--d-teal 92 232 205` (rim highlights only, never text).

**Type.** The system UI stack (`--font`, no web font download: zero bytes, no layout shift). Ask bar 17px (16px on phones so iOS never zooms). Card title 22px/600, tracking -0.015em. Display results weight 250-300, tracking -0.03em, tabular numerals, a white-to-key vertical gradient. Captions 12-13px in `--d-ink-3`.

**Depth.** Five levels, lit from above:
- 0 the void (background, grain)
- 1 the void (event-horizon glow, nebula drift, light pool, star dust)
- 2 the stage (3D miniatures, figures)
- 3 glass (cards, the ask bar): `--d-glass`, rim `--d-rim`, shadow `--d-lift` (top highlight, bottom inner shade, contact 2px, near 18px, far 60px)
- 4 overlays (hints, menus)

**Glass.** `--d-glass` 165° gradient from lit (40,46,70 at .80) to deep (16,18,28 at .88). Blur only where the background is still: never on phones over a moving canvas (measured 2026-10-14: the weather card lagged), where the glass goes nearly opaque instead.

**Lighting.** One key light, top centre, cool. Top edges are brighter than bottom edges; rims are conic gradients that pass through key, warm and teal; a soft coloured bloom (`0 80px 160px -40px key/.14`) under a card is its light on the floor.

**Motion.** `--d-ease-out cubic-bezier(.16,1,.3,1)` for arrivals (700ms, opacity + blur, no movement of content you are reading), `--d-spring` only for the ask bar's lift. Nothing animates at rest except the existing stepped depth breath (about 5 redraws a second). `prefers-reduced-motion`: every arrival is instant. `forced-colors`: the decorative layers are hidden.

**3D stage aesthetic.** Miniatures are physical objects (brass, enamel, paper, glass) lit by the same key light; they stand on the floor, and the card is a panel beside or in front of them. One renderer (`skills/scene3d.js`), ACES tone mapping, room environment light, contact shadows.

**Layout, mobile first.** One column. The ask bar is pinned to the bottom (thumb reach) with safe-area padding; cards centre in the space above it and scroll inside themselves; widths `min(560px, 100vw - 24px)`, 20px gutters at 390px. Tap targets ≥ 44px.

## Gates (every phase)

- Lighthouse performance on the live homepage at or above the last measurement; accessibility 100.
- No new requests or fonts for decoration; CSS before canvas, canvas before WebGL.
- Contrast ≥ 4.5:1 for text, ≥ 3:1 for the focus ring.
- Before/after screenshots at 1440×900 and 390×844, and the weekly visual diff (`.github/workflows/visual.yml`) to catch accidents.

## Phases

1. **Shipped 2026-10-15**: the empty stage (replaced the same day: the grid floor became the default void below), the ask bar (glass, lit rim on focus, glowing send key, bigger type), the answer card shell (glass, rim, bloom, display numerals, blur-in arrival). Screenshots: `/workspace/void-audit/redesign/` on the box.
2. One card component for `.vpage` and `.thing` (with convergence step 7), per-kind accent colours (weather warm, sky teal), skeleton loading in the card's own shape.
3. The stage reacts: the key light follows the active card, miniatures cast their glow on the floor, a horizon that tints with the real sky (`sky-rules.js`).
4. Type and motion pass on every skill's inline styles, moved into tokens.

## The default look: the Verse (owner, 2026-10-15)

"Verse should be a beautiful Verse by default, something impressive to look at that puts people in awe."

- Deep space, never a flat colour: two star-dust canvases with cursor parallax (`#void-stars-far`, `#void-stars`).
- At the centre a dark event horizon ringed by a slowly breathing glow (11s cycle) that turns once every ~160s; a faint nebula drifts behind it (`#void-depth::before/::after`).
- A soft oval pool of light low on the stage where answers stand; under an active card it brightens and casts a shadow (`#void-glow::after`).
- It reacts: the breathing quickens when the ask bar has focus and leans in while a card is shown. The key light follows the cursor (existing `--dx/--dy`).
- Performance: CSS transforms and opacity only, no per-frame JS added; animations pause when the tab is hidden. Target 60fps on phones.
- Reduced motion: the same composition held still. Forced colours: all decoration off.
- The ask bar stays legible: the glow sits above it, and the bar keeps its glass.

### Never
- **No perspective grids, grid floors, synthwave horizons or tron lines.** Adam called it "the ugly every-AI-website grid" and it was removed. A check in `tools/checks.mjs` fails on `rotateX(` paired with `repeating-linear-gradient` in a page background.
- No generic SaaS feature-tile grids on the empty stage. The stage stays empty until you ask.

### The Verse, pass 2 (2026-10-15: "too dim to put people in awe")
- Star dust is on by default: two canvases, DPR capped at 2, count scales with screen area, warm/cool tints, about 14% twinkle, brightest stars get a soft halo. They stop drawing when the tab is hidden and pick up again when it's visible. With reduced motion they're drawn once and held still.
- Accretion ring: a white-hot inner edge into key/warm, plus a conic band that brings the colour round as it turns. `#void-lens` is a thin arc of lensing shimmer (7s).
- A visible nebula: two colour clouds plus the real sky's glow (`--sky-glow`), drifting over 70s.
- **celestial-sync** (Verse's ask): `html[data-phase]` is dawn/day/dusk/night from the device's local hour, and it tints the nebula and ring. The weather and sky come from the existing client-side sky-rules (`--sky-glow`). Nothing is sent or stored.
- **Thinking**: `html.void-thinking` is set while the open card says "thinking…", "looking up" or "reading the page". The ring brightens and spins up (1.6s breathe, 14s turn) and the lens quickens.
- **light-reactive cards** (Verse's ask): the active card picks up a lit top rim and a nebula-coloured bloom from the horizon, stronger while thinking.
