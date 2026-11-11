/**
 * build-world skill: the "build it in my world" family (convergence, owner 2026-10-15: "most skills can be combined"; lists run 15,
 * 2026-11-09). rts (Verse's world as a real-time strategy game: summons are resources, villagers gather, the camp builds) and forge
 * (a thing made as a printable model on the stage) both took "build a hut", so tools/skill-overlap.mjs listed them as a merge
 * candidate; the rts camp already spends its stock on what the forge raises. One routing entry at 0112 (rts sat at 0110 after intent, which shares that number and sorts first; 0112 keeps it there); rts is asked
 * first, as it sat first (forge was at 0120 with only stl-check between, and forge takes none of stl-check's asks), so every ask of
 * either skill lands on the same member as before (tools/build-world-family.test.mjs). Each member keeps its file, examples, near
 * misses and tests (forgeOf stays on skills/forge.js), and the page still logs skill:rts / skill:forge (lib/skill-family.js).
 * parts: ['rts', 'forge']
 */
import { family } from '../lib/skill-family.js';
import rts from './rts.js';
import forge from './forge.js';

export default family('build-world', [rts, forge]);
