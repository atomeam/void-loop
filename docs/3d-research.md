# Void 3D: making the games look better (research, 2026-10-09)

What exists today (from the code): one shared WebGLRenderer (`skills/scene3d.js`) draws each miniature only when it changes ("dirty") and copies the frame into the card's own 2D canvas. It uses ACES tone mapping, a PMREM `RoomEnvironment`, PCFSoft shadows (1024 on phones, 2048 on desktop) and blurred contact shadows. Pixel ratio is 1 on phones and up to 2 on desktop. Chess and checkers use the Poly Haven chess set with CC0 veneer textures. Every other mini (go, othello, mancala, poker, monopoly, connect4, aggravation, battleship, fireworks) uses flat-colour `MeshPhysicalMaterial`s on plain `BoxGeometry`/`CylinderGeometry`. Only `GLTFLoader`, meshopt and KTX2 (with the basis transcoder, 576 KB) are vendored. There is no post-processing, no Draco and no HDR loader. The vendored add-ons already import `../build/three.module.min.js` by relative path, so any new add-on can be vendored the same way: copy the file and rewrite `from 'three'`. No build step and no importmap are needed.

**The main point:** because frames render only on change, an expensive look costs nothing while the scene is still. "Render one beautiful frame when the scene settles" is therefore affordable even on phones.

## Top 10 actions (ranked by visual impact per effort)

1. **Light the scenes with a real studio HDRI instead of RoomEnvironment** (effort S, big impact). Use a CC0 Poly Haven studio HDRI (e.g. a "studio_small" or "photostudio" one) at 1k for the environment only, with `scene.environmentRotation` to place the highlights. Keep the card colour as the background. The ~1–1.5 MB `.hdr` can become a ~0.2–0.4 MB UltraHDR JPEG (`UltraHDRLoader`, in r180 examples). Then run PMREM once per page, as now. Metals (monopoly tokens, crowns, clock brass) and clearcoats get real reflections in place of the grey box room.
2. **Switch tone mapping to `NeutralToneMapping` (Khronos PBR Neutral) for colourful games** (effort XS). ACES desaturates and shifts saturated plastics (connect4 red/yellow, aggravation, poker chips). PBR Neutral was designed for true product colour. Make it a per-miniature option (`opts.toneMapping`) and keep ACES for wood and chess.
3. **Bevel every hard edge** (effort S). `RoundedBoxGeometry` (three add-on) for boards, rails and houses; `LatheGeometry` profiles for chips, checkers men, go stones, discs and pegs. Sharp CG edges are the biggest "fake" tell. A bevel catches a highlight line under the HDRI.
4. **Settle-frame quality pass** (effort M). When a mini goes still, render one frame through `EffectComposer` → `GTAOPass` (soft contact darkening in pits, board seams and under pieces) → `SMAAPass` (or `TAARenderPass` with `accumulate`, which gives free supersampling on a static scene) → `OutputPass`. Animation frames keep the current cheap path. Vendor `EffectComposer`, `RenderPass`, `ShaderPass`, `GTAOPass`, `SMAAPass`, `OutputPass` and their shaders (~60–80 KB) with rewritten imports, and load them lazily from `loadThree()` on desktop. On phones, gate this on still frames only.
5. **Real PBR textures for the non-chess games** (effort M). CC0 wood (Poly Haven veneers are already in use), felt/fabric, leather, marble, slate and paper from Poly Haven and ambientCG at 1k. Store them as KTX2 (ETC1S for colour, UASTC for normal maps) through `toktx` or `gltf-transform`. `KTX2Loader` already handles them and a 1k set is ~100–300 KB. Replace the flat colours in go, othello, mancala, poker, monopoly and aggravation.
6. **Material physics per surface** (effort S). Felt: `sheen: 1, sheenRoughness: 0.8, roughness: 1` plus a fabric normal map. Slate go stones: matte (roughness 0.7, no clearcoat). Clam-shell stones: striations plus clearcoat. Clay chips: roughness 0.55 with an edge-spot texture. Marbles: `transmission: 1, ior: 1.5, thickness` plus an inner swirl mesh, and optional `iridescence` on "cat's eye". Pewter tokens: metalness 1, roughness 0.35. These are all MeshPhysical properties already in r180.
7. **Shadow upgrade** (effort S). Raise the settle frame to a 4096 shadow map on desktop and keep 1024 on phones. Note that `PCFSoftShadowMap` is deprecated from r182 (plain `PCFShadowMap` becomes soft), so a later three upgrade should move to `PCFShadowMap` + `shadow.radius`. `VSMShadowMap` gives softer, wider penumbrae but leaks light on thin pieces, so test it before adopting.
8. **The forge, v1** (effort M–L). Pipeline: text → image (Workers AI FLUX) → image-to-3D (TRELLIS.2, MIT) → GLB cached in R2 → repaired with `manifold-3d` (Apache-2.0, WASM, in-browser) → STL/3MF. A free fallback has an LLM write an `sdfmesh.js` shape list (it runs entirely in the browser). Costs are in §3.
9. **Desktop "photo mode"** (effort M). `three-gpu-pathtracer` (MIT, works from a `WebGLRenderer`) progressively path-traces the current board into a collector-grade still for sharing or the Gumroad storefront. Use it on desktop only, on demand.
10. **WebGPU: wait, and upgrade three first** (effort L, low impact now). `WebGPURenderer` with TSL falls back to WebGL2 automatically, but its post stack (`PostProcessing` was renamed `RenderPipeline` in r183) and APIs are still moving. The plan: upgrade the vendored three to current, keep `WebGLRenderer`, and revisit when we need compute (particles or SSR).

