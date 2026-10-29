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
  { path: '/kanban/', card: 'kanban board', lane: 'kanban', name: 'Kanban board', h1: 'Kanban board', features: KB_ALL,
    intro: 'Boards with columns and cards you drag (or move with the keyboard), labels, due dates, checklists, comments, WIP limits, swimlanes, a timer, repeats, archive, search and filter. Export and import JSON, bring a Trello board in, print. Kept on this device, no account, works offline.',
    does: 'Kanban boards on your device: columns, cards, drag and drop or keyboard moves, labels, due dates, checklists, comments, WIP limits, swimlanes, a card timer, repeating cards, archive, search, export and import JSON (Trello too), print. No account, works offline, English and German.',
    asks: ['kanban board', 'free kanban board', 'kanban board online', 'kanban board no sign up', 'kanban board with checklists and due dates', 'trello alternative no account', 'kanban board offline'],
    links: [] },
  { path: '/kanban/simple/', card: 'kanban board', lane: 'kanban: jasperbernaers.com', name: 'Simple kanban board', h1: 'Simple kanban board', features: { boards: 1, filter: 1, due: 1, labels: 1, checklist: 1, archive: 1, csv: 1, share: 1 },
    intro: 'Several boards with columns you name, cards with a title and notes that you drag between columns or move with the keyboard, saved as you go. Share a board as a link, export and import it as JSON. Kept on this device, no account.',
    does: 'Simple kanban boards on your device: several boards, columns, cards with a title and notes, drag and drop or keyboard moves, saved automatically, share link, export and import as JSON. No account, works offline.',
    asks: ['simple kanban board', 'kanban board html', 'kanban board json export', 'kanban board local storage', 'kanban board no account'], links: [] },
  { path: '/kanban/quick/', card: 'kanban board', lane: 'kanban: abacktools.com', name: 'Quick kanban board', h1: 'Quick kanban board', features: { filter: 1, due: 1, labels: 1, checklist: 1, archive: 1, share: 1 },
    intro: 'Add a column, add a card, drag it along. Give a card a due date, labels and a checklist with its n of m progress. Saved in this browser as you go, no sign-up, no limits.',
    does: 'A quick kanban board in the browser: add columns and cards with due dates, labels and checklists, drag them along or move with the keyboard, saved automatically. No sign-up, no limits, works offline.',
    asks: ['quick kanban board', 'kanban board no sign up', 'kanban board free no limits', 'online kanban tool', 'personal kanban board'], links: [] },
  { path: '/kanban/teams/', card: 'kanban board', lane: 'kanban: wekan.fi', name: 'Kanban board with WIP limits and swimlanes', h1: 'Kanban with WIP limits and swimlanes', features: { boards: 1, wip: 1, lanes: 1, labels: 1, due: 1, checklist: 1, comments: 1, assignee: 1, archive: 1, filter: 1, trello: 1, csv: 1, share: 1, templates: 1, colour: 1 },
    intro: 'Several boards, work-in-progress limits that warn when a column is full, swimlanes by label or person, labels, due dates, checklists, comments, assignees, an archive and filters. Bring in a Trello export; share a board as a link. No server, no account.',
    does: 'Kanban boards with WIP limits, swimlanes by label or person, labels, due dates, checklists, comments, assignees, archive, filters, Trello import, export, and a share link. Kept on your device: no server, no account.',
    asks: ['kanban board with wip limits', 'kanban swimlanes', 'open source kanban alternative', 'import trello board', 'kanban board with comments and assignees', 'self hosted kanban alternative no server'], links: [] },
  { path: '/kanban/flow/', card: 'kanban board', lane: 'kanban: kanbanflow.com', name: 'Personal kanban with a timer', h1: 'Personal kanban with a timer', features: { boards: 1, wip: 1, lanes: 1, labels: 1, due: 1, checklist: 1, archive: 1, filter: 1, timer: 1, recur: 1, print: 1, colour: 1, csv: 1, templates: 1 },
    intro: 'A kanban board that keeps the time you spend: start a timer or a Pomodoro on a card, see the total on it, repeat cards daily, weekly or monthly, limit work in progress, group by label, colour cards, print the board. Kept on this device, no account.',
    does: 'A personal kanban board with a card timer and Pomodoro, repeating cards, WIP limits, swimlanes, subtask checklists, colours, filters and print. Kept on your device: no account, works offline.',
    asks: ['kanban board with timer', 'kanban pomodoro', 'personal kanban', 'kanban recurring tasks', 'kanban board with wip limit', 'kanban board print'], links: [] },
]);
import { FLIGHT_SITES } from './flight-sites.js'; // the travel floor's pages (owner, 2026-10-26: "need a flights page")
export { FLIGHT_SITES };
export const SITE_PAGES = Object.freeze([...PDF_SITES, ...KANBAN_SITES, ...FLIGHT_SITES]);

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

