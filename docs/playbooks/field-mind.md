# Playbook: a field mind on the shared kit

What starts it: an idea for a small simulated field with a tiny local mind (the owner's list F-020..F-035, "all of Grok's ideas are to be added to Void", 2026-10-17), or a miniature or figure that should think a little for itself ("the tiny minds can go into the tiny figures", owner, 2026-10-17).

The pieces already there: `lib/field-kit.js` (pure: seeded `rng`, grids, particles, `entropy`, `occupancyEntropy`, `morphOf`/`morphCss`, `mutate`/`evolveStep`, `audioMap`, `seal`), `lib/field-stage.js` (the Canvas2D card: `mountField`, `fieldSkill`), `lib/field-worker.js` (`spawnMind`: a Worker that imports your pure module, the page when Workers are blocked).

Steps:
1. Brief first: who it is for, who does it best and how (look it up), what the first version does, what it will not build.
2. Write the law as pure functions in `lib/field-<name>.js`: `create(seed)`, `step(s, dt, input)`, `metrics(s)` giving `{ entropy, activity, consensus, cx, cy }` each 0..1, and, if it thinks slowly, one synchronous exported function the Worker can call by name (`evolveFlow`, `evolveSwarm`). No DOM, no clock, no `Math.random`. Cap particle or agent counts (700 and 240 so far).
3. `node tools/new-skill.mjs <name> --ask "..." --near "..."`, then rewrite the skill as `export default fieldSkill({ name, words, examples, nearMisses, idea, say })`. Own controls and background thinking go in `idea.mount(ctx)`, which returns `{ dispose() }`.
4. Unit test the law with numbers (`tools/field-<name>.test.mjs`, `node --test`): seeded determinism, bounds, a fitness that rewards what it says, a step that never gets worse.
5. One browser section in `tools/test_void.mjs`, run alone: `node tools/heavy.mjs node tools/test_void.mjs --only "<title>"`. Test the card with Worker and Web Audio deleted by an init script (`fresh("delete window.Worker; delete window.AudioContext;")`): the mind must fall back to `main` and still run.
6. A `docs/MAP.md` line, then `node tools/finish.mjs grow ...` (say "asked by Owner").

Mistakes already made:
- `th.state` is saved by the stage with `JSON.stringify`; typed arrays in it would be written out each save. `mountField` now defines it non-enumerable; keep handles (Workers, closures) in the state or the hook, never on `th` itself.
- A Blob module Worker needs an absolute URL for its import (`spawnMind` resolves it); the CSP allows `worker-src blob:`.
- Under `prefers-reduced-motion` the card runs no loop, so a hook must not rely on the loop to notice the card has left: check `el.isConnected` on its own timer, and do not evolve while `still()`.
- A seal stores facts only (params and metrics), never the pointer's path.
