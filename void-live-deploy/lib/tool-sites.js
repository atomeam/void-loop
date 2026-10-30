/**
 * tool-sites: the pages of the PDF and Kanban floors of Versus, one table (owner, 2026-10-26: "even if we are sure we already stomp them we still make a page
 * and beat them", docs/RULES.md). The floor's leader has /pdf/ and /kanban/; each site of its lane has a page of its own, built to have every feature that
 * site has and measured against it by the gate (lib/tower.js LANE_PAGES). tools/tool-site-pages.mjs writes each page from a row; lib/toolkit.js (TOOLS,
 * RELATED) and lib/seo.js (PAGES) read the same rows, so a page is added in one place. Verse's pages name no other site; the table does, in plain text,
 * only here as `lane`. Pure data.
 */
const ALL_PDF = ['merge', 'split', 'pages', 'extract', 'order', 'rotate', 'compress', 'img2pdf', 'pdf2img', 'numbers', 'watermark', 'crop', 'info'];
export const PDF_SITES = Object.freeze([
  { path: '/pdf/', card: 'pdf tools', lane: 'pdf', name: 'PDF tools', h1: 'PDF tools', tools: ALL_PDF,
    intro: 'Merge, split, reorder, rotate and delete pages, compress, turn pictures into a PDF and pages into pictures, number, stamp and crop a PDF. Everything runs on this device: your files are never uploaded, there is no account, and the tools work offline after one visit.',
    does: 'Merge, split, reorder, rotate and delete the pages of PDFs, compress them, turn images into a PDF and pages into images, add page numbers and a watermark, and crop. Runs on your device: nothing is uploaded, no account, works offline.',
    asks: ['merge pdf', 'split pdf', 'compress pdf', 'jpg to pdf', 'pdf to jpg', 'rotate pdf', 'delete pdf pages', 'reorder pdf pages'],
    links: [['Merge PDFs', '/pdf/?tool=merge'], ['Split a PDF', '/pdf/?tool=split'], ['Compress a PDF', '/pdf/?tool=compress'], ['Images to PDF', '/pdf/?tool=img2pdf'], ['PDF to images', '/pdf/?tool=pdf2img'], ['Reorder pages', '/pdf/?tool=pages']] },
  { path: '/pdf/merge/', card: 'merge pdf', lane: 'pdf: codeshack.io', name: 'Merge PDF files', h1: 'Merge PDF files', tools: ['merge'], also: ['split', 'rotate', 'extract', 'order', 'img2pdf', 'compress'],
    intro: 'Choose two or more PDFs, set their order with the arrows, keep only some pages of a file if you like, and save one PDF. Joined on this device: nothing is uploaded and nothing is stored.',
    does: 'Join two or more PDF files into one, in the order you set, keeping only the pages you choose from each. Done on your device: nothing is uploaded, no account.',
    asks: ['merge pdf', 'combine pdf files', 'join pdfs', 'merge pdf without uploading', 'merge pdf online free'], links: [] },
  { path: '/pdf/organize/', card: 'reorder pdf pages', lane: 'pdf: 10015.io', name: 'Organize PDF pages', h1: 'Organize PDF pages', tools: ['pages', 'merge', 'split'], also: ['rotate', 'extract', 'img2pdf', 'compress'],
    intro: 'Open one or several PDFs as pages: drag them into a new order, turn or delete any page, mix pages from different files, then save one PDF. Done on this device; nothing is uploaded.',
    does: 'Open PDFs as page thumbnails, reorder them by dragging or with the keyboard, rotate or delete pages, combine pages from several files and save one PDF. Done on your device: nothing is uploaded.',
    asks: ['reorder pdf pages', 'organize pdf', 'rearrange pdf pages', 'delete pdf pages', 'merge and reorder pdf'], links: [] },
  { path: '/pdf/toolbox/', card: 'free pdf tools', lane: 'pdf: pdfcandy.com', name: 'PDF toolbox', h1: 'PDF toolbox', tools: ['merge', 'split', 'extract', 'order', 'rotate', 'compress', 'img2pdf', 'pdf2img', 'watermark', 'numbers', 'crop', 'info', 'pages'],
    intro: 'A box of PDF tools in one row: merge, split, extract or delete pages, rotate, compress, pictures to PDF and back, watermark, page numbers, crop and document info. No limit on tasks or pages beyond your device\'s memory, no account, and the files never leave this device.',
    does: 'A PDF toolbox: merge, split, extract and delete pages, rotate, compress, images to PDF and PDF to images, watermark, page numbers, crop and document info. No task limits, no account, nothing uploaded.',
    asks: ['pdf tools', 'free pdf tools', 'pdf toolbox online', 'watermark pdf', 'add page numbers to pdf', 'pdf tools without limits'], links: [] },
  { path: '/pdf/editor/', card: 'rotate a pdf', lane: 'pdf: sejda.com', name: 'PDF page editor', h1: 'PDF page editor', tools: ['pages', 'merge', 'split', 'extract', 'order', 'rotate', 'crop', 'numbers', 'watermark', 'compress', 'img2pdf', 'pdf2img', 'info'],
    intro: 'Edit a PDF page by page: see every page, move, turn and delete them, crop margins, number and stamp them, edit the title and author, merge and split. No 200-page or three-tasks-a-day limit, no account, and nothing leaves this device.',
    does: 'Edit PDFs by page: thumbnails you reorder, rotate and delete, crop, page numbers, watermark, document info, merge, split and compress. No page or task limits, no account, nothing uploaded.',
    asks: ['pdf page editor', 'edit pdf pages online', 'crop pdf', 'edit pdf title and author', 'pdf editor no limits', 'rearrange pdf pages'], links: [] },
  { path: '/pdf/suite/', card: 'online pdf tools', lane: 'pdf: tools.pdf24.org', name: 'PDF tools that work offline', h1: 'PDF tools that work offline', tools: ['merge', 'split', 'pages', 'extract', 'order', 'rotate', 'compress', 'img2pdf', 'pdf2img', 'numbers', 'watermark', 'crop', 'info'],
    intro: 'The whole set of PDF tools on your device, with no server in the middle: open this page once and it keeps working with the network cut. Merge, split, move and delete pages, rotate, compress, pictures to PDF and back, number, stamp, crop. No account, no upload.',
    does: 'Every PDF tool in one set that works offline after one visit: merge, split, reorder, rotate, delete, compress, images to PDF and back, page numbers, watermark, crop. Nothing is uploaded, no account.',
    asks: ['pdf tools offline', 'offline pdf merge', 'pdf tools no upload', 'private pdf tools', 'pdf tools no account'], links: [] },
  { path: '/pdf/studio/', card: 'compress pdf', lane: 'pdf: smallpdf.com', name: 'PDF studio', h1: 'PDF studio', tools: ['compress', 'merge', 'split', 'pages', 'rotate', 'extract', 'order', 'img2pdf', 'pdf2img', 'numbers', 'watermark', 'crop', 'info'],
    intro: 'Make a PDF smaller, join it, split it and tidy its pages in a few clicks. Compress with a strength you choose, convert pictures to PDF and PDF pages to pictures, rotate, number, stamp and crop. Every file stays on this device.',
    does: 'Compress, merge, split, rotate and tidy PDFs, convert images to PDF and PDF to images, number pages, add a watermark and crop. Your files stay on your device: no upload, no account, no daily limit.',
    asks: ['pdf compressor', 'reduce pdf size', 'pdf to image', 'image to pdf', 'convert jpg to pdf', 'pdf size reducer'], links: [] },
]);

