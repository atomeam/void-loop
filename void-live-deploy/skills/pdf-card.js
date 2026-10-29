/**
 * pdf-card — "ask questions about a pdf", "read this pdf", "chat with a pdf": frontier #12's first piece. Drop a PDF on the card (or
 * choose one) and ask it things; each answer is the document's own lines, with the page and line each came from. The file is read on
 * this device by the bundled pdf.js (/vendor/pdfjs-6.4.299, Apache-2.0) and goes nowhere: no upload, no model, no network beyond
 * this site's own copy of pdf.js, loaded on first use. A question the text does not answer gets "the document does not say".
 * The same card takes a saved web page (.html), a text or markdown file, or pasted text: each heading starts a section, and an
 * answer names its section and line (run 59; a page is never fetched for you, so no site is reached on your behalf).
 * The reading and the answering are in lib/pdf-qa.js (tested in node).
 */
import { linesOf, ask, sectionsOf, blocksOfText, outlineOf } from '../lib/pdf-qa.js';

export const PDFJS = '/vendor/pdfjs-6.4.299/build/pdf.min.js';
export const PDFJS_WORKER = '/vendor/pdfjs-6.4.299/build/pdf.worker.min.js';
export const MAX_BYTES = 50 * 1048576, MAX_PAGES = 500;

