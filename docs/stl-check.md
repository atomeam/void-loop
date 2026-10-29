# STL checker (/stl/): design and test plan

Asked by Verse: "Create a browser-based utility to check the watertightness of STL print files."
Design and test plan only. The ask stays held behind the current Versus target (sycophanthex.com)
in `void.asks.json`, so the page is not on main. The built page waits on branch `asks/stl-check`
and ships when the hold lifts.

## Pieces

| Piece | File | What it does |
| --- | --- | --- |
| The check | `asks/stl-check:void-live-deploy/lib/stl-check.js` | Pure module, no DOM and no network. It parses an STL file, welds the corners, counts every edge and returns a report object, a verdict line and a mended copy. |
| The page | `asks/stl-check:void-live-deploy/stl/index.html`, `stl/app.js` | Drop or pick a file, view the report and the 3D preview, copy or download the report, download a mended copy. |
| The stage card | `asks/stl-check:void-live-deploy/skills/stl-check.js` | "check my stl file", "is my stl watertight". A file box that runs the same check inline, plus links to /stl/. |
| Hand-off | forge card's "Check this STL" link | Opens `/stl/?forge=<key>`, the same file that the forge's Print it downloads. The page also takes `?sample=cube|hole|flipped`, `?src=/same-site/path.stl` and `?tol=`. |

## What it checks

The file is read as **binary STL** when its length is exactly 84 + 50 x the triangle count in its header. Otherwise it is read as
**ASCII STL** (`solid` / `facet` / `vertex` lines). Some exporters start a binary file with the word "solid", so the length test
comes first. If a binary file is shorter than its header says, the report says it was cut short and checks the faces that are there.

Corners closer than the weld tolerance (default 0.001 mm, adjustable on the page) are merged first. Then:

- **Open (boundary) edges**: an edge used by only one face. The open edges are grouped into the holes they surround, and the report
  gives each hole's position in mm. Any open edge means the file is **not watertight**.
- **Non-manifold edges**: an edge shared by three or more faces, for example two cubes touching along an edge. Also not watertight.
- **Inconsistent winding (flipped normals)**: two faces that share an edge must cross it in opposite directions. The faces of each
  shell are walked outward from a start face. A face wound against its neighbours is counted as flipped (the smaller group of each
  shell counts as the flipped one), and the edges where the winding disagrees are counted separately.
- **Inside-out shells**: a closed shell whose signed volume is negative, so every normal points inward.
- **Degenerate triangles**: faces with zero area, either because all three corners sit on one line or because two corners weld into one
  (counted as "collapsed").
- **Duplicate faces**: the same three corners repeated. They are counted, then set aside so they do not create false non-manifold edges.
  They add no area and no volume.
- **Shells**: separate connected bodies.
- **Crossing faces (self-intersections)**: a face edge that pierces another face (Moller-Trumbore test over a uniform grid). This check
  runs up to 300,000 faces, and above that the report says it was skipped.
- **Size, volume, area**: the bounding box in mm, the volume in cm³ and the surface area in cm².

The verdict line comes first and reads as one of three things:

- "Watertight: ready for the slicer."
- "Not watertight: N open edges around M holes, the first near x, y, z mm."
- "Watertight, but not ready: ..." (flipped faces, inside-out shells or crossing faces).

The **mended copy** drops degenerate and duplicate faces, turns the flipped faces, turns inside-out shells outward and fills each hole
with a fan of triangles from its centre.

## Files stay on the device

The file is read with `File.arrayBuffer()` and checked in the page's own JavaScript. Nothing is sent anywhere. The page says so above
the drop zone, and the text report repeats it ("not uploaded"). `?src=` loads only same-site `.stl` paths (no other host, no `..`), so a
link cannot send the page off to fetch someone else's file. Reports and the mended copy download as blob URLs that the page builds.

## How bad areas are shown

The 3D preview uses the vendored three.js r180 (`/vendor/three-r180a`) with orbit controls, Z up. Problem marks are drawn over the
model with the depth test off, so they show through it:

- open edges in red (`#ff4d6d`)
- non-manifold edges in orange (`#ffa53b`)
- flipped faces in violet (`#d77bff`)
- crossing faces in yellow (`#ffe14d`)