// The AI model and assistant floors (owner, 2026-10-26: every tower site gets its own page): /models/ (Hugging Face's floor) and a page under it for each site of
// its lane, /assistant/ (Claude's) the same. tools/ai-pages.mjs writes the pages from these rows (their code is lib/models-page.js and lib/assistant-page.js);
// lib/ai-sites.js names them for the pages and the models Verse can run. Kept here, beside the other floors' rows, because lib/toolkit.js already reads this file.
export const MODEL_SITES = Object.freeze([
  { path: '/models/', page: 'hub', lane: 'ai models', name: 'AI models', h1: 'AI models', card: 'browse ai models',
    does: 'Browse and search open AI models and datasets: filter by task, licence, size and downloads, read a model card, put up to three models side by side, try the ones Verse can run for free, and see what each licence allows. Data read live from a public model hub; no account.',
    asks: ['open source ai models', 'search ai models', 'llm catalogue', 'compare ai models', 'ai model licences explained', 'text generation models', 'ai datasets'],
    links: [['Text generation', '/models/?task=text-generation'], ['Image generation', '/models/?task=text-to-image'], ['Speech to text', '/models/?task=automatic-speech-recognition'], ['Apache 2.0 models', '/models/?licence=apache-2.0'], ['Small models (under 4B)', '/models/?size=s'], ['Datasets', '/models/?kind=datasets']],
    action: { template: '/models/?q={query}', input: 'query', search: true }, related: ['/models/leaderboard/', '/models/local/', '/assistant/'] },
  { path: '/models/leaderboard/', page: 'leaderboard', lane: 'ai models: llm-stats.com', name: 'Model leaderboard', h1: 'Open model leaderboard', card: 'llm leaderboard',
    does: 'A leaderboard of open language models by benchmark (IFEval, BBH, MATH level 5, GPQA, MuSR, MMLU-PRO and the average): sort any column, filter by size and type, search, compare models in a chart, read what each benchmark measures and export CSV.',
    asks: ['llm leaderboard', 'open llm leaderboard', 'llm benchmark scores', 'mmlu pro scores', 'compare llm benchmarks'], related: ['/models/', '/models/arena/', '/models/prices/'] },
  { path: '/models/local/', page: 'local', lane: 'ai models: ollama.com', name: 'Models to run at home', h1: 'Run a model on your computer', card: 'run an llm locally',
    does: 'Find open models packed to run on your own computer (GGUF files): search, filter by what they do, see each file and its size, the one-line command to run it, and which builds fit in your memory. Quantization explained in plain words.',
    asks: ['run llm locally', 'gguf models', 'local ai models', 'which llm fits my ram', 'llm quantization explained', 'offline ai model'], related: ['/models/', '/models/leaderboard/', '/assistant/'] },
  { path: '/models/prices/', page: 'prices', lane: 'ai models: openrouter.ai', name: 'Model prices and context', h1: 'Model prices and context', card: 'ai model prices',
    does: 'Every hosted AI model a public router lists, with its price per million tokens, context length and what it takes in and gives out: filter, sort, find the free ones, compare side by side and work out what a month of use would cost.',
    asks: ['llm api prices', 'ai model pricing', 'cost per million tokens', 'llm context length', 'free llm api models', 'llm cost calculator'], related: ['/models/', '/models/leaderboard/', '/calculator/'] },
  { path: '/models/arena/', page: 'arena', lane: 'ai models: lmarena.ai', name: 'Model arena', h1: 'Model arena', card: 'ai model arena',
    does: 'Put one prompt to two AI models at once without knowing which is which, vote for the better answer, then see their names. Your votes build your own rating table (Elo) by category, kept on your device. Side by side with the models you choose, too.',
    asks: ['ai model arena', 'chatbot arena', 'compare two ai models', 'blind ai test', 'llm side by side', 'ai elo ratings'], related: ['/models/', '/models/leaderboard/', '/assistant/'] },
]);
export const ASSISTANT_SITES = Object.freeze([
  { path: '/assistant/', page: 'hub', lane: 'assistant', name: 'Assistant', h1: 'Assistant', card: 'chat with verse',
    does: 'Chat with Verse\'s assistant on a free open model: conversations kept on your device and searchable, prompt templates, standing instructions, code that runs in your browser, export, share a chat as a link, notes that work offline, and text tools (count, summarize, rewrite, translate). No account.',
    asks: ['ai chat', 'free ai assistant', 'chat with ai no account', 'ai chatbot free', 'ai assistant online', 'ask ai a question', 'ai writing assistant'],
    links: [['Explain simply', '/assistant/?t=explain'], ['Summarize a text', '/assistant/?t=summarize'], ['Write an email', '/assistant/?t=email'], ['Brainstorm ideas', '/assistant/?t=brainstorm'], ['Review my code', '/assistant/?t=code'], ['Plan my week', '/assistant/?t=plan']],
    action: { template: '/assistant/?t={template}', input: 'template' }, related: ['/assistant/workspace/', '/assistant/sources/', '/notes/', '/word-count/'] },
  { path: '/assistant/workspace/', page: 'workspace', lane: 'assistant: typingmind.com', name: 'Chat workspace', h1: 'Chat workspace', card: 'ai chat workspace',
    does: 'An AI chat workspace on your device: folders for chats, pinned chats, search across every message, a prompt library you insert with a slash, saved characters with their own instructions, chat statistics, import and export.',
    asks: ['ai chat workspace', 'organize ai chats', 'prompt library', 'ai chat folders', 'search my ai chats', 'ai characters'], related: ['/assistant/', '/notes/', '/assistant/private/'] },
  { path: '/assistant/voice/', page: 'voice', lane: 'assistant: pi.ai', name: 'Voice chat', h1: 'Talk with Verse', card: 'talk to an ai',
    does: 'A friendly AI to talk with: speak instead of typing, hear every reply read aloud in the voice and speed you choose, a hands-free mode that listens again after each reply, and topics to start from. Speech is turned into text by your browser.',
    asks: ['talk to ai', 'ai voice chat', 'ai to talk to', 'speak with ai', 'ai companion chat', 'voice assistant online'], related: ['/assistant/', '/assistant/quick/', '/translate/'] },
  { path: '/assistant/quick/', page: 'quick', lane: 'assistant: deepai.org', name: 'Quick chat', h1: 'Quick AI chat', card: 'quick ai chat',
    does: 'Ask anything and get an answer at once, no sign-in: pick a chat style (teacher, coder, poet, comedian, philosopher and more), ask for longer answers, copy or share a reply, start again with one press.',
    asks: ['quick ai chat', 'ai chat no sign up', 'ask ai anything', 'ai chat styles', 'free chatbot online', 'chat gpt alternative free'], related: ['/assistant/', '/assistant/voice/', '/assistant/sources/'] },
  { path: '/assistant/private/', page: 'private', lane: 'assistant: duck.ai', name: 'Private chat', h1: 'Private AI chat', card: 'private ai chat',
    does: 'Private AI chat: no account, chats kept only on your device (or not at all), choose the model, and one button that burns every chat. Verse keeps no log of what you write; each message is sent once to be answered.',
    asks: ['private ai chat', 'anonymous ai chat', 'ai chat without account', 'ai chat no history', 'choose ai model chat', 'private chatbot'], related: ['/assistant/', '/assistant/workspace/', '/password/'] },
  { path: '/assistant/sources/', page: 'sources', lane: 'assistant: perplexity.ai', name: 'Answers with sources', h1: 'Answers with sources', card: 'answer with sources',
    does: 'Ask a question and get an answer with numbered sources you can open, the sources listed as cards, follow-up questions to go deeper, and every thread kept on your device to come back to.',
    asks: ['ai answers with sources', 'ai search with citations', 'answer engine', 'ask a question with sources', 'cited ai answers', 'research a question'], related: ['/assistant/', '/news/', '/assistant/quick/'] },
]);
export const AI_SITES = Object.freeze([...MODEL_SITES, ...ASSISTANT_SITES]);
/** the row of a page path, or null. Pure. */
export const aiSiteOf = (path) => AI_SITES.find((r) => r.path === path) || null;

