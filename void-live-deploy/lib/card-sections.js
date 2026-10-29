// A very long answer is not one wall (owner, 2026-10-18: a 16,343-character system log). Past LONG_BODY characters the card's body is cut at its own
// headings, and at blank-line blocks where there are none, into sections the card shows as an accordion: the first open, the rest behind a one-line
// summary. This file only decides the cut; lib/card-frame.js lays it out, and the whole text stays in the page (copy card, save text keep all of it).
export const LONG_BODY = 3000, CHUNK = 1400, MIN_SECTION = 240;
/** @param {{heading?: boolean, text: string}[]} blocks the body's blocks in order (a heading, a paragraph, a list, a code block)
 *  @returns {{title: string, from: number, to: number}[]} sections as inclusive block ranges; [] when the body is short enough to stay whole. Pure. */
export function sectionsOf(blocks, { max = LONG_BODY } = {}) {
  const b = (Array.isArray(blocks) ? blocks : []).map((x) => ({ heading: !!(x && x.heading), text: String((x && x.text) || '').replace(/\s+/g, ' ').trim() }));
  if (b.reduce((n, x) => n + x.text.length, 0) <= max) return [];
  const groups = []; let cur = null;
  b.forEach((x, i) => {
    const size = cur ? cur.len : 0;
    if (!cur || (x.heading && size > 0 && !(cur.onlyHeading)) || (!x.heading && size >= CHUNK)) { cur = { from: i, to: i, len: 0, head: x.heading ? x.text : '', onlyHeading: false }; groups.push(cur); }
    cur.to = i; cur.len += x.text.length; cur.onlyHeading = x.heading && cur.from === i;
    if (!cur.head && x.text) cur.head = x.text;
  });
  const out = [];
  for (const g of groups) {
    const prev = out[out.length - 1];
    if (prev && g.len < MIN_SECTION) { prev.to = g.to; prev.len += g.len; continue; }
    out.push({ title: g.head, from: g.from, to: g.to, len: g.len });
  }
  if (out.length < 2) return [];
  return out.map(({ title, from, to }) => ({ title: title || 'Section', from, to }));
}
