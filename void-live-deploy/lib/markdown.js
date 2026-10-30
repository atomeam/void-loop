// markdown: Markdown to HTML for the converter card (skills/util.js, kind 'mdmaker'). The common Markdown that people write:
// # to ###### headings (h1 to h6, as written), paragraphs, line breaks (two spaces or a backslash at the end), **bold**, *italic*,
// ~~struck~~, `code`, ``` and ~~~ code blocks, > quotes, - * + and 1. lists (nested by indent), --- rules, [links](url "title"),
// ![images](url) and <https://autolinks>. Not covered: tables, footnotes, reference links, raw HTML (it is shown as text).
// Every text is escaped, and a link or image keeps its address only when it is http, https, mailto or a relative path, so the
// HTML is safe to show. Pure: no DOM. (lib/md.js is the lighter reader that shows a model's answer on a card; this is the tool.)
// tools/diff-md-tools.test.mjs tests it.

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ESC[c]);

/** an address kept for href or src: http(s), mailto, or relative ("/x", "#x", "./x", "x.html"); anything with another scheme is null. Pure. */
export function safeUrl(u) {
  const s = String(u || '').trim().replace(/^<(.*)>$/, '$1');
  if (!s || /[\u0000-\u001f\s]/.test(s)) return null;
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(s);
  if (scheme && !/^(?:https?|mailto)$/i.test(scheme[1])) return null;
  return s;
}

// **bold**, __bold__, *italic*, _italic_ and ~~struck~~ in text that is already escaped
const emph = (h) => h
  .replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[^_\w])__(?=\S)([\s\S]*?\S)__(?![_\w])/g, '$1<strong>$2</strong>')
  .replace(/(^|[^*\w])\*(?=\S)([^*]*?\S)\*(?!\*)/g, '$1<em>$2</em>')
  .replace(/(^|[^_\w])_(?=\S)([^_]*?\S)_(?![_\w])/g, '$1<em>$2</em>')
  .replace(/~~(?=\S)([\s\S]*?\S)~~/g, '<del>$1</del>');