// what the ask bar sends to these pages (lib/toolkit.js routeAsk): narrow phrases only, so an ordinary question still reaches the stage
const AI_ROUTES = [
  [/^(?:browse |search |find |open )?(?:open[- ]source |open |hugging ?face )?(?:ai|ml|llm) models?(?: catalogue| catalog| directory| hub| list)?$|^model hub$/i, '/models/'],
  [/^(?:ai |ml )?datasets?(?: hub| catalogue| catalog)?$/i, '/models/?kind=datasets'],
  [/^(?:open )?llm (?:leaderboard|benchmarks?|rankings?)$|^(?:ai|llm) benchmark scores$/i, '/models/leaderboard/'],
  [/^(?:run (?:an? )?(?:llm|ai|model) (?:locally|at home|offline)|gguf models?|local (?:llms?|ai models?))$/i, '/models/local/'],
  [/^(?:llm|ai model|ai api) (?:prices|pricing|costs?)$|^cost per million tokens$/i, '/models/prices/'],
  [/^(?:ai |llm |chatbot )?(?:model )?arena$|^blind ai test$/i, '/models/arena/'],
  [/^(?:ai chat|chat with (?:an? )?ai|ai assistant|assistant|chatbot)$/i, '/assistant/'],
  [/^(?:talk to (?:an? )?ai|ai voice chat|voice chat with ai)$/i, '/assistant/voice/'],
  [/^(?:private|anonymous) (?:ai )?chat$/i, '/assistant/private/'],
  [/^(?:ai )?answers? with sources$|^answer engine$/i, '/assistant/sources/'],
];
/** the page an ask opens, or null. Pure. */
export function aiAskOf(text) {
  const t = String(text || '').trim().replace(/[?!.]+$/, '').replace(/\s+/g, ' ');
  for (const [re, to] of AI_ROUTES) if (re.test(t)) return to;
  return null;
}
