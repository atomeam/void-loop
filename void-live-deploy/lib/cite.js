// Sources an answer actually used (2026-10-11: "do you love me?" printed three song titles a Wikipedia search found for
// "love me" under an answer that cited none of them). The model is told to cite a numbered source inline like [1] only
// when it answers part of the question; a source it never cited is not where the answer came from, so the card does not
// list it. Kept sources are renumbered in order of first citation, and the answer's markers with them; a marker that names no source is dropped,
// so a card never shows a citation with nothing under it. Pure.
// a citation is a bracketed number not glued to a name (arr[2] is code) and outside code: fenced blocks and `inline`
const MARK = /(?<![\w\]\)])\[(\d{1,2})\]/g;
const CODE = /(```[\s\S]*?(?:```|$)|`[^`\n]*`)/;

// some models cite in fullwidth brackets, "【1】" or "【1†source】" (owner, 2026-10-19: "all of your base are belong to us" showed a bare 【1】 with no source under it)
const WIDE = /\s?【(\d{1,2})(?:†[^】]{0,40})?】/g;
export function keepCited(answer, sources) {
  const text = String(answer || '').replace(WIDE, (all, d) => ' [' + d + ']'), list = Array.isArray(sources) ? sources : [];
  const parts = text.split(CODE); // odd indexes are code, left exactly as written
  const order = [];
  parts.forEach((part, i) => {
    if (i % 2) return;
    for (const m of part.matchAll(MARK)) {
      const n = Number(m[1]);
      if (n >= 1 && n <= list.length && !order.includes(n)) order.push(n);
    }
  });
  const to = new Map(order.map((n, i) => [n, i + 1]));
  return {
    answer: parts.map((part, i) => (i % 2 ? part : part.replace(/\s?(?<![\w\]\)])\[(\d{1,2})\]/g, (all, d) => (to.has(Number(d)) ? all.replace(/\[\d+\]/, '[' + to.get(Number(d)) + ']') : '')).replace(/ +([.,;:!?])/g, '$1'))).join(''),
    sources: order.map((n) => list[n - 1]),
  };
}
