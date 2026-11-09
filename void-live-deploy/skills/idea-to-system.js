/**
 * idea-to-system skill: the "turn my idea into a system" family (convergence, owner 2026-10-15: "most skills can be combined";
 * lists run 14, 2026-11-09). business-clarify (a vague business idea becomes a plan card: problem, systems, automations, handoff)
 * and system-blueprint (an idea becomes a buildable system plan that builds into Verse) both took "structure this business idea for
 * Verse to own the heavy lifting", so tools/skill-overlap.mjs listed them as a merge candidate. One routing entry at
 * business-clarify's rank (9500); business-clarify is asked first, as it sat first (system-blueprint was at 9800, with nothing between
 * them), so every ask of either skill lands on the same member as before (tools/idea-to-system-family.test.mjs). Each member keeps its
 * file, examples, near misses and tests, and the page still logs skill:business-clarify / skill:system-blueprint (lib/skill-family.js).
 * parts: ['business-clarify', 'system-blueprint']
 */
import { family } from '../lib/skill-family.js';
import businessClarify from './business-clarify.js';
import systemBlueprint from './system-blueprint.js';

export default family('idea-to-system', [businessClarify, systemBlueprint]);
