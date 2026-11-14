/**
 * tool-sites: the pages of the PDF and Kanban floors of Versus, one table (owner, 2026-10-26: "even if we are sure we already stomp them we still make a page
 * and beat them", docs/RULES.md). The floor's leader has /pdf/ and /kanban/; each site of its lane has a page of its own, built to have every feature that
 * site has and measured against it by the gate (lib/tower.js LANE_PAGES). tools/tool-site-pages.mjs writes each page from a row; lib/toolkit.js (TOOLS,
 * RELATED) and lib/seo.js (PAGES) read the same rows, so a page is added in one place. Verse's pages name no other site; the table does, in plain text,
 * only here as `lane`. Pure data.
 */
const ALL_PDF = ['merge', 'split', 'pages', 'extract', 'order', 'rotate', 'compress', 'img2pdf', 'pdf2img', 'numbers', 'watermark', 'crop', 'info'];
export const PDF_SITES = Object.freeze([
  { path: '/pdf/', card: 'pdf tools', lane: 'pdf', name: 'PDF tools: merge, split, compress and edit pages', h1: 'PDF tools: merge, split, compress and edit pages', tools: ALL_PDF,
    intro: 'Join, split, tidy, shrink and stamp a PDF on this one page, and the file never leaves this device.',
    does: 'Merge, split, reorder, rotate, delete and extract pages, compress, turn images into a PDF and pages into images, add page numbers and a watermark, crop, and edit the title and author. No task or page limit, no account, nothing uploaded, and the page works offline after one visit.',
    asks: ['merge pdf', 'split pdf', 'compress pdf', 'jpg to pdf', 'reorder pdf pages', 'watermark pdf', 'crop pdf', 'pdf tools offline'],
    links: [['Merge PDFs', '/pdf/?tool=merge'], ['Split a PDF', '/pdf/?tool=split'], ['Organize pages', '/pdf/?tool=pages'], ['Compress a PDF', '/pdf/?tool=compress'], ['Images to PDF', '/pdf/?tool=img2pdf'], ['PDF to images', '/pdf/?tool=pdf2img'], ['Watermark', '/pdf/?tool=watermark'], ['Page numbers', '/pdf/?tool=numbers']] },
]);

const KB_ALL = { boards: 1, wip: 1, lanes: 1, labels: 1, due: 1, checklist: 1, comments: 1, assignee: 1, archive: 1, filter: 1, trello: 1, timer: 1, recur: 1, print: 1, csv: 1, share: 1, colour: 1, templates: 1 };
export const KANBAN_SITES = Object.freeze([
  { path: '/kanban/', card: 'kanban board', lane: 'kanban', name: 'Kanban board: columns, timers, limits and a share link', h1: 'Kanban board: columns, timers, limits and a share link', lead: "A to-do board with columns: move tasks from To do to Doing to Done, for a project, a move, a wedding or a class.", tries: [["Moving house",{"boards":[{"name":"Moving house","columns":[{"name":"To do","wip":0,"cards":[{"title":"Book the van"},{"title":"Change the address"},{"title":"Pack the kitchen"}]},{"name":"Doing","wip":0,"cards":[{"title":"Pack books"}]},{"name":"Done","wip":0,"cards":[{"title":"Give notice"}]}]}]}],["A school project",{"boards":[{"name":"School project","columns":[{"name":"To do","wip":0,"cards":[{"title":"Pick a topic"},{"title":"Find three sources"},{"title":"Make the poster"}]},{"name":"Doing","wip":0,"cards":[{"title":"Write the outline"}]},{"name":"Done","wip":0,"cards":[]}]}]}],["A sprint",{"boards":[{"name":"Sprint","columns":[{"name":"Backlog","wip":0,"cards":[{"title":"Sign-up page"},{"title":"Password reset"}]},{"name":"In progress","wip":0,"cards":[{"title":"Fix the login bug"}]},{"name":"Review","wip":0,"cards":[]},{"name":"Done","wip":0,"cards":[]}]}]}]], features: KB_ALL,
    intro: 'Boards with columns and cards you drag (or move with the keyboard), labels, due dates, checklists, comments, WIP limits, swimlanes, a timer, repeats, archive, search and filter. Export and import JSON, bring a Trello board in, print. Kept on this device, no account, works offline.',
    does: 'Kanban boards on your device: columns, cards, drag and drop or keyboard moves, labels, due dates, checklists, comments, WIP limits, swimlanes, a card timer, repeating cards, archive, search, export and import JSON (Trello too), print. No account, works offline, English and German.',
    asks: ['kanban board', 'free kanban board', 'kanban board online', 'kanban board no sign up', 'kanban board with checklists and due dates', 'trello alternative no account', 'kanban board offline'],
    links: [] },
]);
import { FLIGHT_SITES } from './flight-sites.js'; // the travel floor's pages (owner, 2026-10-26: "need a flights page")
export { FLIGHT_SITES };
import { JOB_SITES } from './job-sites.js'; // the jobs floor's pages (owner, 2026-10-26: "we have to have everything all the sites have")
export { JOB_SITES };
import { SELF_SITES } from './self-sites.js'; // the pages Verse built by itself for the sites it took on (tools/tower-self.mjs)
export { SELF_SITES };
// the calculator floor (Versus job mvoxrtv8, online-calculator.com): /calculator/ is the page built for it, named for what it is: the
// scientific calculator with its history, memory and unit conversion (no BMI or darts calculator is claimed here: those are not on it)
export const CALCULATOR_SITES = Object.freeze([
  { path: '/calculator/', card: 'calculator', lane: 'calculator', name: 'Calculator', h1: 'Scientific calculator', tools: ['scientific', 'history', 'memory', 'unit'],
    intro: 'A scientific calculator that shows its working: the expression as typed, the answer, a history that stays, memory keys and unit conversion. Everything runs on this device: nothing is uploaded, there is no account, and it works offline after one visit.',
    does: 'Scientific calculator with history, memory and unit conversion. Everything runs on your device: nothing is uploaded, no account, works offline.',
    asks: ['online calculator', 'scientific calculator', 'calculator with history', 'unit converter'],
    links: [] },
]);

