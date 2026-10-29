// pdf-tools (skills/pdf-tools.js): which asks open the PDF tools card (lib/tool-sites.js PDF_ASK), which tool each names (pdfToolOf), and the card:
// the named tool's heading and link /pdf/?tool=<tool>, the other ten tools as links, and the plain /pdf/ card when no tool is named.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import sk from '../void-live-deploy/skills/pdf-tools.js';
import { pdfToolOf } from '../void-live-deploy/lib/tool-sites.js';

const doc = { createElement: (tag) => ({ tag, children: [], style: {}, append(...k) { this.children.push(...k); }, replaceChildren(...k) { this.children = k; } }) };
const text = (e) => (typeof e === 'string' ? e : e.children.map(text).join(''));
const all = (e, tag, out = []) => { if (typeof e !== 'string') { if (e.tag === tag) out.push(e); e.children.forEach((c) => all(c, tag, out)); } return out; };
const card = (ask) => { const el = { ownerDocument: doc, children: [], replaceChildren(...k) { this.children = k; } }; assert.equal(sk.run(ask, { showPage: (f) => f(el) }), 'pdf-tools'); return el; };
const m = (t) => sk.match(t.toLowerCase(), t);

test('examples in, near misses out, and the asks the pattern names', () => {
  for (const e of sk.examples) assert.ok(m(e), e);
  for (const n of sk.nearMisses) assert.ok(!m(n), n);
  for (const a of ['merge two pdfs together', 'please split this pdf into pages', 'make pdf smaller', 'png to pdf', 'pdf to png', 'add page numbers to my pdf', 'watermark a pdf', 'crop the pdf', 'delete pages from a pdf', 'pdf editor', 'combine files into one pdf']) assert.ok(m(a), a);
  for (const a of ['merge pdf and word', 'read my pdf', 'summarize this pdf', 'split the difference', 'compress a file', 'pdf to word']) assert.ok(!m(a), a);
});
test('which tool an ask names', () => {
  const want = { 'merge pdf': 'merge', 'png to pdf': 'img2pdf', 'pdf to jpg': 'pdf2img', 'split a pdf': 'split', 'compress pdf': 'compress', 'make pdf smaller': 'compress', 'rotate a pdf': 'rotate', 'reorder pdf pages': 'pages',
    'delete pages from a pdf': 'extract', 'crop the pdf': 'crop', 'watermark a pdf': 'watermark', 'add page numbers to my pdf': 'numbers', 'pdf tools': '' };
  for (const [a, t] of Object.entries(want)) assert.equal(pdfToolOf(a), t, a);
});
test('a named tool: its heading, its link, and the other ten', () => {
  const el = card('merge pdf'), [h2, p] = el.children, links = all(el, 'a');
  assert.equal(text(h2), 'Merge PDFs'); assert.match(text(p), /nothing is uploaded, there is no account/);
  assert.equal(links[0].href, '/pdf/?tool=merge'); assert.equal(text(links[0]), 'Open Merge PDFs →'); assert.equal(links[0].className, 'vc-page');
  assert.equal(links.length, 11); assert.ok(!links.slice(1).some((a) => a.href === '/pdf/?tool=merge'));
  assert.deepEqual(links.slice(1).map((a) => a.href), ['split', 'pages', 'extract', 'rotate', 'compress', 'img2pdf', 'pdf2img', 'numbers', 'watermark', 'crop'].map((t) => '/pdf/?tool=' + t));
  assert.equal(text(all(card('jpg to pdf'), 'h2')[0]), 'Images to PDF');
  assert.equal(all(card('rotate a pdf'), 'a')[0].href, '/pdf/?tool=rotate');
});
test('no tool named: the plain PDF tools card links every tool', () => {
  const el = card('pdf tools'), links = all(el, 'a');
  assert.equal(text(el.children[0]), 'PDF tools'); assert.equal(links[0].href, '/pdf/'); assert.equal(text(links[0]), 'Open the PDF tools →');
  assert.equal(links.length, 12); assert.equal(text(el.children.at(-1)), 'Source: the PDF tools on this site (pdf-lib and pdf.js, both bundled) · as of 2026-10');
});
