/**
 * ownership skill: the "who owns what" family (convergence, lists run 17, 2026-11-11). heavy-lift-map (the heavy lifting Verse takes on
 * for a process), ownership-map (what Verse owns versus the client for a process) and ownership-pack (the ownership card for a client
 * handoff) answered each other's asks: ownership-pack at 9930 sat after both, so they took its examples first, and tools/skill-overlap.mjs
 * listed heavy-lift-map~ownership-pack and ownership-map~ownership-pack. One routing entry at 9860, where heavy-lift-map sat, asking the
 * members in their old order; a routing replay of every example and near miss landed each one on the same member as before
 * (tools/ownership-family.test.mjs). Each member keeps its file, examples, near misses and tests, and the page still logs
 * skill:heavy-lift-map / skill:ownership-map / skill:ownership-pack (lib/skill-family.js).
 * parts: ['heavy-lift-map', 'ownership-map', 'ownership-pack']
 */
import { family } from '../lib/skill-family.js';
import heavyLiftMap from './heavy-lift-map.js';
import ownershipMap from './ownership-map.js';
import ownershipPack from './ownership-pack.js';

export default family('ownership', [heavyLiftMap, ownershipMap, ownershipPack]);
