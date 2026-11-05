/**
 * riddle-gen skill: the made-up-text family (convergence, owner 2026-10-15: "most skills can be combined"; lists run 12, 2026-11-05).
 * riddle (a riddle with the answer on request) and textgen (the name, prompt and idea generators) both took "give me a riddle",
 * so tools/skill-overlap.mjs listed them as a merge candidate. One routing entry at riddle's rank (0295); riddle is asked first, as
 * it sat first (textgen was at 1877), and every ask of every skill lands on the same member as before (checked over every skill's
 * examples and near misses, tools/riddle-gen-family.test.mjs). Each member keeps its file, examples, near misses and tests, and the
 * page still logs skill:riddle / skill:textgen (lib/skill-family.js).
 * parts: ['riddle', 'textgen']
 */
import { family } from '../lib/skill-family.js';
import riddle from './riddle.js';
import textgen from './textgen.js';

export default family('riddle-gen', [riddle, textgen]);
