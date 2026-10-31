# iamrapid.com: feature parity

Written by `node tools/parity.mjs --write` from the feature rows in `tools/parity-catalog.mjs` and the live scan in `docs/PARITY/live.json`. Fix a wrong row in the catalogue, not here. Its obituary may say "beaten" only when this page has no missing, partial or unreviewed rows and the tower gate has 9 of 9 with evidence.

- Original: iamrapid.com (https://iamrapid.com/tools/repair-3d-file/)
- Verse: /stl/ (stl check, tower gate 0 of 17)
- Live scan: not scanned yet
- History: [docs/HISTORY/iamrapid.com.md](../HISTORY/iamrapid.com.md)

**Match: 93%**: 14 have, 0 partial, 0 missing, 1 unreviewed, of 15 features.

| Feature | Area | Verse | Evidence on the original | Evidence in Verse |
| --- | --- | --- | --- | --- |
| Watertight yes or no | Check | have | every site of this kind offers it | void-live-deploy/stl/index.html:102 `<h1>Is my STL watertight?</h1>` |
| Open boundaries and holes | Check | have | every site of this kind offers it | void-live-deploy/stl/index.html:103 `he slicer: watertight or not, open edges and holes, non-manifold edges, flipped normals, i` |
| Non-manifold edges | Check | have | every site of this kind offers it | void-live-deploy/stl/index.html:103 `or not, open edges and holes, non-manifold edges, flipped normals, inside-out shells, dege` |
| Inverted and flipped normals | Check | have | every site of this kind offers it | void-live-deploy/stl/index.html:103 `ifold edges, flipped normals, inside-out shells, degenerate and duplicate faces, separate` |
| Degenerate faces | Check | have | every site of this kind offers it | void-live-deploy/stl/index.html:103 `d normals, inside-out shells, degenerate and duplicate faces, separate shells and faces th` |
| Duplicate faces | Check | have | every site of this kind offers it | void-live-deploy/stl/index.html:103 `de-out shells, degenerate and duplicate faces, separate shells and faces that cross, with` |
| Duplicate vertices | Check | have | every site of this kind offers it | void-live-deploy/stl/index.html:147 `s and the weld</dt><dd>An STL repeats each corner for every face that uses it. Corners wit` |
| Disconnected shells | Check | have | every site of this kind offers it | void-live-deploy/stl/index.html:103 `, flipped normals, inside-out shells, degenerate and duplicate faces, separate shells and` |
| Self-intersections | Check | have | every site of this kind offers it | void-live-deploy/stl/index.html:103 `te faces, separate shells and faces that cross, with its size, volume and area, and a 3D v` |
| A weld threshold in mm | Check | have | every site of this kind offers it | void-live-deploy/stl/index.html:111 `welds within about 0.001 mm.">Weld within <input id="tol" type="number" min="0" max="1" st` |
| Triangles, vertices, size, volume and surface area | Part | have | every site of this kind offers it | void-live-deploy/stl/index.html:103 `nd faces that cross, with its size, volume and area, and a 3D view of where each problem i` |
| A 3D view of the part | Part | have | every site of this kind offers it | void-live-deploy/stl/index.html:103 `size, volume and area, and a 3D view of where each problem is. <b>Checked on this device:` |
| Download a repaired file | Repair | have | every site of this kind offers it | void-live-deploy/stl/index.html:134 `left as they are.">Download a mended copy</button>` |
| Runs in the browser, nothing uploaded | Privacy | have | every site of this kind offers it | void-live-deploy/stl/index.html:103 `d on this device: the file is never uploaded.</b></p>` |
| Its live pages could not be read, so its own menus and settings are not studied yet | Unreviewed | unreviewed | the live scan of https://iamrapid.com/tools/repair-3d-file/ | not compared yet |
