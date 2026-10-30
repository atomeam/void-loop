/**
 * list-starters skill: the list-templates family (convergence, owner 2026-10-15: "most skills can be combined"; lists run 3, 2026-10-21). One place
 * in the routing order for the household lists with their own shape (template-list: packing, chores, bills, guests ...) and the starter lists
 * that come filled in (list-templates: "shopping list template", "meeting agenda template" ...). Both took "packing list template", so they were one
 * job in two places (tools/skill-overlap.mjs listed them as a merge candidate). template-list is asked first, as before (it sat at rank 451,
 * list-templates at 1531), so every ask lands where it did; each member keeps its file, examples and near misses, and the page still logs
 * skill:<member> (lib/skill-family.js).
 * parts: ['template-list', 'list-templates']
 */
import { family } from '../lib/skill-family.js';
import templateList from './template-list.js';
import listTemplates from './list-templates.js';

export default family('list-starters', [templateList, listTemplates]);
