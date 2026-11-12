/**
 * tables skill: the pasted-table and list-table family (convergence, lists run 24, 2026-11-12). csv-table (a pasted csv becomes an
 * editable, sortable table; a file dropped on the stage becomes a card) and list-tools (a data table made from a list, with sums,
 * sorting, transposing and check-all) both took "paste csv: item;price ⏎ tea;3 ⏎ cake;5" and "table from csv: a,b ⏎ 1,2"
 * (tools/skill-overlap.mjs listed csv-table~list-tools as a merge candidate): two cards that turn typed rows into a table. One routing
 * entry where csv-table sat (0457), asking csv-table first as before; list-tools sat at 1530, and a routing replay of every example,
 * near miss and bench ask landed each one on the same member as before (tools/tables-family.test.mjs). Each member keeps its file,
 * examples, near misses and tests, and the page still logs skill:csv-table / skill:list-tools (lib/skill-family.js).
 * parts: ['csv-table', 'list-tools']
 */
import { family } from '../lib/skill-family.js';
import csvTable from './csv-table.js';
import listTools from './list-tools.js';

export default family('tables', [csvTable, listTools]);
