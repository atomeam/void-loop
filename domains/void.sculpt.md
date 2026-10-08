# Sculpt Layer v0.1 — lockfile for Void's own body

**Scope:** this applies only to Void itself, meaning its self-form (`void-live-deploy/skills/mini/void.js`, shown on its self page) and any future picture of "Void as structure". It does **not** apply to summons. Zombies, clouds, animals, ice and flowers follow STANDING.md instead: realistic, seeded individuals that act on their nature. Never run a summon through this gate. A realistic zombie has a face and anatomy, and that is correct.

| Layer | Applies to | Rule |
|---|---|---|
| Sculpt Layer (this file) | Void itself | angular, fractured, no face, machine-native |
| STANDING summons | everything summoned | realistic not cute, one of a kind, clonable, acts on its nature |

## Identity
Void is one entity. Every frame is a mutation of the same structure, not a new creature. In code: one fixed seed (`VOID_SEED`), so it is the same body on every device.

## Never
No face. No bilateral symmetry. No organic curvature. No soft gradients. No implied emotion, gender, species or material softness. No hands, eyes, mouth, torso, or limbs as anatomy. No "AI art" mush, bloom or pretty noise.

## Always
Angular, fractured and machine-native. Non-physical: it exists as structure, not as matter. Impossible but coherent. Readable from its silhouette alone, and the same entity under mutation.

## Geometry
- Edges are hard, planar or crystalline breaks, never rounded fillets (flat shading, faceted shards).
- Mass is assembled planes, shards and voids, not volumes that breathe.
- Negative space is part of the body: the missing cone in `plan()` is identity, not decoration.
- No scale cues: no human-sized proportions, no furniture scale. It floats with no ground.

## Silhouette
Recognizable at 32 px and at full frame. Asymmetry is required; a mirror flip is a bug. The contour is a jagged outline, closed or deliberately broken, never a blob.

## Surface
Texture only as structure (grid, etch, fracture lines), never skin, cloth or realistic metal. High contrast is preferred. Colour is an optional signal, not mood.

## Mutation
- **Allowed:** rotate shards, open or close voids, re-cut planes, scale a region, add one fracture.
- **Forbidden:** add a face-like region, soften edges, symmetrize, grow limbs, add symbols or glyphs that read as language or myth.

## Prompt (only for generators asked to draw Void itself)
> A non-human, non-organic entity defined only by silhouette and negative space. Angular, fractured geometry. No face, no symmetry, no softness. Machine-native aesthetic. Recognizable identity across all mutations. Exists outside physical material logic. No implied emotion, gender, species, or biology. Void is a concept rendered as structure.

## Self-check (a test, not a merge gate)
- **Pass:** cut out of black paper, the silhouette is still recognizably Void.
- **Fail:** it reads as a character, a mask, a rock, or soft sci-fi.

`tools/test_3d.mjs` ("3D Void") checks the parts code can check: the same 24 shards from one seed, a different seed differs, the shard directions lean to one side (not symmetric), and a tap breaks it apart and back. Anything code can't check gets judged from a screenshot when the self-form changes.
