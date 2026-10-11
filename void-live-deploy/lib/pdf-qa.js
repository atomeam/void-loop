// pdf-qa — the pure half of the PDF card (frontier #12): a document's text by page and line, and the answer to a question as
// the document's own best-matching lines, each with its page and line. No model and no network: the card reads the PDF in the
// browser (vendored pdf.js) and nothing leaves the device. A question the text does not answer gets "the document does not
// say", never a guess.

const STOP = new Set(('a an the and or but of to in on at for with by from as is are was were be been it its this that these those '
  + 'what which who whom whose when where why how do does did can could would should will shall may might must there here than then '
  + 'i me my we our you your he she they them his her their about into over under any all some no not is there much many').split(' '));

/** words that carry the question: lowercase, letters and digits, no stop words, two letters or more */
export function terms(text) {
  return String(text || '').toLowerCase().match(/[a-z0-9][a-z0-9'’-]*/g)?.map((w) => w.replace(/['’-]+$/, '')).filter((w) => w.length >= 2 && !STOP.has(w)) || [];
}

/** pages of text -> [{ page, line, text }], page and line from 1; blank lines and lone page numbers dropped */
export function linesOf(pages) {
  const out = [];
  (pages || []).forEach((p, i) => {
    let n = 0;
    for (const raw of String(p || '').split(/\r?\n/)) {
      const text = raw.replace(/\s+/g, ' ').trim();
      if (!text || /^\d{1,4}$/.test(text)) continue;
      out.push({ page: i + 1, line: ++n, text });
    }
  });
  return out;
}

const stem = (w) => w.replace(/(?:ing|ed|es|s)$/, '');

/** the best lines for a question: each scored by the question's words it holds (rarer words count more), at most three */
export function ask(question, lines, max = 3) {
  if (!lines || !lines.length) return { lines: [], say: 'This document has no text I can read (it may be a scan).' };
  const q = [...new Set(terms(question).map(stem))];
  if (!q.length) return { lines: [], say: 'Ask about something in the document.' };
  const df = new Map(q.map((w) => [w, 0])), bag = lines.map((l) => new Set(terms(l.text).map(stem)));
  for (const b of bag) for (const w of q) if (b.has(w)) df.set(w, df.get(w) + 1);
  const scored = lines.map((l, i) => {
    let s = 0, hit = 0;
    for (const w of q) if (bag[i].has(w)) { hit++; s += Math.log(1 + lines.length / df.get(w)); }
    return { ...l, score: s, hit };
  }).filter((l) => l.hit && l.hit >= Math.min(q.length, Math.max(1, Math.ceil(q.length / 2))))
    .sort((a, b) => b.score - a.score || a.page - b.page || a.line - b.line).slice(0, max);
  return scored.length ? { lines: scored.map(({ page, line, text }) => ({ page, line, text })), say: '' }
    : { lines: [], say: 'The document does not say (no line holds what you asked about).' };
}
