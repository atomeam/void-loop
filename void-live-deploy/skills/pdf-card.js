/**
 * pdf-card — "ask questions about a pdf", "read this pdf", "chat with a pdf": frontier #12's first piece. Drop a PDF on the card (or
 * choose one) and ask it things; each answer is the document's own lines, with the page and line each came from. The file is read on
 * this device by the bundled pdf.js (/vendor/pdfjs-6.4.299, Apache-2.0) and goes nowhere: no upload, no model, no network beyond
 * this site's own copy of pdf.js, loaded on first use. A question the text does not answer gets "the document does not say".
 * The reading and the answering are in lib/pdf-qa.js (tested in node).
 */
import { linesOf, ask } from '../lib/pdf-qa.js';

export const PDFJS = '/vendor/pdfjs-6.4.299/build/pdf.min.js';
export const PDFJS_WORKER = '/vendor/pdfjs-6.4.299/build/pdf.worker.min.js';
export const MAX_BYTES = 50 * 1048576, MAX_PAGES = 500;

export function pdfAsk(text) {
  const t = String(text || '').toLowerCase().replace(/[^\p{L}\p{N}. ]+/gu, ' ').replace(/\s+/g, ' ').trim();
  if (/\b(convert|compress|merge|split|sign|edit|print|rotate|unlock|password|to (word|jpg|jpeg|png|excel|docx?)|stand for|stands for|meaning of|what is a pdf)\b/.test(t)) return false;
  return /\b(ask|question|questions|chat|talk|search|query) (with |to |about |in |a |an |my |the |this |that )*(pdf|pdfs|\.pdf)\b/.test(t)
    || /^(read|open|load|drop|upload|scan|summari[sz]e|look at|check) (me )?(a |an |my |the |this |that )?(pdf|\.pdf)( file| document)?$/.test(t)
    || /^(pdf|\.pdf)( (reader|card|questions|q a|qa))?$/.test(t)
    || /\bwhat does (this|my|the) pdf say\b/.test(t);
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

function run(text, api) {
  const { showPage, say, loopLog, esc } = api;
  const el = showPage((p) => {
    p.innerHTML = '<h2>Ask a PDF</h2>'
      + '<div class="sub">Drop a <b>PDF</b> on this card, or choose one, then ask it questions. It is read on this device and goes nowhere; each answer is the document\'s own words, with the page and line.</div>'
      + '<p><input type="file" accept=".pdf,application/pdf" data-pdf-file aria-label="Choose a PDF"></p>'
      + '<div data-pdf-status role="status" aria-live="polite" class="sub">Nothing loaded yet.</div>'
      + '<form data-pdf-ask hidden style="display:flex;gap:6px;margin:8px 0"><input type="text" data-pdf-q aria-label="Your question about the document" placeholder="Ask about the document" style="flex:1"> <button type="submit">Ask</button></form>'
      + '<div data-pdf-answer aria-live="polite"></div>';
  });
  const $ = (s) => el.querySelector(s), status = $('[data-pdf-status]'), form = $('[data-pdf-ask]'), q = $('[data-pdf-q]'), out = $('[data-pdf-answer]');
  const say2 = (msg, alert) => { status.textContent = msg; status.setAttribute('role', alert ? 'alert' : 'status'); };
  let lines = null, name = '';

  async function readFile(f) {
    if (!/\.pdf$/i.test(f.name || '') && f.type !== 'application/pdf') { say2('That is not a PDF; choose a .pdf file.', true); return; }
    if (f.size > MAX_BYTES) { say2('That file is larger than ' + Math.round(MAX_BYTES / 1048576) + ' MB; try a smaller one.', true); return; }
    say2('Reading ' + f.name + '…'); out.innerHTML = ''; form.hidden = true; lines = null;
    let r;
    try { r = await readPdf(await f.arrayBuffer()); } catch (e) { say2((e && e.name === 'PasswordException' ? 'That PDF is locked with a password.' : 'I could not read that file as a PDF.'), true); return; }
    lines = linesOf(r.pages); name = f.name;
    el.dataset.pdfPages = String(r.pages.length); el.dataset.pdfLines = String(lines.length);
    if (!lines.length) { say2(f.name + ': ' + r.total + ' page' + (r.total === 1 ? '' : 's') + ', but no text I can read (it may be a scan).', true); return; }
    say2(f.name + ': ' + r.total + ' page' + (r.total === 1 ? '' : 's') + ', ' + lines.length + ' lines read' + (r.total > r.pages.length ? ' (the first ' + r.pages.length + ' pages)' : '') + '. Ask it something.');
    form.hidden = false; q.focus();
    say('pdf loaded');
  }
  $('[data-pdf-file]').addEventListener('change', (e) => { const f = e.target.files && e.target.files[0]; if (f) readFile(f); });
  el.addEventListener('dragover', (e) => { e.preventDefault(); });
  el.addEventListener('drop', (e) => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f) readFile(f); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!lines) return;
    const a = ask(q.value, lines);
    out.innerHTML = a.lines.length // void-review: ok: the document's text and the file name go through esc(), the rest is numbers and fixed words
      ? '<ol data-pdf-lines>' + a.lines.map((l) => '<li><q>' + esc(l.text) + '</q> <span class="sub">— page ' + l.page + ', line ' + l.line + '</span></li>').join('') + '</ol>'
        + '<div class="sub">From ' + esc(name) + '. These are the lines that hold what you asked about; read them in place before you rely on them.</div>'
      : '<p data-pdf-none>' + esc(a.say) + '</p>';
  });
  say(''); loopLog({ domain: 'void.page', ask: text, score: 'pass', note: 'pdf-card' });
  return 'pdf-card';
}

export default {
  name: 'pdf-card',
  pdfAsk,
  examples: ['ask questions about a pdf', 'chat with a pdf', 'read this pdf', 'open a pdf', 'ask my pdf a question', 'pdf reader', 'search a pdf', 'what does this pdf say'],
  nearMisses: ['convert pdf to word', 'what does pdf stand for', 'compress a pdf', 'merge two pdfs', 'pdf to jpg', 'how do i sign a pdf'],
  match(lower, text) { return pdfAsk(text || lower); },
  run,
};