## 1. three.js r180 rendering options we are not using

| Feature | What changes visually | Phone cost | How to add without a bundler |
|---|---|---|---|
| HDRI env (`HDRLoader`, renamed from `RGBELoader` in r180; `UltraHDRLoader`; `EXRLoader`) | real reflections and soft directional ambient | one PMREM at load, ~free after | vendor the loader, `pmrem.fromEquirectangular` |
| `NeutralToneMapping` / `AgXToneMapping` | truer saturated colours (Neutral) or a filmic look without the hue shift (AgX) | free | `renderer.toneMapping = THREE.NeutralToneMapping` |
| GTAO (`GTAOPass`) / SSAO (`SSAOPass`) | grounding in crevices, under rims and in board seams | high per frame; fine on a settle frame | vendor the `postprocessing/` files |
| Bloom (`UnrealBloomPass`, threshold > 1) | glow on highlights, fireworks, LEDs/LCD | medium (mip chain) | use only on emissive minis (fireworks, clock, calculator) |
| SMAA / TAA accumulate / `SSAARenderPass` | clean edges; TAA accumulate turns a still scene into supersampled | SMAA cheap; TAA cheap per frame and converges when idle | vendor the passes |
| Physical extras: sheen, transmission, clearcoat, iridescence, anisotropy | felt, glass marbles, lacquer, brushed metal | transmission adds one extra scene pass | already in core |
| `RoundedBoxGeometry`, `LatheGeometry` | bevels | none | vendor `geometries/RoundedBoxGeometry.js` |
| Baked AO (`aoMap`) | free per-frame AO in pits (mancala, go bowls) | none at runtime | bake in Blender or `gltf-transform`; meshes need uv1 |