const KB_ALL = { boards: 1, wip: 1, lanes: 1, labels: 1, due: 1, checklist: 1, comments: 1, assignee: 1, archive: 1, filter: 1, trello: 1, timer: 1, recur: 1, print: 1, csv: 1, share: 1, colour: 1, templates: 1 };
export const KANBAN_SITES = Object.freeze([
  { path: '/kanban/', card: 'kanban board', lane: 'kanban', name: 'Kanban board', h1: 'Plan tasks on a to-do board (kanban)', lead: "A to-do board with columns: move tasks from To do to Doing to Done, for a project, a move, a wedding or a class.", tries: [["Moving house",{"boards":[{"name":"Moving house","columns":[{"name":"To do","wip":0,"cards":[{"title":"Book the van"},{"title":"Change the address"},{"title":"Pack the kitchen"}]},{"name":"Doing","wip":0,"cards":[{"title":"Pack books"}]},{"name":"Done","wip":0,"cards":[{"title":"Give notice"}]}]}]}],["A school project",{"boards":[{"name":"School project","columns":[{"name":"To do","wip":0,"cards":[{"title":"Pick a topic"},{"title":"Find three sources"},{"title":"Make the poster"}]},{"name":"Doing","wip":0,"cards":[{"title":"Write the outline"}]},{"name":"Done","wip":0,"cards":[]}]}]}],["A sprint",{"boards":[{"name":"Sprint","columns":[{"name":"Backlog","wip":0,"cards":[{"title":"Sign-up page"},{"title":"Password reset"}]},{"name":"In progress","wip":0,"cards":[{"title":"Fix the login bug"}]},{"name":"Review","wip":0,"cards":[]},{"name":"Done","wip":0,"cards":[]}]}]}]], features: KB_ALL,
    intro: 'Boards with columns and cards you drag (or move with the keyboard), labels, due dates, checklists, comments, WIP limits, swimlanes, a timer, repeats, archive, search and filter. Export and import JSON, bring a Trello board in, print. Kept on this device, no account, works offline.',
    does: 'Kanban boards on your device: columns, cards, drag and drop or keyboard moves, labels, due dates, checklists, comments, WIP limits, swimlanes, a card timer, repeating cards, archive, search, export and import JSON (Trello too), print. No account, works offline, English and German.',
    asks: ['kanban board', 'free kanban board', 'kanban board online', 'kanban board no sign up', 'kanban board with checklists and due dates', 'trello alternative no account', 'kanban board offline'],
    links: [] },
  { path: '/kanban/simple/', card: 'kanban board', lane: 'kanban: jasperbernaers.com', name: 'Simple kanban board', h1: 'Plan tasks on a simple to-do board (kanban)', lead: "A plain three-column to-do board: drag tasks from To do to Done.", tries: [["Chores",{"boards":[{"name":"Chores","columns":[{"name":"To do","wip":0,"cards":[{"title":"Laundry"},{"title":"Vacuum"}]},{"name":"Doing","wip":0,"cards":[{"title":"Dishes"}]},{"name":"Done","wip":0,"cards":[]}]}]}],["A trip",{"boards":[{"name":"Trip","columns":[{"name":"To do","wip":0,"cards":[{"title":"Book the train"},{"title":"Pack"},{"title":"Print the tickets"}]},{"name":"Doing","wip":0,"cards":[{"title":"Find a hotel"}]},{"name":"Done","wip":0,"cards":[]}]}]}],["A party",{"boards":[{"name":"Party","columns":[{"name":"To do","wip":0,"cards":[{"title":"Send invites"},{"title":"Buy snacks"},{"title":"Make a playlist"}]},{"name":"Doing","wip":0,"cards":[]},{"name":"Done","wip":0,"cards":[{"title":"Pick a date"}]}]}]}]], features: { boards: 1, filter: 1, due: 1, labels: 1, checklist: 1, archive: 1, csv: 1, share: 1 },
    intro: 'Several boards with columns you name, cards with a title and notes that you drag between columns or move with the keyboard, saved as you go. Share a board as a link, export and import it as JSON. Kept on this device, no account.',
    does: 'Simple kanban boards on your device: several boards, columns, cards with a title and notes, drag and drop or keyboard moves, saved automatically, share link, export and import as JSON. No account, works offline.',
    asks: ['simple kanban board', 'kanban board html', 'kanban board json export', 'kanban board local storage', 'kanban board no account'], links: [] },
  { path: '/kanban/quick/', card: 'kanban board', lane: 'kanban: abacktools.com', name: 'Quick kanban board', h1: 'Plan today on a quick to-do board (kanban)', lead: "A quick to-do board in your browser: three columns, no account, for today or this week.", tries: [["Chores",{"boards":[{"name":"Chores","columns":[{"name":"To do","wip":0,"cards":[{"title":"Laundry"},{"title":"Take the bins out"},{"title":"Water the plants"}]},{"name":"Doing","wip":0,"cards":[{"title":"Dishes"}]},{"name":"Done","wip":0,"cards":[]}]}]}],["Homework",{"boards":[{"name":"Homework","columns":[{"name":"To do","wip":0,"cards":[{"title":"Maths sheet"},{"title":"Read chapter 4"}]},{"name":"Doing","wip":0,"cards":[{"title":"History essay"}]},{"name":"Done","wip":0,"cards":[]}]}]}],["Errands",{"boards":[{"name":"Errands","columns":[{"name":"To do","wip":0,"cards":[{"title":"Post office"},{"title":"Pharmacy"},{"title":"Groceries"}]},{"name":"Doing","wip":0,"cards":[]},{"name":"Done","wip":0,"cards":[]}]}]}]], features: { filter: 1, due: 1, labels: 1, checklist: 1, archive: 1, share: 1 },
    intro: 'Add a column, add a card, drag it along. Give a card a due date, labels and a checklist with its n of m progress. Saved in this browser as you go, no sign-up, no limits.',
    does: 'A quick kanban board in the browser: add columns and cards with due dates, labels and checklists, drag them along or move with the keyboard, saved automatically. No sign-up, no limits, works offline.',
    asks: ['quick kanban board', 'kanban board no sign up', 'kanban board free no limits', 'online kanban tool', 'personal kanban board'], links: [] },
  { path: '/kanban/teams/', card: 'kanban board', lane: 'kanban: wekan.fi', name: 'Kanban board with WIP limits and swimlanes', h1: 'Plan team work on a shared to-do board (kanban with WIP limits)', lead: "A to-do board a team passes around by link, with a cap on how many tasks are in progress at once.", tries: [["A volunteer group",{"boards":[{"name":"Volunteer group","columns":[{"name":"To do","wip":0,"cards":[{"title":"Find a venue"},{"title":"Print flyers"}]},{"name":"Doing (max 3)","wip":3,"cards":[{"title":"Ring the sponsors"}]},{"name":"Done","wip":0,"cards":[]}]}]}],["A newsroom",{"boards":[{"name":"Newsroom","columns":[{"name":"Ideas","wip":0,"cards":[{"title":"Council budget"},{"title":"Local team wins"}]},{"name":"Writing (max 3)","wip":3,"cards":[{"title":"School closures"}]},{"name":"Editing","wip":0,"cards":[]},{"name":"Published","wip":0,"cards":[]}]}]}],["A dev team",{"boards":[{"name":"Dev team","columns":[{"name":"Backlog","wip":0,"cards":[{"title":"Sign-up page"}]},{"name":"In progress (max 3)","wip":3,"cards":[{"title":"Fix the login bug"}]},{"name":"Review","wip":0,"cards":[]},{"name":"Done","wip":0,"cards":[]}]}]}]], features: { boards: 1, wip: 1, lanes: 1, labels: 1, due: 1, checklist: 1, comments: 1, assignee: 1, archive: 1, filter: 1, trello: 1, csv: 1, share: 1, templates: 1, colour: 1 },
    intro: 'Several boards, work-in-progress limits that warn when a column is full, swimlanes by label or person, labels, due dates, checklists, comments, assignees, an archive and filters. Bring in a Trello export; share a board as a link. No server, no account.',
    does: 'Kanban boards with WIP limits, swimlanes by label or person, labels, due dates, checklists, comments, assignees, archive, filters, Trello import, export, and a share link. Kept on your device: no server, no account.',
    asks: ['kanban board with wip limits', 'kanban swimlanes', 'open source kanban alternative', 'import trello board', 'kanban board with comments and assignees', 'self hosted kanban alternative no server'], links: [] },
  { path: '/kanban/flow/', card: 'kanban board', lane: 'kanban: kanbanflow.com', name: 'Personal kanban with a timer', h1: 'Plan and time tasks on a to-do board (personal kanban)', lead: "A to-do board that shows where work piles up, for a shop floor, a support queue or a software team.", tries: [["Orders",{"boards":[{"name":"Orders","columns":[{"name":"New","wip":0,"cards":[{"title":"Order 1041"},{"title":"Order 1042"}]},{"name":"Packing","wip":0,"cards":[{"title":"Order 1039"}]},{"name":"Shipped","wip":0,"cards":[{"title":"Order 1037"}]}]}]}],["Help requests",{"boards":[{"name":"Help requests","columns":[{"name":"Waiting","wip":0,"cards":[{"title":"Printer offline"},{"title":"Password locked"}]},{"name":"Working on it","wip":0,"cards":[{"title":"Laptop slow"}]},{"name":"Solved","wip":0,"cards":[]}]}]}],["A sprint",{"boards":[{"name":"Sprint","columns":[{"name":"Backlog","wip":0,"cards":[{"title":"Search page"}]},{"name":"In progress","wip":0,"cards":[{"title":"Fix the login bug"}]},{"name":"Review","wip":0,"cards":[]},{"name":"Done","wip":0,"cards":[]}]}]}]], features: { boards: 1, wip: 1, lanes: 1, labels: 1, due: 1, checklist: 1, archive: 1, filter: 1, timer: 1, recur: 1, print: 1, colour: 1, csv: 1, templates: 1 },
    intro: 'A kanban board that keeps the time you spend: start a timer or a Pomodoro on a card, see the total on it, repeat cards daily, weekly or monthly, limit work in progress, group by label, colour cards, print the board. Kept on this device, no account.',
    does: 'A personal kanban board with a card timer and Pomodoro, repeating cards, WIP limits, swimlanes, subtask checklists, colours, filters and print. Kept on your device: no account, works offline.',
    asks: ['kanban board with timer', 'kanban pomodoro', 'personal kanban', 'kanban recurring tasks', 'kanban board with wip limit', 'kanban board print'], links: [] },
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
  { path: '/calculator/', card: 'calculators', lane: 'calculator', name: 'Calculator', h1: 'Scientific calculator', tools: ['scientific', 'history', 'memory', 'unit'],
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