export const SITE_PAGES = Object.freeze([...PDF_SITES, ...KANBAN_SITES, ...FLIGHT_SITES, ...JOB_SITES, ...SELF_SITES, ...CALCULATOR_SITES]);

// ---- the asks that reach these pages (skills/pdf-tools.js, skills/kanban-board.js and the ask bar in lib/toolkit.js read them) ----
const T = String.raw`(?:pdfs?|\.pdf)`, THE = String.raw`(?:(?:a|an|my|the|this|these|some|two|several|multiple|a few)\s+)*`;
export const PDF_ASK = new RegExp('^(?:please\\s+)?(?:'
  + String.raw`(?:merge|combine|join|unite)\s+` + THE + String.raw`(?:${T}\s+(?:files|documents)|${T}|files\s+into\s+(?:one\s+)?${T})(?:\s+(?:together|into\s+one|into\s+one\s+pdf|online|for\s+free|free))*`
  + String.raw`|(?:split|cut|divide|separate)\s+(?:up\s+)?` + THE + String.raw`${T}(?:\s+(?:file|into\s+pages|by\s+pages))?`
  + String.raw`|(?:compress|shrink|reduce|optimi[sz]e)\s+(?:the\s+size\s+of\s+)?` + THE + String.raw`${T}(?:\s+(?:file|size))?|(?:make\s+)?${T}\s+(?:smaller|compressor|size\s+reducer)|reduce\s+${T}\s+size`
  + String.raw`|(?:jpe?g|png|webp|images?|photos?|pictures?)\s+to\s+${T}|${T}\s+to\s+(?:jpe?g|png|images?|pictures?)`
  + String.raw`|(?:rotate|reorder|rearrange|crop|watermark|organi[sz]e|number|edit\s+the\s+pages\s+of)\s+` + THE + String.raw`${T}(?:\s+pages)?|(?:add\s+page\s+numbers\s+to|delete\s+pages\s+(?:from|of|in)|remove\s+pages\s+from|extract\s+pages\s+from)\s+` + THE + String.raw`${T}`
  + String.raw`|(?:free\s+)?${T}\s+(?:tools?|merger|splitter|editor|toolbox|page\s+editor)|(?:free\s+)?online\s+${T}\s+tools?`
  + ')(?:\\s+please)?$', 'i');
/** which tool of /pdf/ an ask names. Pure. */
export function pdfToolOf(lower) {
  const t = String(lower || '').toLowerCase();
  if (/(?:jpe?g|png|webp|images?|photos?|pictures?)\s+to\s+(?:pdf|\.pdf)/.test(t)) return 'img2pdf';
  if (/(?:pdf|\.pdf)\s+to\s+(?:jpe?g|png|images?|pictures?)/.test(t)) return 'pdf2img';
  if (/\b(?:merge|combine|join|unite)\b/.test(t)) return 'merge'; if (/\b(?:split|cut|divide|separate)\b/.test(t)) return 'split';
  if (/\b(?:compress|shrink|reduce|smaller|compressor)\b/.test(t)) return 'compress'; if (/\brotate\b/.test(t)) return 'rotate';
  if (/\b(?:reorder|rearrange|organi[sz]e|page editor|edit the pages)\b/.test(t)) return 'pages'; if (/\b(?:delete|remove|extract)\s+pages\b/.test(t)) return 'extract';
  if (/\bcrop\b/.test(t)) return 'crop'; if (/\bwatermark\b/.test(t)) return 'watermark'; if (/\bnumbers?\b/.test(t)) return 'numbers';
  return '';
}
export const KANBAN_ASK = /^(?:please\s+)?(?:(?:open|show|make|start|create|new|build|give\s+me|i\s+want|i\s+need)(?:\s+me)?\s+(?:a\s+|an\s+|my\s+|the\s+|another\s+)?)?(?:free\s+|online\s+|simple\s+|personal\s+|new\s+)*kanban(?:\s+(?:board|tool|app|boards))?(?:\s+(?:online|free|please))*$|^(?:a\s+)?trello\s+(?:like|style)\s+board$/i;
