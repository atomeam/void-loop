# F-207 Spoken Sculpture: local program-synthesis mind that writes its own shader (2026-10-21)

Ledger ID: **F-207** (frontier series). Draft: `drafts/F207-spoken-sdf-program-synthesis/` (open `index.html` over http so the Worker can load; it falls back to the main thread otherwise).

## Concept (novel combination)
Voice (Web Speech API, typed fallback) → a local symbolic intent parser → a Worker running **beam-search program synthesis** over a tiny signed-distance-field shape language (sphere, box, ring, pillar; union, smooth union, subtract, intersect; translate, twist, polar repeat) → the winning program is **compiled to GLSL and hot-swapped into a WebGL2 raymarcher** → the search's own candidate list hangs as a **physical DOM mobile** whose bar tilts by score-weighted torque, whose strings shorten for stronger ideas, and whose cards get jolted when a new idea replaces an old one. Click a card to overrule the mind; Seal stores the program in localStorage and seeds every future search (local concept memory).

## Why it is not a variation of earlier frontier work
F-020 to F-206 evolve *parameters* of fixed substrates (lattices, NCAs, particle fields, MLP/RNN/Transformer controllers, reaction-diffusion) or morph chrome from field statistics. No prior entry synthesizes *programs*, and none has the agent author the renderer itself: here the mind's output is executable shader source, judged by a CPU voxel probe of the same program. No prior draft uses SDF raymarching or speech input (ledger grep for sdf/raymarch: 0 hits).

## Architecture
- `core.js` (pure, shared by page, Worker and node): DSL, CPU interpreter, GLSL compiler, intent lexicon, 18³ voxel feature probe (tall, mass, hollow, parts via 6-neighbour flood fill, detail via surface/volume ratio, twist), mutation operators, beam search (16 beam, 32 children per step, dedupe by program).
- `worker.js`: runs ~120 ms of search per message; posts the top 5.
- `index.html`: WebGL2 raymarcher (110 steps, AO, rim light, starfield void, no grid), shader rebuild throttled to 350 ms and only on strict score improvement; a failed compile keeps the previous program. Adaptive render scale holds ~40–60 fps. Intent meters show target vs. achieved features.

## Measured
- `node test.cjs`: interpreter, compiler, intent, feature and search checks pass; search for "a crown of many tiny pieces, hollow" went from fit -0.386 to -0.039 in 60 generations (~1.2 s on the box).
- 35 synthesized shaders (7 prompts × top 5 after 25 generations) all pass `glslangValidator -S frag` with the page's real header and tail.
- Not yet measured in a real browser on Adam's devices (fps, Worker over file://, speech permission).

## Failure modes and lessons
- The lexicon is a keyword map, not a language model; unknown words leave defaults (the UI says so).
- Features are coarse at 18³; thin parts under ~0.22 units can vanish from the probe and get under-rewarded.
- Twist distance is Lipschitz-unsafe; scaled by 0.7, which can still overstep on strong twists (minor artifacts).
- Worker from file:// is blocked in Chrome; main-thread fallback is slower but works.

## Building blocks for the next experiment
Program-as-output loop (synthesize → compile → render → probe) can drive any shader stage: swap the keyword lexicon for a local WebLLM/transformers.js model that emits DSL directly, add WebGPU compute probing for 64³ features, export the sealed SDF to an STL/3MF mesh via marching cubes for Void's printable pieces, or let two minds bid programs against each other on the mobile.
