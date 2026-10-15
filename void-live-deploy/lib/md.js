/**
 * md: the light markdown a model writes (comics, stories, lists) shown as what it means, never as raw asterisks
 * (launch audit, 2026-10-15: "make a comic about a robot cat" showed **Title:** and *Mech-Mew* as typed).
 *   mdBlock(text, esc)   one text block (no code fences) -> safe HTML: # headings, - / * / 1. lists, **bold**, *italic*,
 *                        _italic_, `code`, ~~struck~~; everything else escaped by esc (the page's own escaper)
 * Pure: no DOM. Code fences are handled before this (void.html fixHtml) and never pass through it.
 */
export function mdInline(escaped) {
  return String(escaped)
    .replace(/`([^`\n]+)`/g, '<code>$1</code>')
    .replace(/\*\*(?=\S)([^*\n]*?\S)\*\*/g, '<b>$1</b>')
    .replace(/__(?=\S)([^_\n]*?\S)__/g, '<b>$1</b>')
    .replace(/(^|[^*\w])\*(?=\S)([^*\n]*?\S)\*(?!\*)/g, '$1<i>$2</i>')
    .replace(/(^|[^_\w])_(?=\S)([^_\n]*?\S)_(?![_\w])/g, '$1<i>$2</i>')
    .replace(/~~(?=\S)([^~\n]*?\S)~~/g, '<s>$1</s>')
    .replace(/\*\*/g, ''); // an unpaired ** left by a cut-off answer is noise, not text
}

export function mdBlock(text, esc) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  let out = '', list = null, para = [];
  const flushPara = () => { if (para.length) { out += '<p>' + para.map((l) => mdInline(esc(l))).join('<br>') + '</p>'; para = []; } };
  const closeList = () => { if (list) { out += '</' + list + '>'; list = null; } };
  for (const raw of lines) {
    const l = raw.trim();
    if (!l) { flushPara(); closeList(); continue; }
    let m;
    if ((m = /^(#{1,6})\s+(.*)$/.exec(l))) { flushPara(); closeList(); const n = Math.min(6, m[1].length + 2); out += '<h' + n + '>' + mdInline(esc(m[2].replace(/\s*#+\s*$/, ''))) + '</h' + n + '>'; continue; }
    if (/^(?:[-*_]\s*){3,}$/.test(l)) { flushPara(); closeList(); out += '<hr>'; continue; }
    if ((m = /^[-*+•]\s+(.*)$/.exec(l)) || (m = /^\d+[.)]\s+(.*)$/.exec(l))) {
      const kind = /^\d/.test(l) ? 'ol' : 'ul';
      flushPara(); if (list !== kind) { closeList(); out += '<' + kind + '>'; list = kind; }
      out += '<li>' + mdInline(esc(m[1])) + '</li>'; continue;
    }
    closeList(); para.push(l);
  }
  flushPara(); closeList();
  return out;
}
