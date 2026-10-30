/**
 * stage-out skill: the stage-output family (convergence, owner 2026-10-15: "most skills can be combined"; lists run 4, 2026-10-21). One place
 * in the routing order for the ways the stage leaves the screen: the one-page sheet to print (stage-print) and the files and views made from it
 * (stage-export: JSON in and out, email-ready text, the print view and its paper size, export history). Both took "print the stage", so they were
 * one job in two places (tools/skill-overlap.mjs listed them as a merge candidate). stage-print is asked first, as before (it sat at rank 1490,
 * stage-export at 1665), so every ask lands where it did; each member keeps its file, examples and near misses, and the page still logs
 * skill:<member> (lib/skill-family.js).
 * parts: ['stage-print', 'stage-export']
 */
import { family } from '../lib/skill-family.js';
import stagePrint from './stage-print.js';
import stageExport from './stage-export.js';

export default family('stage-out', [stagePrint, stageExport]);