/** one line of inline Markdown to HTML. Pure. */
export function mdInlineHtml(text) {
  const keep = [];
  const hold = (html) => '\u0000' + (keep.push(html) - 1) + '\u0000';
  let s = String(text).replace(/\u0000/g, '')
    // code spans first: nothing inside them is Markdown
    .replace(/(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/g, (_, __, c) => hold('<code>' + esc(c.replace(/^ (.*) $/, '$1')) + '</code>'))
    // a backslash before a punctuation mark keeps the mark as text
    .replace(/\\([\\`*_{}[\]()#+\-.!~|>])/g, (_, c) => hold(esc(c)))
    .replace(/<((?:https?:\/\/|mailto:)[^\s<>]+)>/gi, (_, u) => hold('<a href="' + esc(u) + '">' + esc(u) + '</a>'))
    .replace(/!\[([^\]]*)\]\(\s*(<[^>]*>|(?:[^\s()]|\([^\s()]*\))+)(?:\s+"([^"]*)")?\s*\)/g, (all, alt, u, title) => {
      const url = safeUrl(u); return url ? hold('<img src="' + esc(url) + '" alt="' + esc(alt) + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>') : hold(esc(alt));
    })
    .replace(/\[([^\]]+)\]\(\s*(<[^>]*>|(?:[^\s()]|\([^\s()]*\))+)(?:\s+"([^"]*)")?\s*\)/g, (all, label, u, title) => {
      const url = safeUrl(u), inner = emph(esc(label));
      return hold(url ? '<a href="' + esc(url) + '"' + (title ? ' title="' + esc(title) + '"' : '') + '>' + inner + '</a>' : inner);
    });
  s = emph(esc(s));
  // a held piece can hold another (a code span inside a link's words), so put them back until none is left
  for (let k = 0; k < 4 && s.includes('\u0000'); k++) s = s.replace(/\u0000(\d+)\u0000/g, (_, n) => keep[+n]);
  return s;
}

const indentOf = (line) => { let n = 0; for (const c of line) { if (c === ' ') n++; else if (c === '\t') n += 4; else break; } return n; };
const LIST = /^( {0,3})([-*+]|\d{1,9}[.)])( +|$)/;

/** a Markdown text to HTML, one block per line of output. Pure. */
export function mdToHtml(text) {
  const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');
  const out = [];
  let i = 0;
  const para = [];
  const flush = () => {
    if (!para.length) return;
    const body = para.map((l, k) => {
      const last = k === para.length - 1, br = !last && (/ {2,}$/.test(l) || /\\$/.test(l));
      return mdInlineHtml(br ? l.replace(/(?: {2,}|\\)$/, '') : l.trim()) + (br ? '<br>' : '');
    }).join('\n');
    out.push('<p>' + body + '</p>'); para.length = 0;
  };
  while (i < lines.length) {
    const raw = lines[i], l = raw.trim();
    let m;
    if (!l) { flush(); i++; continue; }
    // a code block: ``` or ~~~ up to the same fence (or the end)
    if ((m = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)/.exec(raw))) {
      flush(); const fence = m[1], lang = m[2], code = []; i++;
      while (i < lines.length && !new RegExp('^ {0,3}' + fence[0] + '{' + fence.length + ',}\\s*$').test(lines[i])) code.push(lines[i++]); // void-review: ok (the fence character is ` or ~, never typed text)
      i++; out.push('<pre><code' + (lang ? ' class="language-' + esc(lang) + '"' : '') + '>' + esc(code.join('\n')) + (code.length ? '\n' : '') + '</code></pre>'); continue;
    }
    if ((m = /^ {0,3}(#{1,6})(?:\s+(.*?))?(?:\s+#+)?\s*$/.exec(raw))) { flush(); const n = m[1].length; out.push('<h' + n + '>' + mdInlineHtml(m[2] || '') + '</h' + n + '>'); i++; continue; }
    // a setext heading: a paragraph line underlined with === or ---
    if (para.length === 1 && /^ {0,3}(?:=+|-+)\s*$/.test(raw)) { const n = raw.trim()[0] === '=' ? 1 : 2; out.push('<h' + n + '>' + mdInlineHtml(para[0].trim()) + '</h' + n + '>'); para.length = 0; i++; continue; }
    if (/^ {0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(raw)) { flush(); out.push('<hr>'); i++; continue; }
    if (/^ {0,3}>/.test(raw)) {
      flush(); const q = [];
      while (i < lines.length && lines[i].trim() && (/^ {0,3}>/.test(lines[i]) || q.length)) { q.push(lines[i].replace(/^ {0,3}> ?/, '')); i++; }
      out.push('<blockquote>\n' + mdToHtml(q.join('\n')) + '\n</blockquote>'); continue;
    }
    if ((m = LIST.exec(raw)) && !(para.length && /^\d/.test(m[2]) && +m[2].slice(0, -1) !== 1)) {
      flush();
      const ordered = /^\d/.test(m[2]), kind = ordered ? 'ol' : 'ul', start = ordered ? parseInt(m[2], 10) : 1, items = [];
      let loose = false;
      while (i < lines.length) {
        const mm = LIST.exec(lines[i]);
        if (!mm || /^\d/.test(mm[2]) !== ordered) break;
        const pad = mm[1].length + mm[2].length + Math.min(mm[3].length || 1, 4), body = [lines[i].slice(pad)]; i++;
        // the item's own lines: indented under it, or a lazy line straight after it; a blank line ends it unless an indented line follows
        while (i < lines.length) {
          const nx = lines[i];
          if (!nx.trim()) { if (i + 1 < lines.length && indentOf(lines[i + 1]) >= pad && lines[i + 1].trim()) { body.push(''); i++; loose = true; continue; } break; }
          if (indentOf(nx) >= pad) { body.push(nx.slice(pad)); i++; continue; }
          if (LIST.exec(nx) || /^ {0,3}(?:#|>|`{3}|~{3})/.test(nx)) break;
          body.push(nx.trim()); i++;
        }
        items.push(body);
        if (i < lines.length && !lines[i].trim() && i + 1 < lines.length && LIST.exec(lines[i + 1]) && /^\d/.test(LIST.exec(lines[i + 1])[2]) === ordered) { loose = true; i++; }
      }
      const li = items.map((body) => {
        const inner = mdToHtml(body.join('\n'));
        return '<li>' + (loose ? inner : inner.replace(/^<p>([\s\S]*?)<\/p>/, '$1')) + '</li>';
      });
      out.push('<' + kind + (start !== 1 ? ' start="' + start + '"' : '') + '>\n' + li.join('\n') + '\n</' + kind + '>');
      continue;
    }
    para.push(raw); i++;
  }
  flush();
  return out.join('\n');
}
