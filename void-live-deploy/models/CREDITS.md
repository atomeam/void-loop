# 3D credits

Everything Void draws in 3D is made in code or comes from the sources below. All are free for commercial use.

| Asset | Where it is used | Source | License |
|---|---|---|---|
| three.js r180 (vendored in `/vendor/three-r180/`) | the shared 3D scene (`skills/scene3d.js`) | https://threejs.org · https://github.com/mrdoob/three.js | MIT (`/vendor/three-r180/LICENSE`) |
| "Chess Set" by Riley Queen | the chess set (`chess-set-wood-v1-*.glb`) and the board alone (`chess-board-wood-v1-*.glb`, also under checkers) | https://polyhaven.com/a/chess_set | CC0 |
| "Oak Veneer 01", "Walnut Veneer", "Rosewood Veneer1" by Jenelle van Heerden (Poly Haven) | re-texturing the marble set as wood: maple-toned oak and walnut squares, boxwood-toned oak and rosewood pieces; the checkers men (`wood-v1/oak-*`, `wood-v1/rosewood-*`) | https://polyhaven.com/a/oak_veneer_01 · https://polyhaven.com/a/walnut_veneer · https://polyhaven.com/a/rosewood_veneer1 | CC0 |
| "Wood Table 001" by Dimitrios Savva and Rico Cilliers (Poly Haven) | the table under the boards (`wood-v1/table-*`) | https://polyhaven.com/a/wood_table_001 | CC0 |

How the models were made: the Poly Haven glTF (2k) was re-textured (board and piece colour/ARM maps blended with the
veneers above, felt bases kept), then compressed with gltf-transform: prune, dedup, weld, WebP textures (2k desktop,
1k phone), meshopt geometry. Desktop set 1.65 MB, phone set 0.73 MB; board alone 0.32 MB / 0.10 MB.