Sources: r180 release notes (https://github.com/mrdoob/three.js/releases/tag/r180: "Rename to `HDRLoader`", KTX2 BC4/BC5 and RGB9E5 support); migration guide (https://github.com/mrdoob/three.js/wiki/Migration-Guide: r182 "`PCFSoftShadowMap` with `WebGLRenderer` is now deprecated. Use `PCFShadowMap` which is now soft as well"; r183 "`PostProcessing` has been renamed to `RenderPipeline`").

## 2. Licence-clean assets

- **Poly Haven:** HDRIs, textures and ~500 models, all CC0. The FAQ says "use them for absolutely any purpose", the only limit is not claiming authorship or re-licensing, and attribution is not required. The API needs no key. We already use the chess set and veneers (`models/CREDITS.md`). Sources: https://docs.polyhaven.com/en/faq, https://polyhaven.com/license.
- **ambientCG:** ~2,000+ PBR materials (marble, leather, fabric, paper, metal), CC0, redistributable inside a product. https://ambientcg.com/license (the domain was unreachable from this sandbox; licence confirmed through secondary sources).
- **Kenney:** all CC0, but the board-game packs (Boardgame Pack: 399 pieces, dice, cards, chips) are **2D sprites/vectors**, not 3D. They are useful for card faces and chip labels, not as meshes. https://www.kenney.nl/assets/boardgame-pack. I found no 3D Kenney board-game kit. Its 3D kits ship as GLB.
- **Formats:** `scene3d.js` supports glTF/GLB + meshopt + KTX2 (Basis ETC1S/UASTC) and WebP textures. **Draco is not vendored** and we do not need it, since meshopt covers it. Pipeline: `gltf-transform` (prune, dedup, weld, meshopt, `ktx2`/WebP), as already done for chess. Budget: 1k texture sets ~100–300 KB KTX2, well under Cloudflare Pages' 25 MB per-file limit.

## 3. Generative 3D (forge)

**Workers AI catalog (checked against the Cloudflare docs, updated Aug 2026):** it has **no text-to-3D or image-to-3D model**. It does have image models useful for textures, card art and forge reference images. Pricing (https://developers.cloudflare.com/workers-ai/platform/pricing/) is $0.011 per 1,000 neurons, with 10,000 neurons per day free:

- `@cf/black-forest-labs/flux-1-schnell`: 4.8 neurons per 512² tile + 9.6 per step. A 1024² image at 4 steps is ≈ 58 neurons ≈ **$0.0006**, which is ~170 free images a day.
- `flux-2-klein-4b` / `-9b`: fast generation **and editing**. 9b costs $0.015 for the first megapixel.
- `flux-2-dev` (multi-reference), `lucid-origin` and `phoenix-1.0` (Leonardo, ~$0.006 per tile).
-

**Image-to-3D options:**

| Option | Licence | Cost | Notes |
|---|---|---|---|
| **TRELLIS.2-4B** (Microsoft) | **MIT** (HF card `license: mit`; verify the repo LICENSE) | Replicate `firtoz/trellis` (v1) ≈ **$0.058/run**, ~42 s on an A100; self-host needs a 24 GB GPU | PBR output; best licence fit. https://huggingface.co/microsoft/TRELLIS.2-4B, https://replicate.com/firtoz/trellis |
| Hunyuan3D 2.1 (Tencent) | Tencent community/non-commercial licence, not OSI; historically excludes some regions | self-host 29 GB VRAM | **avoid** for a commercial product |
| Meshy API | commercial SaaS | 20 credits for a full text/image-to-3D; prepaid; failed runs free | https://docs.meshy.ai/api/pricing |
| Tripo API | commercial SaaS | ~$0.01 per credit (2025 launch post; verify); failed runs free | https://developers.tripo3d.com/en/docs/billing |
| In-browser SDF (`sdfmesh.js`) + an LLM writing the shape list | ours | ~free | always watertight, so ideal for printing; stylised |

Suggested forge flow: try SDF first (free and printable). Use FLUX → TRELLIS.2 for things SDF cannot do. Cache by prompt hash in R2, and run `manifold-3d` before STL export.

## 4. Per-game look upgrades (collector grade)

- **All boards:** HDRI, bevels, GTAO on settle, a slight lacquer (`clearcoat 0.4–0.6, clearcoatRoughness 0.15–0.25`) over a real grain texture in place of a flat colour. Vary the grain per board instance (UV offset or rotation) so two boards never look stamped.
- **Chess:** already strong. Add the HDRI, give the felt piece bases `sheen`, and add a thin brass or ebony stringing inlay round the board edge.
- **Checkers:** lathe-profiled men with reeded edges (a normal map or real geometry ridges); kings stack with a visible seam.
- **Go:** a thick kaya block on four *ashi* feet; lines as an inked texture; slate black (matte) vs shell white (striation map + clearcoat); chestnut *go-ke* bowls holding loose stones; the stone "click" settle animation.
- **Othello:** green felt with `sheen` + fabric normal; bevelled two-tone discs with a dark seam between faces; walnut frame with grain.
- **Mancala:** walnut grain texture in place of `#6a4122`; baked AO in the pits; glass beads with full transmission and slight colour variation per bead.
- **Poker:** felt `sheen` with a printed betting line; leather rail (ambientCG leather + clearcoat); clay chips with edge spots and inlays; cards with a linen normal map and a 1 mm bend.
- **Monopoly:** pewter tokens (metalness 1 with the HDRI); a paper/linen texture on the board; houses and hotels with bevels.
- **Connect4 / aggravation:** PBR Neutral tone mapping; ridged discs; glass marbles with an inner swirl and `iridescence 0.3`.