Back faces are drawn dark red (`#5a1f33`), so you can see through a hole into the inside, and an inside-out part reads at a glance. The
legend lists only the kinds that are present. Under the view, "Where" lists each hole's position in mm. Without WebGL, the page draws a
flat 2D projection with the same colours.

## Tests that prove each check

`asks/stl-check:tools/stl-check.test.mjs` (node:test, 11 tests). Every test builds a real mesh, breaks it in one way, and asserts that the report
names exactly that break:

| Check | Test | Asserts |
| --- | --- | --- |
| Clean pass | closed 20 mm cube | binary, 12 faces, 8 welded corners, 20x20x20 mm, volume 8000 mm³, area 2400 mm², 0 open, 0 non-manifold, 0 flipped, 1 shell, verdict "Watertight: ready for the slicer." |
| Open edges, holes, where | cube with one face removed (`sample('hole')`) | 11 faces, 3 open edges, 1 hole at x = 0, not watertight, verdict starts "Not watertight: 3 open edges around 1 hole", 6 corner pairs for the preview. The mended copy is watertight with volume 8000. |
| Flipped normals | cube with one face reversed | still watertight, 1 flipped face, 3 inconsistent edges, verdict "Watertight, but not ready: 1 face wound the wrong way". The mended copy has 0 flipped. |
| Inside-out | every face reversed | 0 flipped (they agree with each other), 1 inside-out shell. The mended copy has 0. |
| ASCII and binary | same cube written both ways | identical counts, size, volume, area. A binary file whose header starts "solid" is still read as binary. |
| Degenerate, collapsed, duplicate | cube plus a line-thin face, a face whose corners weld together, a repeated face | degenerate 1, collapsed 1 (still watertight), duplicates 1 with no false non-manifold edges and area still 2400 |
| Non-manifold, shells, crossings, tolerance | two cubes sharing edges, then moved apart, then pushed into each other; a corner nudged 0.5 µm | non-manifold above 0, not watertight; 2 shells and ok; self-intersections above 0 and not ok; welds at 1 µm, open at 0.1 µm |
| Bad files | empty file, binary cut to 5 faces | "empty" verdict; "cut short" problem with 5 faces read |
| Agreement with the forge | forge vase and rocket via `forge-rules.js` | no open edges, nothing flipped, outward, same volume as `printCheck`, and open + non-manifold equals the model's own count of edges not shared by exactly two faces |
| Report | hole sample | the text starts with the file name and the verdict, and lists every number and "not uploaded"; the JSON has no mesh |
| Stage skill and routing | `asks/stl-check:skills/stl-check.js`, `lib/toolkit.js` | matches the checker asks, leaves "download the stl", "print it", "make me a vase" and others alone; `routeAsk` sends them to /stl/ |

In-browser, `tools/real-pages.mjs` spec `/stl/` (run by `checks.mjs` with Chrome) does the following:

- clicks the cube-with-a-hole sample and expects "Not watertight: 3 open edges around 1 hole"
- clicks the closed cube and expects "Watertight: ready for the slicer"
- copies the report (contains "Open edges: 3")
- downloads the `.txt` report and the `-mended.stl` copy
- opens the share link in a new page and sees the same verdict

`tools/handoff-scan` checks the `verse-handoff` tag (in: url, out: text) and that the page reads its link. `skills-check` and
`tools/families.mjs` check the skill (make family, order `0115-stl-check`).

## Known limits

- Units are assumed to be millimetres, as slicers assume. A part under 12 mm across gets a hint that it may have been drawn in inches (scale by 25.4), but nothing is rescaled.
- Crossing faces are not checked above 300,000 faces.
- Filling a hole with a fan suits small, roughly flat holes. A large ragged hole gets a closed but crude patch.
- Found while building: the forge's `printCheck` counts a mesh as closed when under 0.1% of its edges are bad. The forge's rocket (1),
  bottle (2), snowman (20) and well (47) carry non-manifold edges that /stl/ names.
- The Versus floor 'stl check' (against iamrapid.com's repair tool, parity 93% in `asks/stl-check:docs/PARITY/iamrapid.com.md`) has no probe yet, so
  it is unmeasured.
