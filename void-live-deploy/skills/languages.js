/**
 * languages skill: the languages family (convergence, owner 2026-10-15: "most skills can be combined"; lists run 2026-10-21). One place in the
 * routing order for answering in Spanish (spanish) and translating anything (translate): both took "answer me in Spanish", so they were one
 * job in two places (tools/skill-overlap.mjs). spanish is asked first, as before (it sat at rank 190, translate at 200), so every ask lands
 * where it did; each member keeps its file, examples and near misses, and the page still logs skill:<member> (lib/skill-family.js).
 * parts: ['spanish', 'translate']
 */
import { family } from '../lib/skill-family.js';
import spanish from './spanish.js';
import translate from './translate.js';

export default family('languages', [spanish, translate]);
