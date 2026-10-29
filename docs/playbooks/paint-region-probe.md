# Paint floor: the probe that proves the engine, not the text

**Status: spec only. The floor is `held` in `void-live-deploy/lib/tower.js` until this lands** (owner, 2026-10-28: heycolor.com read beaten on 18 text facts while `/paint/` is a wip).

## Why the old probe was wrong

`tools/tower-probes.mjs` measured the paint floor with text facts — "paint by number", "real paintings", "numbered areas", "a palette". A page can print those strings with no working engine behind them, so the gate scored 18 of 18 and six journeys passed against a `wip paint` commit (`a5c0ba089`). Nothing in those facts can tell a flood fill from a colouring book.

The gate must measure what the page does, not what it says.

## Signals the probe must read

The page exposes a read-only description of its own engine for the probe (no secrets, nothing user-specific):

```js
window.__paint.describe() // -> { templates: [{ id, regions, palette }], engine: 'regions-v1' }
```

Four checks, all computed from that object plus the rendered canvas:

1. **Region floor.** At least **24 regions** in each of at least **3 templates**, and no template with fewer than 12. Rationale: the rival's pictures are 30-80 regions of organic shape; a 6-region grid is not the same job.
2. **Organic contour.** For each region compute the isoperimetric ratio `4*pi*A/P^2` on its mask. Require the **median >= 0.35** and **>= 80% of regions >= 0.25**. Reject any template whose regions are axis-aligned rectangles: for each region the bounding-box fill ratio `A / (w*h)` must be **< 0.92**; a grid of boxes scores 1.0.
3. **Palette variance.** At least **12 distinct colours** per template, and the minimum pairwise **dE2000 >= 5** between colours in adjacent regions (below that two neighbouring areas are visually one blob and the numbering is decorative).
4. **Adjacency.** Every region has **>= 2 neighbours** in the region adjacency graph (computed from the mask, 4-connectivity). Orphan strips are a symptom of a broken segmentation, not a picture.

## Scoring

`completeness` becomes a percentage over these four groups, each worth equal weight: `regions >= 24`, `organic contour`, `palette variance`, `adjacency`. A group is `pass`, `fail`, or `incomplete`.

- `pass` only with numbers for every template it names.
- `incomplete` (never a pass) when the page does not expose `describe()`, when fewer than 3 templates load, or when the canvas cannot be read.
- The floor is beaten only when all four are `pass` and `tools/tower-journeys.mjs` still passes its six scripted journeys with negative controls.

## Where it goes

| file | change |
|---|---|
| `void-live-deploy/paint/app.js` | expose `window.__paint.describe()`; compute per-region area, perimeter and neighbours once per template |
| `tools/tower-probes.mjs` | replace the four text `facts` with the four measured groups above, read via `page.evaluate` |
| `tools/tower-gate.mjs` | nothing — it already scores `PARTS` and records numbers |
| `tools/tower.test.mjs` | a fixture with a 6-region rectangular grid must score `fail` on all four groups |

## Clearing the hold

When the engine merges and `describe()` reports the four groups as `pass`, remove the `held:` line from the `paint` entry in `void-live-deploy/lib/tower.js` and run `gh workflow run tower-gate.yml -f floor=paint`. The floor then measures on its own numbers; the card's "held: ..." line disappears by itself.