/**
 * cinema skill: the films and movies family (convergence, lists run 21, 2026-11-12). films (Verse's own films on /films/, their metadata
 * and uploads) and movie (a movie to watch, a movie card, where to stream one) both answered "where do I watch the films"
 * (tools/skill-overlap.mjs listed films~movie as a merge candidate, named in the allowance while the merge waited): two cards for
 * watching. One routing entry at 1100, where films sat, asking films first as before; movie sat at 1400, and a routing replay of every
 * example, near miss and bench ask landed each one on the same member as before (tools/cinema-family.test.mjs). Each member keeps its
 * file, examples, near misses and tests, and the page still logs skill:films / skill:movie (lib/skill-family.js).
 * parts: ['films', 'movie']
 */
import { family } from '../lib/skill-family.js';
import films from './films.js';
import movie from './movie.js';

export default family('cinema', [films, movie]);
