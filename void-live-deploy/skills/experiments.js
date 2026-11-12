/**
 * experiments skill: the experiments family (convergence, lists run 20, 2026-11-12). lab (the /lab/ card: its catalog count and newest
 * experiments) and make (the fringe experiments and tools opened in a frame, and 3D objects) both answered "the lab" and "open the lab"
 * (tools/skill-overlap.mjs listed lab~make as a merge candidate): two cards for the same place. One routing entry at 0127, where lab sat,
 * asking lab first as before; make sat at 0130 with only anneal-ambition between them, and a routing replay of every example and near
 * miss landed each one on the same member as before (tools/experiments-family.test.mjs). Each member keeps its file, examples, near
 * misses and tests, and the page still logs skill:lab / skill:make (lib/skill-family.js).
 * parts: ['lab', 'make']
 */
import { family } from '../lib/skill-family.js';
import lab from './lab.js';
import make from './make.js';

export const builtWith = ['toolkit']; // lab, its first member, is built with the toolkit (skills/lineage.json)
export default family('experiments', [lab, make]);