export function pdfAsk(text) {
  const t = String(text || '').toLowerCase().replace(/[^\p{L}\p{N}. ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  if (/\b(convert|compress|merge|split|sign|edit|print|rotate|unlock|password|to (word|jpg|jpeg|png|excel|docx?)|stand for|stands for|meaning of|what is a pdf)\b/.test(t)) return false;
  return /\b(ask|question|questions|chat|talk|search|query) (with |to |about |in |a |an |my |the |this |that )*(pdf|pdfs|\.pdf)\b/.test(t)
    || /^(read|open|load|drop|upload|scan|summari[sz]e|look at|check) (me )?(a |an |my |the |this |that )?(pdf|\.pdf)( file| document)?$/.test(t)
    || /^(pdf|\.pdf)( (reader|card|questions|q a|qa))?$/.test(t)
    || /\bwhat does (this|my|the) pdf say\b/.test(t)
    || /^(ask (some )?questions (about|of)|chat with|ask) (a |an |my |the |this |that )?(document|doc|saved (web )?page|web page i saved|text file|markdown file|text i paste|pasted text|this text)( a question)?$/.test(t);
}

let lib = null;
async function pdfjs() {
  if (!lib) lib = import(PDFJS).then((m) => { m.GlobalWorkerOptions.workerSrc = PDFJS_WORKER; return m; }).catch((e) => { lib = null; throw e; });
  return lib;
}

/** one page's text items -> its lines: pdf.js marks line ends (hasEOL); a jump in height starts a new line too */
export function pageText(items) {
  let out = '', y = null;
  for (const it of items || []) {
    if (typeof it.str !== 'string') continue;
    const iy = it.transform ? it.transform[5] : null;
    if (y != null && iy != null && Math.abs(iy - y) > 2 && !out.endsWith('\n')) out += '\n';
    out += it.str + (it.hasEOL ? '\n' : '');
    if (iy != null) y = iy;
  }
  return out;
}

async function readPdf(buf) {
  const m = await pdfjs();
  const task = m.getDocument({ data: new Uint8Array(buf), isEvalSupported: false, disableFontFace: true, useSystemFonts: false, stopAtErrors: false });
  try {
    const doc = await task.promise;
    const n = Math.min(doc.numPages, MAX_PAGES), pages = [];
    for (let i = 1; i <= n; i++) { const p = await doc.getPage(i); pages.push(pageText((await p.getTextContent()).items)); p.cleanup(); }
    return { pages, total: doc.numPages };
  } finally { task.destroy(); } // the worker's copy of the document goes too
}

// a saved web page -> blocks in reading order: headings, paragraphs, list items, cells. DOMParser makes an inert document (no
// script runs, nothing loads); a block that holds another block is left to the inner one, so nothing is read twice.
const BLOCKS = 'h1,h2,h3,h4,h5,h6,p,li,td,th,pre,blockquote,dt,dd,figcaption';
export function blocksOfHtml(html) {
  const doc = new DOMParser().parseFromString(String(html || ''), 'text/html');
  doc.querySelectorAll('script,style,noscript,template,nav,footer,svg').forEach((n) => n.remove());
  const out = [];
  for (const n of doc.body ? doc.body.querySelectorAll(BLOCKS) : []) {
    if (n.querySelector(BLOCKS)) continue;
    const t = (n.textContent || '').replace(/\s+/g, ' ').trim();
    if (t) out.push(/^H[1-6]$/.test(n.tagName) ? { text: t, heading: true, level: Number(n.tagName[1]) } : { text: t, heading: false });
  }
  return out;
}

function run(text, api) {
  const { showPage, say, loopLog, esc } = api;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Ask a document</h2>'
      + '<div class="sub">Drop a <b>PDF</b>, a saved web page (.html) or a text file on this card, choose one, or paste text, then ask it questions. It is read on this device and goes nowhere; each answer is the document\'s own words, with where they are.</div>'
      + '<p><input type="file" accept=".pdf,application/pdf,.html,.htm,text/html,.txt,text/plain,.md,text/markdown" data-pdf-file aria-label="Choose a PDF, a saved web page or a text file"></p>'
      + '<details data-pdf-pastebox><summary>Or paste text</summary><textarea data-pdf-paste rows="5" aria-label="Text to ask about" style="width:100%"></textarea><button type="button" data-pdf-read>Read it</button></details>'
      + '<div data-pdf-status role="status" aria-live="polite" class="sub">Nothing loaded yet.</div>'
      + '<p><button type="button" data-pdf-map hidden>Map it</button></p><div data-pdf-outline></div>'
      + '<form data-pdf-ask hidden style="display:flex;gap:6px;margin:8px 0"><input type="text" data-pdf-q aria-label="Your question about the document" placeholder="Ask about the document" style="flex:1"> <button type="submit">Ask</button></form>'
      + '<div data-pdf-answer aria-live="polite"></div>';
  });
  const $ = (s) => el.querySelector(s), mapBtn = $('[data-pdf-map]'), mapOut = $('[data-pdf-outline]'), status = $('[data-pdf-status]'), form = $('[data-pdf-ask]'), q = $('[data-pdf-q]'), out = $('[data-pdf-answer]');
  const say2 = (msg, alert) => { status.textContent = msg; status.setAttribute('role', alert ? 'alert' : 'status'); };
  let lines = null, name = '', titles = null, outline = []; // titles: a section's heading by its number (null for a PDF, whose answers say the page)
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');

  const ready = (pages, label, unit, total, ts, sections) => {
    lines = linesOf(pages); name = label; titles = ts; outline = sections ? outlineOf(sections) : [];
    mapBtn.hidden = outline.filter((n) => n.title !== 'the opening').length < 2; mapOut.innerHTML = ''; // a map needs two headings
    el.dataset.pdfPages = String(pages.length); el.dataset.pdfLines = String(lines.length);
    if (!lines.length) { say2(label + ': ' + plural(total, unit) + ', but no text I can read' + (unit === 'page' ? ' (it may be a scan).' : '.'), true); return; }
    say2(label + ': ' + plural(total, unit) + ', ' + lines.length + ' lines read' + (total > pages.length ? ' (the first ' + pages.length + ' pages)' : '') + '. Ask it something.');
    form.hidden = false; q.focus();
    say('document loaded');
  };
  const useText = (body, label, html) => { const s = sectionsOf(html ? blocksOfHtml(body) : blocksOfText(body)); ready(s.pages, label, 'section', s.pages.length, s.titles, s); };
  async function readFile(f) {
    const nm = f.name || '', isPdf = /\.pdf$/i.test(nm) || f.type === 'application/pdf', isHtml = /\.html?$/i.test(nm) || f.type === 'text/html', isText = /\.(txt|md|markdown)$/i.test(nm) || /^text\/(plain|markdown)$/.test(f.type);
    if (!isPdf && !isHtml && !isText) { say2('That is not a PDF, a web page or a text file; choose one of those.', true); return; }
    if (f.size > MAX_BYTES) { say2('That file is larger than ' + Math.round(MAX_BYTES / 1048576) + ' MB; try a smaller one.', true); return; }
    say2('Reading ' + nm + '…'); out.innerHTML = ''; form.hidden = true; lines = null; // ellipsis-ok: progress text, not a cut
    if (!isPdf) { try { useText(await f.text(), nm, isHtml); } catch (_) { say2('I could not read that file.', true); } return; }
    let r;
    try { r = await readPdf(await f.arrayBuffer()); } catch (e) { say2((e && e.name === 'PasswordException' ? 'That PDF is locked with a password.' : 'I could not read that file as a PDF.'), true); return; }
    ready(r.pages, nm, 'page', r.total, null);
  }
  $('[data-pdf-file]').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) readFile(f); });
  $('[data-pdf-read]').addEventListener('click', () => {
    const t = $('[data-pdf-paste]').value; out.innerHTML = ''; form.hidden = true; lines = null;
    if (!t.trim()) { say2('Paste some text first.', true); return; }
    useText(t, 'Your text', /^\s*</.test(t) && /<\/?(p|h[1-6]|div|li|body|html)\b/i.test(t));
  });
  el.addEventListener('dragover', (e) => { e.preventDefault(); });
  el.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) readFile(f); });
  const where = (l) => titles ? (titles[l.page - 1] ? 'section “' + esc(titles[l.page - 1]) + '”' : 'the opening') + ', line ' + l.line : 'page ' + l.page + ', line ' + l.line;
  // "map it": the headings as a tree, indented by depth, each opening to its own lines (asked by Verse, 2026-10-11)
  mapBtn.addEventListener('click', () => {
    mapOut.innerHTML = '<ul class="doc-map" data-pdf-outline-list>' + outline.map((n) => { // void-review: ok: titles and lines go through esc(), the rest is numbers
      const own = lines.filter((l) => l.page === n.page);
      return '<li style="--depth:' + n.depth + '"><details data-depth="' + n.depth + '"><summary>' + esc(n.title) + ' <span class="sub">· ' + plural(n.lines, 'line') + '</span></summary>'
        + (own.length ? '<ol>' + own.map((l) => '<li>' + esc(l.text) + '</li>').join('') + '</ol>' : '<p class="sub">just the heading</p>') + '</details></li>';
    }).join('') + '</ul>';
    mapOut.setAttribute('aria-label', 'Map of ' + name);
    say('mapped ' + plural(outline.length, 'section'));
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!lines) return;
    const a = ask(q.value, lines);
    out.innerHTML = a.lines.length // void-review: ok: the document's text, its headings and the file name go through esc(), the rest is numbers and fixed words
      ? '<ol data-pdf-lines>' + a.lines.map((l) => '<li><q>' + esc(l.text) + '</q> <span class="sub">— ' + where(l) + '</span></li>').join('') + '</ol>'
        + '<div class="sub">From ' + esc(name) + '. These are the lines that hold what you asked about; read them in place before you rely on them.</div>'
      : '<p data-pdf-none>' + esc(a.say) + '</p>';
  });
  say(''); loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'pdf-card' });
  return 'pdf-card';
}

export default {
  name: 'pdf-card',
  pdfAsk,
  examples: ['ask questions about a document', 'ask questions about a saved web page', 'ask questions about this text', 'ask questions about a pdf', 'chat with a pdf', 'read this pdf', 'open a pdf', 'ask my pdf a question', 'pdf reader', 'search a pdf', 'what does this pdf say'],
  nearMisses: ['convert pdf to word', 'what does pdf stand for', 'compress a pdf', 'merge two pdfs', 'pdf to jpg', 'how do i sign a pdf'],
  match(lower, text) { return pdfAsk(text || lower); },
  run,
};
