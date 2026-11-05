/**
 * where-is skill: the "where is X" family (convergence, owner 2026-10-15: "most skills can be combined"; lists run 13, 2026-11-05).
 * sky-card (where a planet or the moon is in the sky right now) and place (a street map of a place on earth) both took
 * "where is jupiter" and "where is the moon tonight", so tools/skill-overlap.mjs listed them as a merge candidate. One routing
 * entry at sky-card's rank (0215); sky-card is asked first, as it sat first (place was at 0220, with nothing between them), so
 * every ask of either skill lands on the same member as before (tools/where-is-family.test.mjs). Each member keeps its file,
 * examples, near misses and tests, and the page still logs skill:skycard / skill:place (lib/skill-family.js).
 * parts: ['skycard', 'place']
 */
import { family } from '../lib/skill-family.js';
import skyCard from './sky-card.js';
import place from './place.js';

export default family('where-is', [skyCard, place]);
