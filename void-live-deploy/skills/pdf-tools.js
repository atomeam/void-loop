/**
 * pdf-tools skill - "merge pdf", "split a pdf", "compress pdf", "jpg to pdf", "pdf to jpg", "rotate a pdf", "reorder pdf pages", "pdf tools": a card with the tool
 * the ask names, one press from /pdf/ (owner, 2026-10-26: the PDF tools floor of Versus). The tools run on the device (lib/pdf-tools.js, lib/pdf-ui.js); the card
 * only opens the right one. "Ask questions about a pdf" stays with skills/pdf-card.js, which sits earlier in the order and takes it first.
 */
import { PDF_ASK, pdfToolOf as toolOf } from '../lib/tool-sites.js';
const NAMES = { merge: 'Merge PDFs', split: 'Split a PDF', pages: 'Reorder, turn and delete pages', extract: 'Extract or delete pages', rotate: 'Rotate', compress: 'Compress', img2pdf: 'Images to PDF', pdf2img: 'PDF to images', numbers: 'Page numbers', watermark: 'Watermark', crop: 'Crop' };
const href = (tool) => '/pdf/' + (tool ? '?tool=' + tool : '');

function run(text, api) {
  const { showPage } = api, tool = toolOf(text);
  showPage((el) => {
    const d = el.ownerDocument, h = (tag, props = {}, ...kids) => { const e = d.createElement(tag); Object.assign(e, props); e.append(...kids); return e; };
    const go = h('a', { href: href(tool), className: 'vc-page' }, tool ? 'Open ' + NAMES[tool] + ' →' : 'Open the PDF tools →'); go.style.cssText = 'display:inline-block;margin:10px 0;padding:10px 18px;border-radius:999px;background:#6d4aff;color:#fff;font-weight:600;text-decoration:none';
    const more = h('p', {}); more.style.cssText = 'font-size:13px;display:flex;flex-wrap:wrap;gap:6px 12px'; for (const [k, n] of Object.entries(NAMES)) if (k !== tool) { const a = h('a', { href: href(k) }, n); a.style.color = 'inherit'; more.append(a); }
    el.replaceChildren(h('h2', {}, tool ? NAMES[tool] : 'PDF tools'), h('p', {}, 'Your PDFs are changed on this device: nothing is uploaded, there is no account, and the tools work offline after one visit.'), go, more, h('div', { className: 'src' }, 'Source: the PDF tools on this site (pdf-lib and pdf.js, both bundled) · as of 2026-10'));
  });
  return 'pdf-tools';
}

export default {
  name: 'pdf-tools',
  examples: ['merge pdf', 'split a pdf', 'compress pdf', 'jpg to pdf', 'pdf to jpg', 'combine pdf files', 'rotate a pdf', 'reorder pdf pages', 'pdf tools'],
  nearMisses: ['ask questions about a pdf', 'what is a pdf', 'pdf', 'what does this pdf say', 'merge sort', 'merge conflict', 'split the bill'],
  match(lower) { return PDF_ASK.test(String(lower).trim()); },
  run,
};
